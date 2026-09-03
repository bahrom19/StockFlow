// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'supplier_contact_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SupplierContact _$SupplierContactFromJson(Map<String, dynamic> json) {
  return _SupplierContact.fromJson(json);
}

/// @nodoc
mixin _$SupplierContact {
  String get id => throw _privateConstructorUsedError;
  String get supplierId => throw _privateConstructorUsedError;
  String? get firstName => throw _privateConstructorUsedError;
  String? get lastName => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  String? get position => throw _privateConstructorUsedError;
  bool get isPrimary => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  int get rowVersion => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;
  DateTime? get deletedAt => throw _privateConstructorUsedError;

  /// Serializes this SupplierContact to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierContact
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierContactCopyWith<SupplierContact> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierContactCopyWith<$Res> {
  factory $SupplierContactCopyWith(
          SupplierContact value, $Res Function(SupplierContact) then) =
      _$SupplierContactCopyWithImpl<$Res, SupplierContact>;
  @useResult
  $Res call(
      {String id,
      String supplierId,
      String? firstName,
      String? lastName,
      String? phone,
      String? email,
      String? position,
      bool isPrimary,
      String? notes,
      int rowVersion,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt});
}

/// @nodoc
class _$SupplierContactCopyWithImpl<$Res, $Val extends SupplierContact>
    implements $SupplierContactCopyWith<$Res> {
  _$SupplierContactCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierContact
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? supplierId = null,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? phone = freezed,
    Object? email = freezed,
    Object? position = freezed,
    Object? isPrimary = null,
    Object? notes = freezed,
    Object? rowVersion = null,
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
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      position: freezed == position
          ? _value.position
          : position // ignore: cast_nullable_to_non_nullable
              as String?,
      isPrimary: null == isPrimary
          ? _value.isPrimary
          : isPrimary // ignore: cast_nullable_to_non_nullable
              as bool,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      rowVersion: null == rowVersion
          ? _value.rowVersion
          : rowVersion // ignore: cast_nullable_to_non_nullable
              as int,
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
abstract class _$$SupplierContactImplCopyWith<$Res>
    implements $SupplierContactCopyWith<$Res> {
  factory _$$SupplierContactImplCopyWith(_$SupplierContactImpl value,
          $Res Function(_$SupplierContactImpl) then) =
      __$$SupplierContactImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String supplierId,
      String? firstName,
      String? lastName,
      String? phone,
      String? email,
      String? position,
      bool isPrimary,
      String? notes,
      int rowVersion,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt});
}

/// @nodoc
class __$$SupplierContactImplCopyWithImpl<$Res>
    extends _$SupplierContactCopyWithImpl<$Res, _$SupplierContactImpl>
    implements _$$SupplierContactImplCopyWith<$Res> {
  __$$SupplierContactImplCopyWithImpl(
      _$SupplierContactImpl _value, $Res Function(_$SupplierContactImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierContact
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? supplierId = null,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? phone = freezed,
    Object? email = freezed,
    Object? position = freezed,
    Object? isPrimary = null,
    Object? notes = freezed,
    Object? rowVersion = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
  }) {
    return _then(_$SupplierContactImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      position: freezed == position
          ? _value.position
          : position // ignore: cast_nullable_to_non_nullable
              as String?,
      isPrimary: null == isPrimary
          ? _value.isPrimary
          : isPrimary // ignore: cast_nullable_to_non_nullable
              as bool,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      rowVersion: null == rowVersion
          ? _value.rowVersion
          : rowVersion // ignore: cast_nullable_to_non_nullable
              as int,
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
class _$SupplierContactImpl extends _SupplierContact {
  const _$SupplierContactImpl(
      {required this.id,
      required this.supplierId,
      this.firstName,
      this.lastName,
      this.phone,
      this.email,
      this.position,
      this.isPrimary = false,
      this.notes,
      this.rowVersion = 0,
      required this.createdAt,
      required this.updatedAt,
      this.deletedAt})
      : super._();

  factory _$SupplierContactImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierContactImplFromJson(json);

  @override
  final String id;
  @override
  final String supplierId;
  @override
  final String? firstName;
  @override
  final String? lastName;
  @override
  final String? phone;
  @override
  final String? email;
  @override
  final String? position;
  @override
  @JsonKey()
  final bool isPrimary;
  @override
  final String? notes;
  @override
  @JsonKey()
  final int rowVersion;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;
  @override
  final DateTime? deletedAt;

  @override
  String toString() {
    return 'SupplierContact(id: $id, supplierId: $supplierId, firstName: $firstName, lastName: $lastName, phone: $phone, email: $email, position: $position, isPrimary: $isPrimary, notes: $notes, rowVersion: $rowVersion, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierContactImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.supplierId, supplierId) ||
                other.supplierId == supplierId) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.position, position) ||
                other.position == position) &&
            (identical(other.isPrimary, isPrimary) ||
                other.isPrimary == isPrimary) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.rowVersion, rowVersion) ||
                other.rowVersion == rowVersion) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.deletedAt, deletedAt) ||
                other.deletedAt == deletedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      supplierId,
      firstName,
      lastName,
      phone,
      email,
      position,
      isPrimary,
      notes,
      rowVersion,
      createdAt,
      updatedAt,
      deletedAt);

  /// Create a copy of SupplierContact
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierContactImplCopyWith<_$SupplierContactImpl> get copyWith =>
      __$$SupplierContactImplCopyWithImpl<_$SupplierContactImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierContactImplToJson(
      this,
    );
  }
}

