// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_models.dart';

// ---------------------------------------------------------------------------
// LoginRequest
// ---------------------------------------------------------------------------

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It looks like your constructor used to help with testing. '
    'Please use the actual class you want to test.');

class _$LoginRequestTearOff {
  const _$LoginRequestTearOff();

  _LoginRequest call({required String email, required String password}) {
    return _LoginRequest(
      email: email,
      password: password,
    );
  }

  LoginRequest fromJson(Map<String, Object?> json) {
    return LoginRequest.fromJson(json);
  }
}

const $LoginRequest = _$LoginRequestTearOff();

mixin _$LoginRequest {
  String get email;
  String get password;

  Map<String, dynamic> toJson() => _$$LoginRequestToJson(this as _LoginRequest);

  @override
  String toString() => 'LoginRequest(email: $email, password: $password)';

  @override
  bool operator ==(dynamic other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _LoginRequest &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.password, password) || other.password == password));
  }

  @override
  int get hashCode => Object.hash(runtimeType, email, password);
}

abstract class _LoginRequest extends LoginRequest {
  const factory _LoginRequest(
      {required final String email,
      required final String password}) = __LoginRequest;
  const _LoginRequest._() : super._();

  factory _LoginRequest.fromJson(Map<String, dynamic> json) =
      __LoginRequest.fromJson;
}

class __LoginRequest extends _LoginRequest {
  const __LoginRequest({required this.email, required this.password})
      : super._();

  @override
  final String email;
  @override
  final String password;

  @override
  Map<String, dynamic> toJson() => _$$LoginRequestToJson(this);
}

// ---------------------------------------------------------------------------
// LoginResponse
// ---------------------------------------------------------------------------

class _$LoginResponseTearOff {
  const _$LoginResponseTearOff();

  _LoginResponse call({
    required String accessToken,
    required String refreshToken,
    String? expiresIn,
    String? refreshExpiresIn,
    required CurrentUser user,
  }) {
    return _LoginResponse(
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: expiresIn,
      refreshExpiresIn: refreshExpiresIn,
      user: user,
    );
  }

  LoginResponse fromJson(Map<String, Object?> json) {
    return LoginResponse.fromJson(json);
  }
}

const $LoginResponse = _$LoginResponseTearOff();

mixin _$LoginResponse {
  String get accessToken;
  String get refreshToken;
  String? get expiresIn;
  String? get refreshExpiresIn;
  CurrentUser get user;

  Map<String, dynamic> toJson() =>
      _$$LoginResponseToJson(this as _LoginResponse);

  @override
  String toString() =>
      'LoginResponse(accessToken: $accessToken, refreshToken: $refreshToken, expiresIn: $expiresIn, refreshExpiresIn: $refreshExpiresIn, user: $user)';

  @override
  bool operator ==(dynamic other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _LoginResponse &&
            (identical(other.accessToken, accessToken) ||
                other.accessToken == accessToken) &&
            (identical(other.refreshToken, refreshToken) ||
                other.refreshToken == refreshToken) &&
            (identical(other.expiresIn, expiresIn) ||
                other.expiresIn == expiresIn) &&
            (identical(other.refreshExpiresIn, refreshExpiresIn) ||
                other.refreshExpiresIn == refreshExpiresIn) &&
            (identical(other.user, user) || other.user == user));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType, accessToken, refreshToken, expiresIn, refreshExpiresIn, user);
}

abstract class _LoginResponse extends LoginResponse {
  const factory _LoginResponse({
    required final String accessToken,
    required final String refreshToken,
    final String? expiresIn,
    final String? refreshExpiresIn,
    required final CurrentUser user,
  }) = __LoginResponse;
  const _LoginResponse._() : super._();

  factory _LoginResponse.fromJson(Map<String, dynamic> json) =
      __LoginResponse.fromJson;
}

class __LoginResponse extends _LoginResponse {
  const __LoginResponse({
    required this.accessToken,
    required this.refreshToken,
    this.expiresIn,
    this.refreshExpiresIn,
    required this.user,
  }) : super._();

  @override
  final String accessToken;
  @override
  final String refreshToken;
  @override
  final String? expiresIn;
  @override
  final String? refreshExpiresIn;
  @override
  final CurrentUser user;

  @override
  Map<String, dynamic> toJson() => _$$LoginResponseToJson(this);
}

// ---------------------------------------------------------------------------
// RefreshRequest
// ---------------------------------------------------------------------------

class _$RefreshRequestTearOff {
  const _$RefreshRequestTearOff();

  _RefreshRequest call({required String refreshToken}) {
    return _RefreshRequest(
      refreshToken: refreshToken,
    );
  }

  RefreshRequest fromJson(Map<String, Object?> json) {
    return RefreshRequest.fromJson(json);
  }
}

const $RefreshRequest = _$RefreshRequestTearOff();

mixin _$RefreshRequest {
  String get refreshToken;

  Map<String, dynamic> toJson() =>
      _$$RefreshRequestToJson(this as _RefreshRequest);

  @override
  String toString() => 'RefreshRequest(refreshToken: $refreshToken)';

  @override
  bool operator ==(dynamic other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _RefreshRequest &&
            (identical(other.refreshToken, refreshToken) ||
                other.refreshToken == refreshToken));
  }

  @override
  int get hashCode => Object.hash(runtimeType, refreshToken);
}

abstract class _RefreshRequest extends RefreshRequest {
  const factory _RefreshRequest({required final String refreshToken}) =
      __RefreshRequest;
  const _RefreshRequest._() : super._();

  factory _RefreshRequest.fromJson(Map<String, dynamic> json) =
      __RefreshRequest.fromJson;
}

class __RefreshRequest extends _RefreshRequest {
  const __RefreshRequest({required this.refreshToken}) : super._();

