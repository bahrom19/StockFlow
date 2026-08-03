// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'customer_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

Customer _$CustomerFromJson(Map<String, dynamic> json) {
  return _Customer.fromJson(json);
}

/// @nodoc
mixin _$Customer {
  String get id => throw _privateConstructorUsedError;
  String get companyId => throw _privateConstructorUsedError;
  String? get groupId => throw _privateConstructorUsedError;
  String get type => throw _privateConstructorUsedError;
  String? get firstName => throw _privateConstructorUsedError;
  String? get lastName => throw _privateConstructorUsedError;
  String? get companyName => throw _privateConstructorUsedError;
  String? get iin => throw _privateConstructorUsedError;
  String? get bin => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  String? get mobile => throw _privateConstructorUsedError;
  String? get discount => throw _privateConstructorUsedError;
  String? get creditLimit => throw _privateConstructorUsedError;
  String? get currentDebt => throw _privateConstructorUsedError;
  int get bonusPoints => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  bool get isActive => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;
  DateTime? get deletedAt => throw _privateConstructorUsedError;

  /// Serializes this Customer to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Customer
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CustomerCopyWith<Customer> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CustomerCopyWith<$Res> {
  factory $CustomerCopyWith(Customer value, $Res Function(Customer) then) =
      _$CustomerCopyWithImpl<$Res, Customer>;
  @useResult
  $Res call(
      {String id,
      String companyId,
      String? groupId,
      String type,
      String? firstName,
      String? lastName,
      String? companyName,
      String? iin,
      String? bin,
      String? email,
      String? phone,
      String? mobile,
      String? discount,
      String? creditLimit,
      String? currentDebt,
      int bonusPoints,
      String? notes,
      bool isActive,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt});
}

/// @nodoc
class _$CustomerCopyWithImpl<$Res, $Val extends Customer>
    implements $CustomerCopyWith<$Res> {
  _$CustomerCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Customer
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? groupId = freezed,
    Object? type = null,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? companyName = freezed,
    Object? iin = freezed,
    Object? bin = freezed,
    Object? email = freezed,
    Object? phone = freezed,
    Object? mobile = freezed,
    Object? discount = freezed,
    Object? creditLimit = freezed,
    Object? currentDebt = freezed,
    Object? bonusPoints = null,
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
      groupId: freezed == groupId
          ? _value.groupId
          : groupId // ignore: cast_nullable_to_non_nullable
              as String?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      companyName: freezed == companyName
          ? _value.companyName
          : companyName // ignore: cast_nullable_to_non_nullable
              as String?,
      iin: freezed == iin
          ? _value.iin
          : iin // ignore: cast_nullable_to_non_nullable
              as String?,
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
      mobile: freezed == mobile
          ? _value.mobile
          : mobile // ignore: cast_nullable_to_non_nullable
              as String?,
      discount: freezed == discount
          ? _value.discount
          : discount // ignore: cast_nullable_to_non_nullable
              as String?,
      creditLimit: freezed == creditLimit
          ? _value.creditLimit
          : creditLimit // ignore: cast_nullable_to_non_nullable
              as String?,
      currentDebt: freezed == currentDebt
          ? _value.currentDebt
          : currentDebt // ignore: cast_nullable_to_non_nullable
              as String?,
      bonusPoints: null == bonusPoints
          ? _value.bonusPoints
          : bonusPoints // ignore: cast_nullable_to_non_nullable
              as int,
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
abstract class _$$CustomerImplCopyWith<$Res>
    implements $CustomerCopyWith<$Res> {
  factory _$$CustomerImplCopyWith(
          _$CustomerImpl value, $Res Function(_$CustomerImpl) then) =
      __$$CustomerImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String companyId,
      String? groupId,
      String type,
      String? firstName,
      String? lastName,
      String? companyName,
      String? iin,
      String? bin,
      String? email,
      String? phone,
      String? mobile,
      String? discount,
      String? creditLimit,
      String? currentDebt,
      int bonusPoints,
      String? notes,
      bool isActive,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt});
}

