import 'package:freezed_annotation/freezed_annotation.dart';

part 'supplier_contact_models.freezed.dart';
part 'supplier_contact_models.g.dart';

@freezed
class SupplierContact with _$SupplierContact {
  const SupplierContact._();

  const factory SupplierContact({
    required String id,
    required String supplierId,
    String? firstName,
    String? lastName,
    String? phone,
    String? email,
    String? position,
    @Default(false) bool isPrimary,
    String? notes,
    @Default(0) int rowVersion,
    required DateTime createdAt,
    required DateTime updatedAt,
    DateTime? deletedAt,
  }) = _SupplierContact;

  factory SupplierContact.fromJson(Map<String, dynamic> json) =>
      _$SupplierContactFromJson(json);

  String get displayName {
    final first = (firstName ?? '').trim();
    final last = (lastName ?? '').trim();
    if (first.isNotEmpty || last.isNotEmpty) {
      return '$first $last'.trim();
    }
    if (email != null && email!.isNotEmpty) return email!;
    if (position != null && position!.isNotEmpty) return position!;
    return id.substring(0, 8);
  }
}

@freezed
class CreateSupplierContactRequest with _$CreateSupplierContactRequest {
  const factory CreateSupplierContactRequest({
    String? firstName,
    String? lastName,
    String? phone,
    String? email,
    String? position,
    @Default(false) bool isPrimary,
    String? notes,
  }) = _CreateSupplierContactRequest;

  factory CreateSupplierContactRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateSupplierContactRequestFromJson(json);
}
