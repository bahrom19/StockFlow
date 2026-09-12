// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'supplier_payment_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SupplierPayment _$SupplierPaymentFromJson(Map<String, dynamic> json) {
  return _SupplierPayment.fromJson(json);
}

/// @nodoc
mixin _$SupplierPayment {
  String get id => throw _privateConstructorUsedError;
  String get companyId => throw _privateConstructorUsedError;
  String get supplierId => throw _privateConstructorUsedError;
  String get purchaseInvoiceId => throw _privateConstructorUsedError;
  String get paymentNumber => throw _privateConstructorUsedError;
  DateTime get paymentDate => throw _privateConstructorUsedError;
  String get amount => throw _privateConstructorUsedError;
  String get method => throw _privateConstructorUsedError;
  String? get cashAccountId => throw _privateConstructorUsedError;
  String? get bankAccountId => throw _privateConstructorUsedError;
  String get currency => throw _privateConstructorUsedError;
  String? get reference => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  String? get createdBy => throw _privateConstructorUsedError;
  int get rowVersion => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;
  DateTime? get deletedAt => throw _privateConstructorUsedError;

  /// Serializes this SupplierPayment to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierPayment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierPaymentCopyWith<SupplierPayment> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierPaymentCopyWith<$Res> {
  factory $SupplierPaymentCopyWith(
          SupplierPayment value, $Res Function(SupplierPayment) then) =
      _$SupplierPaymentCopyWithImpl<$Res, SupplierPayment>;
  @useResult
  $Res call(
      {String id,
      String companyId,
      String supplierId,
      String purchaseInvoiceId,
      String paymentNumber,
      DateTime paymentDate,
      String amount,
      String method,
      String? cashAccountId,
      String? bankAccountId,
      String currency,
      String? reference,
      String? notes,
      String? createdBy,
      int rowVersion,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt});
}

/// @nodoc
class _$SupplierPaymentCopyWithImpl<$Res, $Val extends SupplierPayment>
    implements $SupplierPaymentCopyWith<$Res> {
  _$SupplierPaymentCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierPayment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? supplierId = null,
    Object? purchaseInvoiceId = null,
    Object? paymentNumber = null,
    Object? paymentDate = null,
    Object? amount = null,
    Object? method = null,
    Object? cashAccountId = freezed,
    Object? bankAccountId = freezed,
    Object? currency = null,
    Object? reference = freezed,
    Object? notes = freezed,
    Object? createdBy = freezed,
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
      companyId: null == companyId
          ? _value.companyId
          : companyId // ignore: cast_nullable_to_non_nullable
              as String,
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseInvoiceId: null == purchaseInvoiceId
          ? _value.purchaseInvoiceId
          : purchaseInvoiceId // ignore: cast_nullable_to_non_nullable
              as String,
      paymentNumber: null == paymentNumber
          ? _value.paymentNumber
          : paymentNumber // ignore: cast_nullable_to_non_nullable
              as String,
      paymentDate: null == paymentDate
          ? _value.paymentDate
          : paymentDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as String,
      method: null == method
          ? _value.method
          : method // ignore: cast_nullable_to_non_nullable
              as String,
      cashAccountId: freezed == cashAccountId
          ? _value.cashAccountId
          : cashAccountId // ignore: cast_nullable_to_non_nullable
              as String?,
      bankAccountId: freezed == bankAccountId
          ? _value.bankAccountId
          : bankAccountId // ignore: cast_nullable_to_non_nullable
              as String?,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
      reference: freezed == reference
          ? _value.reference
          : reference // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      createdBy: freezed == createdBy
          ? _value.createdBy
          : createdBy // ignore: cast_nullable_to_non_nullable
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
abstract class _$$SupplierPaymentImplCopyWith<$Res>
    implements $SupplierPaymentCopyWith<$Res> {
  factory _$$SupplierPaymentImplCopyWith(_$SupplierPaymentImpl value,
          $Res Function(_$SupplierPaymentImpl) then) =
      __$$SupplierPaymentImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String companyId,
      String supplierId,
      String purchaseInvoiceId,
      String paymentNumber,
      DateTime paymentDate,
      String amount,
      String method,
      String? cashAccountId,
      String? bankAccountId,
      String currency,
      String? reference,
      String? notes,
      String? createdBy,
      int rowVersion,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt});
}

/// @nodoc
class __$$SupplierPaymentImplCopyWithImpl<$Res>
    extends _$SupplierPaymentCopyWithImpl<$Res, _$SupplierPaymentImpl>
    implements _$$SupplierPaymentImplCopyWith<$Res> {
  __$$SupplierPaymentImplCopyWithImpl(
      _$SupplierPaymentImpl _value, $Res Function(_$SupplierPaymentImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierPayment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? supplierId = null,
    Object? purchaseInvoiceId = null,
    Object? paymentNumber = null,
    Object? paymentDate = null,
    Object? amount = null,
    Object? method = null,
    Object? cashAccountId = freezed,
    Object? bankAccountId = freezed,
    Object? currency = null,
    Object? reference = freezed,
    Object? notes = freezed,
    Object? createdBy = freezed,
    Object? rowVersion = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
  }) {
    return _then(_$SupplierPaymentImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      companyId: null == companyId
          ? _value.companyId
          : companyId // ignore: cast_nullable_to_non_nullable
              as String,
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseInvoiceId: null == purchaseInvoiceId
          ? _value.purchaseInvoiceId
          : purchaseInvoiceId // ignore: cast_nullable_to_non_nullable
              as String,
      paymentNumber: null == paymentNumber
          ? _value.paymentNumber
          : paymentNumber // ignore: cast_nullable_to_non_nullable
              as String,
      paymentDate: null == paymentDate
          ? _value.paymentDate
          : paymentDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as String,
      method: null == method
          ? _value.method
          : method // ignore: cast_nullable_to_non_nullable
              as String,
      cashAccountId: freezed == cashAccountId
          ? _value.cashAccountId
          : cashAccountId // ignore: cast_nullable_to_non_nullable
              as String?,
      bankAccountId: freezed == bankAccountId
          ? _value.bankAccountId
          : bankAccountId // ignore: cast_nullable_to_non_nullable
              as String?,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
      reference: freezed == reference
          ? _value.reference
          : reference // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      createdBy: freezed == createdBy
          ? _value.createdBy
          : createdBy // ignore: cast_nullable_to_non_nullable
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
class _$SupplierPaymentImpl implements _SupplierPayment {
  const _$SupplierPaymentImpl(
      {required this.id,
      required this.companyId,
      required this.supplierId,
      required this.purchaseInvoiceId,
      required this.paymentNumber,
      required this.paymentDate,
      required this.amount,
      required this.method,
      this.cashAccountId,
      this.bankAccountId,
      required this.currency,
      this.reference,
      this.notes,
      this.createdBy,
      this.rowVersion = 0,
      required this.createdAt,
      required this.updatedAt,
      this.deletedAt});

  factory _$SupplierPaymentImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierPaymentImplFromJson(json);

  @override
  final String id;
  @override
  final String companyId;
  @override
  final String supplierId;
  @override
  final String purchaseInvoiceId;
  @override
  final String paymentNumber;
  @override
  final DateTime paymentDate;
  @override
  final String amount;
  @override
  final String method;
  @override
  final String? cashAccountId;
  @override
  final String? bankAccountId;
  @override
  final String currency;
  @override
  final String? reference;
  @override
  final String? notes;
  @override
  final String? createdBy;
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
    return 'SupplierPayment(id: $id, companyId: $companyId, supplierId: $supplierId, purchaseInvoiceId: $purchaseInvoiceId, paymentNumber: $paymentNumber, paymentDate: $paymentDate, amount: $amount, method: $method, cashAccountId: $cashAccountId, bankAccountId: $bankAccountId, currency: $currency, reference: $reference, notes: $notes, createdBy: $createdBy, rowVersion: $rowVersion, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierPaymentImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.supplierId, supplierId) ||
                other.supplierId == supplierId) &&
            (identical(other.purchaseInvoiceId, purchaseInvoiceId) ||
                other.purchaseInvoiceId == purchaseInvoiceId) &&
            (identical(other.paymentNumber, paymentNumber) ||
                other.paymentNumber == paymentNumber) &&
            (identical(other.paymentDate, paymentDate) ||
                other.paymentDate == paymentDate) &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.method, method) || other.method == method) &&
            (identical(other.cashAccountId, cashAccountId) ||
                other.cashAccountId == cashAccountId) &&
            (identical(other.bankAccountId, bankAccountId) ||
                other.bankAccountId == bankAccountId) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.reference, reference) ||
                other.reference == reference) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.createdBy, createdBy) ||
                other.createdBy == createdBy) &&
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
      companyId,
      supplierId,
      purchaseInvoiceId,
      paymentNumber,
      paymentDate,
      amount,
      method,
      cashAccountId,
      bankAccountId,
      currency,
      reference,
      notes,
      createdBy,
      rowVersion,
      createdAt,
      updatedAt,
      deletedAt);

  /// Create a copy of SupplierPayment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierPaymentImplCopyWith<_$SupplierPaymentImpl> get copyWith =>
      __$$SupplierPaymentImplCopyWithImpl<_$SupplierPaymentImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierPaymentImplToJson(
      this,
    );
  }
}

abstract class _SupplierPayment implements SupplierPayment {
  const factory _SupplierPayment(
      {required final String id,
      required final String companyId,
      required final String supplierId,
      required final String purchaseInvoiceId,
      required final String paymentNumber,
      required final DateTime paymentDate,
      required final String amount,
      required final String method,
      final String? cashAccountId,
      final String? bankAccountId,
      required final String currency,
      final String? reference,
      final String? notes,
      final String? createdBy,
      final int rowVersion,
      required final DateTime createdAt,
      required final DateTime updatedAt,
      final DateTime? deletedAt}) = _$SupplierPaymentImpl;