/// @nodoc
class __$$CustomerImplCopyWithImpl<$Res>
    extends _$CustomerCopyWithImpl<$Res, _$CustomerImpl>
    implements _$$CustomerImplCopyWith<$Res> {
  __$$CustomerImplCopyWithImpl(
      _$CustomerImpl _value, $Res Function(_$CustomerImpl) _then)
      : super(_value, _then);

  /// Create a copy of Customer
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? groupId = freezed,
    Object? type = null,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? companyName = freezed,
    Object? iin = freezed,
    Object? bin = freezed,
    Object? email = freezed,
    Object? phone = freezed,
    Object? mobile = freezed,
    Object? discount = freezed,
    Object? creditLimit = freezed,
    Object? currentDebt = freezed,
    Object? bonusPoints = null,
    Object? notes = freezed,
    Object? isActive = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
  }) {
    return _then(_$CustomerImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      companyId: null == companyId
          ? _value.companyId
          : companyId // ignore: cast_nullable_to_non_nullable
              as String,
      groupId: freezed == groupId
          ? _value.groupId
          : groupId // ignore: cast_nullable_to_non_nullable
              as String?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      companyName: freezed == companyName
          ? _value.companyName
          : companyName // ignore: cast_nullable_to_non_nullable
              as String?,
      iin: freezed == iin
          ? _value.iin
          : iin // ignore: cast_nullable_to_non_nullable
              as String?,
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
      mobile: freezed == mobile
          ? _value.mobile
          : mobile // ignore: cast_nullable_to_non_nullable
              as String?,
      discount: freezed == discount
          ? _value.discount
          : discount // ignore: cast_nullable_to_non_nullable
              as String?,
      creditLimit: freezed == creditLimit
          ? _value.creditLimit
          : creditLimit // ignore: cast_nullable_to_non_nullable
              as String?,
      currentDebt: freezed == currentDebt
          ? _value.currentDebt
          : currentDebt // ignore: cast_nullable_to_non_nullable
              as String?,
      bonusPoints: null == bonusPoints
          ? _value.bonusPoints
          : bonusPoints // ignore: cast_nullable_to_non_nullable
              as int,
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
class _$CustomerImpl extends _Customer {
  const _$CustomerImpl(
      {required this.id,
      required this.companyId,
      this.groupId,
      required this.type,
      this.firstName,
      this.lastName,
      this.companyName,
      this.iin,
      this.bin,
      this.email,
      this.phone,
      this.mobile,
      this.discount,
      this.creditLimit,
      this.currentDebt,
      this.bonusPoints = 0,
      this.notes,
      this.isActive = true,
      required this.createdAt,
      required this.updatedAt,
      this.deletedAt})
      : super._();

  factory _$CustomerImpl.fromJson(Map<String, dynamic> json) =>
      _$$CustomerImplFromJson(json);

  @override
  final String id;
  @override
  final String companyId;
  @override
  final String? groupId;
  @override
  final String type;
  @override
  final String? firstName;
  @override
  final String? lastName;
  @override
  final String? companyName;
  @override
  final String? iin;
  @override
  final String? bin;
  @override
  final String? email;
  @override
  final String? phone;
  @override
  final String? mobile;
  @override
  final String? discount;
  @override
  final String? creditLimit;
  @override
  final String? currentDebt;
  @override
  @JsonKey()
  final int bonusPoints;
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
    return 'Customer(id: $id, companyId: $companyId, groupId: $groupId, type: $type, firstName: $firstName, lastName: $lastName, companyName: $companyName, iin: $iin, bin: $bin, email: $email, phone: $phone, mobile: $mobile, discount: $discount, creditLimit: $creditLimit, currentDebt: $currentDebt, bonusPoints: $bonusPoints, notes: $notes, isActive: $isActive, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CustomerImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.groupId, groupId) || other.groupId == groupId) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.companyName, companyName) ||
                other.companyName == companyName) &&
            (identical(other.iin, iin) || other.iin == iin) &&
            (identical(other.bin, bin) || other.bin == bin) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.mobile, mobile) || other.mobile == mobile) &&
            (identical(other.discount, discount) ||
                other.discount == discount) &&
            (identical(other.creditLimit, creditLimit) ||
                other.creditLimit == creditLimit) &&
            (identical(other.currentDebt, currentDebt) ||
                other.currentDebt == currentDebt) &&
            (identical(other.bonusPoints, bonusPoints) ||
                other.bonusPoints == bonusPoints) &&
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
  int get hashCode => Object.hashAll([
        runtimeType,
        id,
        companyId,
        groupId,
        type,
        firstName,
        lastName,
        companyName,
        iin,
        bin,
        email,
        phone,
        mobile,
        discount,
        creditLimit,
        currentDebt,
        bonusPoints,
        notes,
        isActive,
        createdAt,
        updatedAt,
        deletedAt
      ]);

  /// Create a copy of Customer
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CustomerImplCopyWith<_$CustomerImpl> get copyWith =>
      __$$CustomerImplCopyWithImpl<_$CustomerImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CustomerImplToJson(
      this,
    );
  }
}

