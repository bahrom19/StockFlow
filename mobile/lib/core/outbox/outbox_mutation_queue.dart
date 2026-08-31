import 'package:dio/dio.dart' show Options;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';

/// Phase F4-D: the ONLY place the backend Idempotency-Key header is composed
/// for the direct (online) mutation calls. A `null` key → no header at all —
/// CREATE_SALE (key-less by contract) must never carry one.
Options? idempotencyHeader(String? idempotencyKey) => idempotencyKey == null
    ? null
    : Options(headers: {'Idempotency-Key': idempotencyKey});

/// Outcome of [OutboxMutationQueue.mutate].
sealed class OutboxMutationOutcome<T> {
  const OutboxMutationOutcome();
}

/// The mutation was applied online: [result] is whatever the repository's
/// own send closure returned (the caller keeps its existing result mapping).
final class OutboxMutationSent<T> extends OutboxMutationOutcome<T> {
  const OutboxMutationSent(this.result);

  final T result;
}

/// The payload was parked in the outbox under [clientOperationId], which IS
/// the persisted Idempotency-Key — every retry replays the exact same key, so
/// the backend guarantees at-most-once. Happens when the device was OFFLINE
/// (F4-D) and, since Phase F5-A, when an ONLINE attempt failed with a
/// transport-level failure (timeout / network / connection error) as
/// classified by the caller-supplied predicate of
/// [OutboxMutationQueue.mutate].
final class OutboxMutationQueued<T> extends OutboxMutationOutcome<T> {
  const OutboxMutationQueued(this.clientOperationId);

  final String clientOperationId;
}

/// The mutation could not be parked (no authenticated user → nothing may be
/// stamped with a company/user scope). The caller surfaces its existing
/// generic error channel — no new l10n keys (decision D3).
final class OutboxMutationRejected<T> extends OutboxMutationOutcome<T> {
  const OutboxMutationRejected(this.reason);

  final String reason;
}

/// Generic send-or-park helper for the five F4 keyed mutations
/// (cashIn, cashOut, adjustStock, transferStock, goodsReceipt).
///
/// * ONLINE → the repository closure is invoked with a freshly minted
///   idempotency key (transported as the `Idempotency-Key` header); the
///   outbox stays untouched unless the attempt fails with a transport-level
///   failure — see [mutate] (Phase F5-A fallback).
/// * OFFLINE → the payload is persisted in the outbox with
///   `idempotencyKey == clientOperationId`, generated exactly once here and
///   never re-minted by the sync worker (F3 copyWith contract).
///
/// Connectivity itself is NOT read here: call sites pass the single
/// [connectivityStatusProvider] value, keeping this class pure and
/// deterministically testable.
class OutboxMutationQueue {
  OutboxMutationQueue({
    required OutboxController controller,
    required CurrentUser? Function() currentUser,
  })  : _controller = controller,
        _currentUser = currentUser;

  final OutboxController _controller;
  final CurrentUser? Function() _currentUser;

  /// Generic offline feedback (decision D3: existing error channels, no new
  /// l10n keys — localized wording is deferred to a later phase).
  static const String offlineQueuedMessage =
      'No internet connection. Your changes were saved offline and will sync '
      'automatically.';

