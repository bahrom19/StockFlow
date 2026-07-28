import 'package:freezed_annotation/freezed_annotation.dart';

part 'supplier_models.freezed.dart';
part 'supplier_models.g.dart';

@freezed
class Supplier with _$Supplier {
  const factory Supplier({
    required String id,
    required String companyId,
    required String companyName,
    String? bin,
    String? email,
    String? phone,
    String? website,
    String? notes,
    @Default(true) bool isActive,
    required DateTime createdAt,
    required DateTime updatedAt,
    DateTime? deletedAt,
  }) = _Supplier;

  factory Supplier.fromJson(Map<String, dynamic> json) =>
      _$SupplierFromJson(json);
}

@freezed
class SupplierListResponse with _$SupplierListResponse {
  const factory SupplierListResponse({
    required List<Supplier> items,
    required int total,
    required int page,
    required int limit,
  }) = _SupplierListResponse;

  factory SupplierListResponse.fromJson(Map<String, dynamic> json) =>
      _$SupplierListResponseFromJson(json);
}

@freezed
class CreateSupplierRequest with _$CreateSupplierRequest {
  const factory CreateSupplierRequest({
    required String companyName,
    String? bin,
    String? email,
    String? phone,
    String? website,
    String? notes,
    @Default(true) bool isActive,
  }) = _CreateSupplierRequest;

  factory CreateSupplierRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateSupplierRequestFromJson(json);
}
