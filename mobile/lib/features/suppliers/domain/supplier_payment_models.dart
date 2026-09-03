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
