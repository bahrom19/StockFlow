// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'supplier_address_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SupplierAddress _$SupplierAddressFromJson(Map<String, dynamic> json) {
  return _SupplierAddress.fromJson(json);
}

/// @nodoc
mixin _$SupplierAddress {
  String get id => throw _privateConstructorUsedError;
  String get supplierId => throw _privateConstructorUsedError;
  String? get city => throw _privateConstructorUsedError;
  String? get country => throw _privateConstructorUsedError;
  String? get street => throw _privateConstructorUsedError;
  String? get postalCode => throw _privateConstructorUsedError;
  bool get isDefault => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;
  DateTime? get deletedAt => throw _privateConstructorUsedError;

  /// Serializes this SupplierAddress to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierAddress
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierAddressCopyWith<SupplierAddress> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierAddressCopyWith<$Res> {
  factory $SupplierAddressCopyWith(
          SupplierAddress value, $Res Function(SupplierAddress) then) =
      _$SupplierAddressCopyWithImpl<$Res, SupplierAddress>;
  @useResult
  $Res call(
      {String id,
      String supplierId,
      String? city,
      String? country,
      String? street,
      String? postalCode,
      bool isDefault,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt});
}

/// @nodoc
class _$SupplierAddressCopyWithImpl<$Res, $Val extends SupplierAddress>
    implements $SupplierAddressCopyWith<$Res> {
  _$SupplierAddressCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierAddress
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? supplierId = null,
    Object? city = freezed,
    Object? country = freezed,
    Object? street = freezed,
    Object? postalCode = freezed,
    Object? isDefault = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      city: freezed == city
          ? _value.city
          : city // ignore: cast_nullable_to_non_nullable
              as String?,
      country: freezed == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String?,
      street: freezed == street
          ? _value.street
          : street // ignore: cast_nullable_to_non_nullable
              as String?,
      postalCode: freezed == postalCode
          ? _value.postalCode
          : postalCode // ignore: cast_nullable_to_non_nullable
              as String?,
      isDefault: null == isDefault
          ? _value.isDefault
          : isDefault // ignore: cast_nullable_to_non_nullable
              as bool,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      deletedAt: freezed == deletedAt
          ? _value.deletedAt
          : deletedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SupplierAddressImplCopyWith<$Res>
    implements $SupplierAddressCopyWith<$Res> {
  factory _$$SupplierAddressImplCopyWith(_$SupplierAddressImpl value,
          $Res Function(_$SupplierAddressImpl) then) =
      __$$SupplierAddressImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String supplierId,
      String? city,
      String? country,
      String? street,
      String? postalCode,
      bool isDefault,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt});
}

/// @nodoc
class __$$SupplierAddressImplCopyWithImpl<$Res>
    extends _$SupplierAddressCopyWithImpl<$Res, _$SupplierAddressImpl>
    implements _$$SupplierAddressImplCopyWith<$Res> {
  __$$SupplierAddressImplCopyWithImpl(
      _$SupplierAddressImpl _value, $Res Function(_$SupplierAddressImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierAddress
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? supplierId = null,
    Object? city = freezed,
    Object? country = freezed,
    Object? street = freezed,
    Object? postalCode = freezed,
    Object? isDefault = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
  }) {
    return _then(_$SupplierAddressImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      city: freezed == city
          ? _value.city
          : city // ignore: cast_nullable_to_non_nullable
              as String?,
      country: freezed == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String?,
      street: freezed == street
          ? _value.street
          : street // ignore: cast_nullable_to_non_nullable
              as String?,
      postalCode: freezed == postalCode
          ? _value.postalCode
          : postalCode // ignore: cast_nullable_to_non_nullable
              as String?,
      isDefault: null == isDefault
          ? _value.isDefault
          : isDefault // ignore: cast_nullable_to_non_nullable
              as bool,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      deletedAt: freezed == deletedAt
          ? _value.deletedAt
          : deletedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SupplierAddressImpl extends _SupplierAddress {
  const _$SupplierAddressImpl(
      {required this.id,
      required this.supplierId,
      this.city,
      this.country,
      this.street,
      this.postalCode,
      this.isDefault = false,
      required this.createdAt,
      required this.updatedAt,
      this.deletedAt})
      : super._();

  factory _$SupplierAddressImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierAddressImplFromJson(json);

  @override
  final String id;
  @override
  final String supplierId;
  @override
  final String? city;
  @override
  final String? country;
  @override
  final String? street;
  @override
  final String? postalCode;
  @override
  @JsonKey()
  final bool isDefault;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;
  @override
  final DateTime? deletedAt;

  @override
  String toString() {
    return 'SupplierAddress(id: $id, supplierId: $supplierId, city: $city, country: $country, street: $street, postalCode: $postalCode, isDefault: $isDefault, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierAddressImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.supplierId, supplierId) ||
                other.supplierId == supplierId) &&
            (identical(other.city, city) || other.city == city) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.street, street) || other.street == street) &&
            (identical(other.postalCode, postalCode) ||
                other.postalCode == postalCode) &&
            (identical(other.isDefault, isDefault) ||
                other.isDefault == isDefault) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.deletedAt, deletedAt) ||
                other.deletedAt == deletedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, supplierId, city, country,
      street, postalCode, isDefault, createdAt, updatedAt, deletedAt);

  /// Create a copy of SupplierAddress
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierAddressImplCopyWith<_$SupplierAddressImpl> get copyWith =>
      __$$SupplierAddressImplCopyWithImpl<_$SupplierAddressImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierAddressImplToJson(
      this,
    );
  }
}

