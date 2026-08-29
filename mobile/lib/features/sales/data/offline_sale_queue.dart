import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/outbox/outbox_controller.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

/// Offline 1B-min: the ONLY operation allowed offline is CREATE_SALE.
///
/// Builds the exact [CreateSaleRequest] JSON the online flow would send,
/// stamps it with a client-generated unique [saleNumber] (prefix `OFF-`) and
/// parks it in the outbox. The sale number is the server-side dedup key: a
/// replayed POST hits the `saleNumber @unique` constraint → 409 P2002 → the
/// sync worker treats it as "already applied". No backend changes needed.
class OfflineSaleQueue {
  OfflineSaleQueue(this._ref);

  final Ref _ref;

  /// Prefix marking offline-created sales; never collides with the server
  /// format `SALE-{company}-{seq}`.
  static const String offlineSaleNumberPrefix = 'OFF-';

  /// Enqueues a CREATE_SALE op. Returns the reserved client saleNumber
  /// (already written into the payload) so the UI can show it immediately.
  ///
  /// Duplicate safety: enqueueing the same [clientOperationId] twice is a
  /// no-op — the controller keeps the first entry and reports `false`.
  Future<String> enqueueCreateSale({
    required CreateSaleRequest request,
    String? clientOperationId,
  }) async {
    final user = _ref.read(currentUserProvider);
    if (user == null) {
      throw StateError(
        'Cannot queue an offline sale without an authenticated user',
      );
    }
    final opId = clientOperationId ?? OutboxOperation.idGenerator();
    final saleNumber =
        '$offlineSaleNumberPrefix${OutboxOperation.idGenerator()}';
    final op = OutboxOperation(
      clientOperationId: opId,
      kind: OutboxOperationKind.createSale,
      companyId: user.companyId,
      userId: user.id,
      payload: request.copyWith(saleNumber: saleNumber).toJson(),
      createdAt: DateTime.now(),
    );
    await _ref.read(outboxControllerProvider.notifier).enqueue(op);
    return saleNumber;
  }
}

/// UI-facing entry point: features resolve this provider instead of touching
/// storage/controller internals directly.
final offlineSaleQueueProvider = Provider<OfflineSaleQueue>(
  (ref) => OfflineSaleQueue(ref),
);