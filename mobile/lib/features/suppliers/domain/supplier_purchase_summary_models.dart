import 'package:freezed_annotation/freezed_annotation.dart';

part 'supplier_purchase_summary_models.freezed.dart';
part 'supplier_purchase_summary_models.g.dart';

@freezed
class MonthlySpend with _$MonthlySpend {
  const factory MonthlySpend({
    required String month,
    required String amount,
  }) = _MonthlySpend;

  factory MonthlySpend.fromJson(Map<String, dynamic> json) =>
      _$MonthlySpendFromJson(json);
}

@freezed
class SupplierPurchaseSummary with _$SupplierPurchaseSummary {
  const factory SupplierPurchaseSummary({
    required String dateFrom,
    required String dateTo,
    required String totalInvoiced,
    required String totalReturned,
    required String netPurchaseSpend,
    required int totalPurchasedQuantity,
    required String weightedAverageUnitCost,
    required int invoiceCount,
    required int returnCount,
    String? firstPurchaseDate,
    String? lastPurchaseDate,
    @Default([]) List<MonthlySpend> monthlySpend,
    required String currentTotalPaid,
    required String currentOutstanding,
  }) = _SupplierPurchaseSummary;

  factory SupplierPurchaseSummary.fromJson(Map<String, dynamic> json) =>
      _$SupplierPurchaseSummaryFromJson(json);
}
