import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
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

  Future<PurchasingResult<GoodsReceipt>> createGoodsReceipt(
      CreateGoodsReceiptRequest request) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/purchasing/goods-receipts',
        data: request.toJson(),
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
