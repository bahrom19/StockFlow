import 'package:freezed_annotation/freezed_annotation.dart';

part 'customer_models.freezed.dart';
part 'customer_models.g.dart';

// ──────────────────────────────────
// CustomerType enum (backend: PERSON | COMPANY)
// ──────────────────────────────────
enum CustomerType {
  @JsonValue('PERSON')
  person,
  @JsonValue('COMPANY')
  company;

  String get label {
    switch (this) {
      case CustomerType.person:
        return 'Person';
      case CustomerType.company:
        return 'Company';
    }
  }

  static CustomerType fromApi(String? value) {
    switch (value) {
      case 'COMPANY':
        return CustomerType.company;
      default:
        return CustomerType.person;
    }
  }
}

// ──────────────────────────────────
// Customer (matches CustomerEntity)
// ──────────────────────────────────
@freezed
class Customer with _$Customer {
  const Customer._();

  const factory Customer({
    required String id,
    required String companyId,
    String? groupId,
    required String type,
    String? firstName,
    String? lastName,
    String? companyName,
    String? iin,
    String? bin,
    String? email,
    String? phone,
    String? mobile,
    String? discount,
    String? creditLimit,
    String? currentDebt,
    @Default(0) int bonusPoints,
    String? notes,
    @Default(true) bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
    DateTime? deletedAt,
  }) = _Customer;

  factory Customer.fromJson(Map<String, dynamic> json) =>
      _$CustomerFromJson(json);

  /// Display name: company > "First Last" > email > id short.
  String get displayName {
    if (companyName != null && companyName!.trim().isNotEmpty) {
      return companyName!;
    }
    final first = (firstName ?? '').trim();
    final last = (lastName ?? '').trim();
    if (first.isNotEmpty || last.isNotEmpty) {
      return '$first $last'.trim();
    }
    if (email != null && email!.isNotEmpty) return email!;
    return id.substring(0, 8);
  }

  String get phoneOrMobile => (phone ?? mobile ?? '').trim();
}

// ──────────────────────────────────
// Customer List Response (paginated)
// ──────────────────────────────────
@freezed
class CustomerListResponse with _$CustomerListResponse {
  const factory CustomerListResponse({
    required List<Customer> items,
    required int total,
    required int page,
    required int limit,
  }) = _CustomerListResponse;

  factory CustomerListResponse.fromJson(Map<String, dynamic> json) =>
      _$CustomerListResponseFromJson(json);
}

// ──────────────────────────────────
// Create Customer Request
// ──────────────────────────────────
@freezed
class CreateCustomerRequest with _$CreateCustomerRequest {
  const factory CreateCustomerRequest({
    required String type,
    String? firstName,
    String? lastName,
    String? companyName,
    String? iin,
    String? bin,
    String? email,
    String? phone,
    String? mobile,
    String? discount,
    String? creditLimit,
    String? notes,
    @Default(true) bool isActive,
  }) = _CreateCustomerRequest;

  factory CreateCustomerRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateCustomerRequestFromJson(json);
}
