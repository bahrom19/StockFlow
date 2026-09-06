import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/currency/currency_provider.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/reports/data/reports_repository.dart';
import 'package:stockflow/features/reports/domain/report_models.dart';

// ──────────────────────────────────
// Common State
// ──────────────────────────────────

sealed class ReportState<T> {
  const ReportState();
  String get message => '';
}

class ReportLoading<T> extends ReportState<T> {
  const ReportLoading();
}

class ReportData<T> extends ReportState<T> {
  final T data;
  final bool isRefreshing;

  const ReportData(this.data, {this.isRefreshing = false});

  ReportData<T> copyWith({bool? isRefreshing}) {
    return ReportData(data, isRefreshing: isRefreshing ?? this.isRefreshing);
  }
}

class ReportEmpty<T> extends ReportState<T> {
  const ReportEmpty();
}

class ReportError<T> extends ReportState<T> {
  final String message;
  final Failure? failure;

  const ReportError(this.message, {this.failure});
}

// ──────────────────────────────────
// Top Products
// ──────────────────────────────────

class TopProductsNotifier
    extends StateNotifier<ReportState<TopProductsResponse>> {
  final Ref _ref;
  TopProductsNotifier(this._ref) : super(const ReportLoading());

  Future<void> load({String? dateFrom, String? dateTo, int top = 10}) async {
    state = const ReportLoading();
    final currency = _ref.read(currencyProvider);
    final repo = _ref.read(reportsRepositoryProvider);
    final result = await repo.getTopProducts(
      currency: currency,
      dateFrom: dateFrom,
      dateTo: dateTo,
      top: top,
    );
    if (result is ReportsApiFailure<TopProductsResponse>) {
      state = ReportError<TopProductsResponse>(
        result.error.message,
        failure: result.error,
      );
    } else if (result is ReportsApiSuccess<TopProductsResponse>) {
      final data = result.data;
      if (data.items.isEmpty) {
        state = const ReportEmpty();
      } else {
        state = ReportData(data);
      }
    }
  }

  Future<void> refresh({
    String? dateFrom,
    String? dateTo,
    int top = 10,
  }) async {
    final current = state;
    if (current is ReportData<TopProductsResponse>) {
      state = current.copyWith(isRefreshing: true);
    }
    await load(dateFrom: dateFrom, dateTo: dateTo, top: top);
  }
}

final topProductsProvider = StateNotifierProvider<
    TopProductsNotifier,
    ReportState<TopProductsResponse>>((ref) {
  return TopProductsNotifier(ref);
});

// ──────────────────────────────────
// Inventory Valuation
// ──────────────────────────────────

class InventoryValuationNotifier
    extends StateNotifier<ReportState<InventoryValuationResponse>> {
  final Ref _ref;
  InventoryValuationNotifier(this._ref) : super(const ReportLoading());

  int _currentPage = 1;
  static const int _pageSize = 50;
  bool _hasMore = true;
  bool _isLoadingMore = false;

  bool get hasMore => _hasMore;
  bool get isLoadingMore => _isLoadingMore;

  Future<void> load({String? warehouseId}) async {
    _currentPage = 1;
    _hasMore = true;
    state = const ReportLoading();
    final repo = _ref.read(reportsRepositoryProvider);
    final result = await repo.getInventoryValuation(
      warehouseId: warehouseId,
      page: 1,
      limit: _pageSize,
    );
    if (result is ReportsApiFailure<InventoryValuationResponse>) {
      state = ReportError<InventoryValuationResponse>(
        result.error.message,
        failure: result.error,
      );
    } else if (result is ReportsApiSuccess<InventoryValuationResponse>) {
      final data = result.data;
      _hasMore = data.items.length >= _pageSize;
      if (data.items.isEmpty) {
        state = const ReportEmpty();
      } else {
        state = ReportData(data);
      }
    }
  }

  Future<void> refresh({String? warehouseId}) async {
    final current = state;
    if (current is ReportData<InventoryValuationResponse>) {
      state = current.copyWith(isRefreshing: true);
    }
    await load(warehouseId: warehouseId);
  }

  Future<void> loadMore({String? warehouseId}) async {
    if (_isLoadingMore || !_hasMore) return;
    _isLoadingMore = true;
    _currentPage++;
    final repo = _ref.read(reportsRepositoryProvider);
    final result = await repo.getInventoryValuation(
      warehouseId: warehouseId,
      page: _currentPage,
      limit: _pageSize,
    );
    _isLoadingMore = false;
    if (result is ReportsApiSuccess<InventoryValuationResponse>) {
      final newData = result.data;
      _hasMore = newData.items.length >= _pageSize;
      final current = state;
      if (current is ReportData<InventoryValuationResponse>) {
        final existing = current.data;
        state = ReportData(
          InventoryValuationResponse(
            items: [...existing.items, ...newData.items],
            totalValue: newData.totalValue,
            total: newData.total,
            page: newData.page,
            limit: newData.limit,
          ),
        );
      }
    }
  }
}

