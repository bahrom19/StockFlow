// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$$LoginRequestFromJson(Map<String, dynamic> json) => __LoginRequest(
      email: json['email'] as String,
      password: json['password'] as String,
    );

Map<String, dynamic> _$$LoginRequestToJson(__LoginRequest instance) =>
    <String, dynamic>{
      'email': instance.email,
      'password': instance.password,
    };

_$$LoginResponseFromJson(Map<String, dynamic> json) => __LoginResponse(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      expiresIn: json['expiresIn'] as String?,
      refreshExpiresIn: json['refreshExpiresIn'] as String?,
      user: CurrentUser.fromJson(json['user'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$LoginResponseToJson(__LoginResponse instance) =>
    <String, dynamic>{
      'accessToken': instance.accessToken,
      'refreshToken': instance.refreshToken,
      'expiresIn': instance.expiresIn,
      'refreshExpiresIn': instance.refreshExpiresIn,
      'user': instance.user,
    };

_$$RefreshRequestFromJson(Map<String, dynamic> json) => __RefreshRequest(
      refreshToken: json['refreshToken'] as String,
    );

Map<String, dynamic> _$$RefreshRequestToJson(__RefreshRequest instance) =>
    <String, dynamic>{
      'refreshToken': instance.refreshToken,
    };

_$$RefreshResponseFromJson(Map<String, dynamic> json) => __RefreshResponse(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      expiresIn: json['expiresIn'] as String?,
      refreshExpiresIn: json['refreshExpiresIn'] as String?,
      user: CurrentUser.fromJson(json['user'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$RefreshResponseToJson(__RefreshResponse instance) =>
    <String, dynamic>{
      'accessToken': instance.accessToken,
      'refreshToken': instance.refreshToken,
      'expiresIn': instance.expiresIn,
      'refreshExpiresIn': instance.refreshExpiresIn,
      'user': instance.user,
    };

_$$CurrentUserFromJson(Map<String, dynamic> json) => __CurrentUser(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      companyId: json['companyId'] as String,
      roles: (json['roles'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          <String>[],
      permissions: (json['permissions'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          <String>[],
      phone: json['phone'] as String?,
    );

Map<String, dynamic> _$$CurrentUserToJson(__CurrentUser instance) =>
    <String, dynamic>{
      'id': instance.id,
      'email': instance.email,
      'firstName': instance.firstName,
      'lastName': instance.lastName,
      'companyId': instance.companyId,
      'roles': instance.roles,
      'permissions': instance.permissions,
      'phone': instance.phone,
    };
