import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/core/services/connectivity_service.dart';

import 'outbox_controller.dart';
import 'outbox_operation.dart';
import 'outbox_operation_spec.dart';

/// What a single [OutboxSyncService.syncAll] pass accomplished.
class OutboxSyncResult {
  const OutboxSyncResult({
    this.sent = 0,
    this.duplicates = 0,
    this.failedPermanent = 0,
    this.retried = 0,
    this.skipped = 0,
  });

  /// Ops the server accepted (2xx).
  final int sent;

  /// Ops recognized as already applied (409 on our client saleNumber —
  /// Prisma P2002): confirmed, never sent twice.
  final int duplicates;

  /// Ops moved to FAILED_PERMANENT (unexpected 4xx) — visible in the UI with
  /// Retry / Discard actions.
  final int failedPermanent;

  /// Ops kept PENDING after a retryable failure (network, timeout, 5xx,
  /// 408, 429, 401) with exponential backoff.
  final int retried;

  /// Ops left untouched (offline, no user, foreign scope, not due yet, or a
  /// kind with no registered dispatch spec).
  final int skipped;

  /// Ops whose state changed during the pass.
  int get processed => sent + duplicates + failedPermanent + retried;
}


/// FIFO sync worker for the offline outbox.
///
/// Dispatch is spec-driven (Phase F3/F4-B): every due op is routed through
/// the [OutboxOperationSpec] found for its kind in the injected dispatch
/// table (defaults to [OutboxOperationRegistry.specs]) — the worker itself
/// never hardcodes an endpoint. A kind without a registered spec is NOT
/// dispatchable and is skipped untouched.
///
/// Safety contract:
/// * An entry is removed ONLY after server confirmation (2xx) or a
///   recognized duplicate. The client-generated `saleNumber` makes any
///   replay detectable server-side (unique constraint → 409 P2002), so a
///   crash between "request sent" and "entry removed" can never double-create
///   a sale — the retry resolves as a duplicate and the entry is confirmed.
/// * Retryable failures (network, timeout, 5xx, 408, 429, 401 — and any
///   non-duplicate 409 for an op carrying an idempotencyKey, i.e. an
///   in-flight idempotency conflict) keep the op PENDING;
///   [OutboxController] applies the exponential backoff.
/// * Any other 4xx → FAILED_PERMANENT, surfaced with Retry / Discard.
/// * Scope guard: an op is flushed only while the SAME user (company + user)
///   is authenticated — user A's offline sale can never be sent under user B.
/// * Re-entrancy guard: overlapping triggers (OFFLINE→ONLINE, app resume)
///   collapse into one burst.
class OutboxSyncService {
  OutboxSyncService({
    required OutboxController controller,
    required Future<dynamic> Function(
      String path, {
      Object? data,
      Map<String, dynamic>? query,
      Map<String, String>? headers,
    }) post,
    required CurrentUser? Function() currentUser,
    required bool Function() isOnline,
    Map<OutboxOperationKind, OutboxOperationSpec> specs =
        OutboxOperationRegistry.specs,
    AppLogger? logger,
  })  : _controller = controller,
        _post = post,
        _currentUser = currentUser,
        _isOnline = isOnline,
        _specs = specs,
        _logger = logger ?? AppLogger('OutboxSync');

  final OutboxController _controller;
  final Future<dynamic> Function(
    String path, {
    Object? data,
    Map<String, dynamic>? query,
    Map<String, String>? headers,
  }) _post;
  final CurrentUser? Function() _currentUser;
  final bool Function() _isOnline;
  final AppLogger _logger;

  /// Dispatch table for this worker. Defaults to the production
  /// [OutboxOperationRegistry.specs]; tests inject partial maps so the
  /// spec-less guard below stays deterministically reachable even though
  /// the production registry covers every kind.
  final Map<OutboxOperationKind, OutboxOperationSpec> _specs;

  bool _inFlight = false;

  /// Processes the due queue, FIFO. Safe to call concurrently — a second
  /// overlapping call is a no-op (the running pass covers the whole queue).
  Future<OutboxSyncResult> syncAll() async {
    if (_inFlight) return const OutboxSyncResult();
    _inFlight = true;
    try {
      return await _syncAllGuarded();
    } finally {
      _inFlight = false;
    }
  }