  factory _SupplierPayment.fromJson(Map<String, dynamic> json) =
      _$SupplierPaymentImpl.fromJson;

  @override
  String get id;
  @override
  String get companyId;
  @override
  String get supplierId;
  @override
  String get purchaseInvoiceId;
  @override
  String get paymentNumber;
  @override
  DateTime get paymentDate;
  @override
  String get amount;
  @override
  String get method;
  @override
  String? get cashAccountId;
  @override
  String? get bankAccountId;
  @override
  String get currency;
  @override
  String? get reference;
  @override
  String? get notes;
  @override
  String? get createdBy;
  @override
  int get rowVersion;
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;
  @override
  DateTime? get deletedAt;

  /// Create a copy of SupplierPayment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierPaymentImplCopyWith<_$SupplierPaymentImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SupplierPaymentListResponse _$SupplierPaymentListResponseFromJson(
    Map<String, dynamic> json) {
  return _SupplierPaymentListResponse.fromJson(json);
}

/// @nodoc
mixin _$SupplierPaymentListResponse {
  List<SupplierPayment> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this SupplierPaymentListResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierPaymentListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierPaymentListResponseCopyWith<SupplierPaymentListResponse>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierPaymentListResponseCopyWith<$Res> {
  factory $SupplierPaymentListResponseCopyWith(
          SupplierPaymentListResponse value,
          $Res Function(SupplierPaymentListResponse) then) =
      _$SupplierPaymentListResponseCopyWithImpl<$Res,
          SupplierPaymentListResponse>;
  @useResult
  $Res call({List<SupplierPayment> items, int total, int page, int limit});
}

/// @nodoc
class _$SupplierPaymentListResponseCopyWithImpl<$Res,
        $Val extends SupplierPaymentListResponse>
    implements $SupplierPaymentListResponseCopyWith<$Res> {
  _$SupplierPaymentListResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierPaymentListResponse
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
              as List<SupplierPayment>,
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
abstract class _$$SupplierPaymentListResponseImplCopyWith<$Res>
    implements $SupplierPaymentListResponseCopyWith<$Res> {
  factory _$$SupplierPaymentListResponseImplCopyWith(
          _$SupplierPaymentListResponseImpl value,
          $Res Function(_$SupplierPaymentListResponseImpl) then) =
      __$$SupplierPaymentListResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<SupplierPayment> items, int total, int page, int limit});
}

