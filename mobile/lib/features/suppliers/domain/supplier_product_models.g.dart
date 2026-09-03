// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supplier_product_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SupplierProductImpl _$$SupplierProductImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierProductImpl(
      id: json['id'] as String,
      companyId: json['companyId'] as String,
      supplierId: json['supplierId'] as String,
      productId: json['productId'] as String,
      supplierSku: json['supplierSku'] as String?,
      purchasePrice: json['purchasePrice'] as String?,
      currency: json['currency'] as String,
      isPreferred: json['isPreferred'] as bool? ?? false,
      notes: json['notes'] as String?,
      lastPurchaseAt: json['lastPurchaseAt'] == null
          ? null
          : DateTime.parse(json['lastPurchaseAt'] as String),
      rowVersion: (json['rowVersion'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      deletedAt: json['deletedAt'] == null
          ? null
          : DateTime.parse(json['deletedAt'] as String),
      product: SupplierProductProduct.fromJson(
          json['product'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$SupplierProductImplToJson(
        _$SupplierProductImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'companyId': instance.companyId,
      'supplierId': instance.supplierId,
      'productId': instance.productId,
      'supplierSku': instance.supplierSku,
      'purchasePrice': instance.purchasePrice,
      'currency': instance.currency,
      'isPreferred': instance.isPreferred,
      'notes': instance.notes,
      'lastPurchaseAt': instance.lastPurchaseAt?.toIso8601String(),
      'rowVersion': instance.rowVersion,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
      'deletedAt': instance.deletedAt?.toIso8601String(),
      'product': instance.product,
    };

_$SupplierProductProductImpl _$$SupplierProductProductImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierProductProductImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      sku: json['sku'] as String?,
    );

Map<String, dynamic> _$$SupplierProductProductImplToJson(
        _$SupplierProductProductImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'sku': instance.sku,
    };

_$SupplierProductListResponseImpl _$$SupplierProductListResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierProductListResponseImpl(
      items: (json['items'] as List<dynamic>)
          .map((e) => SupplierProduct.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
    );

Map<String, dynamic> _$$SupplierProductListResponseImplToJson(
        _$SupplierProductListResponseImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'total': instance.total,
      'page': instance.page,
      'limit': instance.limit,
    };

_$CreateSupplierProductRequestImpl _$$CreateSupplierProductRequestImplFromJson(
        Map<String, dynamic> json) =>
    _$CreateSupplierProductRequestImpl(
      productId: json['productId'] as String,
      supplierSku: json['supplierSku'] as String?,
      purchasePrice: (json['purchasePrice'] as num?)?.toDouble(),
      currency: json['currency'] as String?,
      isPreferred: json['isPreferred'] as bool? ?? false,
      notes: json['notes'] as String?,
    );

Map<String, dynamic> _$$CreateSupplierProductRequestImplToJson(
        _$CreateSupplierProductRequestImpl instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'supplierSku': instance.supplierSku,
      'purchasePrice': instance.purchasePrice,
      'currency': instance.currency,
      'isPreferred': instance.isPreferred,
      'notes': instance.notes,
    };
