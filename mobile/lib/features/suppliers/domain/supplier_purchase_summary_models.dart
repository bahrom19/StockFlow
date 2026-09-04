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

@freezed
class RecentDelivery with _$RecentDelivery {
  const factory RecentDelivery({
    required String orderNumber,
    required String orderDate,
    String? expectedDate,
    String? receiptDate,
    int? leadTimeDays,
    bool? onTime,
    required String status,
    required String grandTotal,
  }) = _RecentDelivery;

  factory RecentDelivery.fromJson(Map<String, dynamic> json) =>
      _$RecentDeliveryFromJson(json);
}

@freezed
class SupplierReliability with _$SupplierReliability {
  const factory SupplierReliability({
    required String dateFrom,
    required String dateTo,
    required int totalOrders,
    required int totalReceipts,
    required double onTimeDeliveryRate,
    required double averageLeadTimeDays,
    int? minLeadTimeDays,
    int? maxLeadTimeDays,
    required int ordersReceived,
    required int ordersPartiallyReceived,
    required int ordersCancelled,
    required double cancellationRate,
    @Default([]) List<RecentDelivery> recentDeliveries,
  }) = _SupplierReliability;

  factory SupplierReliability.fromJson(Map<String, dynamic> json) =>
      _$SupplierReliabilityFromJson(json);
}

@freezed
class PricePoint with _$PricePoint {
  const factory PricePoint({
    required String invoiceDate,
    required String invoiceNumber,
    required String unitCost,
    required int quantity,
    required String total,
  }) = _PricePoint;

  factory PricePoint.fromJson(Map<String, dynamic> json) =>
      _$PricePointFromJson(json);
}

@freezed
class SupplierPriceHistory with _$SupplierPriceHistory {
  const factory SupplierPriceHistory({
    required String productId,
    required String productName,
    String? sku,
    required String dateFrom,
    required String dateTo,
    String? currentQuotedPrice,
    required String averageUnitCost,
    required String minUnitCost,
    required String maxUnitCost,
    @Default([]) List<PricePoint> pricePoints,
  }) = _SupplierPriceHistory;

  factory SupplierPriceHistory.fromJson(Map<String, dynamic> json) =>
      _$SupplierPriceHistoryFromJson(json);
}

@freezed
class OverdueSupplierInvoice with _$OverdueSupplierInvoice {
  const factory OverdueSupplierInvoice({
    required String invoiceId,
    required String invoiceNumber,
    required String invoiceDate,
    String? dueDate,
    required String grandTotal,
    required String paidAmount,
    required String outstanding,
    required int daysOverdue,
  }) = _OverdueSupplierInvoice;

  factory OverdueSupplierInvoice.fromJson(Map<String, dynamic> json) =>
      _$OverdueSupplierInvoiceFromJson(json);
}

@freezed
class PaymentAgingBuckets with _$PaymentAgingBuckets {
  const factory PaymentAgingBuckets({
    required String current,
    required String days1To30,
    required String days31To60,
    required String days61To90,
    required String overdue90Plus,
  }) = _PaymentAgingBuckets;

  factory PaymentAgingBuckets.fromJson(Map<String, dynamic> json) =>
      _$PaymentAgingBucketsFromJson(json);
}

@freezed
class SupplierPaymentAging with _$SupplierPaymentAging {
  const factory SupplierPaymentAging({
    required String totalOutstanding,
    required PaymentAgingBuckets aging,
    @Default([]) List<OverdueSupplierInvoice> overdueInvoices,
    required int invoiceCount,
    required int overdueCount,
  }) = _SupplierPaymentAging;

  factory SupplierPaymentAging.fromJson(Map<String, dynamic> json) =>
      _$SupplierPaymentAgingFromJson(json);
}

@freezed
class TopReturnedProduct with _$TopReturnedProduct {
  const factory TopReturnedProduct({
    required String productId,
    required String productName,
    String? sku,
    required int returnedQuantity,
    required String returnedAmount,
    required int returnCount,
  }) = _TopReturnedProduct;

  factory TopReturnedProduct.fromJson(Map<String, dynamic> json) =>
      _$TopReturnedProductFromJson(json);
}

@freezed
class SupplierReturnSummary with _$SupplierReturnSummary {
  const factory SupplierReturnSummary({
    required String dateFrom,
    required String dateTo,
    required String totalReturnedAmount,
    required int totalReturnedQuantity,
    required int returnCount,
    required String totalPurchaseSpend,
    required int totalPurchasedQuantity,
    required double amountReturnRate,
    required double quantityReturnRate,
    @Default([]) List<TopReturnedProduct> topReturnedProducts,
  }) = _SupplierReturnSummary;

  factory SupplierReturnSummary.fromJson(Map<String, dynamic> json) =>
      _$SupplierReturnSummaryFromJson(json);
}