/// @nodoc
class __$$SupplierPaymentListResponseImplCopyWithImpl<$Res>
    extends _$SupplierPaymentListResponseCopyWithImpl<$Res,
        _$SupplierPaymentListResponseImpl>
    implements _$$SupplierPaymentListResponseImplCopyWith<$Res> {
  __$$SupplierPaymentListResponseImplCopyWithImpl(
      _$SupplierPaymentListResponseImpl _value,
      $Res Function(_$SupplierPaymentListResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierPaymentListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$SupplierPaymentListResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<SupplierPayment>,
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
class _$SupplierPaymentListResponseImpl
    implements _SupplierPaymentListResponse {
  const _$SupplierPaymentListResponseImpl(
      {required final List<SupplierPayment> items,
      required this.total,
      required this.page,
      required this.limit})
      : _items = items;

  factory _$SupplierPaymentListResponseImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$SupplierPaymentListResponseImplFromJson(json);

  final List<SupplierPayment> _items;
  @override
  List<SupplierPayment> get items {
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
    return 'SupplierPaymentListResponse(items: $items, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierPaymentListResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_items), total, page, limit);

  /// Create a copy of SupplierPaymentListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierPaymentListResponseImplCopyWith<_$SupplierPaymentListResponseImpl>
      get copyWith => __$$SupplierPaymentListResponseImplCopyWithImpl<
          _$SupplierPaymentListResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierPaymentListResponseImplToJson(
      this,
    );
  }
}

abstract class _SupplierPaymentListResponse
    implements SupplierPaymentListResponse {
  const factory _SupplierPaymentListResponse(
      {required final List<SupplierPayment> items,
      required final int total,
      required final int page,
      required final int limit}) = _$SupplierPaymentListResponseImpl;

  factory _SupplierPaymentListResponse.fromJson(Map<String, dynamic> json) =
      _$SupplierPaymentListResponseImpl.fromJson;

  @override
  List<SupplierPayment> get items;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of SupplierPaymentListResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierPaymentListResponseImplCopyWith<_$SupplierPaymentListResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

CreateSupplierPaymentRequest _$CreateSupplierPaymentRequestFromJson(
    Map<String, dynamic> json) {
  return _CreateSupplierPaymentRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateSupplierPaymentRequest {
  String get purchaseInvoiceId => throw _privateConstructorUsedError;
  double get amount => throw _privateConstructorUsedError;
  String get method => throw _privateConstructorUsedError;
  String? get cashAccountId => throw _privateConstructorUsedError;
  String? get bankAccountId => throw _privateConstructorUsedError;
  String? get currency => throw _privateConstructorUsedError;
  String? get paymentDate => throw _privateConstructorUsedError;
  String? get reference => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;

  /// Serializes this CreateSupplierPaymentRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateSupplierPaymentRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateSupplierPaymentRequestCopyWith<CreateSupplierPaymentRequest>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateSupplierPaymentRequestCopyWith<$Res> {
  factory $CreateSupplierPaymentRequestCopyWith(
          CreateSupplierPaymentRequest value,
          $Res Function(CreateSupplierPaymentRequest) then) =
      _$CreateSupplierPaymentRequestCopyWithImpl<$Res,
          CreateSupplierPaymentRequest>;
  @useResult
  $Res call(
      {String purchaseInvoiceId,
      double amount,
      String method,
      String? cashAccountId,
      String? bankAccountId,
      String? currency,
      String? paymentDate,
      String? reference,
      String? notes});
}

/// @nodoc
class _$CreateSupplierPaymentRequestCopyWithImpl<$Res,
        $Val extends CreateSupplierPaymentRequest>
    implements $CreateSupplierPaymentRequestCopyWith<$Res> {
  _$CreateSupplierPaymentRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateSupplierPaymentRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? purchaseInvoiceId = null,
    Object? amount = null,
    Object? method = null,
    Object? cashAccountId = freezed,
    Object? bankAccountId = freezed,
    Object? currency = freezed,
    Object? paymentDate = freezed,
    Object? reference = freezed,
    Object? notes = freezed,
  }) {
    return _then(_value.copyWith(
      purchaseInvoiceId: null == purchaseInvoiceId
          ? _value.purchaseInvoiceId
          : purchaseInvoiceId // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as double,
      method: null == method
          ? _value.method
          : method // ignore: cast_nullable_to_non_nullable
              as String,
      cashAccountId: freezed == cashAccountId
          ? _value.cashAccountId
          : cashAccountId // ignore: cast_nullable_to_non_nullable
              as String?,
      bankAccountId: freezed == bankAccountId
          ? _value.bankAccountId
          : bankAccountId // ignore: cast_nullable_to_non_nullable
              as String?,
      currency: freezed == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String?,
      paymentDate: freezed == paymentDate
          ? _value.paymentDate
          : paymentDate // ignore: cast_nullable_to_non_nullable
              as String?,
      reference: freezed == reference
          ? _value.reference
          : reference // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreateSupplierPaymentRequestImplCopyWith<$Res>
    implements $CreateSupplierPaymentRequestCopyWith<$Res> {
  factory _$$CreateSupplierPaymentRequestImplCopyWith(
          _$CreateSupplierPaymentRequestImpl value,
          $Res Function(_$CreateSupplierPaymentRequestImpl) then) =
      __$$CreateSupplierPaymentRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String purchaseInvoiceId,
      double amount,
      String method,
      String? cashAccountId,
      String? bankAccountId,
      String? currency,
      String? paymentDate,
      String? reference,
      String? notes});
}

/// @nodoc
class __$$CreateSupplierPaymentRequestImplCopyWithImpl<$Res>
    extends _$CreateSupplierPaymentRequestCopyWithImpl<$Res,
        _$CreateSupplierPaymentRequestImpl>
    implements _$$CreateSupplierPaymentRequestImplCopyWith<$Res> {
  __$$CreateSupplierPaymentRequestImplCopyWithImpl(
      _$CreateSupplierPaymentRequestImpl _value,
      $Res Function(_$CreateSupplierPaymentRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreateSupplierPaymentRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? purchaseInvoiceId = null,
    Object? amount = null,
    Object? method = null,
    Object? cashAccountId = freezed,
    Object? bankAccountId = freezed,
    Object? currency = freezed,
    Object? paymentDate = freezed,
    Object? reference = freezed,
    Object? notes = freezed,
  }) {
    return _then(_$CreateSupplierPaymentRequestImpl(
      purchaseInvoiceId: null == purchaseInvoiceId
          ? _value.purchaseInvoiceId
          : purchaseInvoiceId // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as double,
      method: null == method
          ? _value.method
          : method // ignore: cast_nullable_to_non_nullable
              as String,
      cashAccountId: freezed == cashAccountId
          ? _value.cashAccountId
          : cashAccountId // ignore: cast_nullable_to_non_nullable
              as String?,
      bankAccountId: freezed == bankAccountId
          ? _value.bankAccountId
          : bankAccountId // ignore: cast_nullable_to_non_nullable
              as String?,
      currency: freezed == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String?,
      paymentDate: freezed == paymentDate
          ? _value.paymentDate
          : paymentDate // ignore: cast_nullable_to_non_nullable
              as String?,
      reference: freezed == reference
          ? _value.reference
          : reference // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateSupplierPaymentRequestImpl
    implements _CreateSupplierPaymentRequest {
  const _$CreateSupplierPaymentRequestImpl(
      {required this.purchaseInvoiceId,
      required this.amount,
      required this.method,
      this.cashAccountId,
      this.bankAccountId,
      this.currency,
      this.paymentDate,
      this.reference,
      this.notes});

  factory _$CreateSupplierPaymentRequestImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$CreateSupplierPaymentRequestImplFromJson(json);

  @override
  final String purchaseInvoiceId;
  @override
  final double amount;
  @override
  final String method;
  @override
  final String? cashAccountId;
  @override
  final String? bankAccountId;
  @override
  final String? currency;
  @override
  final String? paymentDate;
  @override
  final String? reference;
  @override
  final String? notes;

  @override
  String toString() {
    return 'CreateSupplierPaymentRequest(purchaseInvoiceId: $purchaseInvoiceId, amount: $amount, method: $method, cashAccountId: $cashAccountId, bankAccountId: $bankAccountId, currency: $currency, paymentDate: $paymentDate, reference: $reference, notes: $notes)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateSupplierPaymentRequestImpl &&
            (identical(other.purchaseInvoiceId, purchaseInvoiceId) ||
                other.purchaseInvoiceId == purchaseInvoiceId) &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.method, method) || other.method == method) &&
            (identical(other.cashAccountId, cashAccountId) ||
                other.cashAccountId == cashAccountId) &&
            (identical(other.bankAccountId, bankAccountId) ||
                other.bankAccountId == bankAccountId) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.paymentDate, paymentDate) ||
                other.paymentDate == paymentDate) &&
            (identical(other.reference, reference) ||
                other.reference == reference) &&
            (identical(other.notes, notes) || other.notes == notes));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      purchaseInvoiceId,
      amount,
      method,
      cashAccountId,
      bankAccountId,
      currency,
      paymentDate,
      reference,
      notes);

  /// Create a copy of CreateSupplierPaymentRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateSupplierPaymentRequestImplCopyWith<
          _$CreateSupplierPaymentRequestImpl>
      get copyWith => __$$CreateSupplierPaymentRequestImplCopyWithImpl<
          _$CreateSupplierPaymentRequestImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateSupplierPaymentRequestImplToJson(
      this,
    );
  }
}

abstract class _CreateSupplierPaymentRequest
    implements CreateSupplierPaymentRequest {
  const factory _CreateSupplierPaymentRequest(
      {required final String purchaseInvoiceId,
      required final double amount,
      required final String method,
      final String? cashAccountId,
      final String? bankAccountId,
      final String? currency,
      final String? paymentDate,
      final String? reference,
      final String? notes}) = _$CreateSupplierPaymentRequestImpl;

  factory _CreateSupplierPaymentRequest.fromJson(Map<String, dynamic> json) =
      _$CreateSupplierPaymentRequestImpl.fromJson;

  @override
  String get purchaseInvoiceId;
  @override
  double get amount;
  @override
  String get method;
  @override
  String? get cashAccountId;
  @override
  String? get bankAccountId;
  @override
  String? get currency;
  @override
  String? get paymentDate;
  @override
  String? get reference;
  @override
  String? get notes;

  /// Create a copy of CreateSupplierPaymentRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateSupplierPaymentRequestImplCopyWith<
          _$CreateSupplierPaymentRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}

SupplierFinanceSummary _$SupplierFinanceSummaryFromJson(
    Map<String, dynamic> json) {
  return _SupplierFinanceSummary.fromJson(json);
}

/// @nodoc
mixin _$SupplierFinanceSummary {
  String get supplierId => throw _privateConstructorUsedError;
  String get totalInvoiced => throw _privateConstructorUsedError;
  String get totalPaid => throw _privateConstructorUsedError;
  String get totalReturned => throw _privateConstructorUsedError;
  String get outstanding => throw _privateConstructorUsedError;
  int get invoiceCount => throw _privateConstructorUsedError;
  int get paymentCount => throw _privateConstructorUsedError;
  DateTime? get lastPaymentDate => throw _privateConstructorUsedError;
  String? get lastPaymentAmount => throw _privateConstructorUsedError;

  /// Serializes this SupplierFinanceSummary to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierFinanceSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierFinanceSummaryCopyWith<SupplierFinanceSummary> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierFinanceSummaryCopyWith<$Res> {
  factory $SupplierFinanceSummaryCopyWith(SupplierFinanceSummary value,
          $Res Function(SupplierFinanceSummary) then) =
      _$SupplierFinanceSummaryCopyWithImpl<$Res, SupplierFinanceSummary>;
  @useResult
  $Res call(
      {String supplierId,
      String totalInvoiced,
      String totalPaid,
      String totalReturned,
      String outstanding,
      int invoiceCount,
      int paymentCount,
      DateTime? lastPaymentDate,
      String? lastPaymentAmount});
}

/// @nodoc
class _$SupplierFinanceSummaryCopyWithImpl<$Res,
        $Val extends SupplierFinanceSummary>
    implements $SupplierFinanceSummaryCopyWith<$Res> {
  _$SupplierFinanceSummaryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierFinanceSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? supplierId = null,
    Object? totalInvoiced = null,
    Object? totalPaid = null,
    Object? totalReturned = null,
    Object? outstanding = null,
    Object? invoiceCount = null,
    Object? paymentCount = null,
    Object? lastPaymentDate = freezed,
    Object? lastPaymentAmount = freezed,
  }) {
    return _then(_value.copyWith(
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      totalInvoiced: null == totalInvoiced
          ? _value.totalInvoiced
          : totalInvoiced // ignore: cast_nullable_to_non_nullable
              as String,
      totalPaid: null == totalPaid
          ? _value.totalPaid
          : totalPaid // ignore: cast_nullable_to_non_nullable
              as String,
      totalReturned: null == totalReturned
          ? _value.totalReturned
          : totalReturned // ignore: cast_nullable_to_non_nullable
              as String,
      outstanding: null == outstanding
          ? _value.outstanding
          : outstanding // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceCount: null == invoiceCount
          ? _value.invoiceCount
          : invoiceCount // ignore: cast_nullable_to_non_nullable
              as int,
      paymentCount: null == paymentCount
          ? _value.paymentCount
          : paymentCount // ignore: cast_nullable_to_non_nullable
              as int,
      lastPaymentDate: freezed == lastPaymentDate
          ? _value.lastPaymentDate
          : lastPaymentDate // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      lastPaymentAmount: freezed == lastPaymentAmount
          ? _value.lastPaymentAmount
          : lastPaymentAmount // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SupplierFinanceSummaryImplCopyWith<$Res>
    implements $SupplierFinanceSummaryCopyWith<$Res> {
  factory _$$SupplierFinanceSummaryImplCopyWith(
          _$SupplierFinanceSummaryImpl value,
          $Res Function(_$SupplierFinanceSummaryImpl) then) =
      __$$SupplierFinanceSummaryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String supplierId,
      String totalInvoiced,
      String totalPaid,
      String totalReturned,
      String outstanding,
      int invoiceCount,
      int paymentCount,
      DateTime? lastPaymentDate,
      String? lastPaymentAmount});
}

/// @nodoc
class __$$SupplierFinanceSummaryImplCopyWithImpl<$Res>
    extends _$SupplierFinanceSummaryCopyWithImpl<$Res,
        _$SupplierFinanceSummaryImpl>
    implements _$$SupplierFinanceSummaryImplCopyWith<$Res> {
  __$$SupplierFinanceSummaryImplCopyWithImpl(
      _$SupplierFinanceSummaryImpl _value,
      $Res Function(_$SupplierFinanceSummaryImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierFinanceSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? supplierId = null,
    Object? totalInvoiced = null,
    Object? totalPaid = null,
    Object? totalReturned = null,
    Object? outstanding = null,
    Object? invoiceCount = null,
    Object? paymentCount = null,
    Object? lastPaymentDate = freezed,
    Object? lastPaymentAmount = freezed,
  }) {
    return _then(_$SupplierFinanceSummaryImpl(
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      totalInvoiced: null == totalInvoiced
          ? _value.totalInvoiced
          : totalInvoiced // ignore: cast_nullable_to_non_nullable
              as String,
      totalPaid: null == totalPaid
          ? _value.totalPaid
          : totalPaid // ignore: cast_nullable_to_non_nullable
              as String,
      totalReturned: null == totalReturned
          ? _value.totalReturned
          : totalReturned // ignore: cast_nullable_to_non_nullable
              as String,
      outstanding: null == outstanding
          ? _value.outstanding
          : outstanding // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceCount: null == invoiceCount
          ? _value.invoiceCount
          : invoiceCount // ignore: cast_nullable_to_non_nullable
              as int,
      paymentCount: null == paymentCount
          ? _value.paymentCount
          : paymentCount // ignore: cast_nullable_to_non_nullable
              as int,
      lastPaymentDate: freezed == lastPaymentDate
          ? _value.lastPaymentDate
          : lastPaymentDate // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      lastPaymentAmount: freezed == lastPaymentAmount
          ? _value.lastPaymentAmount
          : lastPaymentAmount // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SupplierFinanceSummaryImpl implements _SupplierFinanceSummary {
  const _$SupplierFinanceSummaryImpl(
      {required this.supplierId,
      required this.totalInvoiced,
      required this.totalPaid,
      required this.totalReturned,
      required this.outstanding,
      required this.invoiceCount,
      required this.paymentCount,
      this.lastPaymentDate,
      this.lastPaymentAmount});

  factory _$SupplierFinanceSummaryImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierFinanceSummaryImplFromJson(json);

  @override
  final String supplierId;
  @override
  final String totalInvoiced;
  @override
  final String totalPaid;
  @override
  final String totalReturned;
  @override
  final String outstanding;
  @override
  final int invoiceCount;
  @override
  final int paymentCount;
  @override
  final DateTime? lastPaymentDate;
  @override
  final String? lastPaymentAmount;

  @override
  String toString() {
    return 'SupplierFinanceSummary(supplierId: $supplierId, totalInvoiced: $totalInvoiced, totalPaid: $totalPaid, totalReturned: $totalReturned, outstanding: $outstanding, invoiceCount: $invoiceCount, paymentCount: $paymentCount, lastPaymentDate: $lastPaymentDate, lastPaymentAmount: $lastPaymentAmount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierFinanceSummaryImpl &&
            (identical(other.supplierId, supplierId) ||
                other.supplierId == supplierId) &&
            (identical(other.totalInvoiced, totalInvoiced) ||
                other.totalInvoiced == totalInvoiced) &&
            (identical(other.totalPaid, totalPaid) ||
                other.totalPaid == totalPaid) &&
            (identical(other.totalReturned, totalReturned) ||
                other.totalReturned == totalReturned) &&
            (identical(other.outstanding, outstanding) ||
                other.outstanding == outstanding) &&
            (identical(other.invoiceCount, invoiceCount) ||
                other.invoiceCount == invoiceCount) &&
            (identical(other.paymentCount, paymentCount) ||
                other.paymentCount == paymentCount) &&
            (identical(other.lastPaymentDate, lastPaymentDate) ||
                other.lastPaymentDate == lastPaymentDate) &&
            (identical(other.lastPaymentAmount, lastPaymentAmount) ||
                other.lastPaymentAmount == lastPaymentAmount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      supplierId,
      totalInvoiced,
      totalPaid,
      totalReturned,
      outstanding,
      invoiceCount,
      paymentCount,
      lastPaymentDate,
      lastPaymentAmount);

  /// Create a copy of SupplierFinanceSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierFinanceSummaryImplCopyWith<_$SupplierFinanceSummaryImpl>
      get copyWith => __$$SupplierFinanceSummaryImplCopyWithImpl<
          _$SupplierFinanceSummaryImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierFinanceSummaryImplToJson(
      this,
    );
  }
}

abstract class _SupplierFinanceSummary implements SupplierFinanceSummary {
  const factory _SupplierFinanceSummary(
      {required final String supplierId,
      required final String totalInvoiced,
      required final String totalPaid,
      required final String totalReturned,
      required final String outstanding,
      required final int invoiceCount,
      required final int paymentCount,
      final DateTime? lastPaymentDate,
      final String? lastPaymentAmount}) = _$SupplierFinanceSummaryImpl;

  factory _SupplierFinanceSummary.fromJson(Map<String, dynamic> json) =
      _$SupplierFinanceSummaryImpl.fromJson;

  @override
  String get supplierId;
  @override
  String get totalInvoiced;
  @override
  String get totalPaid;
  @override
  String get totalReturned;
  @override
  String get outstanding;
  @override
  int get invoiceCount;
  @override
  int get paymentCount;
  @override
  DateTime? get lastPaymentDate;
  @override
  String? get lastPaymentAmount;

  /// Create a copy of SupplierFinanceSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierFinanceSummaryImplCopyWith<_$SupplierFinanceSummaryImpl>
      get copyWith => throw _privateConstructorUsedError;
}

SupplierInvoiceLite _$SupplierInvoiceLiteFromJson(Map<String, dynamic> json) {
  return _SupplierInvoiceLite.fromJson(json);
}

/// @nodoc
mixin _$SupplierInvoiceLite {
  String get id => throw _privateConstructorUsedError;
  String get invoiceNumber => throw _privateConstructorUsedError;
  String get grandTotal => throw _privateConstructorUsedError;
  String get paidAmount => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String get currency => throw _privateConstructorUsedError;
  DateTime? get dueDate => throw _privateConstructorUsedError;

  /// Serializes this SupplierInvoiceLite to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierInvoiceLite
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierInvoiceLiteCopyWith<SupplierInvoiceLite> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierInvoiceLiteCopyWith<$Res> {
  factory $SupplierInvoiceLiteCopyWith(
          SupplierInvoiceLite value, $Res Function(SupplierInvoiceLite) then) =
      _$SupplierInvoiceLiteCopyWithImpl<$Res, SupplierInvoiceLite>;
  @useResult
  $Res call(
      {String id,
      String invoiceNumber,
      String grandTotal,
      String paidAmount,
      String status,
      String currency,
      DateTime? dueDate});
}

/// @nodoc
class _$SupplierInvoiceLiteCopyWithImpl<$Res, $Val extends SupplierInvoiceLite>
    implements $SupplierInvoiceLiteCopyWith<$Res> {
  _$SupplierInvoiceLiteCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierInvoiceLite
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? invoiceNumber = null,
    Object? grandTotal = null,
    Object? paidAmount = null,
    Object? status = null,
    Object? currency = null,
    Object? dueDate = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceNumber: null == invoiceNumber
          ? _value.invoiceNumber
          : invoiceNumber // ignore: cast_nullable_to_non_nullable
              as String,
      grandTotal: null == grandTotal
          ? _value.grandTotal
          : grandTotal // ignore: cast_nullable_to_non_nullable
              as String,
      paidAmount: null == paidAmount
          ? _value.paidAmount
          : paidAmount // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
      dueDate: freezed == dueDate
          ? _value.dueDate
          : dueDate // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SupplierInvoiceLiteImplCopyWith<$Res>
    implements $SupplierInvoiceLiteCopyWith<$Res> {
  factory _$$SupplierInvoiceLiteImplCopyWith(_$SupplierInvoiceLiteImpl value,
          $Res Function(_$SupplierInvoiceLiteImpl) then) =
      __$$SupplierInvoiceLiteImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String invoiceNumber,
      String grandTotal,
      String paidAmount,
      String status,
      String currency,
      DateTime? dueDate});
}

/// @nodoc
class __$$SupplierInvoiceLiteImplCopyWithImpl<$Res>
    extends _$SupplierInvoiceLiteCopyWithImpl<$Res, _$SupplierInvoiceLiteImpl>
    implements _$$SupplierInvoiceLiteImplCopyWith<$Res> {
  __$$SupplierInvoiceLiteImplCopyWithImpl(_$SupplierInvoiceLiteImpl _value,
      $Res Function(_$SupplierInvoiceLiteImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierInvoiceLite
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? invoiceNumber = null,
    Object? grandTotal = null,
    Object? paidAmount = null,
    Object? status = null,
    Object? currency = null,
    Object? dueDate = freezed,
  }) {
    return _then(_$SupplierInvoiceLiteImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceNumber: null == invoiceNumber
          ? _value.invoiceNumber
          : invoiceNumber // ignore: cast_nullable_to_non_nullable
              as String,
      grandTotal: null == grandTotal
          ? _value.grandTotal
          : grandTotal // ignore: cast_nullable_to_non_nullable
              as String,
      paidAmount: null == paidAmount
          ? _value.paidAmount
          : paidAmount // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
      dueDate: freezed == dueDate
          ? _value.dueDate
          : dueDate // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SupplierInvoiceLiteImpl implements _SupplierInvoiceLite {
  const _$SupplierInvoiceLiteImpl(
      {required this.id,
      required this.invoiceNumber,
      required this.grandTotal,
      required this.paidAmount,
      required this.status,
      required this.currency,
      this.dueDate});

  factory _$SupplierInvoiceLiteImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierInvoiceLiteImplFromJson(json);

  @override
  final String id;
  @override
  final String invoiceNumber;
  @override
  final String grandTotal;
  @override
  final String paidAmount;
  @override
  final String status;
  @override
  final String currency;
  @override
  final DateTime? dueDate;

  @override
  String toString() {
    return 'SupplierInvoiceLite(id: $id, invoiceNumber: $invoiceNumber, grandTotal: $grandTotal, paidAmount: $paidAmount, status: $status, currency: $currency, dueDate: $dueDate)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierInvoiceLiteImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.invoiceNumber, invoiceNumber) ||
                other.invoiceNumber == invoiceNumber) &&
            (identical(other.grandTotal, grandTotal) ||
                other.grandTotal == grandTotal) &&
            (identical(other.paidAmount, paidAmount) ||
                other.paidAmount == paidAmount) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.dueDate, dueDate) || other.dueDate == dueDate));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, invoiceNumber, grandTotal,
      paidAmount, status, currency, dueDate);

  /// Create a copy of SupplierInvoiceLite
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierInvoiceLiteImplCopyWith<_$SupplierInvoiceLiteImpl> get copyWith =>
      __$$SupplierInvoiceLiteImplCopyWithImpl<_$SupplierInvoiceLiteImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierInvoiceLiteImplToJson(
      this,
    );
  }
}

abstract class _SupplierInvoiceLite implements SupplierInvoiceLite {
  const factory _SupplierInvoiceLite(
      {required final String id,
      required final String invoiceNumber,
      required final String grandTotal,
      required final String paidAmount,
      required final String status,
      required final String currency,
      final DateTime? dueDate}) = _$SupplierInvoiceLiteImpl;

  factory _SupplierInvoiceLite.fromJson(Map<String, dynamic> json) =
      _$SupplierInvoiceLiteImpl.fromJson;

  @override
  String get id;
  @override
  String get invoiceNumber;
  @override
  String get grandTotal;
  @override
  String get paidAmount;
  @override
  String get status;
  @override
  String get currency;
  @override
  DateTime? get dueDate;

  /// Create a copy of SupplierInvoiceLite
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierInvoiceLiteImplCopyWith<_$SupplierInvoiceLiteImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CashAccountLite _$CashAccountLiteFromJson(Map<String, dynamic> json) {
  return _CashAccountLite.fromJson(json);
}

/// @nodoc
mixin _$CashAccountLite {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get currency => throw _privateConstructorUsedError;
  String? get type => throw _privateConstructorUsedError;

  /// Serializes this CashAccountLite to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CashAccountLite
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CashAccountLiteCopyWith<CashAccountLite> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CashAccountLiteCopyWith<$Res> {
  factory $CashAccountLiteCopyWith(
          CashAccountLite value, $Res Function(CashAccountLite) then) =
      _$CashAccountLiteCopyWithImpl<$Res, CashAccountLite>;
  @useResult
  $Res call({String id, String name, String currency, String? type});
}

/// @nodoc
class _$CashAccountLiteCopyWithImpl<$Res, $Val extends CashAccountLite>
    implements $CashAccountLiteCopyWith<$Res> {
  _$CashAccountLiteCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CashAccountLite
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? currency = null,
    Object? type = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
      type: freezed == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CashAccountLiteImplCopyWith<$Res>
    implements $CashAccountLiteCopyWith<$Res> {
  factory _$$CashAccountLiteImplCopyWith(_$CashAccountLiteImpl value,
          $Res Function(_$CashAccountLiteImpl) then) =
      __$$CashAccountLiteImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String name, String currency, String? type});
}

/// @nodoc
class __$$CashAccountLiteImplCopyWithImpl<$Res>
    extends _$CashAccountLiteCopyWithImpl<$Res, _$CashAccountLiteImpl>
    implements _$$CashAccountLiteImplCopyWith<$Res> {
  __$$CashAccountLiteImplCopyWithImpl(
      _$CashAccountLiteImpl _value, $Res Function(_$CashAccountLiteImpl) _then)
      : super(_value, _then);

  /// Create a copy of CashAccountLite
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? currency = null,
    Object? type = freezed,
  }) {
    return _then(_$CashAccountLiteImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
      type: freezed == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CashAccountLiteImpl implements _CashAccountLite {
  const _$CashAccountLiteImpl(
      {required this.id,
      required this.name,
      required this.currency,
      this.type});

  factory _$CashAccountLiteImpl.fromJson(Map<String, dynamic> json) =>
      _$$CashAccountLiteImplFromJson(json);

  @override
  final String id;
  @override
  final String name;
  @override
  final String currency;
  @override
  final String? type;

  @override
  String toString() {
    return 'CashAccountLite(id: $id, name: $name, currency: $currency, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CashAccountLiteImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, name, currency, type);

  /// Create a copy of CashAccountLite
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CashAccountLiteImplCopyWith<_$CashAccountLiteImpl> get copyWith =>
      __$$CashAccountLiteImplCopyWithImpl<_$CashAccountLiteImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CashAccountLiteImplToJson(
      this,
    );
  }
}

abstract class _CashAccountLite implements CashAccountLite {
  const factory _CashAccountLite(
      {required final String id,
      required final String name,
      required final String currency,
      final String? type}) = _$CashAccountLiteImpl;

  factory _CashAccountLite.fromJson(Map<String, dynamic> json) =
      _$CashAccountLiteImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  String get currency;
  @override
  String? get type;

  /// Create a copy of CashAccountLite
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CashAccountLiteImplCopyWith<_$CashAccountLiteImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

BankAccountLite _$BankAccountLiteFromJson(Map<String, dynamic> json) {
  return _BankAccountLite.fromJson(json);
}

/// @nodoc
mixin _$BankAccountLite {
  String get id => throw _privateConstructorUsedError;
  String get bankName => throw _privateConstructorUsedError;
  String get accountNumber => throw _privateConstructorUsedError;
  String? get accountName => throw _privateConstructorUsedError;
  String get currency => throw _privateConstructorUsedError;

  /// Serializes this BankAccountLite to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of BankAccountLite
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $BankAccountLiteCopyWith<BankAccountLite> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $BankAccountLiteCopyWith<$Res> {
  factory $BankAccountLiteCopyWith(
          BankAccountLite value, $Res Function(BankAccountLite) then) =
      _$BankAccountLiteCopyWithImpl<$Res, BankAccountLite>;
  @useResult
  $Res call(
      {String id,
      String bankName,
      String accountNumber,
      String? accountName,
      String currency});
}

/// @nodoc
class _$BankAccountLiteCopyWithImpl<$Res, $Val extends BankAccountLite>
    implements $BankAccountLiteCopyWith<$Res> {
  _$BankAccountLiteCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of BankAccountLite
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? bankName = null,
    Object? accountNumber = null,
    Object? accountName = freezed,
    Object? currency = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      bankName: null == bankName
          ? _value.bankName
          : bankName // ignore: cast_nullable_to_non_nullable
              as String,
      accountNumber: null == accountNumber
          ? _value.accountNumber
          : accountNumber // ignore: cast_nullable_to_non_nullable
              as String,
      accountName: freezed == accountName
          ? _value.accountName
          : accountName // ignore: cast_nullable_to_non_nullable
              as String?,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$BankAccountLiteImplCopyWith<$Res>
    implements $BankAccountLiteCopyWith<$Res> {
  factory _$$BankAccountLiteImplCopyWith(_$BankAccountLiteImpl value,
          $Res Function(_$BankAccountLiteImpl) then) =
      __$$BankAccountLiteImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String bankName,
      String accountNumber,
      String? accountName,
      String currency});
}

/// @nodoc
class __$$BankAccountLiteImplCopyWithImpl<$Res>
    extends _$BankAccountLiteCopyWithImpl<$Res, _$BankAccountLiteImpl>
    implements _$$BankAccountLiteImplCopyWith<$Res> {
  __$$BankAccountLiteImplCopyWithImpl(
      _$BankAccountLiteImpl _value, $Res Function(_$BankAccountLiteImpl) _then)
      : super(_value, _then);

  /// Create a copy of BankAccountLite
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? bankName = null,
    Object? accountNumber = null,
    Object? accountName = freezed,
    Object? currency = null,
  }) {
    return _then(_$BankAccountLiteImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      bankName: null == bankName
          ? _value.bankName
          : bankName // ignore: cast_nullable_to_non_nullable
              as String,
      accountNumber: null == accountNumber
          ? _value.accountNumber
          : accountNumber // ignore: cast_nullable_to_non_nullable
              as String,
      accountName: freezed == accountName
          ? _value.accountName
          : accountName // ignore: cast_nullable_to_non_nullable
              as String?,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$BankAccountLiteImpl implements _BankAccountLite {
  const _$BankAccountLiteImpl(
      {required this.id,
      required this.bankName,
      required this.accountNumber,
      this.accountName,
      required this.currency});

  factory _$BankAccountLiteImpl.fromJson(Map<String, dynamic> json) =>
      _$$BankAccountLiteImplFromJson(json);

  @override
  final String id;
  @override
  final String bankName;
  @override
  final String accountNumber;
  @override
  final String? accountName;
  @override
  final String currency;

  @override
  String toString() {
    return 'BankAccountLite(id: $id, bankName: $bankName, accountNumber: $accountNumber, accountName: $accountName, currency: $currency)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$BankAccountLiteImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.bankName, bankName) ||
                other.bankName == bankName) &&
            (identical(other.accountNumber, accountNumber) ||
                other.accountNumber == accountNumber) &&
            (identical(other.accountName, accountName) ||
                other.accountName == accountName) &&
            (identical(other.currency, currency) ||
                other.currency == currency));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, bankName, accountNumber, accountName, currency);

  /// Create a copy of BankAccountLite
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$BankAccountLiteImplCopyWith<_$BankAccountLiteImpl> get copyWith =>
      __$$BankAccountLiteImplCopyWithImpl<_$BankAccountLiteImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$BankAccountLiteImplToJson(
      this,
    );
  }
}

abstract class _BankAccountLite implements BankAccountLite {
  const factory _BankAccountLite(
      {required final String id,
      required final String bankName,
      required final String accountNumber,
      final String? accountName,
      required final String currency}) = _$BankAccountLiteImpl;

  factory _BankAccountLite.fromJson(Map<String, dynamic> json) =
      _$BankAccountLiteImpl.fromJson;

  @override
  String get id;
  @override
  String get bankName;
  @override
  String get accountNumber;
  @override
  String? get accountName;
  @override
  String get currency;

  /// Create a copy of BankAccountLite
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$BankAccountLiteImplCopyWith<_$BankAccountLiteImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PurchaseInvoiceItem _$PurchaseInvoiceItemFromJson(Map<String, dynamic> json) {
  return _PurchaseInvoiceItem.fromJson(json);
}

/// @nodoc
mixin _$PurchaseInvoiceItem {
  String get id => throw _privateConstructorUsedError;
  String get purchaseInvoiceId => throw _privateConstructorUsedError;
  String get productId => throw _privateConstructorUsedError;
  String? get purchaseOrderItemId => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  String get unitCost => throw _privateConstructorUsedError;
  String? get discountPercent => throw _privateConstructorUsedError;
  String get discountAmount => throw _privateConstructorUsedError;
  String? get taxPercent => throw _privateConstructorUsedError;
  String get taxAmount => throw _privateConstructorUsedError;
  String get subtotal => throw _privateConstructorUsedError;
  String get total => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;

  /// Serializes this PurchaseInvoiceItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PurchaseInvoiceItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PurchaseInvoiceItemCopyWith<PurchaseInvoiceItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PurchaseInvoiceItemCopyWith<$Res> {
  factory $PurchaseInvoiceItemCopyWith(
          PurchaseInvoiceItem value, $Res Function(PurchaseInvoiceItem) then) =
      _$PurchaseInvoiceItemCopyWithImpl<$Res, PurchaseInvoiceItem>;
  @useResult
  $Res call(
      {String id,
      String purchaseInvoiceId,
      String productId,
      String? purchaseOrderItemId,
      int quantity,
      String unitCost,
      String? discountPercent,
      String discountAmount,
      String? taxPercent,
      String taxAmount,
      String subtotal,
      String total,
      String? notes});
}

/// @nodoc
class _$PurchaseInvoiceItemCopyWithImpl<$Res, $Val extends PurchaseInvoiceItem>
    implements $PurchaseInvoiceItemCopyWith<$Res> {
  _$PurchaseInvoiceItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PurchaseInvoiceItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? purchaseInvoiceId = null,
    Object? productId = null,
    Object? purchaseOrderItemId = freezed,
    Object? quantity = null,
    Object? unitCost = null,
    Object? discountPercent = freezed,
    Object? discountAmount = null,
    Object? taxPercent = freezed,
    Object? taxAmount = null,
    Object? subtotal = null,
    Object? total = null,
    Object? notes = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseInvoiceId: null == purchaseInvoiceId
          ? _value.purchaseInvoiceId
          : purchaseInvoiceId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseOrderItemId: freezed == purchaseOrderItemId
          ? _value.purchaseOrderItemId
          : purchaseOrderItemId // ignore: cast_nullable_to_non_nullable
              as String?,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitCost: null == unitCost
          ? _value.unitCost
          : unitCost // ignore: cast_nullable_to_non_nullable
              as String,
      discountPercent: freezed == discountPercent
          ? _value.discountPercent
          : discountPercent // ignore: cast_nullable_to_non_nullable
              as String?,
      discountAmount: null == discountAmount
          ? _value.discountAmount
          : discountAmount // ignore: cast_nullable_to_non_nullable
              as String,
      taxPercent: freezed == taxPercent
          ? _value.taxPercent
          : taxPercent // ignore: cast_nullable_to_non_nullable
              as String?,
      taxAmount: null == taxAmount
          ? _value.taxAmount
          : taxAmount // ignore: cast_nullable_to_non_nullable
              as String,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as String,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as String,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PurchaseInvoiceItemImplCopyWith<$Res>
    implements $PurchaseInvoiceItemCopyWith<$Res> {
  factory _$$PurchaseInvoiceItemImplCopyWith(_$PurchaseInvoiceItemImpl value,
          $Res Function(_$PurchaseInvoiceItemImpl) then) =
      __$$PurchaseInvoiceItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String purchaseInvoiceId,
      String productId,
      String? purchaseOrderItemId,
      int quantity,
      String unitCost,
      String? discountPercent,
      String discountAmount,
      String? taxPercent,
      String taxAmount,
      String subtotal,
      String total,
      String? notes});
}

/// @nodoc
class __$$PurchaseInvoiceItemImplCopyWithImpl<$Res>
    extends _$PurchaseInvoiceItemCopyWithImpl<$Res, _$PurchaseInvoiceItemImpl>
    implements _$$PurchaseInvoiceItemImplCopyWith<$Res> {
  __$$PurchaseInvoiceItemImplCopyWithImpl(_$PurchaseInvoiceItemImpl _value,
      $Res Function(_$PurchaseInvoiceItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of PurchaseInvoiceItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? purchaseInvoiceId = null,
    Object? productId = null,
    Object? purchaseOrderItemId = freezed,
    Object? quantity = null,
    Object? unitCost = null,
    Object? discountPercent = freezed,
    Object? discountAmount = null,
    Object? taxPercent = freezed,
    Object? taxAmount = null,
    Object? subtotal = null,
    Object? total = null,
    Object? notes = freezed,
  }) {
    return _then(_$PurchaseInvoiceItemImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseInvoiceId: null == purchaseInvoiceId
          ? _value.purchaseInvoiceId
          : purchaseInvoiceId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseOrderItemId: freezed == purchaseOrderItemId
          ? _value.purchaseOrderItemId
          : purchaseOrderItemId // ignore: cast_nullable_to_non_nullable
              as String?,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitCost: null == unitCost
          ? _value.unitCost
          : unitCost // ignore: cast_nullable_to_non_nullable
              as String,
      discountPercent: freezed == discountPercent
          ? _value.discountPercent
          : discountPercent // ignore: cast_nullable_to_non_nullable
              as String?,
      discountAmount: null == discountAmount
          ? _value.discountAmount
          : discountAmount // ignore: cast_nullable_to_non_nullable
              as String,
      taxPercent: freezed == taxPercent
          ? _value.taxPercent
          : taxPercent // ignore: cast_nullable_to_non_nullable
              as String?,
      taxAmount: null == taxAmount
          ? _value.taxAmount
          : taxAmount // ignore: cast_nullable_to_non_nullable
              as String,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as String,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as String,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PurchaseInvoiceItemImpl implements _PurchaseInvoiceItem {
  const _$PurchaseInvoiceItemImpl(
      {required this.id,
      required this.purchaseInvoiceId,
      required this.productId,
      this.purchaseOrderItemId,
      required this.quantity,
      required this.unitCost,
      this.discountPercent,
      required this.discountAmount,
      this.taxPercent,
      required this.taxAmount,
      required this.subtotal,
      required this.total,
      this.notes});

  factory _$PurchaseInvoiceItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$PurchaseInvoiceItemImplFromJson(json);

  @override
  final String id;
  @override
  final String purchaseInvoiceId;
  @override
  final String productId;
  @override
  final String? purchaseOrderItemId;
  @override
  final int quantity;
  @override
  final String unitCost;
  @override
  final String? discountPercent;
  @override
  final String discountAmount;
  @override
  final String? taxPercent;
  @override
  final String taxAmount;
  @override
  final String subtotal;
  @override
  final String total;
  @override
  final String? notes;

  @override
  String toString() {
    return 'PurchaseInvoiceItem(id: $id, purchaseInvoiceId: $purchaseInvoiceId, productId: $productId, purchaseOrderItemId: $purchaseOrderItemId, quantity: $quantity, unitCost: $unitCost, discountPercent: $discountPercent, discountAmount: $discountAmount, taxPercent: $taxPercent, taxAmount: $taxAmount, subtotal: $subtotal, total: $total, notes: $notes)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PurchaseInvoiceItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.purchaseInvoiceId, purchaseInvoiceId) ||
                other.purchaseInvoiceId == purchaseInvoiceId) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.purchaseOrderItemId, purchaseOrderItemId) ||
                other.purchaseOrderItemId == purchaseOrderItemId) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.unitCost, unitCost) ||
                other.unitCost == unitCost) &&
            (identical(other.discountPercent, discountPercent) ||
                other.discountPercent == discountPercent) &&
            (identical(other.discountAmount, discountAmount) ||
                other.discountAmount == discountAmount) &&
            (identical(other.taxPercent, taxPercent) ||
                other.taxPercent == taxPercent) &&
            (identical(other.taxAmount, taxAmount) ||
                other.taxAmount == taxAmount) &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.notes, notes) || other.notes == notes));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      purchaseInvoiceId,
      productId,
      purchaseOrderItemId,
      quantity,
      unitCost,
      discountPercent,
      discountAmount,
      taxPercent,
      taxAmount,
      subtotal,
      total,
      notes);

  /// Create a copy of PurchaseInvoiceItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PurchaseInvoiceItemImplCopyWith<_$PurchaseInvoiceItemImpl> get copyWith =>
      __$$PurchaseInvoiceItemImplCopyWithImpl<_$PurchaseInvoiceItemImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PurchaseInvoiceItemImplToJson(
      this,
    );
  }
}

