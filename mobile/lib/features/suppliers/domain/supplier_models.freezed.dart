// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'supplier_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

Supplier _$SupplierFromJson(Map<String, dynamic> json) {
  return _Supplier.fromJson(json);
}

/// @nodoc
mixin _$Supplier {
  String get id => throw _privateConstructorUsedError;
  String get companyId => throw _privateConstructorUsedError;
  String get companyName => throw _privateConstructorUsedError;
  String? get bin => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  String? get website => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  bool get isActive => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;
  DateTime? get deletedAt => throw _privateConstructorUsedError;

  /// Serializes this Supplier to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Supplier
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierCopyWith<Supplier> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierCopyWith<$Res> {
  factory $SupplierCopyWith(Supplier value, $Res Function(Supplier) then) =
      _$SupplierCopyWithImpl<$Res, Supplier>;
  @useResult
  $Res call(
      {String id,
      String companyId,
      String companyName,
      String? bin,
      String? email,
      String? phone,
      String? website,
      String? notes,
      bool isActive,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt});
}

/// @nodoc
class _$SupplierCopyWithImpl<$Res, $Val extends Supplier>
    implements $SupplierCopyWith<$Res> {
  _$SupplierCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Supplier
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? companyName = null,
    Object? bin = freezed,
    Object? email = freezed,
    Object? phone = freezed,
    Object? website = freezed,
    Object? notes = freezed,
    Object? isActive = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      companyId: null == companyId
          ? _value.companyId
          : companyId // ignore: cast_nullable_to_non_nullable
              as String,
      companyName: null == companyName
          ? _value.companyName
          : companyName // ignore: cast_nullable_to_non_nullable
              as String,
      bin: freezed == bin
          ? _value.bin
          : bin // ignore: cast_nullable_to_non_nullable
              as String?,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      website: freezed == website
          ? _value.website
          : website // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      isActive: null == isActive
          ? _value.isActive
          : isActive // ignore: cast_nullable_to_non_nullable
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
abstract class _$$SupplierImplCopyWith<$Res>
    implements $SupplierCopyWith<$Res> {
  factory _$$SupplierImplCopyWith(
          _$SupplierImpl value, $Res Function(_$SupplierImpl) then) =
      __$$SupplierImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String companyId,
      String companyName,
      String? bin,
      String? email,
      String? phone,
      String? website,
      String? notes,
      bool isActive,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt});
}

/// @nodoc
class __$$SupplierImplCopyWithImpl<$Res>
    extends _$SupplierCopyWithImpl<$Res, _$SupplierImpl>
    implements _$$SupplierImplCopyWith<$Res> {
  __$$SupplierImplCopyWithImpl(
      _$SupplierImpl _value, $Res Function(_$SupplierImpl) _then)
      : super(_value, _then);

  /// Create a copy of Supplier
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? companyName = null,
    Object? bin = freezed,
    Object? email = freezed,
    Object? phone = freezed,
    Object? website = freezed,
    Object? notes = freezed,
    Object? isActive = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
  }) {
    return _then(_$SupplierImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      companyId: null == companyId
          ? _value.companyId
          : companyId // ignore: cast_nullable_to_non_nullable
              as String,
      companyName: null == companyName
          ? _value.companyName
          : companyName // ignore: cast_nullable_to_non_nullable
              as String,
      bin: freezed == bin
          ? _value.bin
          : bin // ignore: cast_nullable_to_non_nullable
              as String?,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      website: freezed == website
          ? _value.website
          : website // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      isActive: null == isActive
          ? _value.isActive
          : isActive // ignore: cast_nullable_to_non_nullable
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
class _$SupplierImpl implements _Supplier {
  const _$SupplierImpl(
      {required this.id,
      required this.companyId,
      required this.companyName,
      this.bin,
      this.email,
      this.phone,
      this.website,
      this.notes,
      this.isActive = true,
      required this.createdAt,
      required this.updatedAt,
      this.deletedAt});

  factory _$SupplierImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierImplFromJson(json);

  @override
  final String id;
  @override
  final String companyId;
  @override
  final String companyName;
  @override
  final String? bin;
  @override
  final String? email;
  @override
  final String? phone;
  @override
  final String? website;
  @override
  final String? notes;
  @override
  @JsonKey()
  final bool isActive;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;
  @override
  final DateTime? deletedAt;

  @override
  String toString() {
    return 'Supplier(id: $id, companyId: $companyId, companyName: $companyName, bin: $bin, email: $email, phone: $phone, website: $website, notes: $notes, isActive: $isActive, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.companyName, companyName) ||
                other.companyName == companyName) &&
            (identical(other.bin, bin) || other.bin == bin) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.website, website) || other.website == website) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.isActive, isActive) ||
                other.isActive == isActive) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.deletedAt, deletedAt) ||
                other.deletedAt == deletedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, companyId, companyName, bin,
      email, phone, website, notes, isActive, createdAt, updatedAt, deletedAt);

  /// Create a copy of Supplier
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierImplCopyWith<_$SupplierImpl> get copyWith =>
      __$$SupplierImplCopyWithImpl<_$SupplierImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierImplToJson(
      this,
    );
  }
}