  /// Online → [sendOnline]; offline → enqueue. See the class docs.
  ///
  /// Phase F5-A fallback: when [online] is true and the attempt made through
  /// [sendOnline] comes back classified as a transport-level failure by
  /// [isNetworkFailure] (timeout / network / connection error — the caller
  /// reuses the existing `ErrorHandler` → `NetworkFailure` mapping, so no
  /// parallel classification lives here), the SAME payload is parked in the
  /// outbox under the SAME key the failed attempt already transported — never
  /// a freshly minted UUID. The next outbox flush therefore replays
  /// `Idempotency-Key: <original key>` and the backend idempotency guard
  /// makes the replay at-most-once. Business failures (400/404/409/422 …)
  /// are NOT parked: they surface through [OutboxMutationSent] exactly as
  /// before and stay the caller's concern.
  Future<OutboxMutationOutcome<T>> mutate<T>({
    required OutboxOperationKind kind,
    required Map<String, dynamic> payload,
    required bool online,
    Future<T> Function(String idempotencyKey)? sendOnline,
    String? clientOperationId,

    /// F5-A: true when [sendOnline]'s result represents a transport-level
    /// failure (timeout / network / connection error). Null (the default)
    /// disables the fallback — an online failure keeps surfacing through
    /// [OutboxMutationSent] as it did in F4-D.
    bool Function(T result)? isNetworkFailure,
  }) async {
    if (online) {
      if (sendOnline == null) {
        throw ArgumentError.value(sendOnline, 'sendOnline',
            'required when mutate() is called online');
      }
      final key = clientOperationId ?? OutboxOperation.idGenerator();
      final result = await sendOnline(key);
      if (isNetworkFailure != null && isNetworkFailure(result)) {
        return _fallbackToOutbox<T>(kind: kind, payload: payload, key: key);
      }
      return OutboxMutationSent<T>(result);
    }
    try {
      final id = await enqueueOffline(
        kind: kind,
        payload: payload,
        clientOperationId: clientOperationId,
      );
      return OutboxMutationQueued<T>(id);
    } on StateError catch (e) {
      return OutboxMutationRejected<T>(e.message);
    }
  }

  /// F5-A: parks an ONLINE attempt that failed with a transport-level
  /// failure. [key] is the EXACT idempotency key the failed attempt already
  /// carried: [enqueueOffline] persists it verbatim as both
  /// clientOperationId and idempotencyKey (`idempotencyKey ==
  /// clientOperationId`), so no new UUID is minted on the fallback path and
  /// the controller-level dedupe keeps a repeated fallback for the same key
  /// a no-op. A [StateError] (no authenticated user) degrades to
  /// [OutboxMutationRejected] — the same generic channel the offline path
  /// uses (decision D3).
  Future<OutboxMutationOutcome<T>> _fallbackToOutbox<T>({
    required OutboxOperationKind kind,
    required Map<String, dynamic> payload,
    required String key,
  }) async {
    try {
      final id = await enqueueOffline(
        kind: kind,
        payload: payload,
        // F5-A invariant: EXACTLY the key of the failed online attempt —
        // never a freshly generated one.
        clientOperationId: key,
      );
      return OutboxMutationQueued<T>(id);
    } on StateError catch (e) {
      return OutboxMutationRejected<T>(e.message);
    }
  }

  /// Offline-only path. Throws [StateError] when there is no authenticated
  /// user — the same generic semantics as the legacy offline sale queue.
  ///
  /// Duplicate safety: re-enqueueing the same [clientOperationId] is a
  /// controller-level no-op (the first entry wins).
  Future<String> enqueueOffline({
    required OutboxOperationKind kind,
    required Map<String, dynamic> payload,
    String? clientOperationId,
  }) async {
    final user = _currentUser();
    if (user == null) {
      throw StateError(
        'Cannot queue a mutation without an authenticated user',
      );
    }
    final opId = clientOperationId ?? OutboxOperation.idGenerator();
    final op = OutboxOperation(
      clientOperationId: opId,
      kind: kind,
      companyId: user.companyId,
      userId: user.id,
      payload: payload,
      // F4 contract: the Idempotency-Key IS the clientOperationId — minted
      // once here, persisted, and never regenerated on retry.
      idempotencyKey: opId,
      createdAt: DateTime.now(),
    );
    await _controller.enqueue(op);
    return opId;
  }
}

/// UI-facing entry point: features resolve this provider instead of touching
/// controller internals directly.
final outboxMutationQueueProvider = Provider<OutboxMutationQueue>((ref) {
  return OutboxMutationQueue(
    controller: ref.watch(outboxControllerProvider.notifier),
    currentUser: () => ref.read(currentUserProvider),
  );
});