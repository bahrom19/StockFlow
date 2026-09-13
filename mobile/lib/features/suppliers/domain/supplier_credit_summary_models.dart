/// G9-D1: Supplier Credit Summary domain model — mirrors the backend
/// `SupplierCreditSummaryEntity` (read-only, observability only).
///
/// Backend contract (all monetary values are exact DECIMAL strings,
/// company base currency only — non-base-currency documents are excluded):
///   GET /suppliers/:supplierId/credit-summary
///
///  - creditLimit: null = not configured (NOT the same as 0); '0' = explicit
///    zero limit; positive = configured limit.
///  - outstandingAP: canonical supplier AP in base currency.
///  - availableCredit: creditLimit − outstandingAP; null when no limit is
///    configured; may be negative (over-limit is not an error).
///  - utilizationPercent: (outstandingAP / creditLimit) * 100, 2dp; null when
///    no limit is configured or the limit is 0 (never divide by zero).
class SupplierCreditSummary {
  final String supplierId;
  final String? creditLimit;
  final String outstandingAP;
  final String? availableCredit;
  final String? utilizationPercent;
  final String currency;

  const SupplierCreditSummary({
    required this.supplierId,
    this.creditLimit,
    required this.outstandingAP,
    this.availableCredit,
    this.utilizationPercent,
    required this.currency,
  });

  factory SupplierCreditSummary.fromJson(Map<String, dynamic> json) {
    return SupplierCreditSummary(
      supplierId: json['supplierId'] as String,
      creditLimit: json['creditLimit'] as String?,
      outstandingAP: (json['outstandingAP'] ?? '0').toString(),
      availableCredit: json['availableCredit'] as String?,
      utilizationPercent: json['utilizationPercent'] as String?,
      currency: (json['currency'] ?? 'KZT').toString(),
    );
  }
}