final inventoryValuationProvider = StateNotifierProvider<
    InventoryValuationNotifier,
    ReportState<InventoryValuationResponse>>((ref) {
  return InventoryValuationNotifier(ref);
});

// ──────────────────────────────────
// Customer Report
// ──────────────────────────────────

class CustomerReportNotifier
    extends StateNotifier<ReportState<CustomerReportResponse>> {
  final Ref _ref;
  CustomerReportNotifier(this._ref) : super(const ReportLoading());

  int _currentPage = 1;
  static const int _pageSize = 20;
  bool _hasMore = true;
  bool _isLoadingMore = false;

  bool get hasMore => _hasMore;
  bool get isLoadingMore => _isLoadingMore;

  Future<void> load({
    String? search,
    String? dateFrom,
    String? dateTo,
  }) async {
    _currentPage = 1;
    _hasMore = true;
    state = const ReportLoading();
    final currency = _ref.read(currencyProvider);
    final repo = _ref.read(reportsRepositoryProvider);
    final result = await repo.getCustomerReport(
      currency: currency,
      search: search,
      dateFrom: dateFrom,
      dateTo: dateTo,
      page: 1,
      limit: _pageSize,
    );
    if (result is ReportsApiFailure<CustomerReportResponse>) {
      state = ReportError<CustomerReportResponse>(
        result.error.message,
        failure: result.error,
      );
    } else if (result is ReportsApiSuccess<CustomerReportResponse>) {
      final data = result.data;
      _hasMore = data.items.length >= _pageSize;
      if (data.items.isEmpty) {
        state = const ReportEmpty();
      } else {
        state = ReportData(data);
      }
    }
  }

  Future<void> refresh({
    String? search,
    String? dateFrom,
    String? dateTo,
  }) async {
    final current = state;
    if (current is ReportData<CustomerReportResponse>) {
      state = current.copyWith(isRefreshing: true);
    }
    await load(search: search, dateFrom: dateFrom, dateTo: dateTo);
  }

  Future<void> loadMore({
    String? search,
    String? dateFrom,
    String? dateTo,
  }) async {
    if (_isLoadingMore || !_hasMore) return;
    _isLoadingMore = true;
    _currentPage++;
    final currency = _ref.read(currencyProvider);
    final repo = _ref.read(reportsRepositoryProvider);
    final result = await repo.getCustomerReport(
      currency: currency,
      search: search,
      dateFrom: dateFrom,
      dateTo: dateTo,
      page: _currentPage,
      limit: _pageSize,
    );
    _isLoadingMore = false;
    if (result is ReportsApiSuccess<CustomerReportResponse>) {
      final newData = result.data;
      _hasMore = newData.items.length >= _pageSize;
      final current = state;
      if (current is ReportData<CustomerReportResponse>) {
        final existing = current.data;
        state = ReportData(
          CustomerReportResponse(
            items: [...existing.items, ...newData.items],
            total: newData.total,
            page: newData.page,
            limit: newData.limit,
          ),
        );
      }
    }
  }
}

final customerReportProvider = StateNotifierProvider<
    CustomerReportNotifier,
    ReportState<CustomerReportResponse>>((ref) {
  return CustomerReportNotifier(ref);
});

// ──────────────────────────────────
// Supplier Report
// ──────────────────────────────────

