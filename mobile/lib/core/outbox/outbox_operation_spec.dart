import 'package:stockflow/core/api/api_endpoints.dart';

import 'outbox_operation.dart';

/// Per-kind routing table for the outbox sync worker (Phase F3 / F4-B).
///
/// The worker itself never hardcodes an endpoint: every queued op is
/// dispatched through the [OutboxOperationSpec] registered for its
/// [OutboxOperationKind]. F3 registered CREATE_SALE; F4-B registers the five
/// keyed mutation kinds (cash-in/out, adjust, transfer, goods-receipt) —
/// their replay safety comes from the backend Idempotency-Key (transport
/// wiring lands in F4-C), so every spec except CREATE_SALE's describes a
/// keyed operation.

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

/// Optional query parameters derived from the persisted payload. Must be a
/// PURE function: it may read the payload but never mutate it; the returned
/// map (if any) is passed to the transport as the request's query parameters.
typedef OutboxQueryResolver = Map<String, dynamic>? Function(
  Map<String, dynamic> payload,
);

/// Static description of HOW one [OutboxOperationKind] is dispatched.
class OutboxOperationSpec {
  const OutboxOperationSpec({
    required this.kind,
    required this.endpoint,
    this.buildQuery,
    this.chainedFollowUp,
  });

  final OutboxOperationKind kind;

  /// API path the payload is POSTed to verbatim (e.g. [ApiEndpoints.sales]).
  final String endpoint;

  /// Query parameters extracted from the persisted payload (F4-B). Null (the
  /// default) means the endpoint takes no query parameters. Only the cash
  /// kinds need this: the backend reads `warehouseId` from the query string,
  /// so the queued payload carries it as an envelope field and [buildQuery]
  /// lifts it into the query without touching the business fields.
  final OutboxQueryResolver? buildQuery;

  /// Optional post-success follow-up (CREATE_SALE: complete a DRAFT sale).
  final OutboxChainedFollowUp? chainedFollowUp;

  /// JSON body the sync worker must POST for [payload] (F4-B).
  ///
  /// Fields lifted into the query by [buildQuery] are ENVELOPE-ONLY: they live
  /// in the persisted payload (the only place a queued op can carry them) but
  /// must NOT appear in the request body — the backend ValidationPipe runs
  /// with `forbidNonWhitelisted: true`, so an unknown body property (the cash
  /// endpoints' query-only `warehouseId` is not a field of CashInOutDto)
  /// would be rejected with 400 before the mutation is even attempted.
  ///
  /// Pure: never mutates [payload]. Returns the same map instance when no
  /// envelope fields are consumed; otherwise a stripped copy the caller must
  /// treat as read-only.
  Map<String, dynamic> bodyFor(Map<String, dynamic> payload) {
    final query = buildQuery?.call(payload);
    if (query == null || query.isEmpty) return payload;
    final lifted = query.keys.toSet();
    return <String, dynamic>{
      for (final entry in payload.entries)
        if (!lifted.contains(entry.key)) entry.key: entry.value,
    };
  }
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

/// Shared query resolver for the cash kinds (Phase F4-B). `warehouseId`
/// selects WHICH open shift is credited and is part of the backend request
/// hash, so it must ride in the query string exactly like the online
/// repositories send it. The queued payload carries it as an envelope field;
/// the resolver lifts it out WITHOUT mutating the payload. A missing/blank
/// warehouseId produces no query — the backend then rejects the request
/// (required query param), which the worker classifies as a permanent
/// failure visible to the user instead of guessing a shift.
Map<String, dynamic>? _warehouseIdQuery(Map<String, dynamic> payload) {
  final warehouseId = payload['warehouseId'];
  if (warehouseId is String && warehouseId.isNotEmpty) {
    return <String, dynamic>{'warehouseId': warehouseId};
  }
  return null;
}

/// F4-B keyed mutation specs: cash-in/out, stock adjust/transfer, goods
/// receipt. All five are keyed operations — the `Idempotency-Key` header is
/// attached by the transport layer in F4-C; the specs only fix the route.
/// Payloads stay verbatim (built at enqueue time in F4-D from the existing
/// request DTOs); none of these kinds chains a follow-up.
const OutboxOperationSpec cashInSpec = OutboxOperationSpec(
  kind: OutboxOperationKind.cashIn,
  endpoint: ApiEndpoints.cashShiftCashIn,
  buildQuery: _warehouseIdQuery,
);

const OutboxOperationSpec cashOutSpec = OutboxOperationSpec(
  kind: OutboxOperationKind.cashOut,
  endpoint: ApiEndpoints.cashShiftCashOut,
  buildQuery: _warehouseIdQuery,
);

const OutboxOperationSpec adjustStockSpec = OutboxOperationSpec(
  kind: OutboxOperationKind.adjustStock,
  endpoint: ApiEndpoints.stockAdjustments,
);

const OutboxOperationSpec transferStockSpec = OutboxOperationSpec(
  kind: OutboxOperationKind.transferStock,
  endpoint: ApiEndpoints.stockTransfers,
);

const OutboxOperationSpec goodsReceiptSpec = OutboxOperationSpec(
  kind: OutboxOperationKind.goodsReceipt,
  endpoint: ApiEndpoints.goodsReceipt,
);

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
    OutboxOperationKind.cashIn: cashInSpec,
    OutboxOperationKind.cashOut: cashOutSpec,
    OutboxOperationKind.adjustStock: adjustStockSpec,
    OutboxOperationKind.transferStock: transferStockSpec,
    OutboxOperationKind.goodsReceipt: goodsReceiptSpec,
  };

  /// The dispatch plan for [kind], or null when the kind has no registered
  /// spec yet (must never be sent anywhere).
  static OutboxOperationSpec? specFor(OutboxOperationKind kind) =>
      specs[kind];
}