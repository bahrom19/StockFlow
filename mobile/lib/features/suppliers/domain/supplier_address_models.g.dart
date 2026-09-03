// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supplier_address_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SupplierAddressImpl _$$SupplierAddressImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierAddressImpl(
      id: json['id'] as String,
      supplierId: json['supplierId'] as String,
      city: json['city'] as String?,
      country: json['country'] as String?,
      street: json['street'] as String?,
      postalCode: json['postalCode'] as String?,
      isDefault: json['isDefault'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      deletedAt: json['deletedAt'] == null
          ? null
          : DateTime.parse(json['deletedAt'] as String),
    );

Map<String, dynamic> _$$SupplierAddressImplToJson(
        _$SupplierAddressImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'supplierId': instance.supplierId,
      'city': instance.city,
      'country': instance.country,
      'street': instance.street,
      'postalCode': instance.postalCode,
      'isDefault': instance.isDefault,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
      'deletedAt': instance.deletedAt?.toIso8601String(),
    };

_$CreateSupplierAddressRequestImpl _$$CreateSupplierAddressRequestImplFromJson(
        Map<String, dynamic> json) =>
    _$CreateSupplierAddressRequestImpl(
      city: json['city'] as String?,
      country: json['country'] as String?,
      street: json['street'] as String?,
      postalCode: json['postalCode'] as String?,
      isDefault: json['isDefault'] as bool? ?? false,
    );

Map<String, dynamic> _$$CreateSupplierAddressRequestImplToJson(
        _$CreateSupplierAddressRequestImpl instance) =>
    <String, dynamic>{
      'city': instance.city,
      'country': instance.country,
      'street': instance.street,
      'postalCode': instance.postalCode,
      'isDefault': instance.isDefault,
    };
