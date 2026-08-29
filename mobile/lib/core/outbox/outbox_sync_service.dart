import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/core/services/connectivity_service.dart';

import 'outbox_controller.dart';
import 'outbox_operation.dart';

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

  /// Ops left untouched (offline, no user, foreign scope, not due yet).
  final int skipped;

  /// Ops whose state changed during the pass.
  int get processed => sent + duplicates + failedPermanent + retried;
}


/// FIFO sync worker for the offline outbox (Offline 1B-min: CREATE_SALE only).
///
/// Safety contract:
/// * An entry is removed ONLY after server confirmation (2xx) or a
///   recognized duplicate. The client-generated `saleNumber` makes any
///   replay detectable server-side (unique constraint → 409 P2002), so a
///   crash between "request sent" and "entry removed" can never double-create
///   a sale — the retry resolves as a duplicate and the entry is confirmed.
/// * Retryable failures (network, timeout, 5xx, 408, 429, 401) keep the op
///   PENDING; [OutboxController] applies the exponential backoff.
/// * Any other 4xx → FAILED_PERMANENT, surfaced with Retry / Discard.
/// * Scope guard: an op is flushed only while the SAME user (company + user)
///   is authenticated — user A's offline sale can never be sent under user B.
/// * Re-entrancy guard: overlapping triggers (OFFLINE→ONLINE, app resume)
///   collapse into one burst.
class OutboxSyncService {
  OutboxSyncService({
    required OutboxController controller,
    required Future<dynamic> Function(String path, {Object? data}) post,
    required CurrentUser? Function() currentUser,
    required bool Function() isOnline,
    AppLogger? logger,
  })  : _controller = controller,
        _post = post,
        _currentUser = currentUser,
        _isOnline = isOnline,
        _logger = logger ?? AppLogger('OutboxSync');

  final OutboxController _controller;
  final Future<dynamic> Function(String path, {Object? data}) _post;
  final CurrentUser? Function() _currentUser;
  final bool Function() _isOnline;
  final AppLogger _logger;

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

      // PENDING → sending (persisted; a crash here recovers as
      // sending → PENDING on the next hydrate).
      await _controller.markSending(op.clientOperationId);

      try {
        final response = await _post(ApiEndpoints.sales, data: op.payload);
        await _completeChainedIfDraft(response);
        await _controller.confirmSent(op.clientOperationId);
        sent++;
      } on DioException catch (e) {
        final message = _responseMessage(e.response);
        switch (_classify(e)) {
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
  _Outcome _classify(DioException e) {
    final code = e.response?.statusCode;
    if (code == 409) {
      // Prisma P2002 reaches the client through the backend global exception
      // filter as HTTP 409 with "…same unique value already exists…" message.
      // A duplicate of OUR client saleNumber means "already applied".
      final message = _responseMessage(e.response).toLowerCase();
      if (message.contains('unique') || message.contains('p2002')) {
        return _Outcome.confirm;
      }
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

  /// The backend creates sales as DRAFT; the online POS flow immediately
  /// completes them with a second request. The queue carries only the create,
  /// so once the create is confirmed we best-effort complete the sale within
  /// the same burst. If the complete fails (network drops again), the sale
  /// stays DRAFT — visible in the Sales list and completable manually. It
  /// must NEVER block removing the create from the queue: the sale id needed
  /// for the complete call exists only in this response and is not persisted.
  Future<void> _completeChainedIfDraft(dynamic data) async {
    if (data is! Map) return;
    final id = data['id'];
    if (id is! String || id.isEmpty) return;
    if (data['status'] != 'DRAFT') return;
    try {
      await _post('/sales/$id/complete');
    } catch (e) {
      _logger.warning(
        'Chained complete failed for sale $id — sale stays DRAFT: $e',
      );
    }
  }
}

/// Wires the worker to the single [ApiClient], the auth scope and the
/// connectivity signal (the ONLY online/offline source — no second mechanism).
/// All collaborators are injected so tests can stub them.
final outboxSyncProvider = Provider<OutboxSyncService>((ref) {
  return OutboxSyncService(
    controller: ref.watch(outboxControllerProvider.notifier),
    post: (path, {data}) =>
        ref.watch(apiClientProvider).post<dynamic>(path, data: data),
    currentUser: () => ref.read(currentUserProvider),
    isOnline: () => ref.read(connectivityStatusProvider),
  );
});
enum _Outcome { confirm, retryable, permanent }