abstract class _SupplierAddress extends SupplierAddress {
  const factory _SupplierAddress(
      {required final String id,
      required final String supplierId,
      final String? city,
      final String? country,
      final String? street,
      final String? postalCode,
      final bool isDefault,
      required final DateTime createdAt,
      required final DateTime updatedAt,
      final DateTime? deletedAt}) = _$SupplierAddressImpl;
  const _SupplierAddress._() : super._();

  factory _SupplierAddress.fromJson(Map<String, dynamic> json) =
      _$SupplierAddressImpl.fromJson;

  @override
  String get id;
  @override
  String get supplierId;
  @override
  String? get city;
  @override
  String? get country;
  @override
  String? get street;
  @override
  String? get postalCode;
  @override
  bool get isDefault;
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;
  @override
  DateTime? get deletedAt;

  /// Create a copy of SupplierAddress
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierAddressImplCopyWith<_$SupplierAddressImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CreateSupplierAddressRequest _$CreateSupplierAddressRequestFromJson(
    Map<String, dynamic> json) {
  return _CreateSupplierAddressRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateSupplierAddressRequest {
  String? get city => throw _privateConstructorUsedError;
  String? get country => throw _privateConstructorUsedError;
  String? get street => throw _privateConstructorUsedError;
  String? get postalCode => throw _privateConstructorUsedError;
  bool get isDefault => throw _privateConstructorUsedError;

  /// Serializes this CreateSupplierAddressRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateSupplierAddressRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateSupplierAddressRequestCopyWith<CreateSupplierAddressRequest>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateSupplierAddressRequestCopyWith<$Res> {
  factory $CreateSupplierAddressRequestCopyWith(
          CreateSupplierAddressRequest value,
          $Res Function(CreateSupplierAddressRequest) then) =
      _$CreateSupplierAddressRequestCopyWithImpl<$Res,
          CreateSupplierAddressRequest>;
  @useResult
  $Res call(
      {String? city,
      String? country,
      String? street,
      String? postalCode,
      bool isDefault});
}

/// @nodoc
class _$CreateSupplierAddressRequestCopyWithImpl<$Res,
        $Val extends CreateSupplierAddressRequest>
    implements $CreateSupplierAddressRequestCopyWith<$Res> {
  _$CreateSupplierAddressRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateSupplierAddressRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? city = freezed,
    Object? country = freezed,
    Object? street = freezed,
    Object? postalCode = freezed,
    Object? isDefault = null,
  }) {
    return _then(_value.copyWith(
      city: freezed == city
          ? _value.city
          : city // ignore: cast_nullable_to_non_nullable
              as String?,
      country: freezed == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String?,
      street: freezed == street
          ? _value.street
          : street // ignore: cast_nullable_to_non_nullable
              as String?,
      postalCode: freezed == postalCode
          ? _value.postalCode
          : postalCode // ignore: cast_nullable_to_non_nullable
              as String?,
      isDefault: null == isDefault
          ? _value.isDefault
          : isDefault // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreateSupplierAddressRequestImplCopyWith<$Res>
    implements $CreateSupplierAddressRequestCopyWith<$Res> {
  factory _$$CreateSupplierAddressRequestImplCopyWith(
          _$CreateSupplierAddressRequestImpl value,
          $Res Function(_$CreateSupplierAddressRequestImpl) then) =
      __$$CreateSupplierAddressRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String? city,
      String? country,
      String? street,
      String? postalCode,
      bool isDefault});
}

/// @nodoc
class __$$CreateSupplierAddressRequestImplCopyWithImpl<$Res>
    extends _$CreateSupplierAddressRequestCopyWithImpl<$Res,
        _$CreateSupplierAddressRequestImpl>
    implements _$$CreateSupplierAddressRequestImplCopyWith<$Res> {
  __$$CreateSupplierAddressRequestImplCopyWithImpl(
      _$CreateSupplierAddressRequestImpl _value,
      $Res Function(_$CreateSupplierAddressRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreateSupplierAddressRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? city = freezed,
    Object? country = freezed,
    Object? street = freezed,
    Object? postalCode = freezed,
    Object? isDefault = null,
  }) {
    return _then(_$CreateSupplierAddressRequestImpl(
      city: freezed == city
          ? _value.city
          : city // ignore: cast_nullable_to_non_nullable
              as String?,
      country: freezed == country
          ? _value.country
          : country // ignore: cast_nullable_to_non_nullable
              as String?,
      street: freezed == street
          ? _value.street
          : street // ignore: cast_nullable_to_non_nullable
              as String?,
      postalCode: freezed == postalCode
          ? _value.postalCode
          : postalCode // ignore: cast_nullable_to_non_nullable
              as String?,
      isDefault: null == isDefault
          ? _value.isDefault
          : isDefault // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateSupplierAddressRequestImpl
    implements _CreateSupplierAddressRequest {
  const _$CreateSupplierAddressRequestImpl(
      {this.city,
      this.country,
      this.street,
      this.postalCode,
      this.isDefault = false});

  factory _$CreateSupplierAddressRequestImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$CreateSupplierAddressRequestImplFromJson(json);

  @override
  final String? city;
  @override
  final String? country;
  @override
  final String? street;
  @override
  final String? postalCode;
  @override
  @JsonKey()
  final bool isDefault;

  @override
  String toString() {
    return 'CreateSupplierAddressRequest(city: $city, country: $country, street: $street, postalCode: $postalCode, isDefault: $isDefault)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateSupplierAddressRequestImpl &&
            (identical(other.city, city) || other.city == city) &&
            (identical(other.country, country) || other.country == country) &&
            (identical(other.street, street) || other.street == street) &&
            (identical(other.postalCode, postalCode) ||
                other.postalCode == postalCode) &&
            (identical(other.isDefault, isDefault) ||
                other.isDefault == isDefault));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, city, country, street, postalCode, isDefault);

  /// Create a copy of CreateSupplierAddressRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateSupplierAddressRequestImplCopyWith<
          _$CreateSupplierAddressRequestImpl>
      get copyWith => __$$CreateSupplierAddressRequestImplCopyWithImpl<
          _$CreateSupplierAddressRequestImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateSupplierAddressRequestImplToJson(
      this,
    );
  }
}

abstract class _CreateSupplierAddressRequest
    implements CreateSupplierAddressRequest {
  const factory _CreateSupplierAddressRequest(
      {final String? city,
      final String? country,
      final String? street,
      final String? postalCode,
      final bool isDefault}) = _$CreateSupplierAddressRequestImpl;

  factory _CreateSupplierAddressRequest.fromJson(Map<String, dynamic> json) =
      _$CreateSupplierAddressRequestImpl.fromJson;

  @override
  String? get city;
  @override
  String? get country;
  @override
  String? get street;
  @override
  String? get postalCode;
  @override
  bool get isDefault;

  /// Create a copy of CreateSupplierAddressRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateSupplierAddressRequestImplCopyWith<
          _$CreateSupplierAddressRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}
