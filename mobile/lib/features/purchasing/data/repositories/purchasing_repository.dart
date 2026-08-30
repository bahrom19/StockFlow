import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/core/outbox/outbox_mutation_queue.dart';
import 'package:stockflow/core/outbox/outbox_operation.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';

sealed class PurchasingResult<T> {
  const PurchasingResult();
}

class PurchasingSuccess<T> extends PurchasingResult<T> {
  final T data;
  const PurchasingSuccess(this.data);
}

class PurchasingFailure<T> extends PurchasingResult<T> {
  final Failure error;
  const PurchasingFailure(this.error);
}

class PurchasingRepository {
  final ApiClient _api;
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('PurchasingRepo'));

  PurchasingRepository(this._api);

  // ── Purchase Orders ──

  Future<PurchasingResult<PurchaseOrder>> createOrder(
      CreatePurchaseOrderRequest request) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/purchasing/purchase-orders',
        data: request.toJson(),
      );
      return PurchasingSuccess(PurchaseOrder.fromJson(response.data!));
    } catch (e) {
      return PurchasingFailure(_errorHandler.handle(e));
    }
  }

  Future<PurchasingResult<PurchaseOrderListResponse>> listOrders({
    int page = 1,
    int limit = 20,
    String? search,
    String? supplierId,
    String? status,
    String? orderDateFrom,
    String? orderDateTo,
    String sortBy = 'createdAt',
    String sortOrder = 'desc',
  }) async {
    try {
      final params = <String, dynamic>{
        'page': page,
        'limit': limit,
        'sortBy': sortBy,
        'sortOrder': sortOrder,
      };
      if (search != null && search.isNotEmpty) params['search'] = search;
      if (supplierId != null) params['supplierId'] = supplierId;
      if (status != null) params['status'] = status;
      if (orderDateFrom != null) params['orderDateFrom'] = orderDateFrom;
      if (orderDateTo != null) params['orderDateTo'] = orderDateTo;

      final response = await _api.get<Map<String, dynamic>>(
        '/purchasing/purchase-orders',
        queryParameters: params,
      );
      return PurchasingSuccess(
          PurchaseOrderListResponse.fromJson(response.data!));
    } catch (e) {
      return PurchasingFailure(_errorHandler.handle(e));
    }
  }

  Future<PurchasingResult<PurchaseOrder>> getOrderById(String id) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
          '/purchasing/purchase-orders/$id');
      return PurchasingSuccess(PurchaseOrder.fromJson(response.data!));
    } catch (e) {
      return PurchasingFailure(_errorHandler.handle(e));
    }
  }

  Future<PurchasingResult<PurchaseOrder>> updateOrder(
      String id, Map<String, dynamic> data) async {
    try {
      final response = await _api.patch<Map<String, dynamic>>(
        '/purchasing/purchase-orders/$id',
        data: data,
      );
      return PurchasingSuccess(PurchaseOrder.fromJson(response.data!));
    } catch (e) {
      return PurchasingFailure(_errorHandler.handle(e));
    }
  }

  Future<PurchasingResult<void>> deleteOrder(String id) async {
    try {
      await _api.delete<dynamic>('/purchasing/purchase-orders/$id');
      return const PurchasingSuccess(null);
    } catch (e) {
      return PurchasingFailure(_errorHandler.handle(e));
    }
  }

  Future<PurchasingResult<PurchaseOrder>> transitionStatus(
      String id, String status) async {
    try {
      final response = await _api.patch<Map<String, dynamic>>(
        '/purchasing/purchase-orders/$id/status',
        data: {'status': status},
      );
      return PurchasingSuccess(PurchaseOrder.fromJson(response.data!));
    } catch (e) {
      return PurchasingFailure(_errorHandler.handle(e));
    }
  }

  Future<PurchasingResult<String>> getNextOrderNumber() async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
          '/purchasing/purchase-orders/next-number');
      return PurchasingSuccess(
          response.data!['orderNumber']?.toString() ?? '');
    } catch (e) {
      return PurchasingFailure(_errorHandler.handle(e));
    }
  }

  // ── Goods Receipts ──

  /// Phase F4-D: keyed mutation.
  ///
  /// * Online → direct POST; [idempotencyKey] (when given) is transported as
  ///   the `Idempotency-Key` header.
  /// * Offline (when [offlineQueue] is supplied and [online] is false) → the
  ///   verbatim [CreateGoodsReceiptRequest.toJson] payload is parked in the
  ///   outbox under kind [OutboxOperationKind.goodsReceipt] with
  ///   `idempotencyKey == clientOperationId`, minted once and never
  ///   regenerated on retry. The caller keeps its existing generic
  ///   failure-shaped result (decision D3: no new l10n keys).
  Future<PurchasingResult<GoodsReceipt>> createGoodsReceipt(
    CreateGoodsReceiptRequest request, {
    String? idempotencyKey,
    OutboxMutationQueue? offlineQueue,
    bool online = true,
  }) async {
    if (offlineQueue != null && !online) {
      try {
        await offlineQueue.enqueueOffline(
          kind: OutboxOperationKind.goodsReceipt,
          payload: request.toJson(),
        );
      } on StateError catch (e) {
        return PurchasingFailure(NetworkFailure(message: e.message));
      }
      return const PurchasingFailure(
        NetworkFailure(message: OutboxMutationQueue.offlineQueuedMessage),
      );
    }
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/purchasing/goods-receipts',
        data: request.toJson(),
        options: idempotencyHeader(idempotencyKey),
      );
      return PurchasingSuccess(GoodsReceipt.fromJson(response.data!));
    } catch (e) {
      return PurchasingFailure(_errorHandler.handle(e));
    }
  }
}

final purchasingRepositoryProvider = Provider<PurchasingRepository>((ref) {
  final api = ref.read(apiClientProvider);
  return PurchasingRepository(api);
});
