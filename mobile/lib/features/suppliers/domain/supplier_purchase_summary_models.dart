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

@freezed
class ProductPurchaseDetail with _$ProductPurchaseDetail {
  const factory ProductPurchaseDetail({
    required String productId,
    required String productName,
    String? sku,
    required int totalPurchasedQuantity,
    required String totalPurchaseSpend,
    required String weightedAverageUnitCost,
    required String minUnitCost,
    required String maxUnitCost,
    required int totalReturnedQuantity,
    required String totalReturnedSpend,
    required int netPurchasedQuantity,
    required String netPurchaseSpend,
    required int invoiceCount,
    String? firstPurchaseDate,
    String? lastPurchaseDate,
  }) = _ProductPurchaseDetail;

  factory ProductPurchaseDetail.fromJson(Map<String, dynamic> json) =>
      _$ProductPurchaseDetailFromJson(json);
}

@freezed
class ProductPurchaseListResponse with _$ProductPurchaseListResponse {
  const factory ProductPurchaseListResponse({
    required List<ProductPurchaseDetail> items,
    required int total,
    required int page,
    required int limit,
  }) = _ProductPurchaseListResponse;

  factory ProductPurchaseListResponse.fromJson(Map<String, dynamic> json) =>
      _$ProductPurchaseListResponseFromJson(json);
}