abstract class _PurchaseInvoiceItem implements PurchaseInvoiceItem {
  const factory _PurchaseInvoiceItem(
      {required final String id,
      required final String purchaseInvoiceId,
      required final String productId,
      final String? purchaseOrderItemId,
      required final int quantity,
      required final String unitCost,
      final String? discountPercent,
      required final String discountAmount,
      final String? taxPercent,
      required final String taxAmount,
      required final String subtotal,
      required final String total,
      final String? notes}) = _$PurchaseInvoiceItemImpl;

  factory _PurchaseInvoiceItem.fromJson(Map<String, dynamic> json) =
      _$PurchaseInvoiceItemImpl.fromJson;

  @override
  String get id;
  @override
  String get purchaseInvoiceId;
  @override
  String get productId;
  @override
  String? get purchaseOrderItemId;
  @override
  int get quantity;
  @override
  String get unitCost;
  @override
  String? get discountPercent;
  @override
  String get discountAmount;
  @override
  String? get taxPercent;
  @override
  String get taxAmount;
  @override
  String get subtotal;
  @override
  String get total;
  @override
  String? get notes;

  /// Create a copy of PurchaseInvoiceItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PurchaseInvoiceItemImplCopyWith<_$PurchaseInvoiceItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PurchaseInvoice _$PurchaseInvoiceFromJson(Map<String, dynamic> json) {
  return _PurchaseInvoice.fromJson(json);
}