abstract class _Customer extends Customer {
  const factory _Customer(
      {required final String id,
      required final String companyId,
      final String? groupId,
      required final String type,
      final String? firstName,
      final String? lastName,
      final String? companyName,
      final String? iin,
      final String? bin,
      final String? email,
      final String? phone,
      final String? mobile,
      final String? discount,
      final String? creditLimit,
      final String? currentDebt,
      final int bonusPoints,
      final String? notes,
      final bool isActive,
      required final DateTime createdAt,
      required final DateTime updatedAt,
      final DateTime? deletedAt}) = _$CustomerImpl;
  const _Customer._() : super._();

  factory _Customer.fromJson(Map<String, dynamic> json) =
      _$CustomerImpl.fromJson;

  @override
  String get id;
  @override
  String get companyId;
  @override
  String? get groupId;
  @override
  String get type;
  @override
  String? get firstName;
  @override
  String? get lastName;
  @override
  String? get companyName;
  @override
  String? get iin;
  @override
  String? get bin;
  @override
  String? get email;
  @override
  String? get phone;
  @override
  String? get mobile;
  @override
  String? get discount;
  @override
  String? get creditLimit;
  @override
  String? get currentDebt;
  @override
  int get bonusPoints;
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

  /// Create a copy of Customer
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CustomerImplCopyWith<_$CustomerImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CustomerListResponse _$CustomerListResponseFromJson(Map<String, dynamic> json) {
  return _CustomerListResponse.fromJson(json);
}

/// @nodoc
mixin _$CustomerListResponse {
  List<Customer> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this CustomerListResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CustomerListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CustomerListResponseCopyWith<CustomerListResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CustomerListResponseCopyWith<$Res> {
  factory $CustomerListResponseCopyWith(CustomerListResponse value,
          $Res Function(CustomerListResponse) then) =
      _$CustomerListResponseCopyWithImpl<$Res, CustomerListResponse>;
  @useResult
  $Res call({List<Customer> items, int total, int page, int limit});
}

/// @nodoc
class _$CustomerListResponseCopyWithImpl<$Res,
        $Val extends CustomerListResponse>
    implements $CustomerListResponseCopyWith<$Res> {
  _$CustomerListResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CustomerListResponse
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
              as List<Customer>,
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
abstract class _$$CustomerListResponseImplCopyWith<$Res>
    implements $CustomerListResponseCopyWith<$Res> {
  factory _$$CustomerListResponseImplCopyWith(_$CustomerListResponseImpl value,
          $Res Function(_$CustomerListResponseImpl) then) =
      __$$CustomerListResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<Customer> items, int total, int page, int limit});
}

/// @nodoc
class __$$CustomerListResponseImplCopyWithImpl<$Res>
    extends _$CustomerListResponseCopyWithImpl<$Res, _$CustomerListResponseImpl>
    implements _$$CustomerListResponseImplCopyWith<$Res> {
  __$$CustomerListResponseImplCopyWithImpl(_$CustomerListResponseImpl _value,
      $Res Function(_$CustomerListResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of CustomerListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$CustomerListResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<Customer>,
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
class _$CustomerListResponseImpl implements _CustomerListResponse {
  const _$CustomerListResponseImpl(
      {required final List<Customer> items,
      required this.total,
      required this.page,
      required this.limit})
      : _items = items;

  factory _$CustomerListResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$CustomerListResponseImplFromJson(json);

  final List<Customer> _items;
  @override
  List<Customer> get items {
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
    return 'CustomerListResponse(items: $items, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CustomerListResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_items), total, page, limit);

  /// Create a copy of CustomerListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CustomerListResponseImplCopyWith<_$CustomerListResponseImpl>
      get copyWith =>
          __$$CustomerListResponseImplCopyWithImpl<_$CustomerListResponseImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CustomerListResponseImplToJson(
      this,
    );
  }
}

abstract class _CustomerListResponse implements CustomerListResponse {
  const factory _CustomerListResponse(
      {required final List<Customer> items,
      required final int total,
      required final int page,
      required final int limit}) = _$CustomerListResponseImpl;

  factory _CustomerListResponse.fromJson(Map<String, dynamic> json) =
      _$CustomerListResponseImpl.fromJson;

  @override
  List<Customer> get items;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of CustomerListResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CustomerListResponseImplCopyWith<_$CustomerListResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

CreateCustomerRequest _$CreateCustomerRequestFromJson(
    Map<String, dynamic> json) {
  return _CreateCustomerRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateCustomerRequest {
  String get type => throw _privateConstructorUsedError;
  String? get firstName => throw _privateConstructorUsedError;
  String? get lastName => throw _privateConstructorUsedError;
  String? get companyName => throw _privateConstructorUsedError;
  String? get iin => throw _privateConstructorUsedError;
  String? get bin => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  String? get mobile => throw _privateConstructorUsedError;
  String? get discount => throw _privateConstructorUsedError;
  String? get creditLimit => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  bool get isActive => throw _privateConstructorUsedError;

  /// Serializes this CreateCustomerRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateCustomerRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateCustomerRequestCopyWith<CreateCustomerRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateCustomerRequestCopyWith<$Res> {
  factory $CreateCustomerRequestCopyWith(CreateCustomerRequest value,
          $Res Function(CreateCustomerRequest) then) =
      _$CreateCustomerRequestCopyWithImpl<$Res, CreateCustomerRequest>;
  @useResult
  $Res call(
      {String type,
      String? firstName,
      String? lastName,
      String? companyName,
      String? iin,
      String? bin,
      String? email,
      String? phone,
      String? mobile,
      String? discount,
      String? creditLimit,
      String? notes,
      bool isActive});
}

/// @nodoc
class _$CreateCustomerRequestCopyWithImpl<$Res,
        $Val extends CreateCustomerRequest>
    implements $CreateCustomerRequestCopyWith<$Res> {
  _$CreateCustomerRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateCustomerRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? companyName = freezed,
    Object? iin = freezed,
    Object? bin = freezed,
    Object? email = freezed,
    Object? phone = freezed,
    Object? mobile = freezed,
    Object? discount = freezed,
    Object? creditLimit = freezed,
    Object? notes = freezed,
    Object? isActive = null,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      companyName: freezed == companyName
          ? _value.companyName
          : companyName // ignore: cast_nullable_to_non_nullable
              as String?,
      iin: freezed == iin
          ? _value.iin
          : iin // ignore: cast_nullable_to_non_nullable
              as String?,
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
      mobile: freezed == mobile
          ? _value.mobile
          : mobile // ignore: cast_nullable_to_non_nullable
              as String?,
      discount: freezed == discount
          ? _value.discount
          : discount // ignore: cast_nullable_to_non_nullable
              as String?,
      creditLimit: freezed == creditLimit
          ? _value.creditLimit
          : creditLimit // ignore: cast_nullable_to_non_nullable
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
abstract class _$$CreateCustomerRequestImplCopyWith<$Res>
    implements $CreateCustomerRequestCopyWith<$Res> {
  factory _$$CreateCustomerRequestImplCopyWith(
          _$CreateCustomerRequestImpl value,
          $Res Function(_$CreateCustomerRequestImpl) then) =
      __$$CreateCustomerRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String type,
      String? firstName,
      String? lastName,
      String? companyName,
      String? iin,
      String? bin,
      String? email,
      String? phone,
      String? mobile,
      String? discount,
      String? creditLimit,
      String? notes,
      bool isActive});
}

/// @nodoc
class __$$CreateCustomerRequestImplCopyWithImpl<$Res>
    extends _$CreateCustomerRequestCopyWithImpl<$Res,
        _$CreateCustomerRequestImpl>
    implements _$$CreateCustomerRequestImplCopyWith<$Res> {
  __$$CreateCustomerRequestImplCopyWithImpl(_$CreateCustomerRequestImpl _value,
      $Res Function(_$CreateCustomerRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreateCustomerRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? firstName = freezed,
    Object? lastName = freezed,
    Object? companyName = freezed,
    Object? iin = freezed,
    Object? bin = freezed,
    Object? email = freezed,
    Object? phone = freezed,
    Object? mobile = freezed,
    Object? discount = freezed,
    Object? creditLimit = freezed,
    Object? notes = freezed,
    Object? isActive = null,
  }) {
    return _then(_$CreateCustomerRequestImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: freezed == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String?,
      lastName: freezed == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String?,
      companyName: freezed == companyName
          ? _value.companyName
          : companyName // ignore: cast_nullable_to_non_nullable
              as String?,
      iin: freezed == iin
          ? _value.iin
          : iin // ignore: cast_nullable_to_non_nullable
              as String?,
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
      mobile: freezed == mobile
          ? _value.mobile
          : mobile // ignore: cast_nullable_to_non_nullable
              as String?,
      discount: freezed == discount
          ? _value.discount
          : discount // ignore: cast_nullable_to_non_nullable
              as String?,
      creditLimit: freezed == creditLimit
          ? _value.creditLimit
          : creditLimit // ignore: cast_nullable_to_non_nullable
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
class _$CreateCustomerRequestImpl implements _CreateCustomerRequest {
  const _$CreateCustomerRequestImpl(
      {required this.type,
      this.firstName,
      this.lastName,
      this.companyName,
      this.iin,
      this.bin,
      this.email,
      this.phone,
      this.mobile,
      this.discount,
      this.creditLimit,
      this.notes,
      this.isActive = true});

  factory _$CreateCustomerRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateCustomerRequestImplFromJson(json);

  @override
  final String type;
  @override
  final String? firstName;
  @override
  final String? lastName;
  @override
  final String? companyName;
  @override
  final String? iin;
  @override
  final String? bin;
  @override
  final String? email;
  @override
  final String? phone;
  @override
  final String? mobile;
  @override
  final String? discount;
  @override
  final String? creditLimit;
  @override
  final String? notes;
  @override
  @JsonKey()
  final bool isActive;

  @override
  String toString() {
    return 'CreateCustomerRequest(type: $type, firstName: $firstName, lastName: $lastName, companyName: $companyName, iin: $iin, bin: $bin, email: $email, phone: $phone, mobile: $mobile, discount: $discount, creditLimit: $creditLimit, notes: $notes, isActive: $isActive)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateCustomerRequestImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName) &&
            (identical(other.companyName, companyName) ||
                other.companyName == companyName) &&
            (identical(other.iin, iin) || other.iin == iin) &&
            (identical(other.bin, bin) || other.bin == bin) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.mobile, mobile) || other.mobile == mobile) &&
            (identical(other.discount, discount) ||
                other.discount == discount) &&
            (identical(other.creditLimit, creditLimit) ||
                other.creditLimit == creditLimit) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.isActive, isActive) ||
                other.isActive == isActive));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      type,
      firstName,
      lastName,
      companyName,
      iin,
      bin,
      email,
      phone,
      mobile,
      discount,
      creditLimit,
      notes,
      isActive);

  /// Create a copy of CreateCustomerRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateCustomerRequestImplCopyWith<_$CreateCustomerRequestImpl>
      get copyWith => __$$CreateCustomerRequestImplCopyWithImpl<
          _$CreateCustomerRequestImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateCustomerRequestImplToJson(
      this,
    );
  }
}

abstract class _CreateCustomerRequest implements CreateCustomerRequest {
  const factory _CreateCustomerRequest(
      {required final String type,
      final String? firstName,
      final String? lastName,
      final String? companyName,
      final String? iin,
      final String? bin,
      final String? email,
      final String? phone,
      final String? mobile,
      final String? discount,
      final String? creditLimit,
      final String? notes,
      final bool isActive}) = _$CreateCustomerRequestImpl;

  factory _CreateCustomerRequest.fromJson(Map<String, dynamic> json) =
      _$CreateCustomerRequestImpl.fromJson;

  @override
  String get type;
  @override
  String? get firstName;
  @override
  String? get lastName;
  @override
  String? get companyName;
  @override
  String? get iin;
  @override
  String? get bin;
  @override
  String? get email;
  @override
  String? get phone;
  @override
  String? get mobile;
  @override
  String? get discount;
  @override
  String? get creditLimit;
  @override
  String? get notes;
  @override
  bool get isActive;

  /// Create a copy of CreateCustomerRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateCustomerRequestImplCopyWith<_$CreateCustomerRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}