class SupplierReportNotifier
    extends StateNotifier<ReportState<SupplierReportResponse>> {
  final Ref _ref;
  SupplierReportNotifier(this._ref) : super(const ReportLoading());

  int _currentPage = 1;
  static const int _pageSize = 20;
  bool _hasMore = true;
  bool _isLoadingMore = false;

  bool get hasMore => _hasMore;
  bool get isLoadingMore => _isLoadingMore;

  Future<void> load({
    String? search,
    String? dateFrom,
    String? dateTo,
  }) async {
    _currentPage = 1;
    _hasMore = true;
    state = const ReportLoading();
    final currency = _ref.read(currencyProvider);
    final repo = _ref.read(reportsRepositoryProvider);
    final result = await repo.getSupplierReport(
      currency: currency,
      search: search,
      dateFrom: dateFrom,
      dateTo: dateTo,
      page: 1,
      limit: _pageSize,
    );
    if (result is ReportsApiFailure<SupplierReportResponse>) {
      state = ReportError<SupplierReportResponse>(
        result.error.message,
        failure: result.error,
      );
    } else if (result is ReportsApiSuccess<SupplierReportResponse>) {
      final data = result.data;
      _hasMore = data.items.length >= _pageSize;
      if (data.items.isEmpty) {
        state = const ReportEmpty();
      } else {
        state = ReportData(data);
      }
    }
  }

  Future<void> refresh({
    String? search,
    String? dateFrom,
    String? dateTo,
  }) async {
    final current = state;
    if (current is ReportData<SupplierReportResponse>) {
      state = current.copyWith(isRefreshing: true);
    }
    await load(search: search, dateFrom: dateFrom, dateTo: dateTo);
  }

  Future<void> loadMore({
    String? search,
    String? dateFrom,
    String? dateTo,
  }) async {
    if (_isLoadingMore || !_hasMore) return;
    _isLoadingMore = true;
    _currentPage++;
    final currency = _ref.read(currencyProvider);
    final repo = _ref.read(reportsRepositoryProvider);
    final result = await repo.getSupplierReport(
      currency: currency,
      search: search,
      dateFrom: dateFrom,
      dateTo: dateTo,
      page: _currentPage,
      limit: _pageSize,
    );
    _isLoadingMore = false;
    if (result is ReportsApiSuccess<SupplierReportResponse>) {
      final newData = result.data;
      _hasMore = newData.items.length >= _pageSize;
      final current = state;
      if (current is ReportData<SupplierReportResponse>) {
        final existing = current.data;
        state = ReportData(
          SupplierReportResponse(
            items: [...existing.items, ...newData.items],
            total: newData.total,
            page: newData.page,
            limit: newData.limit,
          ),
        );
      }
    }
  }
}

final supplierReportProvider = StateNotifierProvider<
    SupplierReportNotifier,
    ReportState<SupplierReportResponse>>((ref) {
  return SupplierReportNotifier(ref);
});

// ──────────────────────────────────
// Cash Shift Report
// ──────────────────────────────────

class CashShiftReportNotifier
    extends StateNotifier<ReportState<CashShiftReportResponse>> {
  final Ref _ref;
  CashShiftReportNotifier(this._ref) : super(const ReportLoading());

  int _currentPage = 1;
  static const int _pageSize = 20;
  bool _hasMore = true;
  bool _isLoadingMore = false;

  bool get hasMore => _hasMore;
  bool get isLoadingMore => _isLoadingMore;

  Future<void> load({
    String? warehouseId,
    String? status,
    String? dateFrom,
    String? dateTo,
  }) async {
    _currentPage = 1;
    _hasMore = true;
    state = const ReportLoading();
    final currency = _ref.read(currencyProvider);
    final repo = _ref.read(reportsRepositoryProvider);
    final result = await repo.getCashShiftReport(
      currency: currency,
      warehouseId: warehouseId,
      status: status,
      dateFrom: dateFrom,
      dateTo: dateTo,
      page: 1,
      limit: _pageSize,
    );
    if (result is ReportsApiFailure<CashShiftReportResponse>) {
      state = ReportError<CashShiftReportResponse>(
        result.error.message,
        failure: result.error,
      );
    } else if (result is ReportsApiSuccess<CashShiftReportResponse>) {
      final data = result.data;
      _hasMore = data.items.length >= _pageSize;
      if (data.items.isEmpty) {
        state = const ReportEmpty();
      } else {
        state = ReportData(data);
      }
    }
  }

  Future<void> refresh({
    String? warehouseId,
    String? status,
    String? dateFrom,
    String? dateTo,
  }) async {
    final current = state;
    if (current is ReportData<CashShiftReportResponse>) {
      state = current.copyWith(isRefreshing: true);
    }
    await load(
        warehouseId: warehouseId,
        status: status,
        dateFrom: dateFrom,
        dateTo: dateTo);
  }

  Future<void> loadMore({
    String? warehouseId,
    String? status,
    String? dateFrom,
    String? dateTo,
  }) async {
    if (_isLoadingMore || !_hasMore) return;
    _isLoadingMore = true;
    _currentPage++;
    final currency = _ref.read(currencyProvider);
    final repo = _ref.read(reportsRepositoryProvider);
    final result = await repo.getCashShiftReport(
      currency: currency,
      warehouseId: warehouseId,
      status: status,
      dateFrom: dateFrom,
      dateTo: dateTo,
      page: _currentPage,
      limit: _pageSize,
    );
    _isLoadingMore = false;
    if (result is ReportsApiSuccess<CashShiftReportResponse>) {
      final newData = result.data;
      _hasMore = newData.items.length >= _pageSize;
      final current = state;
      if (current is ReportData<CashShiftReportResponse>) {
        final existing = current.data;
        state = ReportData(
          CashShiftReportResponse(
            items: [...existing.items, ...newData.items],
            total: newData.total,
            page: newData.page,
            limit: newData.limit,
          ),
        );
      }
    }
  }
}

final cashShiftReportProvider = StateNotifierProvider<
    CashShiftReportNotifier,
    ReportState<CashShiftReportResponse>>((ref) {
  return CashShiftReportNotifier(ref);
});
