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
