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
// Purchasing Summary (from GET /reports/purchasing → summary)
// ──────────────────────────────────
/// Lightweight purchasing summary used by the Dashboard Action Center
/// (event #4 — pending purchase orders). Loaded once per dashboard refresh
/// with `limit=1` so only the `summary` block is consumed; the `orders` list
/// is ignored.
///
/// Decision (docs/ux/dashboard_v33_action_center.md §3a): Dashboard uses this
/// Dashboard-specific summary request instead of `poListProvider`, which
/// belongs to the Purchasing screen.
@freezed
class PurchasingSummary with _$PurchasingSummary {
  const factory PurchasingSummary({
    required int totalOrders,
    required String totalValue,
    @Default({}) Map<String, int> byStatus,
  }) = _PurchasingSummary;

  factory PurchasingSummary.fromJson(Map<String, dynamic> json) =>
      _$PurchasingSummaryFromJson(json);

  const PurchasingSummary._();

  /// PENDING + ORDERED — purchase orders awaiting owner action.
  /// Strictly excludes APPROVED / PARTIALLY_RECEIVED / RECEIVED / CANCELLED /
  /// DRAFT (approved decision — see docs §3a).
  int get pendingPoCount =>
      (byStatus['PENDING'] ?? 0) + (byStatus['ORDERED'] ?? 0);
}

// ──────────────────────────────────
// Low Stock Item (from GET /reports/inventory/low-stock)
// ──────────────────────────────────
/// One low-stock inventory position, used by Action Center event #3 to show
/// the top-3 most critical items (name, SKU, stock, min, warehouse).
///
/// Stage B decision (docs/ux/dashboard_v33_action_center.md §3a): the
/// Dashboard loads this lightweight list once per refresh via the existing
/// endpoint — NOT on the 20s Cash Drawer timer.
@freezed
class LowStockItem with _$LowStockItem {
  const factory LowStockItem({
    required String productId,
    required String productName,
    required String sku,
    required int currentStock,
    required int minQuantity,
    required String warehouseId,
    required String warehouseName,
    required String status,
  }) = _LowStockItem;

  factory LowStockItem.fromJson(Map<String, dynamic> json) =>
      _$LowStockItemFromJson(json);

  const LowStockItem._();

  /// Units below the reorder point: `minQuantity − currentStock`.
  /// Positive = shortfall. Drives the deterministic Low Stock sort
  /// (largest deficit first).
  int get deficit => minQuantity - currentStock;

  /// True when this position is a plain low stock (not out of stock).
  bool get isLowStock => status == 'LOW_STOCK';
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
