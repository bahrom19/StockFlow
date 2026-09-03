import 'package:freezed_annotation/freezed_annotation.dart';

part 'supplier_product_models.freezed.dart';
part 'supplier_product_models.g.dart';

@freezed
class SupplierProduct with _$SupplierProduct {
  const factory SupplierProduct({
    required String id,
    required String companyId,
    required String supplierId,
    required String productId,
    String? supplierSku,
    String? purchasePrice,
    required String currency,
    @Default(false) bool isPreferred,
    String? notes,
    DateTime? lastPurchaseAt,
    @Default(0) int rowVersion,
    required DateTime createdAt,
    required DateTime updatedAt,
    DateTime? deletedAt,
    required SupplierProductProduct product,
  }) = _SupplierProduct;

  factory SupplierProduct.fromJson(Map<String, dynamic> json) =>
      _$SupplierProductFromJson(json);
}

@freezed
class SupplierProductProduct with _$SupplierProductProduct {
  const factory SupplierProductProduct({
    required String id,
    required String name,
    String? sku,
  }) = _SupplierProductProduct;

  factory SupplierProductProduct.fromJson(Map<String, dynamic> json) =>
      _$SupplierProductProductFromJson(json);
}

@freezed
class SupplierProductListResponse with _$SupplierProductListResponse {
  const factory SupplierProductListResponse({
    required List<SupplierProduct> items,
    required int total,
    required int page,
    required int limit,
  }) = _SupplierProductListResponse;

  factory SupplierProductListResponse.fromJson(Map<String, dynamic> json) =>
      _$SupplierProductListResponseFromJson(json);
}

@freezed
class CreateSupplierProductRequest with _$CreateSupplierProductRequest {
  const factory CreateSupplierProductRequest({
    required String productId,
    String? supplierSku,
    double? purchasePrice,
    String? currency,
    @Default(false) bool isPreferred,
    String? notes,
  }) = _CreateSupplierProductRequest;

  factory CreateSupplierProductRequest.fromJson(Map<String, dynamic> json) =>
      _$CreateSupplierProductRequestFromJson(json);
}