abstract class _SupplierContact extends SupplierContact {
  const factory _SupplierContact(
      {required final String id,
      required final String supplierId,
      final String? firstName,
      final String? lastName,
      final String? phone,
      final String? email,
      final String? position,
      final bool isPrimary,
      final String? notes,
      final int rowVersion,
      required final DateTime createdAt,
      required final DateTime updatedAt,
      final DateTime? deletedAt}) = _$SupplierContactImpl;
  const _SupplierContact._() : super._();

  factory _SupplierContact.fromJson(Map<String, dynamic> json) =
      _$SupplierContactImpl.fromJson;

  @override
  String get id;
  @override
  String get supplierId;
  @override
  String? get firstName;
  @override
  String? get lastName;
  @override
  String? get phone;
  @override
  String? get email;
  @override
  String? get position;
  @override
  bool get isPrimary;
  @override
  String? get notes;
  @override
  int get rowVersion;
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;
  @override
  DateTime? get deletedAt;

  /// Create a copy of SupplierContact
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierContactImplCopyWith<_$SupplierContactImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CreateSupplierContactRequest _$CreateSupplierContactRequestFromJson(
    Map<String, dynamic> json) {
  return _CreateSupplierContactRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateSupplierContactRequest {
  String? get firstName => throw _privateConstructorUsedError;
  String? get lastName => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  String? get position => throw _privateConstructorUsedError;
  bool get isPrimary => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;

  /// Serializes this CreateSupplierContactRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateSupplierContactRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateSupplierContactRequestCopyWith<CreateSupplierContactRequest>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateSupplierContactRequestCopyWith<$Res> {
  factory $CreateSupplierContactRequestCopyWith(
          CreateSupplierContactRequest value,
          $Res Function(CreateSupplierContactRequest) then) =
      _$CreateSupplierContactRequestCopyWithImpl<$Res,
          CreateSupplierContactRequest>;
  @useResult
  $Res call(
      {String? firstName,
      String? lastName,
      String? phone,
      String? email,
      String? position,
      bool isPrimary,
      String? notes});
}

/// @nodoc
class _$CreateSupplierContactRequestCopyWithImpl<$Res,
        $Val extends CreateSupplierContactRequest>
    implements $CreateSupplierContactRequestCopyWith<$Res> {
  _$CreateSupplierContactRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateSupplierContactRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? phone = freezed,
    Object? email = freezed,
    Object? position = freezed,
    Object? isPrimary = null,
    Object? notes = freezed,
  }) {
    return _then(_value.copyWith(
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      position: freezed == position
          ? _value.position
          : position // ignore: cast_nullable_to_non_nullable
              as String?,
      isPrimary: null == isPrimary
          ? _value.isPrimary
          : isPrimary // ignore: cast_nullable_to_non_nullable
              as bool,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreateSupplierContactRequestImplCopyWith<$Res>
    implements $CreateSupplierContactRequestCopyWith<$Res> {
  factory _$$CreateSupplierContactRequestImplCopyWith(
          _$CreateSupplierContactRequestImpl value,
          $Res Function(_$CreateSupplierContactRequestImpl) then) =
      __$$CreateSupplierContactRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String? firstName,
      String? lastName,
      String? phone,
      String? email,
      String? position,
      bool isPrimary,
      String? notes});
}

/// @nodoc
class __$$CreateSupplierContactRequestImplCopyWithImpl<$Res>
    extends _$CreateSupplierContactRequestCopyWithImpl<$Res,
        _$CreateSupplierContactRequestImpl>
    implements _$$CreateSupplierContactRequestImplCopyWith<$Res> {
  __$$CreateSupplierContactRequestImplCopyWithImpl(
      _$CreateSupplierContactRequestImpl _value,
      $Res Function(_$CreateSupplierContactRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreateSupplierContactRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? phone = freezed,
    Object? email = freezed,
    Object? position = freezed,
    Object? isPrimary = null,
    Object? notes = freezed,
  }) {
    return _then(_$CreateSupplierContactRequestImpl(
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      position: freezed == position
          ? _value.position
          : position // ignore: cast_nullable_to_non_nullable
              as String?,
      isPrimary: null == isPrimary
          ? _value.isPrimary
          : isPrimary // ignore: cast_nullable_to_non_nullable
              as bool,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateSupplierContactRequestImpl
    implements _CreateSupplierContactRequest {
  const _$CreateSupplierContactRequestImpl(
      {this.firstName,
      this.lastName,
      this.phone,
      this.email,
      this.position,
      this.isPrimary = false,
      this.notes});

  factory _$CreateSupplierContactRequestImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$CreateSupplierContactRequestImplFromJson(json);

  @override
  final String? firstName;
  @override
  final String? lastName;
  @override
  final String? phone;
  @override
  final String? email;
  @override
  final String? position;
  @override
  @JsonKey()
  final bool isPrimary;
  @override
  final String? notes;

  @override
  String toString() {
    return 'CreateSupplierContactRequest(firstName: $firstName, lastName: $lastName, phone: $phone, email: $email, position: $position, isPrimary: $isPrimary, notes: $notes)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateSupplierContactRequestImpl &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.position, position) ||
                other.position == position) &&
            (identical(other.isPrimary, isPrimary) ||
                other.isPrimary == isPrimary) &&
            (identical(other.notes, notes) || other.notes == notes));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, firstName, lastName, phone,
      email, position, isPrimary, notes);

  /// Create a copy of CreateSupplierContactRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateSupplierContactRequestImplCopyWith<
          _$CreateSupplierContactRequestImpl>
      get copyWith => __$$CreateSupplierContactRequestImplCopyWithImpl<
          _$CreateSupplierContactRequestImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateSupplierContactRequestImplToJson(
      this,
    );
  }
}

abstract class _CreateSupplierContactRequest
    implements CreateSupplierContactRequest {
  const factory _CreateSupplierContactRequest(
      {final String? firstName,
      final String? lastName,
      final String? phone,
      final String? email,
      final String? position,
      final bool isPrimary,
      final String? notes}) = _$CreateSupplierContactRequestImpl;

  factory _CreateSupplierContactRequest.fromJson(Map<String, dynamic> json) =
      _$CreateSupplierContactRequestImpl.fromJson;

  @override
  String? get firstName;
  @override
  String? get lastName;
  @override
  String? get phone;
  @override
  String? get email;
  @override
  String? get position;
  @override
  bool get isPrimary;
  @override
  String? get notes;

  /// Create a copy of CreateSupplierContactRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateSupplierContactRequestImplCopyWith<
          _$CreateSupplierContactRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}
