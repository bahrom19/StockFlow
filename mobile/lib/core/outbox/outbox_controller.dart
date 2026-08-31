import 'dart:async' show unawaited;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'outbox_operation.dart';
import 'outbox_storage.dart';

/// Immutable snapshot of the outbox for UI and the sync worker.
class OutboxState {
  const OutboxState({this.operations = const <OutboxOperation>[]});

  /// FIFO-ordered queue.
  final List<OutboxOperation> operations;

  int get pendingCount =>
      operations.where((o) => o.status == OutboxStatus.pending).length;

  int get failedCount =>
      operations.where((o) => o.status == OutboxStatus.failedPermanent).length;

  int get sendingCount =>
      operations.where((o) => o.status == OutboxStatus.sending).length;

  bool get isEmpty => operations.isEmpty;
  bool get isNotEmpty => operations.isNotEmpty;
}

/// In-memory owner of the outbox queue.
///
/// Responsibilities:
/// * enqueue with clientOperationId dedupe (re-enqueue == no-op);
/// * keep FIFO order and persist on every mutation;
/// * apply the retry backoff policy (30s * 2^n, capped) and the F5-B finite
///   retry budget — a retryable chain longer than [OutboxController
///   .maxRetryAttempts] attempts ends in FAILED_PERMANENT;
/// * expose counts for the compact UI indicator;
/// * wipe the queue on logout.
class OutboxController extends StateNotifier<OutboxState> {
  OutboxController(this._storage, {DateTime Function()? now})
      : _now = now ?? DateTime.now,
        super(const OutboxState());

  static const Duration _baseBackoff = Duration(seconds: 30);
  static const Duration _maxBackoff = Duration(minutes: 15);

  /// F5-B: the finite automatic retry budget per operation. The 12th
  /// retryable failure (≈2h of wall-clock under the existing backoff:
  /// 30s + 60s + 120s + 240s + 480s, then 15-minute steps) demotes the op to
  /// FAILED_PERMANENT instead of retrying forever, so it surfaces in the
  /// existing failed UI for an explicit Retry or Discard. This is a budget
  /// policy ONLY — the sync worker's error classification (what is
  /// retryable vs permanent) is intentionally untouched.
  static const int maxRetryAttempts = 12;

  final OutboxStorage _storage;
  final DateTime Function() _now;

  /// Read-only snapshot for the sync worker and UI — the protected
  /// [state] member must not be reached from outside this class.
  OutboxState get snapshot => state;

  Future<void> _guard = Future<void>.value();
  bool _hydrated = false;

  /// Serialises mutations so concurrent enqueues keep FIFO order.
  Future<T> _serialize<T>(Future<T> Function() task) {
    final run = _guard.then((_) => task());
    _guard = run.then<void>((_) {}, onError: (Object _) {});
    return run;
  }

  /// Loads persisted ops once (restart persistence). SENDING → PENDING
  /// normalisation already happened inside [OutboxStorage.load].
  Future<void> hydrate() => _serialize(_hydrateLocked);

  /// Inner hydrate WITHOUT re-entering [_serialize] — must only be called
  /// while already holding the serialisation lock (e.g. from [enqueue]).
  Future<void> _hydrateLocked() async {
    if (_hydrated) return;
    final ops = await _storage.load();
    _hydrated = true;
    state = OutboxState(operations: _sorted(ops));
  }

  /// Appends a new operation. Returns false when an op with the same
  /// [op.clientOperationId] is already queued — duplicate enqueue is a no-op.
  Future<bool> enqueue(OutboxOperation op) {
    return _serialize(() async {
      await _hydrateLocked();
      if (state.operations
          .any((o) => o.clientOperationId == op.clientOperationId)) {
        return false;
      }
      final withDefaults = op.copyWith(createdAt: op.createdAt ?? _now());
      final ops = [...state.operations, withDefaults];
      state = OutboxState(operations: _sorted(ops));
      await _storage.save(state.operations);
      return true;
    });
  }

  /// Marks the op as being sent right now.
  Future<void> markSending(String clientOperationId) =>
      _mutate(clientOperationId,
          (o) => o.copyWith(status: OutboxStatus.sending));

  /// Retryable failure: back to PENDING with exponential backoff — until the
  /// F5-B budget is exhausted. When the NEXT attempt would reach
  /// [maxRetryAttempts], the endless retryable chain ends: the op is demoted
  /// to FAILED_PERMANENT (lastError kept for the failed UI, nextAttemptAt
  /// cleared so it is never auto-dispatched again). A manual [retryFailed]
  /// grants a fresh full budget.
  Future<void> markRetryableFailure(
    String clientOperationId,
    String reason,
  ) {
    return _mutate(clientOperationId, (o) {
      final attempts = o.attempts + 1;
      // F5-B cap. `>=` (not `==`) also ends the chain for ops restored from a
      // pre-F5-B build already at (or beyond) the budget on their next
      // failure. The demotion itself is NOT a classification change — the
      // sync worker still counts it as a retryable outcome.
      if (attempts >= maxRetryAttempts) {
        return _withRetryStateReset(
          o,
          status: OutboxStatus.failedPermanent,
          attempts: attempts,
          nextAttemptAt: null,
          lastError: reason,
        );
      }
      final backoff = _baseBackoff * (1 << (attempts - 1).clamp(0, 5));
      final capped = backoff > _maxBackoff ? _maxBackoff : backoff;
      return o.copyWith(
        status: OutboxStatus.pending,
        attempts: attempts,
        nextAttemptAt: _now().add(capped),
        lastError: reason,
      );
    });
  }

