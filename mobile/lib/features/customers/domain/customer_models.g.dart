// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'customer_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$CustomerImpl _$$CustomerImplFromJson(Map<String, dynamic> json) =>
    _$CustomerImpl(
      id: json['id'] as String,
      companyId: json['companyId'] as String,
      groupId: json['groupId'] as String?,
      type: json['type'] as String,
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      companyName: json['companyName'] as String?,
      iin: json['iin'] as String?,
      bin: json['bin'] as String?,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      mobile: json['mobile'] as String?,
      discount: json['discount'] as String?,
      creditLimit: json['creditLimit'] as String?,
      currentDebt: json['currentDebt'] as String?,
      bonusPoints: (json['bonusPoints'] as num?)?.toInt() ?? 0,
      notes: json['notes'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      deletedAt: json['deletedAt'] == null
          ? null
          : DateTime.parse(json['deletedAt'] as String),
    );

Map<String, dynamic> _$$CustomerImplToJson(_$CustomerImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'companyId': instance.companyId,
      'groupId': instance.groupId,
      'type': instance.type,
      'firstName': instance.firstName,
      'lastName': instance.lastName,
      'companyName': instance.companyName,
      'iin': instance.iin,
      'bin': instance.bin,
      'email': instance.email,
      'phone': instance.phone,
      'mobile': instance.mobile,
      'discount': instance.discount,
      'creditLimit': instance.creditLimit,
      'currentDebt': instance.currentDebt,
      'bonusPoints': instance.bonusPoints,
      'notes': instance.notes,
      'isActive': instance.isActive,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
      'deletedAt': instance.deletedAt?.toIso8601String(),
    };

_$CustomerListResponseImpl _$$CustomerListResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$CustomerListResponseImpl(
      items: (json['items'] as List<dynamic>)
          .map((e) => Customer.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
    );

Map<String, dynamic> _$$CustomerListResponseImplToJson(
        _$CustomerListResponseImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'total': instance.total,
      'page': instance.page,
      'limit': instance.limit,
    };

_$CreateCustomerRequestImpl _$$CreateCustomerRequestImplFromJson(
        Map<String, dynamic> json) =>
    _$CreateCustomerRequestImpl(
      type: json['type'] as String,
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      companyName: json['companyName'] as String?,
      iin: json['iin'] as String?,
      bin: json['bin'] as String?,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      mobile: json['mobile'] as String?,
      discount: json['discount'] as String?,
      creditLimit: json['creditLimit'] as String?,
      notes: json['notes'] as String?,
      isActive: json['isActive'] as bool? ?? true,
    );

Map<String, dynamic> _$$CreateCustomerRequestImplToJson(
        _$CreateCustomerRequestImpl instance) =>
    <String, dynamic>{
      'type': instance.type,
      'firstName': instance.firstName,
      'lastName': instance.lastName,
      'companyName': instance.companyName,
      'iin': instance.iin,
      'bin': instance.bin,
      'email': instance.email,
      'phone': instance.phone,
      'mobile': instance.mobile,
      'discount': instance.discount,
      'creditLimit': instance.creditLimit,
      'notes': instance.notes,
      'isActive': instance.isActive,
    };
