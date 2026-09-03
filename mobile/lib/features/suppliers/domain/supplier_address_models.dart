import 'package:freezed_annotation/freezed_annotation.dart';

part 'supplier_address_models.freezed.dart';
part 'supplier_address_models.g.dart';

@freezed
class SupplierAddress with _$SupplierAddress {
  const SupplierAddress._();

  const factory SupplierAddress({
    required String id,
    required String supplierId,
    String? city,
    String? country,
    String? street,
    String? postalCode,
    @Default(false) bool isDefault,
    required DateTime createdAt,
    required DateTime updatedAt,
    DateTime? deletedAt,
  }) = _SupplierAddress;

  factory SupplierAddress.fromJson(Map<String, dynamic> json) =>
      _$SupplierAddressFromJson(json);

  String get displayAddress {
    final parts = <String>[];
    if (street != null && street!.isNotEmpty) parts.add(street!);
    if (city != null && city!.isNotEmpty) parts.add(city!);
    if (country != null && country!.isNotEmpty) parts.add(country!);
    if (postalCode != null && postalCode!.isNotEmpty) parts.add(postalCode!);
    return parts.isEmpty ? id.substring(0, 8) : parts.join(', ');
  }
}

@freezed
class CreateSupplierAddressRequest with _$CreateSupplierAddressRequest {
  const factory CreateSupplierAddressRequest({
    String? city,
    String? country,
    String? street,
    String? postalCode,
    @Default(false) bool isDefault,
  }) = _CreateSupplierAddressRequest;

  factory CreateSupplierAddressRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateSupplierAddressRequestFromJson(json);
}