  /// Permanent failure: stays in the queue until the user Retries or Discards.
  Future<void> markPermanentFailure(
    String clientOperationId,
    String reason,
  ) {
    return _mutate(
      clientOperationId,
      (o) => o.copyWith(
        status: OutboxStatus.failedPermanent,
        nextAttemptAt: null,
        lastError: reason,
      ),
    );
  }

  /// User-triggered retry of a FAILED_PERMANENT op (F5-B: grants a FULL new
  /// budget — attempts reset to 0, the op becomes due immediately and the
  /// next retryable failure restarts the backoff from the first step).
  Future<void> retryFailed(String clientOperationId) {
    return _mutate(
      clientOperationId,
      (o) => _withRetryStateReset(
        o,
        status: OutboxStatus.pending,
        attempts: 0,
        nextAttemptAt: null,
        lastError: null,
      ),
    );
  }

  /// Rebuilds [o] for a retry-state transition that must CLEAR
  /// [OutboxOperation.nextAttemptAt]. [OutboxOperation.copyWith] cannot null
  /// it (`??` keeps the previous value), so the cap demotion and the
  /// manual-retry reset construct the entry explicitly. Immutable identity
  /// fields — clientOperationId, kind, payload, idempotencyKey, createdAt,
  /// schemaVersion — are carried over verbatim: the idempotency key in
  /// particular can never be minted or altered by a retry (F4 invariant).
  static OutboxOperation _withRetryStateReset(
    OutboxOperation o, {
    required OutboxStatus status,
    required int attempts,
    required DateTime? nextAttemptAt,
    required String? lastError,
  }) {
    return OutboxOperation(
      clientOperationId: o.clientOperationId,
      kind: o.kind,
      companyId: o.companyId,
      userId: o.userId,
      payload: o.payload,
      idempotencyKey: o.idempotencyKey,
      status: status,
      attempts: attempts,
      nextAttemptAt: nextAttemptAt,
      createdAt: o.createdAt,
      lastError: lastError,
      schemaVersion: o.schemaVersion,
    );
  }

  /// Confirmed application (2xx or recognized duplicate) → remove from queue.
  /// Removal happens ONLY here, after the confirmation.
  Future<void> confirmSent(String clientOperationId) {
    return _serialize(() async {
      final ops = state.operations
          .where((o) => o.clientOperationId != clientOperationId)
          .toList();
      state = OutboxState(operations: ops);
      await _storage.save(ops);
    });
  }

  /// User-triggered discard of a FAILED_PERMANENT op.
  Future<void> discard(String clientOperationId) =>
      confirmSent(clientOperationId);

  /// Logout: wipe everything (both memory and persistence).
  Future<void> clearForLogout() {
    return _serialize(() async {
      state = const OutboxState();
      await _storage.clear();
    });
  }

  Future<void> _mutate(
    String clientOperationId,
    OutboxOperation Function(OutboxOperation) transform,
  ) {
    return _serialize(() async {
      final ops = state.operations.map((o) {
        return o.clientOperationId == clientOperationId ? transform(o) : o;
      }).toList();
      state = OutboxState(operations: ops);
      await _storage.save(ops);
    });
  }

  List<OutboxOperation> _sorted(List<OutboxOperation> ops) {
    final copy = [...ops];
    copy.sort((a, b) {
      final at = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bt = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final cmp = at.compareTo(bt);
      return cmp != 0 ? cmp : a.clientOperationId.compareTo(b.clientOperationId);
    });
    return copy;
  }
}

/// Wiring: builds the controller from the warmed [OutboxStorage] injected in
/// main.dart. Tests override this provider directly with an in-memory setup.
final outboxControllerProvider =
    StateNotifierProvider<OutboxController, OutboxState>((ref) {
  return OutboxController(ref.watch(outboxStorageProvider));
});

/// Fires once per controller lifetime: hydrates the persisted queue
/// (restart survival — ops enqueued while OFFLINE must surface after the app
/// is killed and relaunched). Watched by the outbox indicator, so the badge
/// reflects the restored queue on cold start without any user interaction.
final outboxInitProvider = Provider<void>((ref) {
  unawaited(ref.watch(outboxControllerProvider.notifier).hydrate());
});
