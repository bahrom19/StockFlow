import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';

sealed class DashboardResult<T> {
  const DashboardResult();
}

class DashboardSuccess<T> extends DashboardResult<T> {
  final T data;
  const DashboardSuccess(this.data);
}

class DashboardFailure<T> extends DashboardResult<T> {
  final Failure error;
  const DashboardFailure(this.error);
}

/// DashboardRepository — real API calls only, no mocked data.
class DashboardRepository {
  final Ref _ref;
  final AppLogger _logger = AppLogger('DashboardRepository');
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('ErrHandler'));

  DashboardRepository(this._ref);

  Future<DashboardResult<DashboardSummary>> getDashboardSummary() async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.get(ApiEndpoints.dashboard);
      final data = response.data as Map<String, dynamic>;
      return DashboardSuccess(DashboardSummary.fromJson(data));
    } catch (e) {
      _logger.error('Dashboard summary failed', e);
      return DashboardFailure(_errorHandler.handle(e));
    }
  }

  Future<DashboardResult<SalesReport>> getRecentSales({
    int page = 1,
    int limit = 10,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.get(
        ApiEndpoints.reportsSales,
        queryParameters: {
          'page': page.toString(),
          'limit': limit.toString(),
          'sortBy': 'createdAt',
          'sortOrder': 'desc',
        },
      );
      final data = response.data as Map<String, dynamic>;
      return DashboardSuccess(SalesReport.fromJson(data));
    } catch (e) {
      _logger.error('Recent sales failed', e);
      return DashboardFailure(_errorHandler.handle(e));
    }
  }

  /// Low-stock positions for the Dashboard Action Center (event #3 — top-3
  /// critical items with SKU/stock/warehouse).
  ///
  /// Stage B decision (docs/ux/dashboard_v33_action_center.md §3a): loaded
  /// once per dashboard refresh via the existing endpoint — NOT on the 20s
  /// Cash Drawer timer.
  Future<DashboardResult<List<LowStockItem>>> getLowStockItems({
    int limit = 50,
  }) async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.get(
        ApiEndpoints.reportsLowStock,
        queryParameters: {'limit': limit.toString()},
      );
      final data = response.data as Map<String, dynamic>;
      final items = (data['items'] as List<dynamic>? ?? [])
          .map((e) => LowStockItem.fromJson(e as Map<String, dynamic>))
          .toList();
      return DashboardSuccess(items);
    } catch (e) {
      _logger.error('Low stock items failed', e);
      return DashboardFailure(_errorHandler.handle(e));
    }
  }

  /// Lightweight purchasing summary for the Dashboard Action Center
  /// (event #4 — pending POs). Uses `limit=1` so only the `summary` block is
  /// consumed; the `orders` list payload is minimized.
  ///
  /// Decision (docs/ux/dashboard_v33_action_center.md §3a): the Dashboard uses
  /// this Dashboard-specific summary request instead of `poListProvider`
  /// (which belongs to the Purchasing screen).
  Future<DashboardResult<PurchasingSummary>> getPurchasingSummary() async {
    try {
      final client = _ref.read(apiClientProvider);
      final response = await client.get(
        ApiEndpoints.reportsPurchasing,
        queryParameters: {'limit': '1'},
      );
      final data = response.data as Map<String, dynamic>;
      final summary = data['summary'] as Map<String, dynamic>;
      return DashboardSuccess(PurchasingSummary.fromJson(summary));
    } catch (e) {
      _logger.error('Purchasing summary failed', e);
      return DashboardFailure(_errorHandler.handle(e));
    }
  }

  Future<DashboardResult<ProfitReport>> getProfitReport({
    int days = 30,
  }) async {
    try {
      final now = DateTime.now();
      final from = now.subtract(Duration(days: days));
      final client = _ref.read(apiClientProvider);
      final response = await client.get(
        ApiEndpoints.reportsProfit,
        queryParameters: {
          'dateFrom': from.toIso8601String(),
          'dateTo': now.toIso8601String(),
        },
      );
      final data = response.data as Map<String, dynamic>;
      return DashboardSuccess(ProfitReport.fromJson(data));
    } catch (e) {
      _logger.error('Profit report failed', e);
      return DashboardFailure(_errorHandler.handle(e));
    }
  }
}

final dashboardRepositoryProvider = Provider<DashboardRepository>((ref) {
  return DashboardRepository(ref);
});
