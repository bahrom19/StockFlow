import 'package:stockflow/core/api/api_endpoints.dart';

import 'outbox_operation.dart';

/// Per-kind routing table for the outbox sync worker (Phase F3).
///
/// The worker itself never hardcodes an endpoint: every queued op is
/// dispatched through the [OutboxOperationSpec] registered for its
/// [OutboxOperationKind]. F3 registers exactly one kind — CREATE_SALE — and
/// F4 will register the follow-up kinds (cash-in/out, adjust, transfer,
/// goods-receipt) here without touching the worker again.

/// Contract of an optional chained follow-up executed after the primary
/// request of an operation was accepted (2xx). A follow-up is best-effort:
/// its failure must never prevent the op from being confirmed and removed —
/// it reports through [OutboxFollowUpContext.warn] instead of throwing.
typedef OutboxChainedFollowUp = Future<void> Function(
  OutboxFollowUpContext context,
);

/// Everything a chained follow-up may need. Deliberately dependency-free
/// (no Dio/logger types) so specs stay unit-testable with plain closures.
class OutboxFollowUpContext {
  const OutboxFollowUpContext({
    required this.responseData,
    required this.post,
    required this.warn,
  });

  /// Decoded 2xx response body of the primary request.
  final dynamic responseData;

  /// The same POST channel the worker uses (wired to the ApiClient).
  final Future<dynamic> Function(String path, {Object? data}) post;

  /// Non-fatal diagnostics channel (logger.warning in production).
  final void Function(String message) warn;
}

/// Static description of HOW one [OutboxOperationKind] is dispatched.
class OutboxOperationSpec {
  const OutboxOperationSpec({
    required this.kind,
    required this.endpoint,
    this.chainedFollowUp,
  });

  final OutboxOperationKind kind;

  /// API path the payload is POSTed to verbatim (e.g. [ApiEndpoints.sales]).
  final String endpoint;

  /// Optional post-success follow-up (CREATE_SALE: complete a DRAFT sale).
  final OutboxChainedFollowUp? chainedFollowUp;
}

/// CREATE_SALE spec: POST /sales, then — only when the backend answered that
/// the sale was created as DRAFT — best-effort complete it in the same
/// burst. The create is deduped server-side by the client-generated unique
/// `saleNumber` (409 P2002 → already applied); no Idempotency-Key header
/// exists for this kind.
const OutboxOperationSpec createSaleSpec = OutboxOperationSpec(
  kind: OutboxOperationKind.createSale,
  endpoint: ApiEndpoints.sales,
  chainedFollowUp: _completeChainedIfDraft,
);

/// CREATE_SALE-specific chained follow-up (formerly `_completeChainedIfDraft`
/// inside the sync worker; moved here so the worker stays kind-agnostic).
///
/// The backend creates sales as DRAFT; the online POS flow immediately
/// completes them with a second request. The queue carries only the create,
/// so once the create is confirmed we best-effort complete the sale within
/// the same burst. If the complete fails (network drops again), the sale
/// stays DRAFT — visible in the Sales list and completable manually. It
/// must NEVER block removing the create from the queue: the sale id needed
/// for the complete call exists only in this response and is not persisted.
Future<void> _completeChainedIfDraft(OutboxFollowUpContext context) async {
  final data = context.responseData;
  if (data is! Map) return;
  final id = data['id'];
  if (id is! String || id.isEmpty) return;
  if (data['status'] != 'DRAFT') return;
  try {
    await context.post('/sales/$id/complete');
  } catch (e) {
    context.warn(
      'Chained complete failed for sale $id — sale stays DRAFT: $e',
    );
  }
}

/// Registry: kind → dispatch spec.
///
/// Invariant: every [OutboxOperationKind] value must have a registered spec.
/// A lookup that returns null means the kind is NOT dispatchable — the sync
/// worker skips such ops instead of guessing an endpoint. The
/// `registry covers every kind` test guards this invariant.
class OutboxOperationRegistry {
  const OutboxOperationRegistry._();

  static const Map<OutboxOperationKind, OutboxOperationSpec> specs = {
    OutboxOperationKind.createSale: createSaleSpec,
  };

  /// The dispatch plan for [kind], or null when the kind has no registered
  /// spec yet (must never be sent anywhere).
  static OutboxOperationSpec? specFor(OutboxOperationKind kind) =>
      specs[kind];
}