  Future<OutboxSyncResult> _syncAllGuarded() async {
    // Never flush while OFFLINE and never without an authenticated user —
    // the scope guard would skip everything anyway.
    if (!_isOnline()) return const OutboxSyncResult();
    final user = _currentUser();
    if (user == null) return const OutboxSyncResult();

    var sent = 0;
    var duplicates = 0;
    var failedPermanent = 0;
    var retried = 0;
    var skipped = 0;

    // Snapshot before the loop: ids/scopes/payloads are immutable; statuses
    // are mutated only through the controller's serialized guard.
    final snapshot = _controller.snapshot.operations;
    for (final op in snapshot) {
      final inScope = op.companyId == user.companyId && op.userId == user.id;
      if (op.status != OutboxStatus.pending ||
          !inScope ||
          !op.isDue(DateTime.now())) {
        skipped++;
        continue;
      }

      // Dispatch plan for this kind. A kind without a registered spec is
      // NOT dispatchable: it is skipped untouched instead of being sent to
      // a guessed endpoint. (A persisted unknown kind never even reaches
      // this loop — OutboxStorage drops it at load time.)
      final spec = _specs[op.kind];
      if (spec == null) {
        _logger.warning(
          'No outbox spec for kind ${op.kind.name} — op '
          '${op.clientOperationId} skipped, never dispatched',
        );
        skipped++;
        continue;
      }

      // PENDING → sending (persisted; a crash here recovers as
      // sending → PENDING on the next hydrate).
      await _controller.markSending(op.clientOperationId);

      try {
        // Query parameters (F4-B: the cash kinds' query-only `warehouseId`)
        // ride in the query string exactly like the online repositories send
        // them; the body drops the envelope-only fields via [spec.bodyFor]
        // so the backend's forbidNonWhitelisted ValidationPipe accepts it.
        final response = await _post(
          spec.endpoint,
          data: spec.bodyFor(op.payload),
          query: spec.buildQuery?.call(op.payload),
          // F4-C transport: a keyed op carries its immutable idempotencyKey
          // as the backend's Idempotency-Key header on EVERY attempt — the
          // same value minted once at enqueue time, which retries can never
          // change (copyWith does not expose the key). CREATE_SALE has no
          // key and must never send the header.
          headers: op.idempotencyKey == null
              ? null
              : {'Idempotency-Key': op.idempotencyKey!},
        );
        final followUp = spec.chainedFollowUp;
        if (followUp != null) {
          await followUp(
            OutboxFollowUpContext(
              responseData: response,
              post: _post,
              warn: _logger.warning,
            ),
          );
        }
        await _controller.confirmSent(op.clientOperationId);
        sent++;
      } on DioException catch (e) {
        final message = _responseMessage(e.response);
        switch (_classify(e, op)) {
          case _Outcome.confirm:
            await _controller.confirmSent(op.clientOperationId);
            duplicates++;
          case _Outcome.retryable:
            await _controller.markRetryableFailure(
              op.clientOperationId,
              message.isNotEmpty ? message : e.type.name,
            );
            retried++;
          case _Outcome.permanent:
            await _controller.markPermanentFailure(
              op.clientOperationId,
              message.isNotEmpty
                  ? message
                  : 'HTTP ${e.response?.statusCode ?? '?'}',
            );
            failedPermanent++;
        }
      } catch (e) {
        // Unknown failure — conservative: retryable, never data loss.
        await _controller
            .markRetryableFailure(op.clientOperationId, e.toString());
        retried++;
      }
    }

    final result = OutboxSyncResult(
      sent: sent,
      duplicates: duplicates,
      failedPermanent: failedPermanent,
      retried: retried,
      skipped: skipped,
    );
    if (result.processed > 0) {
      _logger.info(
        'Outbox sync: sent=${result.sent} dup=${result.duplicates} '
        'failed=${result.failedPermanent} retried=${result.retried} '
        'skipped=${result.skipped}',
      );
    }
    return result;
  }

  /// Maps a failed send to the queue outcome.
  ///
  /// Key-aware (Phase F3): an op carrying [OutboxOperation.idempotencyKey]
  /// can always be replayed safely — the backend guarantees at-most-once
  /// application per key — so a 409 that is NOT a recognized duplicate is
  /// treated as an in-flight idempotency conflict (the backend answers 409
  /// "Request with idempotency key '…' is already being processed" while
  /// another request still holds the reservation) and stays PENDING with
  /// its key untouched. CREATE_SALE (no key) keeps the exact 1B-min
  /// classification below.
  _Outcome _classify(DioException e, OutboxOperation op) {
    final code = e.response?.statusCode;
    if (code == 409) {
      // Prisma P2002 reaches the client through the backend global exception
      // filter as HTTP 409 with "…same unique value already exists…" message.
      // A duplicate of OUR client saleNumber means "already applied".
      final message = _responseMessage(e.response).toLowerCase();
      if (message.contains('unique') || message.contains('p2002')) {
        return _Outcome.confirm;
      }
      // Keyed op: replay is safe → wait and retry with the SAME key.
      if (op.idempotencyKey != null) return _Outcome.retryable;
      // Any other conflict is not interpretable offline → user decides.
      return _Outcome.permanent;
    }
    // 401: token refresh already failed → recoverable after re-login.
    // 408/429/5xx: transient conditions.
    if (code == 401 || code == 408 || code == 429) return _Outcome.retryable;
    if (code != null && code >= 500) return _Outcome.retryable;
    if (code != null && code >= 400) return _Outcome.permanent;
    // No response at all: connection error / timeout / cancelled request.
    return _Outcome.retryable;
  }

  String _failureReason(DioException e) {
    final message = _responseMessage(e.response);
    if (message.isNotEmpty) return message;
    final code = e.response?.statusCode;
    if (code != null) return 'HTTP $code';
    return e.type.name;
  }

  String _responseMessage(Response<dynamic>? response) {
    final data = response?.data;
    if (data is Map) return '${data['message'] ?? ''}';
    if (data is String) return data;
    return '';
  }
}

/// Wires the worker to the single [ApiClient], the auth scope and the
/// connectivity signal (the ONLY online/offline source — no second mechanism).
/// All collaborators are injected so tests can stub them.
final outboxSyncProvider = Provider<OutboxSyncService>((ref) {
  return OutboxSyncService(
    controller: ref.watch(outboxControllerProvider.notifier),
    post: (path, {data, query, headers}) => ref
        .watch(apiClientProvider)
        .post<dynamic>(
          path,
          data: data,
          queryParameters: query,
          // Per-request headers merge over the Dio BaseOptions headers, so
          // Authorization/Content-Type stamped elsewhere stay intact.
          options: headers == null ? null : Options(headers: headers),
        ),
    currentUser: () => ref.read(currentUserProvider),
    isOnline: () => ref.read(connectivityStatusProvider),
  );
});
enum _Outcome { confirm, retryable, permanent }