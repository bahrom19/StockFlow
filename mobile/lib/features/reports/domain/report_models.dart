import 'package:freezed_annotation/freezed_annotation.dart';

part 'report_models.freezed.dart';
part 'report_models.g.dart';

// ──────────────────────────────────
// Top Products (GET /reports/products/top)
// ──────────────────────────────────

@freezed
class TopProductsResponse with _$TopProductsResponse {
  const factory TopProductsResponse({
    required List<TopProductItem> items,
    required int total,
  }) = _TopProductsResponse;

  factory TopProductsResponse.fromJson(Map<String, dynamic> json) =>
      _$TopProductsResponseFromJson(json);
}

@freezed
class TopProductItem with _$TopProductItem {
  const factory TopProductItem({
    required String productId,
    required String productName,
    @Default('') String sku,
    @Default(0) int quantitySold,
    required String revenue,
    required String profit,
    required String margin,
  }) = _TopProductItem;

  factory TopProductItem.fromJson(Map<String, dynamic> json) =>
      _$TopProductItemFromJson(json);
}

// ──────────────────────────────────
// Inventory Valuation (GET /reports/inventory/value)
// ──────────────────────────────────

@freezed
class InventoryValuationResponse with _$InventoryValuationResponse {
  const factory InventoryValuationResponse({
    required List<InventoryValuationItem> items,
    required String totalValue,
    required int total,
    required int page,
    required int limit,
  }) = _InventoryValuationResponse;

  factory InventoryValuationResponse.fromJson(Map<String, dynamic> json) =>
      _$InventoryValuationResponseFromJson(json);
}

@freezed
class InventoryValuationItem with _$InventoryValuationItem {
  const factory InventoryValuationItem({
    required String productId,
    required String productName,
    @Default('') String sku,
    required int quantity,
    required String averageCost,
    required String inventoryValue,
  }) = _InventoryValuationItem;

  factory InventoryValuationItem.fromJson(Map<String, dynamic> json) =>
      _$InventoryValuationItemFromJson(json);
}

// ──────────────────────────────────
// Customer Report (GET /reports/customers)
// ──────────────────────────────────

@freezed
class CustomerReportResponse with _$CustomerReportResponse {
  const factory CustomerReportResponse({
    required List<CustomerReportItem> items,
    required int total,
    required int page,
    required int limit,
  }) = _CustomerReportResponse;

  factory CustomerReportResponse.fromJson(Map<String, dynamic> json) =>
      _$CustomerReportResponseFromJson(json);
}

@freezed
class CustomerReportItem with _$CustomerReportItem {
  const factory CustomerReportItem({
    required String customerId,
    required String name,
    String? email,
    String? phone,
    @Default(0) int orders,
    @Default('0.0000') String revenue,
    @Default('0.0000') String averageReceipt,
    String? lastPurchase,
  }) = _CustomerReportItem;

  factory CustomerReportItem.fromJson(Map<String, dynamic> json) =>
      _$CustomerReportItemFromJson(json);
}

// ──────────────────────────────────
// Supplier Report (GET /reports/suppliers)
// ──────────────────────────────────

@freezed
class SupplierReportResponse with _$SupplierReportResponse {
  const factory SupplierReportResponse({
    required List<SupplierReportItem> items,
    required int total,
    required int page,
    required int limit,
  }) = _SupplierReportResponse;

  factory SupplierReportResponse.fromJson(Map<String, dynamic> json) =>
      _$SupplierReportResponseFromJson(json);
}

@freezed
class SupplierReportItem with _$SupplierReportItem {
  const factory SupplierReportItem({
    required String supplierId,
    @Default('') String companyName,
    String? email,
    String? phone,
    @Default(0) int purchaseOrders,
    @Default('0.0000') String purchaseTotal,
    String? lastPurchase,
  }) = _SupplierReportItem;

  factory SupplierReportItem.fromJson(Map<String, dynamic> json) =>
      _$SupplierReportItemFromJson(json);
}

// ──────────────────────────────────
// Cash Shift Report (GET /reports/cash-shifts)
// ──────────────────────────────────

@freezed
class CashShiftReportResponse with _$CashShiftReportResponse {
  const factory CashShiftReportResponse({
    required List<CashShiftReportItem> items,
    required int total,
    required int page,
    required int limit,
  }) = _CashShiftReportResponse;

  factory CashShiftReportResponse.fromJson(Map<String, dynamic> json) =>
      _$CashShiftReportResponseFromJson(json);
}

@freezed
class CashShiftReportItem with _$CashShiftReportItem {
  const factory CashShiftReportItem({
    required String id,
    required String status,
    required String openedAt,
    String? closedAt,
    @Default('') String warehouseName,
    @Default('') String cashierName,
    required String openingBalance,
    required String closingBalance,
    @Default('0.0000') String cashSales,
    @Default('0.0000') String cardSales,
    @Default('0.0000') String qrSales,
    @Default('0.0000') String bankTransferSales,
    @Default('0.0000') String mobileWalletSales,
    @Default('0.0000') String totalSales,
    @Default('0.0000') String cashIn,
    @Default('0.0000') String cashOut,
    @Default('0.0000') String expectedClosing,
    @Default('0.0000') String difference,
    String? notes,
  }) = _CashShiftReportItem;

  factory CashShiftReportItem.fromJson(Map<String, dynamic> json) =>
      _$CashShiftReportItemFromJson(json);

  const CashShiftReportItem._();

  /// True if the shift is still open (no closedAt).
  bool get isOpen => closedAt == null;

  /// Numeric shorthand helpers.
  double get totalSalesAmount => double.tryParse(totalSales) ?? 0;
  double get differenceAmount => double.tryParse(difference) ?? 0;
}