abstract class _Supplier implements Supplier {
  const factory _Supplier(
      {required final String id,
      required final String companyId,
      required final String companyName,
      final String? bin,
      final String? email,
      final String? phone,
      final String? website,
      final String? notes,
      final bool isActive,
      required final DateTime createdAt,
      required final DateTime updatedAt,
      final DateTime? deletedAt}) = _$SupplierImpl;

  factory _Supplier.fromJson(Map<String, dynamic> json) =
      _$SupplierImpl.fromJson;

  @override
  String get id;
  @override
  String get companyId;
  @override
  String get companyName;
  @override
  String? get bin;
  @override
  String? get email;
  @override
  String? get phone;
  @override
  String? get website;
  @override
  String? get notes;
  @override
  bool get isActive;
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;
  @override
  DateTime? get deletedAt;

  /// Create a copy of Supplier
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierImplCopyWith<_$SupplierImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SupplierListResponse _$SupplierListResponseFromJson(Map<String, dynamic> json) {
  return _SupplierListResponse.fromJson(json);
}

/// @nodoc
mixin _$SupplierListResponse {
  List<Supplier> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this SupplierListResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierListResponseCopyWith<SupplierListResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierListResponseCopyWith<$Res> {
  factory $SupplierListResponseCopyWith(SupplierListResponse value,
          $Res Function(SupplierListResponse) then) =
      _$SupplierListResponseCopyWithImpl<$Res, SupplierListResponse>;
  @useResult
  $Res call({List<Supplier> items, int total, int page, int limit});
}

/// @nodoc
class _$SupplierListResponseCopyWithImpl<$Res,
        $Val extends SupplierListResponse>
    implements $SupplierListResponseCopyWith<$Res> {
  _$SupplierListResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_value.copyWith(
      items: null == items
          ? _value.items
          : items // ignore: cast_nullable_to_non_nullable
              as List<Supplier>,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as int,
      limit: null == limit
          ? _value.limit
          : limit // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SupplierListResponseImplCopyWith<$Res>
    implements $SupplierListResponseCopyWith<$Res> {
  factory _$$SupplierListResponseImplCopyWith(_$SupplierListResponseImpl value,
          $Res Function(_$SupplierListResponseImpl) then) =
      __$$SupplierListResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<Supplier> items, int total, int page, int limit});
}

/// @nodoc
class __$$SupplierListResponseImplCopyWithImpl<$Res>
    extends _$SupplierListResponseCopyWithImpl<$Res, _$SupplierListResponseImpl>
    implements _$$SupplierListResponseImplCopyWith<$Res> {
  __$$SupplierListResponseImplCopyWithImpl(_$SupplierListResponseImpl _value,
      $Res Function(_$SupplierListResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$SupplierListResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<Supplier>,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
      page: null == page
          ? _value.page
          : page // ignore: cast_nullable_to_non_nullable
              as int,
      limit: null == limit
          ? _value.limit
          : limit // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SupplierListResponseImpl implements _SupplierListResponse {
  const _$SupplierListResponseImpl(
      {required final List<Supplier> items,
      required this.total,
      required this.page,
      required this.limit})
      : _items = items;

  factory _$SupplierListResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierListResponseImplFromJson(json);

  final List<Supplier> _items;
  @override
  List<Supplier> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  final int total;
  @override
  final int page;
  @override
  final int limit;

  @override
  String toString() {
    return 'SupplierListResponse(items: $items, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierListResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_items), total, page, limit);

  /// Create a copy of SupplierListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierListResponseImplCopyWith<_$SupplierListResponseImpl>
      get copyWith =>
          __$$SupplierListResponseImplCopyWithImpl<_$SupplierListResponseImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierListResponseImplToJson(
      this,
    );
  }
}

abstract class _SupplierListResponse implements SupplierListResponse {
  const factory _SupplierListResponse(
      {required final List<Supplier> items,
      required final int total,
      required final int page,
      required final int limit}) = _$SupplierListResponseImpl;

  factory _SupplierListResponse.fromJson(Map<String, dynamic> json) =
      _$SupplierListResponseImpl.fromJson;

  @override
  List<Supplier> get items;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of SupplierListResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierListResponseImplCopyWith<_$SupplierListResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

CreateSupplierRequest _$CreateSupplierRequestFromJson(
    Map<String, dynamic> json) {
  return _CreateSupplierRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateSupplierRequest {
  String get companyName => throw _privateConstructorUsedError;
  String? get bin => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  String? get website => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  bool get isActive => throw _privateConstructorUsedError;

  /// Serializes this CreateSupplierRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateSupplierRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateSupplierRequestCopyWith<CreateSupplierRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateSupplierRequestCopyWith<$Res> {
  factory $CreateSupplierRequestCopyWith(CreateSupplierRequest value,
          $Res Function(CreateSupplierRequest) then) =
      _$CreateSupplierRequestCopyWithImpl<$Res, CreateSupplierRequest>;
  @useResult
  $Res call(
      {String companyName,
      String? bin,
      String? email,
      String? phone,
      String? website,
      String? notes,
      bool isActive});
}

/// @nodoc
class _$CreateSupplierRequestCopyWithImpl<$Res,
        $Val extends CreateSupplierRequest>
    implements $CreateSupplierRequestCopyWith<$Res> {
  _$CreateSupplierRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateSupplierRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? companyName = null,
    Object? bin = freezed,
    Object? email = freezed,
    Object? phone = freezed,
    Object? website = freezed,
    Object? notes = freezed,
    Object? isActive = null,
  }) {
    return _then(_value.copyWith(
      companyName: null == companyName
          ? _value.companyName
          : companyName // ignore: cast_nullable_to_non_nullable
              as String,
      bin: freezed == bin
          ? _value.bin
          : bin // ignore: cast_nullable_to_non_nullable
              as String?,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      website: freezed == website
          ? _value.website
          : website // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      isActive: null == isActive
          ? _value.isActive
          : isActive // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreateSupplierRequestImplCopyWith<$Res>
    implements $CreateSupplierRequestCopyWith<$Res> {
  factory _$$CreateSupplierRequestImplCopyWith(
          _$CreateSupplierRequestImpl value,
          $Res Function(_$CreateSupplierRequestImpl) then) =
      __$$CreateSupplierRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String companyName,
      String? bin,
      String? email,
      String? phone,
      String? website,
      String? notes,
      bool isActive});
}

/// @nodoc
class __$$CreateSupplierRequestImplCopyWithImpl<$Res>
    extends _$CreateSupplierRequestCopyWithImpl<$Res,
        _$CreateSupplierRequestImpl>
    implements _$$CreateSupplierRequestImplCopyWith<$Res> {
  __$$CreateSupplierRequestImplCopyWithImpl(_$CreateSupplierRequestImpl _value,
      $Res Function(_$CreateSupplierRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreateSupplierRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? companyName = null,
    Object? bin = freezed,
    Object? email = freezed,
    Object? phone = freezed,
    Object? website = freezed,
    Object? notes = freezed,
    Object? isActive = null,
  }) {
    return _then(_$CreateSupplierRequestImpl(
      companyName: null == companyName
          ? _value.companyName
          : companyName // ignore: cast_nullable_to_non_nullable
              as String,
      bin: freezed == bin
          ? _value.bin
          : bin // ignore: cast_nullable_to_non_nullable
              as String?,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      website: freezed == website
          ? _value.website
          : website // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      isActive: null == isActive
          ? _value.isActive
          : isActive // ignore: cast_nullable_to_non_nullable
              as bool,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateSupplierRequestImpl implements _CreateSupplierRequest {
  const _$CreateSupplierRequestImpl(
      {required this.companyName,
      this.bin,
      this.email,
      this.phone,
      this.website,
      this.notes,
      this.isActive = true});

  factory _$CreateSupplierRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateSupplierRequestImplFromJson(json);

  @override
  final String companyName;
  @override
  final String? bin;
  @override
  final String? email;
  @override
  final String? phone;
  @override
  final String? website;
  @override
  final String? notes;
  @override
  @JsonKey()
  final bool isActive;

  @override
  String toString() {
    return 'CreateSupplierRequest(companyName: $companyName, bin: $bin, email: $email, phone: $phone, website: $website, notes: $notes, isActive: $isActive)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateSupplierRequestImpl &&
            (identical(other.companyName, companyName) ||
                other.companyName == companyName) &&
            (identical(other.bin, bin) || other.bin == bin) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.website, website) || other.website == website) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.isActive, isActive) ||
                other.isActive == isActive));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, companyName, bin, email, phone, website, notes, isActive);

  /// Create a copy of CreateSupplierRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateSupplierRequestImplCopyWith<_$CreateSupplierRequestImpl>
      get copyWith => __$$CreateSupplierRequestImplCopyWithImpl<
          _$CreateSupplierRequestImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateSupplierRequestImplToJson(
      this,
    );
  }
}

abstract class _CreateSupplierRequest implements CreateSupplierRequest {
  const factory _CreateSupplierRequest(
      {required final String companyName,
      final String? bin,
      final String? email,
      final String? phone,
      final String? website,
      final String? notes,
      final bool isActive}) = _$CreateSupplierRequestImpl;

  factory _CreateSupplierRequest.fromJson(Map<String, dynamic> json) =
      _$CreateSupplierRequestImpl.fromJson;

  @override
  String get companyName;
  @override
  String? get bin;
  @override
  String? get email;
  @override
  String? get phone;
  @override
  String? get website;
  @override
  String? get notes;
  @override
  bool get isActive;

  /// Create a copy of CreateSupplierRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateSupplierRequestImplCopyWith<_$CreateSupplierRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}