/// @nodoc
mixin _$PurchaseInvoice {
  String get id => throw _privateConstructorUsedError;
  String get companyId => throw _privateConstructorUsedError;
  String get purchaseOrderId => throw _privateConstructorUsedError;
  String get supplierId => throw _privateConstructorUsedError;
  String get invoiceNumber => throw _privateConstructorUsedError;
  String get invoiceDate => throw _privateConstructorUsedError;
  String? get dueDate => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String get subtotal => throw _privateConstructorUsedError;
  String get discountAmount => throw _privateConstructorUsedError;
  String get taxAmount => throw _privateConstructorUsedError;
  String get grandTotal => throw _privateConstructorUsedError;
  String get paidAmount => throw _privateConstructorUsedError;
  String get currency => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  String? get approvedBy => throw _privateConstructorUsedError;
  String? get approvedAt => throw _privateConstructorUsedError;
  String? get cancelledBy => throw _privateConstructorUsedError;
  String? get cancelledAt => throw _privateConstructorUsedError;
  String get createdAt => throw _privateConstructorUsedError;
  String get updatedAt => throw _privateConstructorUsedError;
  String? get deletedAt => throw _privateConstructorUsedError;
  List<PurchaseInvoiceItem> get items => throw _privateConstructorUsedError;

  /// Serializes this PurchaseInvoice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PurchaseInvoice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PurchaseInvoiceCopyWith<PurchaseInvoice> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PurchaseInvoiceCopyWith<$Res> {
  factory $PurchaseInvoiceCopyWith(
          PurchaseInvoice value, $Res Function(PurchaseInvoice) then) =
      _$PurchaseInvoiceCopyWithImpl<$Res, PurchaseInvoice>;
  @useResult
  $Res call(
      {String id,
      String companyId,
      String purchaseOrderId,
      String supplierId,
      String invoiceNumber,
      String invoiceDate,
      String? dueDate,
      String status,
      String subtotal,
      String discountAmount,
      String taxAmount,
      String grandTotal,
      String paidAmount,
      String currency,
      String? notes,
      String? approvedBy,
      String? approvedAt,
      String? cancelledBy,
      String? cancelledAt,
      String createdAt,
      String updatedAt,
      String? deletedAt,
      List<PurchaseInvoiceItem> items});
}

