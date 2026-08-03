import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

// ──────────────────────────────────
// Result Wrapper
// ──────────────────────────────────
sealed class SalesResult<T> {
  const SalesResult();
}

class SalesSuccess<T> extends SalesResult<T> {
  final T data;
  const SalesSuccess(this.data);
}

class SalesFailure<T> extends SalesResult<T> {
  final Failure error;
  const SalesFailure(this.error);
}

// ──────────────────────────────────
// Sales Repository
// ──────────────────────────────────
class SalesRepository {
  final ApiClient _api;
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('SalesRepo'));

  SalesRepository(this._api);

  /// POST /sales — Create a sale (DRAFT)
  Future<SalesResult<Sale>> create(CreateSaleRequest request) async {
    try {
      final response = await _api.post<Map<String, dynamic>>(
        '/sales',
        data: request.toJson(),
      );
      return SalesSuccess(Sale.fromJson(response.data!));
    } catch (e) {
      return SalesFailure(_errorHandler.handle(e));
    }
  }

  /// GET /sales — List sales with pagination and filters
  Future<SalesResult<SaleListResponse>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? warehouseId,
    String? cashierId,
    String? customerId,
    String? status,
    String? paymentMethod,
    String? dateFrom,
    String? dateTo,
    String sortBy = 'createdAt',
    String sortOrder = 'desc',
  }) async {
    try {
      final queryParams = <String, dynamic>{
        'page': page,
        'limit': limit,
        'sortBy': sortBy,
        'sortOrder': sortOrder,
      };
      if (search != null && search.isNotEmpty) queryParams['search'] = search;
      if (warehouseId != null) queryParams['warehouseId'] = warehouseId;
      if (cashierId != null) queryParams['cashierId'] = cashierId;
      if (customerId != null) queryParams['customerId'] = customerId;
      if (status != null) queryParams['status'] = status;
      if (paymentMethod != null) queryParams['paymentMethod'] = paymentMethod;
      if (dateFrom != null) queryParams['dateFrom'] = dateFrom;
      if (dateTo != null) queryParams['dateTo'] = dateTo;

      final response = await _api.get<Map<String, dynamic>>(
        '/sales',
        queryParameters: queryParams,
      );
      return SalesSuccess(SaleListResponse.fromJson(response.data!));
    } catch (e) {
      return SalesFailure(_errorHandler.handle(e));
    }
  }

  /// GET /sales/:id — Get sale by ID
  Future<SalesResult<Sale>> getById(String id) async {
    try {
      final response = await _api.get<Map<String, dynamic>>('/sales/$id');
      return SalesSuccess(Sale.fromJson(response.data!));
    } catch (e) {
      return SalesFailure(_errorHandler.handle(e));
    }
  }

  /// GET /sales/next-number — Get next auto-generated sale number
  Future<SalesResult<String>> getNextNumber() async {
    try {
      final response = await _api.get<Map<String, dynamic>>('/sales/next-number');
      return SalesSuccess(response.data!['saleNumber']?.toString() ?? '');
    } catch (e) {
      return SalesFailure(_errorHandler.handle(e));
    }
  }

  /// GET /sales/receipt/:id — Get sale receipt
  Future<SalesResult<Sale>> getReceipt(String id) async {
    try {
      final response = await _api.get<Map<String, dynamic>>('/sales/receipt/$id');
      return SalesSuccess(Sale.fromJson(response.data!));
    } catch (e) {
      return SalesFailure(_errorHandler.handle(e));
    }
  }

  /// PATCH /sales/:id — Update a draft sale
  Future<SalesResult<Sale>> update(
    String id, {
    String? customerId,
    String? notes,
    String? currency,
  }) async {
    try {
      final body = <String, dynamic>{};
      if (customerId != null) body['customerId'] = customerId;
      if (notes != null) body['notes'] = notes;
      if (currency != null) body['currency'] = currency;

      final response = await _api.patch<Map<String, dynamic>>(
        '/sales/$id',
        data: body,
      );
      return SalesSuccess(Sale.fromJson(response.data!));
    } catch (e) {
      return SalesFailure(_errorHandler.handle(e));
    }
  }

  /// DELETE /sales/:id — Delete a draft sale
  Future<SalesResult<void>> delete(String id) async {
    try {
      await _api.delete<dynamic>('/sales/$id');
      return const SalesSuccess(null);
    } catch (e) {
      return SalesFailure(_errorHandler.handle(e));
    }
  }

  /// PATCH /sales/:id/status — Transition sale status
  Future<SalesResult<Sale>> transitionStatus(String id, String status) async {
    try {
      final response = await _api.patch<Map<String, dynamic>>(
        '/sales/$id/status',
        data: {'status': status},
      );
      return SalesSuccess(Sale.fromJson(response.data!));
    } catch (e) {
      return SalesFailure(_errorHandler.handle(e));
    }
  }

  /// POST /sales/:id/complete — Complete a sale
  Future<SalesResult<Sale>> complete(String id) async {
    try {
      final response = await _api.post<Map<String, dynamic>>('/sales/$id/complete');
      return SalesSuccess(Sale.fromJson(response.data!));
    } catch (e) {
      return SalesFailure(_errorHandler.handle(e));
    }
  }

  /// POST /sales/:id/cancel — Cancel a pending sale
  Future<SalesResult<Sale>> cancel(String id) async {
    try {
      final response = await _api.post<Map<String, dynamic>>('/sales/$id/cancel');
      return SalesSuccess(Sale.fromJson(response.data!));
    } catch (e) {
      return SalesFailure(_errorHandler.handle(e));
    }
  }

  /// POST /sales/:id/refund — Refund a completed sale
  Future<SalesResult<Sale>> refund(String id) async {
    try {
      final response = await _api.post<Map<String, dynamic>>('/sales/$id/refund');
      return SalesSuccess(Sale.fromJson(response.data!));
    } catch (e) {
      return SalesFailure(_errorHandler.handle(e));
    }
  }
}

// ──────────────────────────────────
// Provider
// ──────────────────────────────────
final salesRepositoryProvider = Provider<SalesRepository>((ref) {
  final api = ref.read(apiClientProvider);
  return SalesRepository(api);
});