  @override
  final String refreshToken;

  @override
  Map<String, dynamic> toJson() => _$$RefreshRequestToJson(this);
}

// ---------------------------------------------------------------------------
// RefreshResponse
// ---------------------------------------------------------------------------

class _$RefreshResponseTearOff {
  const _$RefreshResponseTearOff();

  _RefreshResponse call({
    required String accessToken,
    required String refreshToken,
    String? expiresIn,
    String? refreshExpiresIn,
    required CurrentUser user,
  }) {
    return _RefreshResponse(
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: expiresIn,
      refreshExpiresIn: refreshExpiresIn,
      user: user,
    );
  }

  RefreshResponse fromJson(Map<String, Object?> json) {
    return RefreshResponse.fromJson(json);
  }
}

const $RefreshResponse = _$RefreshResponseTearOff();

mixin _$RefreshResponse {
  String get accessToken;
  String get refreshToken;
  String? get expiresIn;
  String? get refreshExpiresIn;
  CurrentUser get user;

  Map<String, dynamic> toJson() =>
      _$$RefreshResponseToJson(this as _RefreshResponse);

  @override
  String toString() =>
      'RefreshResponse(accessToken: $accessToken, refreshToken: $refreshToken, expiresIn: $expiresIn, refreshExpiresIn: $refreshExpiresIn, user: $user)';

  @override
  bool operator ==(dynamic other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _RefreshResponse &&
            (identical(other.accessToken, accessToken) ||
                other.accessToken == accessToken) &&
            (identical(other.refreshToken, refreshToken) ||
                other.refreshToken == refreshToken) &&
            (identical(other.expiresIn, expiresIn) ||
                other.expiresIn == expiresIn) &&
            (identical(other.refreshExpiresIn, refreshExpiresIn) ||
                other.refreshExpiresIn == refreshExpiresIn) &&
            (identical(other.user, user) || other.user == user));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType, accessToken, refreshToken, expiresIn, refreshExpiresIn, user);
}

abstract class _RefreshResponse extends RefreshResponse {
  const factory _RefreshResponse({
    required final String accessToken,
    required final String refreshToken,
    final String? expiresIn,
    final String? refreshExpiresIn,
    required final CurrentUser user,
  }) = __RefreshResponse;
  const _RefreshResponse._() : super._();

  factory _RefreshResponse.fromJson(Map<String, dynamic> json) =
      __RefreshResponse.fromJson;
}

class __RefreshResponse extends _RefreshResponse {
  const __RefreshResponse({
    required this.accessToken,
    required this.refreshToken,
    this.expiresIn,
    this.refreshExpiresIn,
    required this.user,
  }) : super._();

  @override
  final String accessToken;
  @override
  final String refreshToken;
  @override
  final String? expiresIn;
  @override
  final String? refreshExpiresIn;
  @override
  final CurrentUser user;

  @override
  Map<String, dynamic> toJson() => _$$RefreshResponseToJson(this);
}

// ---------------------------------------------------------------------------
// CurrentUser
// ---------------------------------------------------------------------------

class _$CurrentUserTearOff {
  const _$CurrentUserTearOff();

  _CurrentUser call({
    required String id,
    required String email,
    String? firstName,
    String? lastName,
    required String companyId,
    @Default(<String>[]) List<String> roles,
    @Default(<String>[]) List<String> permissions,
    String? phone,
  }) {
    return _CurrentUser(
      id: id,
      email: email,
      firstName: firstName,
      lastName: lastName,
      companyId: companyId,
      roles: roles,
      permissions: permissions,
      phone: phone,
    );
  }

  CurrentUser fromJson(Map<String, Object?> json) {
    return CurrentUser.fromJson(json);
  }
}

const $CurrentUser = _$CurrentUserTearOff();

mixin _$CurrentUser {
  String get id;
  String get email;
  String? get firstName;
  String? get lastName;
  String get companyId;
  List<String> get roles;
  List<String> get permissions;
  String? get phone;

  Map<String, dynamic> toJson() => _$$CurrentUserToJson(this as _CurrentUser);

  @override
  String toString() =>
      'CurrentUser(id: $id, email: $email, firstName: $firstName, lastName: $lastName, companyId: $companyId, roles: $roles, permissions: $permissions, phone: $phone)';

  @override
  bool operator ==(dynamic other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _CurrentUser &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            const DeepCollectionEquality().equals(other.roles, roles) &&
            const DeepCollectionEquality()
                .equals(other.permissions, permissions) &&
            (identical(other.phone, phone) || other.phone == phone));
  }

  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      email,
      firstName,
      lastName,
      companyId,
      const DeepCollectionEquality().hash(roles),
      const DeepCollectionEquality().hash(permissions),
      phone);
}

abstract class _CurrentUser extends CurrentUser {
  const factory _CurrentUser({
    required final String id,
    required final String email,
    final String? firstName,
    final String? lastName,
    required final String companyId,
    @Default(<String>[]) final List<String> roles,
    @Default(<String>[]) final List<String> permissions,
    final String? phone,
  }) = __CurrentUser;
  const _CurrentUser._() : super._();

  factory _CurrentUser.fromJson(Map<String, dynamic> json) =
      __CurrentUser.fromJson;
}

class __CurrentUser extends _CurrentUser {
  const __CurrentUser({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
    required this.companyId,
    @Default(<String>[]) this.roles,
    @Default(<String>[]) this.permissions,
    this.phone,
  }) : super._();

  @override
  final String id;
  @override
  final String email;
  @override
  final String? firstName;
  @override
  final String? lastName;
  @override
  final String companyId;
  @override
  final List<String> roles;
  @override
  final List<String> permissions;
  @override
  final String? phone;

  @override
  Map<String, dynamic> toJson() => _$$CurrentUserToJson(this);
}
