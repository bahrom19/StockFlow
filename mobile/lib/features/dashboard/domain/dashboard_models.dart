import 'package:freezed_annotation/freezed_annotation.dart';

part 'dashboard_models.freezed.dart';
part 'dashboard_models.g.dart';

// ──────────────────────────────────
// Dashboard Summary (from GET /reports/dashboard)
// ──────────────────────────────────
@freezed
class DashboardSummary with _$DashboardSummary {
  const factory DashboardSummary({
    required DaySales todaySales,
    required DaySales yesterdaySales,
    required DaySales monthSales,
    required int ordersCount,
    required String grossRevenue,
    required String grossProfit,
    required String inventoryValue,
    required int lowStockProducts,
    required int outOfStockProducts,
    required int customerCount,
    required int supplierCount,
    required String purchaseTotal,
  }) = _DashboardSummary;

  factory DashboardSummary.fromJson(Map<String, dynamic> json) =>
      _$DashboardSummaryFromJson(json);
}

@freezed
class DaySales with _$DaySales {
  const factory DaySales({
    required String revenue,
    required int count,
    String? averageReceipt,
  }) = _DaySales;

  factory DaySales.fromJson(Map<String, dynamic> json) =>
      _$DaySalesFromJson(json);
}

// ──────────────────────────────────
// Recent Sale (from GET /reports/sales)
// ──────────────────────────────────
@freezed
class RecentSale with _$RecentSale {
  const factory RecentSale({
    required String id,
    required String saleNumber,
    required String createdAt,
    required String status,
    required String total,
    required String paidAmount,
  }) = _RecentSale;

  factory RecentSale.fromJson(Map<String, dynamic> json) =>
      _$RecentSaleFromJson(json);
}

@freezed
class SalesReport with _$SalesReport {
  const factory SalesReport({
    required List<RecentSale> sales,
    required SalesSummary summary,
    required int total,
    required int page,
    required int limit,
  }) = _SalesReport;

  factory SalesReport.fromJson(Map<String, dynamic> json) =>
      _$SalesReportFromJson(json);
}

@freezed
class SalesSummary with _$SalesSummary {
  const factory SalesSummary({
    required String revenue,
    required String profit,
    required String margin,
    required String averageReceipt,
    required int productsSold,
    required int count,
    required PaymentBreakdown payments,
  }) = _SalesSummary;

  factory SalesSummary.fromJson(Map<String, dynamic> json) =>
      _$SalesSummaryFromJson(json);
}

@freezed
class PaymentBreakdown with _$PaymentBreakdown {
  const factory PaymentBreakdown({
    required String cash,
    required String card,
    required String qr,
    @Default('0.0000') String bankTransfer,
    @Default('0.0000') String mobileWallet,
    @Default('0.0000') String other,
  }) = _PaymentBreakdown;

  factory PaymentBreakdown.fromJson(Map<String, dynamic> json) =>
      _$PaymentBreakdownFromJson(json);

  const PaymentBreakdown._();

  /// Total of all per-method buckets (invariant: == total sales revenue).
  double get total {
    return (double.tryParse(cash) ?? 0) +
        (double.tryParse(card) ?? 0) +
        (double.tryParse(qr) ?? 0) +
        (double.tryParse(bankTransfer) ?? 0) +
        (double.tryParse(mobileWallet) ?? 0) +
        (double.tryParse(other) ?? 0);
  }

  /// Share of [total] for a given amount (0 when total is zero).
  double percentOf(double amount) =>
      total <= 0 ? 0 : (amount / total) * 100;
}

// ──────────────────────────────────
// Chart data (from GET /reports/profit)
// ──────────────────────────────────
@freezed
class ProfitReport with _$ProfitReport {
  const factory ProfitReport({
    required ProfitSummary summary,
    required List<DailyProfit> daily,
    required List<WeeklyProfit> weekly,
    required List<MonthlyProfit> monthly,
  }) = _ProfitReport;

  factory ProfitReport.fromJson(Map<String, dynamic> json) =>
      _$ProfitReportFromJson(json);
}

@freezed
class ProfitSummary with _$ProfitSummary {
  const factory ProfitSummary({
    required String revenue,
    required String cost,
    required String profit,
    required String margin,
  }) = _ProfitSummary;

  factory ProfitSummary.fromJson(Map<String, dynamic> json) =>
      _$ProfitSummaryFromJson(json);
}

@freezed
class DailyProfit with _$DailyProfit {
  const factory DailyProfit({
    required String date,
    required String revenue,
    required String cost,
    required String profit,
    required String margin,
  }) = _DailyProfit;

  factory DailyProfit.fromJson(Map<String, dynamic> json) =>
      _$DailyProfitFromJson(json);
}

@freezed
class WeeklyProfit with _$WeeklyProfit {
  const factory WeeklyProfit({
    required String week,
    required String revenue,
    required String cost,
    required String profit,
    required String margin,
  }) = _WeeklyProfit;

  factory WeeklyProfit.fromJson(Map<String, dynamic> json) =>
      _$WeeklyProfitFromJson(json);
}

@freezed
class MonthlyProfit with _$MonthlyProfit {
  const factory MonthlyProfit({
    required String month,
    required String revenue,
    required String cost,
    required String profit,
    required String margin,
  }) = _MonthlyProfit;

  factory MonthlyProfit.fromJson(Map<String, dynamic> json) =>
      _$MonthlyProfitFromJson(json);
}

// ──────────────────────────────────
// Chart Data Points
// ──────────────────────────────────
@freezed
class ChartDataPoint with _$ChartDataPoint {
  const factory ChartDataPoint({
    required String label,
    required double revenue,
    required double profit,
  }) = _ChartDataPoint;
}