/// @nodoc
class _$PurchaseInvoiceCopyWithImpl<$Res, $Val extends PurchaseInvoice>
    implements $PurchaseInvoiceCopyWith<$Res> {
  _$PurchaseInvoiceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PurchaseInvoice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? purchaseOrderId = null,
    Object? supplierId = null,
    Object? invoiceNumber = null,
    Object? invoiceDate = null,
    Object? dueDate = freezed,
    Object? status = null,
    Object? subtotal = null,
    Object? discountAmount = null,
    Object? taxAmount = null,
    Object? grandTotal = null,
    Object? paidAmount = null,
    Object? currency = null,
    Object? notes = freezed,
    Object? approvedBy = freezed,
    Object? approvedAt = freezed,
    Object? cancelledBy = freezed,
    Object? cancelledAt = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
    Object? items = null,
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
      purchaseOrderId: null == purchaseOrderId
          ? _value.purchaseOrderId
          : purchaseOrderId // ignore: cast_nullable_to_non_nullable
              as String,
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceNumber: null == invoiceNumber
          ? _value.invoiceNumber
          : invoiceNumber // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceDate: null == invoiceDate
          ? _value.invoiceDate
          : invoiceDate // ignore: cast_nullable_to_non_nullable
              as String,
      dueDate: freezed == dueDate
          ? _value.dueDate
          : dueDate // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as String,
      discountAmount: null == discountAmount
          ? _value.discountAmount
          : discountAmount // ignore: cast_nullable_to_non_nullable
              as String,
      taxAmount: null == taxAmount
          ? _value.taxAmount
          : taxAmount // ignore: cast_nullable_to_non_nullable
              as String,
      grandTotal: null == grandTotal
          ? _value.grandTotal
          : grandTotal // ignore: cast_nullable_to_non_nullable
              as String,
      paidAmount: null == paidAmount
          ? _value.paidAmount
          : paidAmount // ignore: cast_nullable_to_non_nullable
              as String,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      approvedBy: freezed == approvedBy
          ? _value.approvedBy
          : approvedBy // ignore: cast_nullable_to_non_nullable
              as String?,
      approvedAt: freezed == approvedAt
          ? _value.approvedAt
          : approvedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      cancelledBy: freezed == cancelledBy
          ? _value.cancelledBy
          : cancelledBy // ignore: cast_nullable_to_non_nullable
              as String?,
      cancelledAt: freezed == cancelledAt
          ? _value.cancelledAt
          : cancelledAt // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String,
      deletedAt: freezed == deletedAt
          ? _value.deletedAt
          : deletedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      items: null == items
          ? _value.items
          : items // ignore: cast_nullable_to_non_nullable
              as List<PurchaseInvoiceItem>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PurchaseInvoiceImplCopyWith<$Res>
    implements $PurchaseInvoiceCopyWith<$Res> {
  factory _$$PurchaseInvoiceImplCopyWith(_$PurchaseInvoiceImpl value,
          $Res Function(_$PurchaseInvoiceImpl) then) =
      __$$PurchaseInvoiceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String companyId,
      String purchaseOrderId,
      String supplierId,
      String invoiceNumber,
      String invoiceDate,
      String? dueDate,
      String status,
      String subtotal,
      String discountAmount,
      String taxAmount,
      String grandTotal,
      String paidAmount,
      String currency,
      String? notes,
      String? approvedBy,
      String? approvedAt,
      String? cancelledBy,
      String? cancelledAt,
      String createdAt,
      String updatedAt,
      String? deletedAt,
      List<PurchaseInvoiceItem> items});
}

