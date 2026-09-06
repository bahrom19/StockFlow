import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/features/reports/domain/report_models.dart';

sealed class ReportsApiResult<T> {
  const ReportsApiResult();
}

class ReportsApiSuccess<T> extends ReportsApiResult<T> {
  final T data;
  const ReportsApiSuccess(this.data);
}

class ReportsApiFailure<T> extends ReportsApiResult<T> {
  final Failure error;
  const ReportsApiFailure(this.error);
}

/// ReportsRepository — real API calls for analytics report endpoints.
class ReportsRepository {
  final Ref _ref;
  final AppLogger _logger = AppLogger('ReportsRepository');
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('ErrHandler'));

  ReportsRepository(this._ref);

  // ── Top Products ──────────────────────────────────────────────

  Future<ReportsApiResult<TopProductsResponse>> getTopProducts({
    String? currency,
    String? dateFrom,
    String? dateTo,
    int top = 10,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.get(
        ApiEndpoints.reportsTopProducts,
        queryParameters: {
          'top': top.toString(),
          if (currency != null && currency.isNotEmpty) 'currency': currency,
          if (dateFrom != null) 'dateFrom': dateFrom,
          if (dateTo != null) 'dateTo': dateTo,
        },
      );
      final data = response.data as Map<String, dynamic>;
      return ReportsApiSuccess(TopProductsResponse.fromJson(data));
    } catch (e) {
      _logger.error('Top products failed', e);
      return ReportsApiFailure(_errorHandler.handle(e));
    }
  }

  // ── Inventory Valuation ────────────────────────────────────────

  Future<ReportsApiResult<InventoryValuationResponse>> getInventoryValuation({
    String? warehouseId,
    int page = 1,
    int limit = 50,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.get(
        ApiEndpoints.reportsInventoryValue,
        queryParameters: {
          'page': page.toString(),
          'limit': limit.toString(),
          if (warehouseId != null) 'warehouseId': warehouseId,
        },
      );
      final data = response.data as Map<String, dynamic>;
      return ReportsApiSuccess(InventoryValuationResponse.fromJson(data));
    } catch (e) {
      _logger.error('Inventory valuation failed', e);
      return ReportsApiFailure(_errorHandler.handle(e));
    }
  }

  // ── Customer Report ───────────────────────────────────────────

  Future<ReportsApiResult<CustomerReportResponse>> getCustomerReport({
    String? currency,
    String? search,
    String? dateFrom,
    String? dateTo,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.get(
        ApiEndpoints.reportsCustomers,
        queryParameters: {
          'page': page.toString(),
          'limit': limit.toString(),
          if (currency != null && currency.isNotEmpty) 'currency': currency,
          if (search != null && search.isNotEmpty) 'search': search,
          if (dateFrom != null) 'dateFrom': dateFrom,
          if (dateTo != null) 'dateTo': dateTo,
        },
      );
      final data = response.data as Map<String, dynamic>;
      return ReportsApiSuccess(CustomerReportResponse.fromJson(data));
    } catch (e) {
      _logger.error('Customer report failed', e);
      return ReportsApiFailure(_errorHandler.handle(e));
    }
  }

  // ── Supplier Report ───────────────────────────────────────────

  Future<ReportsApiResult<SupplierReportResponse>> getSupplierReport({
    String? currency,
    String? search,
    String? dateFrom,
    String? dateTo,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.get(
        ApiEndpoints.reportsSuppliers,
        queryParameters: {
          'page': page.toString(),
          'limit': limit.toString(),
          if (currency != null && currency.isNotEmpty) 'currency': currency,
          if (search != null && search.isNotEmpty) 'search': search,
          if (dateFrom != null) 'dateFrom': dateFrom,
          if (dateTo != null) 'dateTo': dateTo,
        },
      );
      final data = response.data as Map<String, dynamic>;
      return ReportsApiSuccess(SupplierReportResponse.fromJson(data));
    } catch (e) {
      _logger.error('Supplier report failed', e);
      return ReportsApiFailure(_errorHandler.handle(e));
    }
  }

  // ── Cash Shift Report ─────────────────────────────────────────

  Future<ReportsApiResult<CashShiftReportResponse>> getCashShiftReport({
    String? currency,
    String? warehouseId,
    String? cashierId,
    String? status,
    String? dateFrom,
    String? dateTo,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.get(
        ApiEndpoints.reportsCashShifts,
        queryParameters: {
          'page': page.toString(),
          'limit': limit.toString(),
          if (currency != null && currency.isNotEmpty) 'currency': currency,
          if (warehouseId != null) 'warehouseId': warehouseId,
          if (cashierId != null) 'cashierId': cashierId,
          if (status != null && status.isNotEmpty) 'status': status,
          if (dateFrom != null) 'dateFrom': dateFrom,
          if (dateTo != null) 'dateTo': dateTo,
        },
      );
      final data = response.data as Map<String, dynamic>;
      return ReportsApiSuccess(CashShiftReportResponse.fromJson(data));
    } catch (e) {
      _logger.error('Cash shift report failed', e);
      return ReportsApiFailure(_errorHandler.handle(e));
    }
  }
}

final reportsRepositoryProvider = Provider<ReportsRepository>((ref) {
  return ReportsRepository(ref);
});
