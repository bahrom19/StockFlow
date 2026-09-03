// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supplier_contact_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SupplierContactImpl _$$SupplierContactImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierContactImpl(
      id: json['id'] as String,
      supplierId: json['supplierId'] as String,
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      position: json['position'] as String?,
      isPrimary: json['isPrimary'] as bool? ?? false,
      notes: json['notes'] as String?,
      rowVersion: (json['rowVersion'] as num?)?.toInt() ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      deletedAt: json['deletedAt'] == null
          ? null
          : DateTime.parse(json['deletedAt'] as String),
    );

Map<String, dynamic> _$$SupplierContactImplToJson(
        _$SupplierContactImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'supplierId': instance.supplierId,
      'firstName': instance.firstName,
      'lastName': instance.lastName,
      'phone': instance.phone,
      'email': instance.email,
      'position': instance.position,
      'isPrimary': instance.isPrimary,
      'notes': instance.notes,
      'rowVersion': instance.rowVersion,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
      'deletedAt': instance.deletedAt?.toIso8601String(),
    };

_$CreateSupplierContactRequestImpl _$$CreateSupplierContactRequestImplFromJson(
        Map<String, dynamic> json) =>
    _$CreateSupplierContactRequestImpl(
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      position: json['position'] as String?,
      isPrimary: json['isPrimary'] as bool? ?? false,
      notes: json['notes'] as String?,
    );

Map<String, dynamic> _$$CreateSupplierContactRequestImplToJson(
        _$CreateSupplierContactRequestImpl instance) =>
    <String, dynamic>{
      'firstName': instance.firstName,
      'lastName': instance.lastName,
      'phone': instance.phone,
      'email': instance.email,
      'position': instance.position,
      'isPrimary': instance.isPrimary,
      'notes': instance.notes,
    };
