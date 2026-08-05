import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/api/api_client.dart';
import 'package:stockflow/core/api/api_endpoints.dart';
import 'package:stockflow/core/errors/error_handler.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/core/logger/app_logger.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

// ──────────────────────────────────
// Result Wrapper
// ──────────────────────────────────
sealed class PaymentsResult<T> {
  const PaymentsResult();
}

class PaymentsSuccess<T> extends PaymentsResult<T> {
  final T data;
  const PaymentsSuccess(this.data);
}

class PaymentsFailure<T> extends PaymentsResult<T> {
  final Failure error;
  const PaymentsFailure(this.error);
}

// ──────────────────────────────────
// Payments Repository
// ──────────────────────────────────
// Consumes ONLY the existing production endpoints:
//   GET /reports/sales  → summary.payments (cash/card/qr/bankTransfer/mobileWallet/other)
//   GET /sales          → per-method transaction counts + per-day trend source
class PaymentsRepository {
  final ApiClient _api;
  final ErrorHandler _errorHandler = ErrorHandler(AppLogger('PaymentsRepo'));

  PaymentsRepository(this._api);

  /// Authoritative per-method amounts from the Sales Report summary.
  Future<PaymentsResult<SalesReport>> getSalesReport({
    required DateTime from,
    required DateTime to,
  }) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        ApiEndpoints.reportsSales,
        queryParameters: {
          'dateFrom': from.toIso8601String(),
          'dateTo': to.toIso8601String(),
          'limit': '1',
        },
      );
      return PaymentsSuccess(SalesReport.fromJson(response.data!));
    } catch (e) {
      return PaymentsFailure(_errorHandler.handle(e));
    }
  }

  /// Fetches completed sales in the period (paginated) — used to build the
  /// daily per-method trend from the same data the backend reports on.
  Future<PaymentsResult<List<Sale>>> getSalesForTrend({
    required DateTime from,
    required DateTime to,
    int maxPages = 15,
  }) async {
    try {
      final all = <Sale>[];
      var page = 1;
      var total = -1;
      while (page <= maxPages) {
        final response = await _api.get<Map<String, dynamic>>(
          ApiEndpoints.sales,
          queryParameters: {
            'dateFrom': from.toIso8601String(),
            'dateTo': to.toIso8601String(),
            'page': '$page',
            'limit': '100',
            'sortBy': 'createdAt',
            'sortOrder': 'asc',
          },
        );
        final data = response.data;
        final items = (data?['items'] as List<dynamic>?)
                ?.map((e) => Sale.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const <Sale>[];
        all.addAll(items);
        total = (data?['total'] as num?)?.toInt() ?? items.length;
        if (items.isEmpty || all.length >= total) break;
        page++;
      }
      return PaymentsSuccess(all);
    } catch (e) {
      return PaymentsFailure(_errorHandler.handle(e));
    }
  }

  /// A single page of sales with optional method filter — powers the Payment
  /// Details table (search / sort / pagination / export).
  Future<PaymentsResult<SaleListResponse>> getSalesPage({
    int page = 1,
    int limit = 50,
    String? method,
    String? search,
    String? sortBy,
    String sortOrder = 'desc',
  }) async {
    try {
      final response = await _api.get<Map<String, dynamic>>(
        ApiEndpoints.sales,
        queryParameters: {
          'page': '$page',
          'limit': '$limit',
          if (method != null && method.isNotEmpty) 'paymentMethod': method,
          if (search != null && search.isNotEmpty) 'search': search,
          if (sortBy != null) 'sortBy': sortBy,
          'sortOrder': sortOrder,
        },
      );
      return PaymentsSuccess(SaleListResponse.fromJson(response.data!));
    } catch (e) {
      return PaymentsFailure(_errorHandler.handle(e));
    }
  }
}

final paymentsRepositoryProvider = Provider<PaymentsRepository>((ref) {
  final api = ref.read(apiClientProvider);
  return PaymentsRepository(api);
});