/// @nodoc
class __$$PurchaseInvoiceImplCopyWithImpl<$Res>
    extends _$PurchaseInvoiceCopyWithImpl<$Res, _$PurchaseInvoiceImpl>
    implements _$$PurchaseInvoiceImplCopyWith<$Res> {
  __$$PurchaseInvoiceImplCopyWithImpl(
      _$PurchaseInvoiceImpl _value, $Res Function(_$PurchaseInvoiceImpl) _then)
      : super(_value, _then);

  /// Create a copy of PurchaseInvoice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? purchaseOrderId = null,
    Object? supplierId = null,
    Object? invoiceNumber = null,
    Object? invoiceDate = null,
    Object? dueDate = freezed,
    Object? status = null,
    Object? subtotal = null,
    Object? discountAmount = null,
    Object? taxAmount = null,
    Object? grandTotal = null,
    Object? paidAmount = null,
    Object? currency = null,
    Object? notes = freezed,
    Object? approvedBy = freezed,
    Object? approvedAt = freezed,
    Object? cancelledBy = freezed,
    Object? cancelledAt = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
    Object? items = null,
  }) {
    return _then(_$PurchaseInvoiceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      companyId: null == companyId
          ? _value.companyId
          : companyId // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseOrderId: null == purchaseOrderId
          ? _value.purchaseOrderId
          : purchaseOrderId // ignore: cast_nullable_to_non_nullable
              as String,
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceNumber: null == invoiceNumber
          ? _value.invoiceNumber
          : invoiceNumber // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceDate: null == invoiceDate
          ? _value.invoiceDate
          : invoiceDate // ignore: cast_nullable_to_non_nullable
              as String,
      dueDate: freezed == dueDate
          ? _value.dueDate
          : dueDate // ignore: cast_nullable_to_non_nullable
              as String?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as String,
      discountAmount: null == discountAmount
          ? _value.discountAmount
          : discountAmount // ignore: cast_nullable_to_non_nullable
              as String,
      taxAmount: null == taxAmount
          ? _value.taxAmount
          : taxAmount // ignore: cast_nullable_to_non_nullable
              as String,
      grandTotal: null == grandTotal
          ? _value.grandTotal
          : grandTotal // ignore: cast_nullable_to_non_nullable
              as String,
      paidAmount: null == paidAmount
          ? _value.paidAmount
          : paidAmount // ignore: cast_nullable_to_non_nullable
              as String,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      approvedBy: freezed == approvedBy
          ? _value.approvedBy
          : approvedBy // ignore: cast_nullable_to_non_nullable
              as String?,
      approvedAt: freezed == approvedAt
          ? _value.approvedAt
          : approvedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      cancelledBy: freezed == cancelledBy
          ? _value.cancelledBy
          : cancelledBy // ignore: cast_nullable_to_non_nullable
              as String?,
      cancelledAt: freezed == cancelledAt
          ? _value.cancelledAt
          : cancelledAt // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String,
      deletedAt: freezed == deletedAt
          ? _value.deletedAt
          : deletedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<PurchaseInvoiceItem>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PurchaseInvoiceImpl implements _PurchaseInvoice {
  const _$PurchaseInvoiceImpl(
      {required this.id,
      required this.companyId,
      required this.purchaseOrderId,
      required this.supplierId,
      required this.invoiceNumber,
      required this.invoiceDate,
      this.dueDate,
      required this.status,
      required this.subtotal,
      required this.discountAmount,
      required this.taxAmount,
      required this.grandTotal,
      required this.paidAmount,
      required this.currency,
      this.notes,
      this.approvedBy,
      this.approvedAt,
      this.cancelledBy,
      this.cancelledAt,
      required this.createdAt,
      required this.updatedAt,
      this.deletedAt,
      final List<PurchaseInvoiceItem> items = const []})
      : _items = items;

  factory _$PurchaseInvoiceImpl.fromJson(Map<String, dynamic> json) =>
      _$$PurchaseInvoiceImplFromJson(json);

  @override
  final String id;
  @override
  final String companyId;
  @override
  final String purchaseOrderId;
  @override
  final String supplierId;
  @override
  final String invoiceNumber;
  @override
  final String invoiceDate;
  @override
  final String? dueDate;
  @override
  final String status;
  @override
  final String subtotal;
  @override
  final String discountAmount;
  @override
  final String taxAmount;
  @override
  final String grandTotal;
  @override
  final String paidAmount;
  @override
  final String currency;
  @override
  final String? notes;
  @override
  final String? approvedBy;
  @override
  final String? approvedAt;
  @override
  final String? cancelledBy;
  @override
  final String? cancelledAt;
  @override
  final String createdAt;
  @override
  final String updatedAt;
  @override
  final String? deletedAt;
  final List<PurchaseInvoiceItem> _items;
  @override
  @JsonKey()
  List<PurchaseInvoiceItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  String toString() {
    return 'PurchaseInvoice(id: $id, companyId: $companyId, purchaseOrderId: $purchaseOrderId, supplierId: $supplierId, invoiceNumber: $invoiceNumber, invoiceDate: $invoiceDate, dueDate: $dueDate, status: $status, subtotal: $subtotal, discountAmount: $discountAmount, taxAmount: $taxAmount, grandTotal: $grandTotal, paidAmount: $paidAmount, currency: $currency, notes: $notes, approvedBy: $approvedBy, approvedAt: $approvedAt, cancelledBy: $cancelledBy, cancelledAt: $cancelledAt, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt, items: $items)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PurchaseInvoiceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.purchaseOrderId, purchaseOrderId) ||
                other.purchaseOrderId == purchaseOrderId) &&
            (identical(other.supplierId, supplierId) ||
                other.supplierId == supplierId) &&
            (identical(other.invoiceNumber, invoiceNumber) ||
                other.invoiceNumber == invoiceNumber) &&
            (identical(other.invoiceDate, invoiceDate) ||
                other.invoiceDate == invoiceDate) &&
            (identical(other.dueDate, dueDate) || other.dueDate == dueDate) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.discountAmount, discountAmount) ||
                other.discountAmount == discountAmount) &&
            (identical(other.taxAmount, taxAmount) ||
                other.taxAmount == taxAmount) &&
            (identical(other.grandTotal, grandTotal) ||
                other.grandTotal == grandTotal) &&
            (identical(other.paidAmount, paidAmount) ||
                other.paidAmount == paidAmount) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.approvedBy, approvedBy) ||
                other.approvedBy == approvedBy) &&
            (identical(other.approvedAt, approvedAt) ||
                other.approvedAt == approvedAt) &&
            (identical(other.cancelledBy, cancelledBy) ||
                other.cancelledBy == cancelledBy) &&
            (identical(other.cancelledAt, cancelledAt) ||
                other.cancelledAt == cancelledAt) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.deletedAt, deletedAt) ||
                other.deletedAt == deletedAt) &&
            const DeepCollectionEquality().equals(other._items, _items));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([
        runtimeType,
        id,
        companyId,
        purchaseOrderId,
        supplierId,
        invoiceNumber,
        invoiceDate,
        dueDate,
        status,
        subtotal,
        discountAmount,
        taxAmount,
        grandTotal,
        paidAmount,
        currency,
        notes,
        approvedBy,
        approvedAt,
        cancelledBy,
        cancelledAt,
        createdAt,
        updatedAt,
        deletedAt,
        const DeepCollectionEquality().hash(_items)
      ]);

  /// Create a copy of PurchaseInvoice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PurchaseInvoiceImplCopyWith<_$PurchaseInvoiceImpl> get copyWith =>
      __$$PurchaseInvoiceImplCopyWithImpl<_$PurchaseInvoiceImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PurchaseInvoiceImplToJson(
      this,
    );
  }
}

