import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/dashboard/data/repositories/dashboard_repository.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';

// ──────────────────────────────────
// Dashboard State
// ──────────────────────────────────
sealed class DashboardUiState {
  const DashboardUiState();
}

class DashboardLoading extends DashboardUiState {
  const DashboardLoading();
}

class DashboardData extends DashboardUiState {
  final DashboardSummary summary;
  final SalesReport? recentSales;
  final ProfitReport? profit;
  final PurchasingSummary? purchasingSummary;
  final List<LowStockItem> lowStockItems;
  final List<ChartDataPoint> chartData;
  final bool isRefreshing;

  const DashboardData({
    required this.summary,
    this.recentSales,
    this.profit,
    this.purchasingSummary,
    this.lowStockItems = const [],
    this.chartData = const [],
    this.isRefreshing = false,
  });

  DashboardData copyWith({
    DashboardSummary? summary,
    SalesReport? recentSales,
    ProfitReport? profit,
    PurchasingSummary? purchasingSummary,
    List<LowStockItem>? lowStockItems,
    List<ChartDataPoint>? chartData,
    bool? isRefreshing,
  }) {
    return DashboardData(
      summary: summary ?? this.summary,
      recentSales: recentSales ?? this.recentSales,
      profit: profit ?? this.profit,
      purchasingSummary: purchasingSummary ?? this.purchasingSummary,
      lowStockItems: lowStockItems ?? this.lowStockItems,
      chartData: chartData ?? this.chartData,
      isRefreshing: isRefreshing ?? this.isRefreshing,
    );
  }
}

class DashboardError extends DashboardUiState {
  final String message;
  final Failure? failure;

  const DashboardError(this.message, {this.failure});
}

// ──────────────────────────────────
// Dashboard Notifier
// ──────────────────────────────────
class DashboardNotifier extends StateNotifier<DashboardUiState> {
  final Ref _ref;

  DashboardNotifier(this._ref) : super(const DashboardLoading());

  Future<void> loadDashboard() async {
    state = const DashboardLoading();
    await _fetchAll();
  }

  Future<void> refresh() async {
    final current = state;
    if (current is DashboardData) {
      state = current.copyWith(isRefreshing: true);
    }
    await _fetchAll();
  }

  Future<void> _fetchAll() async {
    final repo = _ref.read(dashboardRepositoryProvider);

    // Fire all requests concurrently. Purchasing summary (limit=1) and the
    // low-stock list are single light requests for Action Center events #4/#3
    // — they do NOT run on the 20s Cash Drawer timer, only on initial load /
    // manual refresh.
    final results = await Future.wait([
      repo.getDashboardSummary(),
      repo.getRecentSales(),
      repo.getProfitReport(),
      repo.getPurchasingSummary(),
      repo.getLowStockItems(),
    ]);

    final summaryResult = results[0] as DashboardResult<DashboardSummary>;
    final salesResult = results[1] as DashboardResult<SalesReport>;
    final profitResult = results[2] as DashboardResult<ProfitReport>;
    final purchasingResult =
        results[3] as DashboardResult<PurchasingSummary>;
    final lowStockResult = results[4] as DashboardResult<List<LowStockItem>>;

    // If the essential API (summary) fails, show error
    if (summaryResult is DashboardFailure<DashboardSummary>) {
      final failure = summaryResult;
      state = DashboardError(
        failure.error.message,
        failure: failure.error,
      );
      return;
    }

    final summary = (summaryResult as DashboardSuccess<DashboardSummary>).data;
    final recentSales = salesResult is DashboardSuccess<SalesReport>
        ? salesResult.data
        : null;
    final profit = profitResult is DashboardSuccess<ProfitReport>
        ? profitResult.data
        : null;
    final purchasingSummary =
        purchasingResult is DashboardSuccess<PurchasingSummary>
            ? purchasingResult.data
            : null;
    final lowStockItems =
        lowStockResult is DashboardSuccess<List<LowStockItem>>
            ? lowStockResult.data
            : const <LowStockItem>[];

    // Build chart data from profit report
    final chartData = <ChartDataPoint>[];
    if (profit != null) {
      // Use daily data (last 7 significant days)
      final daily = profit.daily;
      final recent = daily.length > 7 ? daily.sublist(daily.length - 7) : daily;
      for (final d in recent) {
        chartData.add(ChartDataPoint(
          label: d.date.length >= 10 ? d.date.substring(5, 10) : d.date,
          revenue: double.tryParse(d.revenue) ?? 0,
          profit: double.tryParse(d.profit) ?? 0,
        ));
      }
    }

    state = DashboardData(
      summary: summary,
      recentSales: recentSales,
      profit: profit,
      purchasingSummary: purchasingSummary,
      lowStockItems: lowStockItems,
      chartData: chartData,
    );
  }
}

// ──────────────────────────────────
// Providers
// ──────────────────────────────────
final dashboardProvider =
    StateNotifierProvider<DashboardNotifier, DashboardUiState>((ref) {
  return DashboardNotifier(ref);
});
