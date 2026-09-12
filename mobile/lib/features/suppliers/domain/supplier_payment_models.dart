import 'package:freezed_annotation/freezed_annotation.dart';

part 'supplier_payment_models.freezed.dart';
part 'supplier_payment_models.g.dart';

@freezed
class SupplierPayment with _$SupplierPayment {
  const factory SupplierPayment({
    required String id,
    required String companyId,
    required String supplierId,
    required String purchaseInvoiceId,
    required String paymentNumber,
    required DateTime paymentDate,
    required String amount,
    required String method,
    String? cashAccountId,
    String? bankAccountId,
    required String currency,
    String? reference,
    String? notes,
    String? createdBy,
    @Default(0) int rowVersion,
    required DateTime createdAt,
    required DateTime updatedAt,
    DateTime? deletedAt,
  }) = _SupplierPayment;

  factory SupplierPayment.fromJson(Map<String, dynamic> json) =>
      _$SupplierPaymentFromJson(json);
}

@freezed
class SupplierPaymentListResponse with _$SupplierPaymentListResponse {
  const factory SupplierPaymentListResponse({
    required List<SupplierPayment> items,
    required int total,
    required int page,
    required int limit,
  }) = _SupplierPaymentListResponse;

  factory SupplierPaymentListResponse.fromJson(Map<String, dynamic> json) =>
      _$SupplierPaymentListResponseFromJson(json);
}

@freezed
class CreateSupplierPaymentRequest with _$CreateSupplierPaymentRequest {
  const factory CreateSupplierPaymentRequest({
    required String purchaseInvoiceId,
    required double amount,
    required String method,
    String? cashAccountId,
    String? bankAccountId,
    String? currency,
    String? paymentDate,
    String? reference,
    String? notes,
  }) = _CreateSupplierPaymentRequest;

  factory CreateSupplierPaymentRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateSupplierPaymentRequestFromJson(json);
}

@freezed
class SupplierFinanceSummary with _$SupplierFinanceSummary {
  const factory SupplierFinanceSummary({
    required String supplierId,
    required String totalInvoiced,
    required String totalPaid,
    required String totalReturned,
    required String outstanding,
    required int invoiceCount,
    required int paymentCount,
    DateTime? lastPaymentDate,
    String? lastPaymentAmount,
  }) = _SupplierFinanceSummary;

  factory SupplierFinanceSummary.fromJson(Map<String, dynamic> json) =>
      _$SupplierFinanceSummaryFromJson(json);
}

/// Lightweight supplier-scoped invoice projection used by Record Payment.
@freezed
class SupplierInvoiceLite with _$SupplierInvoiceLite {
  const factory SupplierInvoiceLite({
    required String id,
    required String invoiceNumber,
    required String grandTotal,
    required String paidAmount,
    required String status,
    required String currency,
    DateTime? dueDate,
  }) = _SupplierInvoiceLite;

  factory SupplierInvoiceLite.fromJson(Map<String, dynamic> json) =>
      _$SupplierInvoiceLiteFromJson(json);
}

/// Cash account projection returned by GET /finance/cash-accounts.
@freezed
class CashAccountLite with _$CashAccountLite {
  const factory CashAccountLite({
    required String id,
    required String name,
    required String currency,
    String? type,
  }) = _CashAccountLite;

  factory CashAccountLite.fromJson(Map<String, dynamic> json) =>
      _$CashAccountLiteFromJson(json);
}

/// Bank account projection returned by GET /finance/bank-accounts.
@freezed
class BankAccountLite with _$BankAccountLite {
  const factory BankAccountLite({
    required String id,
    required String bankName,
    required String accountNumber,
    String? accountName,
    required String currency,
  }) = _BankAccountLite;

  factory BankAccountLite.fromJson(Map<String, dynamic> json) =>
      _$BankAccountLiteFromJson(json);
}

// ── G5: Purchase Invoice models ──────────────────────────────

/// Single line item inside a purchase invoice.
@freezed
class PurchaseInvoiceItem with _$PurchaseInvoiceItem {
  const factory PurchaseInvoiceItem({
    required String id,
    required String purchaseInvoiceId,
    required String productId,
    String? purchaseOrderItemId,
    required int quantity,
    required String unitCost,
    String? discountPercent,
    required String discountAmount,
    String? taxPercent,
    required String taxAmount,
    required String subtotal,
    required String total,
    String? notes,
  }) = _PurchaseInvoiceItem;

  factory PurchaseInvoiceItem.fromJson(Map<String, dynamic> json) =>
      _$PurchaseInvoiceItemFromJson(json);
}

/// Full purchase invoice entity returned by the backend.
@freezed
class PurchaseInvoice with _$PurchaseInvoice {
  const factory PurchaseInvoice({
    required String id,
    required String companyId,
    required String purchaseOrderId,
    required String supplierId,
    required String invoiceNumber,
    required String invoiceDate,
    String? dueDate,
    required String status,
    required String subtotal,
    required String discountAmount,
    required String taxAmount,
    required String grandTotal,
    required String paidAmount,
    required String currency,
    String? notes,
    String? approvedBy,
    String? approvedAt,
    String? cancelledBy,
    String? cancelledAt,
    required String createdAt,
    required String updatedAt,
    String? deletedAt,
    @Default([]) List<PurchaseInvoiceItem> items,
  }) = _PurchaseInvoice;

  factory PurchaseInvoice.fromJson(Map<String, dynamic> json) =>
      _$PurchaseInvoiceFromJson(json);
}

/// Paginated response from GET /purchasing/invoices.
@freezed
class PurchaseInvoiceListResponse with _$PurchaseInvoiceListResponse {
  const factory PurchaseInvoiceListResponse({
    required List<PurchaseInvoice> items,
    required int total,
    required int page,
    required int limit,
  }) = _PurchaseInvoiceListResponse;

  factory PurchaseInvoiceListResponse.fromJson(Map<String, dynamic> json) =>
      _$PurchaseInvoiceListResponseFromJson(json);
}