abstract class _PurchaseInvoice implements PurchaseInvoice {
  const factory _PurchaseInvoice(
      {required final String id,
      required final String companyId,
      required final String purchaseOrderId,
      required final String supplierId,
      required final String invoiceNumber,
      required final String invoiceDate,
      final String? dueDate,
      required final String status,
      required final String subtotal,
      required final String discountAmount,
      required final String taxAmount,
      required final String grandTotal,
      required final String paidAmount,
      required final String currency,
      final String? notes,
      final String? approvedBy,
      final String? approvedAt,
      final String? cancelledBy,
      final String? cancelledAt,
      required final String createdAt,
      required final String updatedAt,
      final String? deletedAt,
      final List<PurchaseInvoiceItem> items}) = _$PurchaseInvoiceImpl;

  factory _PurchaseInvoice.fromJson(Map<String, dynamic> json) =
      _$PurchaseInvoiceImpl.fromJson;

  @override
  String get id;
  @override
  String get companyId;
  @override
  String get purchaseOrderId;
  @override
  String get supplierId;
  @override
  String get invoiceNumber;
  @override
  String get invoiceDate;
  @override
  String? get dueDate;
  @override
  String get status;
  @override
  String get subtotal;
  @override
  String get discountAmount;
  @override
  String get taxAmount;
  @override
  String get grandTotal;
  @override
  String get paidAmount;
  @override
  String get currency;
  @override
  String? get notes;
  @override
  String? get approvedBy;
  @override
  String? get approvedAt;
  @override
  String? get cancelledBy;
  @override
  String? get cancelledAt;
  @override
  String get createdAt;
  @override
  String get updatedAt;
  @override
  String? get deletedAt;
  @override
  List<PurchaseInvoiceItem> get items;

  /// Create a copy of PurchaseInvoice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PurchaseInvoiceImplCopyWith<_$PurchaseInvoiceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PurchaseInvoiceListResponse _$PurchaseInvoiceListResponseFromJson(
    Map<String, dynamic> json) {
  return _PurchaseInvoiceListResponse.fromJson(json);
}

/// @nodoc
mixin _$PurchaseInvoiceListResponse {
  List<PurchaseInvoice> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this PurchaseInvoiceListResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PurchaseInvoiceListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PurchaseInvoiceListResponseCopyWith<PurchaseInvoiceListResponse>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PurchaseInvoiceListResponseCopyWith<$Res> {
  factory $PurchaseInvoiceListResponseCopyWith(
          PurchaseInvoiceListResponse value,
          $Res Function(PurchaseInvoiceListResponse) then) =
      _$PurchaseInvoiceListResponseCopyWithImpl<$Res,
          PurchaseInvoiceListResponse>;
  @useResult
  $Res call({List<PurchaseInvoice> items, int total, int page, int limit});
}

/// @nodoc
class _$PurchaseInvoiceListResponseCopyWithImpl<$Res,
        $Val extends PurchaseInvoiceListResponse>
    implements $PurchaseInvoiceListResponseCopyWith<$Res> {
  _$PurchaseInvoiceListResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PurchaseInvoiceListResponse
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
              as List<PurchaseInvoice>,
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
abstract class _$$PurchaseInvoiceListResponseImplCopyWith<$Res>
    implements $PurchaseInvoiceListResponseCopyWith<$Res> {
  factory _$$PurchaseInvoiceListResponseImplCopyWith(
          _$PurchaseInvoiceListResponseImpl value,
          $Res Function(_$PurchaseInvoiceListResponseImpl) then) =
      __$$PurchaseInvoiceListResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<PurchaseInvoice> items, int total, int page, int limit});
}

/// @nodoc
class __$$PurchaseInvoiceListResponseImplCopyWithImpl<$Res>
    extends _$PurchaseInvoiceListResponseCopyWithImpl<$Res,
        _$PurchaseInvoiceListResponseImpl>
    implements _$$PurchaseInvoiceListResponseImplCopyWith<$Res> {
  __$$PurchaseInvoiceListResponseImplCopyWithImpl(
      _$PurchaseInvoiceListResponseImpl _value,
      $Res Function(_$PurchaseInvoiceListResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of PurchaseInvoiceListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$PurchaseInvoiceListResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<PurchaseInvoice>,
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
class _$PurchaseInvoiceListResponseImpl
    implements _PurchaseInvoiceListResponse {
  const _$PurchaseInvoiceListResponseImpl(
      {required final List<PurchaseInvoice> items,
      required this.total,
      required this.page,
      required this.limit})
      : _items = items;

  factory _$PurchaseInvoiceListResponseImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$PurchaseInvoiceListResponseImplFromJson(json);

  final List<PurchaseInvoice> _items;
  @override
  List<PurchaseInvoice> get items {
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
    return 'PurchaseInvoiceListResponse(items: $items, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PurchaseInvoiceListResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_items), total, page, limit);

  /// Create a copy of PurchaseInvoiceListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PurchaseInvoiceListResponseImplCopyWith<_$PurchaseInvoiceListResponseImpl>
      get copyWith => __$$PurchaseInvoiceListResponseImplCopyWithImpl<
          _$PurchaseInvoiceListResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PurchaseInvoiceListResponseImplToJson(
      this,
    );
  }
}

abstract class _PurchaseInvoiceListResponse
    implements PurchaseInvoiceListResponse {
  const factory _PurchaseInvoiceListResponse(
      {required final List<PurchaseInvoice> items,
      required final int total,
      required final int page,
      required final int limit}) = _$PurchaseInvoiceListResponseImpl;

  factory _PurchaseInvoiceListResponse.fromJson(Map<String, dynamic> json) =
      _$PurchaseInvoiceListResponseImpl.fromJson;

  @override
  List<PurchaseInvoice> get items;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of PurchaseInvoiceListResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PurchaseInvoiceListResponseImplCopyWith<_$PurchaseInvoiceListResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}
