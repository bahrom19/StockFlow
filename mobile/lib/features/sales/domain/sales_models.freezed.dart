// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'sales_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

Sale _$SaleFromJson(Map<String, dynamic> json) {
  return _Sale.fromJson(json);
}

/// @nodoc
mixin _$Sale {
  String get id => throw _privateConstructorUsedError;
  String get companyId => throw _privateConstructorUsedError;
  String get warehouseId => throw _privateConstructorUsedError;
  String get cashierId => throw _privateConstructorUsedError;
  String? get customerId => throw _privateConstructorUsedError;
  String get saleNumber => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String get subtotal => throw _privateConstructorUsedError;
  String get discount => throw _privateConstructorUsedError;
  String get tax => throw _privateConstructorUsedError;
  String get total => throw _privateConstructorUsedError;
  String get paidAmount => throw _privateConstructorUsedError;
  String get changeAmount => throw _privateConstructorUsedError;
  String get currency => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  int get rowVersion => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;
  DateTime? get deletedAt => throw _privateConstructorUsedError;
  List<SaleItem> get items => throw _privateConstructorUsedError;
  List<Payment> get payments => throw _privateConstructorUsedError;
  List<Receipt> get receipts => throw _privateConstructorUsedError;

  /// Serializes this Sale to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Sale
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SaleCopyWith<Sale> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SaleCopyWith<$Res> {
  factory $SaleCopyWith(Sale value, $Res Function(Sale) then) =
      _$SaleCopyWithImpl<$Res, Sale>;
  @useResult
  $Res call(
      {String id,
      String companyId,
      String warehouseId,
      String cashierId,
      String? customerId,
      String saleNumber,
      String status,
      String subtotal,
      String discount,
      String tax,
      String total,
      String paidAmount,
      String changeAmount,
      String currency,
      String? notes,
      int rowVersion,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt,
      List<SaleItem> items,
      List<Payment> payments,
      List<Receipt> receipts});
}

/// @nodoc
class _$SaleCopyWithImpl<$Res, $Val extends Sale>
    implements $SaleCopyWith<$Res> {
  _$SaleCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Sale
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? warehouseId = null,
    Object? cashierId = null,
    Object? customerId = freezed,
    Object? saleNumber = null,
    Object? status = null,
    Object? subtotal = null,
    Object? discount = null,
    Object? tax = null,
    Object? total = null,
    Object? paidAmount = null,
    Object? changeAmount = null,
    Object? currency = null,
    Object? notes = freezed,
    Object? rowVersion = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
    Object? items = null,
    Object? payments = null,
    Object? receipts = null,
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
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      cashierId: null == cashierId
          ? _value.cashierId
          : cashierId // ignore: cast_nullable_to_non_nullable
              as String,
      customerId: freezed == customerId
          ? _value.customerId
          : customerId // ignore: cast_nullable_to_non_nullable
              as String?,
      saleNumber: null == saleNumber
          ? _value.saleNumber
          : saleNumber // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as String,
      discount: null == discount
          ? _value.discount
          : discount // ignore: cast_nullable_to_non_nullable
              as String,
      tax: null == tax
          ? _value.tax
          : tax // ignore: cast_nullable_to_non_nullable
              as String,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as String,
      paidAmount: null == paidAmount
          ? _value.paidAmount
          : paidAmount // ignore: cast_nullable_to_non_nullable
              as String,
      changeAmount: null == changeAmount
          ? _value.changeAmount
          : changeAmount // ignore: cast_nullable_to_non_nullable
              as String,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
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
      items: null == items
          ? _value.items
          : items // ignore: cast_nullable_to_non_nullable
              as List<SaleItem>,
      payments: null == payments
          ? _value.payments
          : payments // ignore: cast_nullable_to_non_nullable
              as List<Payment>,
      receipts: null == receipts
          ? _value.receipts
          : receipts // ignore: cast_nullable_to_non_nullable
              as List<Receipt>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SaleImplCopyWith<$Res> implements $SaleCopyWith<$Res> {
  factory _$$SaleImplCopyWith(
          _$SaleImpl value, $Res Function(_$SaleImpl) then) =
      __$$SaleImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String companyId,
      String warehouseId,
      String cashierId,
      String? customerId,
      String saleNumber,
      String status,
      String subtotal,
      String discount,
      String tax,
      String total,
      String paidAmount,
      String changeAmount,
      String currency,
      String? notes,
      int rowVersion,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt,
      List<SaleItem> items,
      List<Payment> payments,
      List<Receipt> receipts});
}

/// @nodoc
class __$$SaleImplCopyWithImpl<$Res>
    extends _$SaleCopyWithImpl<$Res, _$SaleImpl>
    implements _$$SaleImplCopyWith<$Res> {
  __$$SaleImplCopyWithImpl(_$SaleImpl _value, $Res Function(_$SaleImpl) _then)
      : super(_value, _then);

  /// Create a copy of Sale
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? warehouseId = null,
    Object? cashierId = null,
    Object? customerId = freezed,
    Object? saleNumber = null,
    Object? status = null,
    Object? subtotal = null,
    Object? discount = null,
    Object? tax = null,
    Object? total = null,
    Object? paidAmount = null,
    Object? changeAmount = null,
    Object? currency = null,
    Object? notes = freezed,
    Object? rowVersion = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
    Object? items = null,
    Object? payments = null,
    Object? receipts = null,
  }) {
    return _then(_$SaleImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      companyId: null == companyId
          ? _value.companyId
          : companyId // ignore: cast_nullable_to_non_nullable
              as String,
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      cashierId: null == cashierId
          ? _value.cashierId
          : cashierId // ignore: cast_nullable_to_non_nullable
              as String,
      customerId: freezed == customerId
          ? _value.customerId
          : customerId // ignore: cast_nullable_to_non_nullable
              as String?,
      saleNumber: null == saleNumber
          ? _value.saleNumber
          : saleNumber // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as String,
      discount: null == discount
          ? _value.discount
          : discount // ignore: cast_nullable_to_non_nullable
              as String,
      tax: null == tax
          ? _value.tax
          : tax // ignore: cast_nullable_to_non_nullable
              as String,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as String,
      paidAmount: null == paidAmount
          ? _value.paidAmount
          : paidAmount // ignore: cast_nullable_to_non_nullable
              as String,
      changeAmount: null == changeAmount
          ? _value.changeAmount
          : changeAmount // ignore: cast_nullable_to_non_nullable
              as String,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
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
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<SaleItem>,
      payments: null == payments
          ? _value._payments
          : payments // ignore: cast_nullable_to_non_nullable
              as List<Payment>,
      receipts: null == receipts
          ? _value._receipts
          : receipts // ignore: cast_nullable_to_non_nullable
              as List<Receipt>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SaleImpl implements _Sale {
  const _$SaleImpl(
      {required this.id,
      required this.companyId,
      required this.warehouseId,
      required this.cashierId,
      this.customerId,
      required this.saleNumber,
      required this.status,
      required this.subtotal,
      required this.discount,
      required this.tax,
      required this.total,
      required this.paidAmount,
      required this.changeAmount,
      required this.currency,
      this.notes,
      this.rowVersion = 0,
      required this.createdAt,
      required this.updatedAt,
      this.deletedAt,
      final List<SaleItem> items = const [],
      final List<Payment> payments = const [],
      final List<Receipt> receipts = const []})
      : _items = items,
        _payments = payments,
        _receipts = receipts;

  factory _$SaleImpl.fromJson(Map<String, dynamic> json) =>
      _$$SaleImplFromJson(json);

  @override
  final String id;
  @override
  final String companyId;
  @override
  final String warehouseId;
  @override
  final String cashierId;
  @override
  final String? customerId;
  @override
  final String saleNumber;
  @override
  final String status;
  @override
  final String subtotal;
  @override
  final String discount;
  @override
  final String tax;
  @override
  final String total;
  @override
  final String paidAmount;
  @override
  final String changeAmount;
  @override
  final String currency;
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
  final List<SaleItem> _items;
  @override
  @JsonKey()
  List<SaleItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  final List<Payment> _payments;
  @override
  @JsonKey()
  List<Payment> get payments {
    if (_payments is EqualUnmodifiableListView) return _payments;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_payments);
  }

  final List<Receipt> _receipts;
  @override
  @JsonKey()
  List<Receipt> get receipts {
    if (_receipts is EqualUnmodifiableListView) return _receipts;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_receipts);
  }

  @override
  String toString() {
    return 'Sale(id: $id, companyId: $companyId, warehouseId: $warehouseId, cashierId: $cashierId, customerId: $customerId, saleNumber: $saleNumber, status: $status, subtotal: $subtotal, discount: $discount, tax: $tax, total: $total, paidAmount: $paidAmount, changeAmount: $changeAmount, currency: $currency, notes: $notes, rowVersion: $rowVersion, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt, items: $items, payments: $payments, receipts: $receipts)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SaleImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.warehouseId, warehouseId) ||
                other.warehouseId == warehouseId) &&
            (identical(other.cashierId, cashierId) ||
                other.cashierId == cashierId) &&
            (identical(other.customerId, customerId) ||
                other.customerId == customerId) &&
            (identical(other.saleNumber, saleNumber) ||
                other.saleNumber == saleNumber) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.discount, discount) ||
                other.discount == discount) &&
            (identical(other.tax, tax) || other.tax == tax) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.paidAmount, paidAmount) ||
                other.paidAmount == paidAmount) &&
            (identical(other.changeAmount, changeAmount) ||
                other.changeAmount == changeAmount) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.rowVersion, rowVersion) ||
                other.rowVersion == rowVersion) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.deletedAt, deletedAt) ||
                other.deletedAt == deletedAt) &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            const DeepCollectionEquality().equals(other._payments, _payments) &&
            const DeepCollectionEquality().equals(other._receipts, _receipts));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([
        runtimeType,
        id,
        companyId,
        warehouseId,
        cashierId,
        customerId,
        saleNumber,
        status,
        subtotal,
        discount,
        tax,
        total,
        paidAmount,
        changeAmount,
        currency,
        notes,
        rowVersion,
        createdAt,
        updatedAt,
        deletedAt,
        const DeepCollectionEquality().hash(_items),
        const DeepCollectionEquality().hash(_payments),
        const DeepCollectionEquality().hash(_receipts)
      ]);

  /// Create a copy of Sale
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SaleImplCopyWith<_$SaleImpl> get copyWith =>
      __$$SaleImplCopyWithImpl<_$SaleImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SaleImplToJson(
      this,
    );
  }
}

abstract class _Sale implements Sale {
  const factory _Sale(
      {required final String id,
      required final String companyId,
      required final String warehouseId,
      required final String cashierId,
      final String? customerId,
      required final String saleNumber,
      required final String status,
      required final String subtotal,
      required final String discount,
      required final String tax,
      required final String total,
      required final String paidAmount,
      required final String changeAmount,
      required final String currency,
      final String? notes,
      final int rowVersion,
      required final DateTime createdAt,
      required final DateTime updatedAt,
      final DateTime? deletedAt,
      final List<SaleItem> items,
      final List<Payment> payments,
      final List<Receipt> receipts}) = _$SaleImpl;

  factory _Sale.fromJson(Map<String, dynamic> json) = _$SaleImpl.fromJson;

  @override
  String get id;
  @override
  String get companyId;
  @override
  String get warehouseId;
  @override
  String get cashierId;
  @override
  String? get customerId;
  @override
  String get saleNumber;
  @override
  String get status;
  @override
  String get subtotal;
  @override
  String get discount;
  @override
  String get tax;
  @override
  String get total;
  @override
  String get paidAmount;
  @override
  String get changeAmount;
  @override
  String get currency;
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
  @override
  List<SaleItem> get items;
  @override
  List<Payment> get payments;
  @override
  List<Receipt> get receipts;

  /// Create a copy of Sale
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SaleImplCopyWith<_$SaleImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SaleItem _$SaleItemFromJson(Map<String, dynamic> json) {
  return _SaleItem.fromJson(json);
}

/// @nodoc
mixin _$SaleItem {
  String get id => throw _privateConstructorUsedError;
  String get saleId => throw _privateConstructorUsedError;
  String get productId => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  String get unitPrice => throw _privateConstructorUsedError;
  String get costPrice => throw _privateConstructorUsedError;
  String get discount => throw _privateConstructorUsedError;
  String get subtotal => throw _privateConstructorUsedError;
  String get total => throw _privateConstructorUsedError;
  String get margin => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this SaleItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SaleItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SaleItemCopyWith<SaleItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SaleItemCopyWith<$Res> {
  factory $SaleItemCopyWith(SaleItem value, $Res Function(SaleItem) then) =
      _$SaleItemCopyWithImpl<$Res, SaleItem>;
  @useResult
  $Res call(
      {String id,
      String saleId,
      String productId,
      int quantity,
      String unitPrice,
      String costPrice,
      String discount,
      String subtotal,
      String total,
      String margin,
      DateTime createdAt,
      DateTime updatedAt});
}

/// @nodoc
class _$SaleItemCopyWithImpl<$Res, $Val extends SaleItem>
    implements $SaleItemCopyWith<$Res> {
  _$SaleItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SaleItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? saleId = null,
    Object? productId = null,
    Object? quantity = null,
    Object? unitPrice = null,
    Object? costPrice = null,
    Object? discount = null,
    Object? subtotal = null,
    Object? total = null,
    Object? margin = null,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      saleId: null == saleId
          ? _value.saleId
          : saleId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitPrice: null == unitPrice
          ? _value.unitPrice
          : unitPrice // ignore: cast_nullable_to_non_nullable
              as String,
      costPrice: null == costPrice
          ? _value.costPrice
          : costPrice // ignore: cast_nullable_to_non_nullable
              as String,
      discount: null == discount
          ? _value.discount
          : discount // ignore: cast_nullable_to_non_nullable
              as String,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as String,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as String,
      margin: null == margin
          ? _value.margin
          : margin // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SaleItemImplCopyWith<$Res>
    implements $SaleItemCopyWith<$Res> {
  factory _$$SaleItemImplCopyWith(
          _$SaleItemImpl value, $Res Function(_$SaleItemImpl) then) =
      __$$SaleItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String saleId,
      String productId,
      int quantity,
      String unitPrice,
      String costPrice,
      String discount,
      String subtotal,
      String total,
      String margin,
      DateTime createdAt,
      DateTime updatedAt});
}

/// @nodoc
class __$$SaleItemImplCopyWithImpl<$Res>
    extends _$SaleItemCopyWithImpl<$Res, _$SaleItemImpl>
    implements _$$SaleItemImplCopyWith<$Res> {
  __$$SaleItemImplCopyWithImpl(
      _$SaleItemImpl _value, $Res Function(_$SaleItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of SaleItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? saleId = null,
    Object? productId = null,
    Object? quantity = null,
    Object? unitPrice = null,
    Object? costPrice = null,
    Object? discount = null,
    Object? subtotal = null,
    Object? total = null,
    Object? margin = null,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_$SaleItemImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      saleId: null == saleId
          ? _value.saleId
          : saleId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitPrice: null == unitPrice
          ? _value.unitPrice
          : unitPrice // ignore: cast_nullable_to_non_nullable
              as String,
      costPrice: null == costPrice
          ? _value.costPrice
          : costPrice // ignore: cast_nullable_to_non_nullable
              as String,
      discount: null == discount
          ? _value.discount
          : discount // ignore: cast_nullable_to_non_nullable
              as String,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as String,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as String,
      margin: null == margin
          ? _value.margin
          : margin // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SaleItemImpl implements _SaleItem {
  const _$SaleItemImpl(
      {required this.id,
      required this.saleId,
      required this.productId,
      required this.quantity,
      required this.unitPrice,
      required this.costPrice,
      required this.discount,
      required this.subtotal,
      required this.total,
      required this.margin,
      required this.createdAt,
      required this.updatedAt});

  factory _$SaleItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$SaleItemImplFromJson(json);

  @override
  final String id;
  @override
  final String saleId;
  @override
  final String productId;
  @override
  final int quantity;
  @override
  final String unitPrice;
  @override
  final String costPrice;
  @override
  final String discount;
  @override
  final String subtotal;
  @override
  final String total;
  @override
  final String margin;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  @override
  String toString() {
    return 'SaleItem(id: $id, saleId: $saleId, productId: $productId, quantity: $quantity, unitPrice: $unitPrice, costPrice: $costPrice, discount: $discount, subtotal: $subtotal, total: $total, margin: $margin, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SaleItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.saleId, saleId) || other.saleId == saleId) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.unitPrice, unitPrice) ||
                other.unitPrice == unitPrice) &&
            (identical(other.costPrice, costPrice) ||
                other.costPrice == costPrice) &&
            (identical(other.discount, discount) ||
                other.discount == discount) &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.margin, margin) || other.margin == margin) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      saleId,
      productId,
      quantity,
      unitPrice,
      costPrice,
      discount,
      subtotal,
      total,
      margin,
      createdAt,
      updatedAt);

  /// Create a copy of SaleItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SaleItemImplCopyWith<_$SaleItemImpl> get copyWith =>
      __$$SaleItemImplCopyWithImpl<_$SaleItemImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SaleItemImplToJson(
      this,
    );
  }
}

abstract class _SaleItem implements SaleItem {
  const factory _SaleItem(
      {required final String id,
      required final String saleId,
      required final String productId,
      required final int quantity,
      required final String unitPrice,
      required final String costPrice,
      required final String discount,
      required final String subtotal,
      required final String total,
      required final String margin,
      required final DateTime createdAt,
      required final DateTime updatedAt}) = _$SaleItemImpl;

  factory _SaleItem.fromJson(Map<String, dynamic> json) =
      _$SaleItemImpl.fromJson;

  @override
  String get id;
  @override
  String get saleId;
  @override
  String get productId;
  @override
  int get quantity;
  @override
  String get unitPrice;
  @override
  String get costPrice;
  @override
  String get discount;
  @override
  String get subtotal;
  @override
  String get total;
  @override
  String get margin;
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;

  /// Create a copy of SaleItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SaleItemImplCopyWith<_$SaleItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

Payment _$PaymentFromJson(Map<String, dynamic> json) {
  return _Payment.fromJson(json);
}

/// @nodoc
mixin _$Payment {
  String get id => throw _privateConstructorUsedError;
  String get saleId => throw _privateConstructorUsedError;
  String get method => throw _privateConstructorUsedError;
  String get amount => throw _privateConstructorUsedError;
  String? get reference => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this Payment to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Payment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PaymentCopyWith<Payment> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PaymentCopyWith<$Res> {
  factory $PaymentCopyWith(Payment value, $Res Function(Payment) then) =
      _$PaymentCopyWithImpl<$Res, Payment>;
  @useResult
  $Res call(
      {String id,
      String saleId,
      String method,
      String amount,
      String? reference,
      DateTime createdAt,
      DateTime updatedAt});
}

/// @nodoc
class _$PaymentCopyWithImpl<$Res, $Val extends Payment>
    implements $PaymentCopyWith<$Res> {
  _$PaymentCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Payment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? saleId = null,
    Object? method = null,
    Object? amount = null,
    Object? reference = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      saleId: null == saleId
          ? _value.saleId
          : saleId // ignore: cast_nullable_to_non_nullable
              as String,
      method: null == method
          ? _value.method
          : method // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as String,
      reference: freezed == reference
          ? _value.reference
          : reference // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PaymentImplCopyWith<$Res> implements $PaymentCopyWith<$Res> {
  factory _$$PaymentImplCopyWith(
          _$PaymentImpl value, $Res Function(_$PaymentImpl) then) =
      __$$PaymentImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String saleId,
      String method,
      String amount,
      String? reference,
      DateTime createdAt,
      DateTime updatedAt});
}

/// @nodoc
class __$$PaymentImplCopyWithImpl<$Res>
    extends _$PaymentCopyWithImpl<$Res, _$PaymentImpl>
    implements _$$PaymentImplCopyWith<$Res> {
  __$$PaymentImplCopyWithImpl(
      _$PaymentImpl _value, $Res Function(_$PaymentImpl) _then)
      : super(_value, _then);

  /// Create a copy of Payment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? saleId = null,
    Object? method = null,
    Object? amount = null,
    Object? reference = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_$PaymentImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      saleId: null == saleId
          ? _value.saleId
          : saleId // ignore: cast_nullable_to_non_nullable
              as String,
      method: null == method
          ? _value.method
          : method // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as String,
      reference: freezed == reference
          ? _value.reference
          : reference // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PaymentImpl implements _Payment {
  const _$PaymentImpl(
      {required this.id,
      required this.saleId,
      required this.method,
      required this.amount,
      this.reference,
      required this.createdAt,
      required this.updatedAt});

  factory _$PaymentImpl.fromJson(Map<String, dynamic> json) =>
      _$$PaymentImplFromJson(json);

  @override
  final String id;
  @override
  final String saleId;
  @override
  final String method;
  @override
  final String amount;
  @override
  final String? reference;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  @override
  String toString() {
    return 'Payment(id: $id, saleId: $saleId, method: $method, amount: $amount, reference: $reference, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PaymentImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.saleId, saleId) || other.saleId == saleId) &&
            (identical(other.method, method) || other.method == method) &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.reference, reference) ||
                other.reference == reference) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, saleId, method, amount, reference, createdAt, updatedAt);

  /// Create a copy of Payment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PaymentImplCopyWith<_$PaymentImpl> get copyWith =>
      __$$PaymentImplCopyWithImpl<_$PaymentImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PaymentImplToJson(
      this,
    );
  }
}

abstract class _Payment implements Payment {
  const factory _Payment(
      {required final String id,
      required final String saleId,
      required final String method,
      required final String amount,
      final String? reference,
      required final DateTime createdAt,
      required final DateTime updatedAt}) = _$PaymentImpl;

  factory _Payment.fromJson(Map<String, dynamic> json) = _$PaymentImpl.fromJson;

  @override
  String get id;
  @override
  String get saleId;
  @override
  String get method;
  @override
  String get amount;
  @override
  String? get reference;
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;

  /// Create a copy of Payment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PaymentImplCopyWith<_$PaymentImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

Receipt _$ReceiptFromJson(Map<String, dynamic> json) {
  return _Receipt.fromJson(json);
}

/// @nodoc
mixin _$Receipt {
  String get id => throw _privateConstructorUsedError;
  String get receiptNumber => throw _privateConstructorUsedError;
  String get saleId => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  bool get printed => throw _privateConstructorUsedError;
  bool get emailed => throw _privateConstructorUsedError;
  String? get pdfUrl => throw _privateConstructorUsedError;
  String? get qrCode => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this Receipt to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Receipt
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ReceiptCopyWith<Receipt> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ReceiptCopyWith<$Res> {
  factory $ReceiptCopyWith(Receipt value, $Res Function(Receipt) then) =
      _$ReceiptCopyWithImpl<$Res, Receipt>;
  @useResult
  $Res call(
      {String id,
      String receiptNumber,
      String saleId,
      String status,
      bool printed,
      bool emailed,
      String? pdfUrl,
      String? qrCode,
      DateTime createdAt,
      DateTime updatedAt});
}

/// @nodoc
class _$ReceiptCopyWithImpl<$Res, $Val extends Receipt>
    implements $ReceiptCopyWith<$Res> {
  _$ReceiptCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Receipt
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? receiptNumber = null,
    Object? saleId = null,
    Object? status = null,
    Object? printed = null,
    Object? emailed = null,
    Object? pdfUrl = freezed,
    Object? qrCode = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      receiptNumber: null == receiptNumber
          ? _value.receiptNumber
          : receiptNumber // ignore: cast_nullable_to_non_nullable
              as String,
      saleId: null == saleId
          ? _value.saleId
          : saleId // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      printed: null == printed
          ? _value.printed
          : printed // ignore: cast_nullable_to_non_nullable
              as bool,
      emailed: null == emailed
          ? _value.emailed
          : emailed // ignore: cast_nullable_to_non_nullable
              as bool,
      pdfUrl: freezed == pdfUrl
          ? _value.pdfUrl
          : pdfUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      qrCode: freezed == qrCode
          ? _value.qrCode
          : qrCode // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ReceiptImplCopyWith<$Res> implements $ReceiptCopyWith<$Res> {
  factory _$$ReceiptImplCopyWith(
          _$ReceiptImpl value, $Res Function(_$ReceiptImpl) then) =
      __$$ReceiptImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String receiptNumber,
      String saleId,
      String status,
      bool printed,
      bool emailed,
      String? pdfUrl,
      String? qrCode,
      DateTime createdAt,
      DateTime updatedAt});
}

/// @nodoc
class __$$ReceiptImplCopyWithImpl<$Res>
    extends _$ReceiptCopyWithImpl<$Res, _$ReceiptImpl>
    implements _$$ReceiptImplCopyWith<$Res> {
  __$$ReceiptImplCopyWithImpl(
      _$ReceiptImpl _value, $Res Function(_$ReceiptImpl) _then)
      : super(_value, _then);

  /// Create a copy of Receipt
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? receiptNumber = null,
    Object? saleId = null,
    Object? status = null,
    Object? printed = null,
    Object? emailed = null,
    Object? pdfUrl = freezed,
    Object? qrCode = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_$ReceiptImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      receiptNumber: null == receiptNumber
          ? _value.receiptNumber
          : receiptNumber // ignore: cast_nullable_to_non_nullable
              as String,
      saleId: null == saleId
          ? _value.saleId
          : saleId // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      printed: null == printed
          ? _value.printed
          : printed // ignore: cast_nullable_to_non_nullable
              as bool,
      emailed: null == emailed
          ? _value.emailed
          : emailed // ignore: cast_nullable_to_non_nullable
              as bool,
      pdfUrl: freezed == pdfUrl
          ? _value.pdfUrl
          : pdfUrl // ignore: cast_nullable_to_non_nullable
              as String?,
      qrCode: freezed == qrCode
          ? _value.qrCode
          : qrCode // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ReceiptImpl implements _Receipt {
  const _$ReceiptImpl(
      {required this.id,
      required this.receiptNumber,
      required this.saleId,
      required this.status,
      this.printed = false,
      this.emailed = false,
      this.pdfUrl,
      this.qrCode,
      required this.createdAt,
      required this.updatedAt});

  factory _$ReceiptImpl.fromJson(Map<String, dynamic> json) =>
      _$$ReceiptImplFromJson(json);

  @override
  final String id;
  @override
  final String receiptNumber;
  @override
  final String saleId;
  @override
  final String status;
  @override
  @JsonKey()
  final bool printed;
  @override
  @JsonKey()
  final bool emailed;
  @override
  final String? pdfUrl;
  @override
  final String? qrCode;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  @override
  String toString() {
    return 'Receipt(id: $id, receiptNumber: $receiptNumber, saleId: $saleId, status: $status, printed: $printed, emailed: $emailed, pdfUrl: $pdfUrl, qrCode: $qrCode, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ReceiptImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.receiptNumber, receiptNumber) ||
                other.receiptNumber == receiptNumber) &&
            (identical(other.saleId, saleId) || other.saleId == saleId) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.printed, printed) || other.printed == printed) &&
            (identical(other.emailed, emailed) || other.emailed == emailed) &&
            (identical(other.pdfUrl, pdfUrl) || other.pdfUrl == pdfUrl) &&
            (identical(other.qrCode, qrCode) || other.qrCode == qrCode) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, receiptNumber, saleId,
      status, printed, emailed, pdfUrl, qrCode, createdAt, updatedAt);

  /// Create a copy of Receipt
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ReceiptImplCopyWith<_$ReceiptImpl> get copyWith =>
      __$$ReceiptImplCopyWithImpl<_$ReceiptImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ReceiptImplToJson(
      this,
    );
  }
}

abstract class _Receipt implements Receipt {
  const factory _Receipt(
      {required final String id,
      required final String receiptNumber,
      required final String saleId,
      required final String status,
      final bool printed,
      final bool emailed,
      final String? pdfUrl,
      final String? qrCode,
      required final DateTime createdAt,
      required final DateTime updatedAt}) = _$ReceiptImpl;

  factory _Receipt.fromJson(Map<String, dynamic> json) = _$ReceiptImpl.fromJson;

  @override
  String get id;
  @override
  String get receiptNumber;
  @override
  String get saleId;
  @override
  String get status;
  @override
  bool get printed;
  @override
  bool get emailed;
  @override
  String? get pdfUrl;
  @override
  String? get qrCode;
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;

  /// Create a copy of Receipt
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ReceiptImplCopyWith<_$ReceiptImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CreateSaleRequest _$CreateSaleRequestFromJson(Map<String, dynamic> json) {
  return _CreateSaleRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateSaleRequest {
  String get warehouseId => throw _privateConstructorUsedError;
  String? get customerId => throw _privateConstructorUsedError;
  String? get saleNumber => throw _privateConstructorUsedError;
  String get currency => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  List<CreateSaleItem> get items => throw _privateConstructorUsedError;
  List<CreatePayment> get payments => throw _privateConstructorUsedError;

  /// Serializes this CreateSaleRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateSaleRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateSaleRequestCopyWith<CreateSaleRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateSaleRequestCopyWith<$Res> {
  factory $CreateSaleRequestCopyWith(
          CreateSaleRequest value, $Res Function(CreateSaleRequest) then) =
      _$CreateSaleRequestCopyWithImpl<$Res, CreateSaleRequest>;
  @useResult
  $Res call(
      {String warehouseId,
      String? customerId,
      String? saleNumber,
      String currency,
      String? notes,
      List<CreateSaleItem> items,
      List<CreatePayment> payments});
}

/// @nodoc
class _$CreateSaleRequestCopyWithImpl<$Res, $Val extends CreateSaleRequest>
    implements $CreateSaleRequestCopyWith<$Res> {
  _$CreateSaleRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateSaleRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? warehouseId = null,
    Object? customerId = freezed,
    Object? saleNumber = freezed,
    Object? currency = null,
    Object? notes = freezed,
    Object? items = null,
    Object? payments = null,
  }) {
    return _then(_value.copyWith(
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      customerId: freezed == customerId
          ? _value.customerId
          : customerId // ignore: cast_nullable_to_non_nullable
              as String?,
      saleNumber: freezed == saleNumber
          ? _value.saleNumber
          : saleNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      items: null == items
          ? _value.items
          : items // ignore: cast_nullable_to_non_nullable
              as List<CreateSaleItem>,
      payments: null == payments
          ? _value.payments
          : payments // ignore: cast_nullable_to_non_nullable
              as List<CreatePayment>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreateSaleRequestImplCopyWith<$Res>
    implements $CreateSaleRequestCopyWith<$Res> {
  factory _$$CreateSaleRequestImplCopyWith(_$CreateSaleRequestImpl value,
          $Res Function(_$CreateSaleRequestImpl) then) =
      __$$CreateSaleRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String warehouseId,
      String? customerId,
      String? saleNumber,
      String currency,
      String? notes,
      List<CreateSaleItem> items,
      List<CreatePayment> payments});
}

/// @nodoc
class __$$CreateSaleRequestImplCopyWithImpl<$Res>
    extends _$CreateSaleRequestCopyWithImpl<$Res, _$CreateSaleRequestImpl>
    implements _$$CreateSaleRequestImplCopyWith<$Res> {
  __$$CreateSaleRequestImplCopyWithImpl(_$CreateSaleRequestImpl _value,
      $Res Function(_$CreateSaleRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreateSaleRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? warehouseId = null,
    Object? customerId = freezed,
    Object? saleNumber = freezed,
    Object? currency = null,
    Object? notes = freezed,
    Object? items = null,
    Object? payments = null,
  }) {
    return _then(_$CreateSaleRequestImpl(
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      customerId: freezed == customerId
          ? _value.customerId
          : customerId // ignore: cast_nullable_to_non_nullable
              as String?,
      saleNumber: freezed == saleNumber
          ? _value.saleNumber
          : saleNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<CreateSaleItem>,
      payments: null == payments
          ? _value._payments
          : payments // ignore: cast_nullable_to_non_nullable
              as List<CreatePayment>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateSaleRequestImpl implements _CreateSaleRequest {
  const _$CreateSaleRequestImpl(
      {required this.warehouseId,
      this.customerId,
      this.saleNumber,
      this.currency = 'KZT',
      this.notes,
      required final List<CreateSaleItem> items,
      required final List<CreatePayment> payments})
      : _items = items,
        _payments = payments;

  factory _$CreateSaleRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateSaleRequestImplFromJson(json);

  @override
  final String warehouseId;
  @override
  final String? customerId;
  @override
  final String? saleNumber;
  @override
  @JsonKey()
  final String currency;
  @override
  final String? notes;
  final List<CreateSaleItem> _items;
  @override
  List<CreateSaleItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  final List<CreatePayment> _payments;
  @override
  List<CreatePayment> get payments {
    if (_payments is EqualUnmodifiableListView) return _payments;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_payments);
  }

  @override
  String toString() {
    return 'CreateSaleRequest(warehouseId: $warehouseId, customerId: $customerId, saleNumber: $saleNumber, currency: $currency, notes: $notes, items: $items, payments: $payments)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateSaleRequestImpl &&
            (identical(other.warehouseId, warehouseId) ||
                other.warehouseId == warehouseId) &&
            (identical(other.customerId, customerId) ||
                other.customerId == customerId) &&
            (identical(other.saleNumber, saleNumber) ||
                other.saleNumber == saleNumber) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            const DeepCollectionEquality().equals(other._payments, _payments));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      warehouseId,
      customerId,
      saleNumber,
      currency,
      notes,
      const DeepCollectionEquality().hash(_items),
      const DeepCollectionEquality().hash(_payments));

  /// Create a copy of CreateSaleRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateSaleRequestImplCopyWith<_$CreateSaleRequestImpl> get copyWith =>
      __$$CreateSaleRequestImplCopyWithImpl<_$CreateSaleRequestImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateSaleRequestImplToJson(
      this,
    );
  }
}

abstract class _CreateSaleRequest implements CreateSaleRequest {
  const factory _CreateSaleRequest(
      {required final String warehouseId,
      final String? customerId,
      final String? saleNumber,
      final String currency,
      final String? notes,
      required final List<CreateSaleItem> items,
      required final List<CreatePayment> payments}) = _$CreateSaleRequestImpl;

  factory _CreateSaleRequest.fromJson(Map<String, dynamic> json) =
      _$CreateSaleRequestImpl.fromJson;

  @override
  String get warehouseId;
  @override
  String? get customerId;
  @override
  String? get saleNumber;
  @override
  String get currency;
  @override
  String? get notes;
  @override
  List<CreateSaleItem> get items;
  @override
  List<CreatePayment> get payments;

  /// Create a copy of CreateSaleRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateSaleRequestImplCopyWith<_$CreateSaleRequestImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CreateSaleItem _$CreateSaleItemFromJson(Map<String, dynamic> json) {
  return _CreateSaleItem.fromJson(json);
}

/// @nodoc
mixin _$CreateSaleItem {
  String get productId => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  double get unitPrice => throw _privateConstructorUsedError;
  double? get costPrice => throw _privateConstructorUsedError;
  double get discount => throw _privateConstructorUsedError;

  /// Serializes this CreateSaleItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateSaleItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateSaleItemCopyWith<CreateSaleItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateSaleItemCopyWith<$Res> {
  factory $CreateSaleItemCopyWith(
          CreateSaleItem value, $Res Function(CreateSaleItem) then) =
      _$CreateSaleItemCopyWithImpl<$Res, CreateSaleItem>;
  @useResult
  $Res call(
      {String productId,
      int quantity,
      double unitPrice,
      double? costPrice,
      double discount});
}

/// @nodoc
class _$CreateSaleItemCopyWithImpl<$Res, $Val extends CreateSaleItem>
    implements $CreateSaleItemCopyWith<$Res> {
  _$CreateSaleItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateSaleItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? quantity = null,
    Object? unitPrice = null,
    Object? costPrice = freezed,
    Object? discount = null,
  }) {
    return _then(_value.copyWith(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitPrice: null == unitPrice
          ? _value.unitPrice
          : unitPrice // ignore: cast_nullable_to_non_nullable
              as double,
      costPrice: freezed == costPrice
          ? _value.costPrice
          : costPrice // ignore: cast_nullable_to_non_nullable
              as double?,
      discount: null == discount
          ? _value.discount
          : discount // ignore: cast_nullable_to_non_nullable
              as double,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreateSaleItemImplCopyWith<$Res>
    implements $CreateSaleItemCopyWith<$Res> {
  factory _$$CreateSaleItemImplCopyWith(_$CreateSaleItemImpl value,
          $Res Function(_$CreateSaleItemImpl) then) =
      __$$CreateSaleItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String productId,
      int quantity,
      double unitPrice,
      double? costPrice,
      double discount});
}

/// @nodoc
class __$$CreateSaleItemImplCopyWithImpl<$Res>
    extends _$CreateSaleItemCopyWithImpl<$Res, _$CreateSaleItemImpl>
    implements _$$CreateSaleItemImplCopyWith<$Res> {
  __$$CreateSaleItemImplCopyWithImpl(
      _$CreateSaleItemImpl _value, $Res Function(_$CreateSaleItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreateSaleItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? quantity = null,
    Object? unitPrice = null,
    Object? costPrice = freezed,
    Object? discount = null,
  }) {
    return _then(_$CreateSaleItemImpl(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitPrice: null == unitPrice
          ? _value.unitPrice
          : unitPrice // ignore: cast_nullable_to_non_nullable
              as double,
      costPrice: freezed == costPrice
          ? _value.costPrice
          : costPrice // ignore: cast_nullable_to_non_nullable
              as double?,
      discount: null == discount
          ? _value.discount
          : discount // ignore: cast_nullable_to_non_nullable
              as double,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateSaleItemImpl implements _CreateSaleItem {
  const _$CreateSaleItemImpl(
      {required this.productId,
      required this.quantity,
      required this.unitPrice,
      this.costPrice,
      this.discount = 0});

  factory _$CreateSaleItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateSaleItemImplFromJson(json);

  @override
  final String productId;
  @override
  final int quantity;
  @override
  final double unitPrice;
  @override
  final double? costPrice;
  @override
  @JsonKey()
  final double discount;

  @override
  String toString() {
    return 'CreateSaleItem(productId: $productId, quantity: $quantity, unitPrice: $unitPrice, costPrice: $costPrice, discount: $discount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateSaleItemImpl &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.unitPrice, unitPrice) ||
                other.unitPrice == unitPrice) &&
            (identical(other.costPrice, costPrice) ||
                other.costPrice == costPrice) &&
            (identical(other.discount, discount) ||
                other.discount == discount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, productId, quantity, unitPrice, costPrice, discount);

  /// Create a copy of CreateSaleItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateSaleItemImplCopyWith<_$CreateSaleItemImpl> get copyWith =>
      __$$CreateSaleItemImplCopyWithImpl<_$CreateSaleItemImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateSaleItemImplToJson(
      this,
    );
  }
}

abstract class _CreateSaleItem implements CreateSaleItem {
  const factory _CreateSaleItem(
      {required final String productId,
      required final int quantity,
      required final double unitPrice,
      final double? costPrice,
      final double discount}) = _$CreateSaleItemImpl;

  factory _CreateSaleItem.fromJson(Map<String, dynamic> json) =
      _$CreateSaleItemImpl.fromJson;

  @override
  String get productId;
  @override
  int get quantity;
  @override
  double get unitPrice;
  @override
  double? get costPrice;
  @override
  double get discount;

  /// Create a copy of CreateSaleItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateSaleItemImplCopyWith<_$CreateSaleItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CreatePayment _$CreatePaymentFromJson(Map<String, dynamic> json) {
  return _CreatePayment.fromJson(json);
}

/// @nodoc
mixin _$CreatePayment {
  String get method => throw _privateConstructorUsedError;
  double get amount => throw _privateConstructorUsedError;
  String? get reference => throw _privateConstructorUsedError;

  /// Serializes this CreatePayment to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreatePayment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreatePaymentCopyWith<CreatePayment> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreatePaymentCopyWith<$Res> {
  factory $CreatePaymentCopyWith(
          CreatePayment value, $Res Function(CreatePayment) then) =
      _$CreatePaymentCopyWithImpl<$Res, CreatePayment>;
  @useResult
  $Res call({String method, double amount, String? reference});
}

/// @nodoc
class _$CreatePaymentCopyWithImpl<$Res, $Val extends CreatePayment>
    implements $CreatePaymentCopyWith<$Res> {
  _$CreatePaymentCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreatePayment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? method = null,
    Object? amount = null,
    Object? reference = freezed,
  }) {
    return _then(_value.copyWith(
      method: null == method
          ? _value.method
          : method // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as double,
      reference: freezed == reference
          ? _value.reference
          : reference // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreatePaymentImplCopyWith<$Res>
    implements $CreatePaymentCopyWith<$Res> {
  factory _$$CreatePaymentImplCopyWith(
          _$CreatePaymentImpl value, $Res Function(_$CreatePaymentImpl) then) =
      __$$CreatePaymentImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String method, double amount, String? reference});
}

/// @nodoc
class __$$CreatePaymentImplCopyWithImpl<$Res>
    extends _$CreatePaymentCopyWithImpl<$Res, _$CreatePaymentImpl>
    implements _$$CreatePaymentImplCopyWith<$Res> {
  __$$CreatePaymentImplCopyWithImpl(
      _$CreatePaymentImpl _value, $Res Function(_$CreatePaymentImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreatePayment
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? method = null,
    Object? amount = null,
    Object? reference = freezed,
  }) {
    return _then(_$CreatePaymentImpl(
      method: null == method
          ? _value.method
          : method // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as double,
      reference: freezed == reference
          ? _value.reference
          : reference // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreatePaymentImpl implements _CreatePayment {
  const _$CreatePaymentImpl(
      {required this.method, required this.amount, this.reference});

  factory _$CreatePaymentImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreatePaymentImplFromJson(json);

  @override
  final String method;
  @override
  final double amount;
  @override
  final String? reference;

  @override
  String toString() {
    return 'CreatePayment(method: $method, amount: $amount, reference: $reference)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreatePaymentImpl &&
            (identical(other.method, method) || other.method == method) &&
            (identical(other.amount, amount) || other.amount == amount) &&
            (identical(other.reference, reference) ||
                other.reference == reference));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, method, amount, reference);

  /// Create a copy of CreatePayment
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreatePaymentImplCopyWith<_$CreatePaymentImpl> get copyWith =>
      __$$CreatePaymentImplCopyWithImpl<_$CreatePaymentImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreatePaymentImplToJson(
      this,
    );
  }
}

abstract class _CreatePayment implements CreatePayment {
  const factory _CreatePayment(
      {required final String method,
      required final double amount,
      final String? reference}) = _$CreatePaymentImpl;

  factory _CreatePayment.fromJson(Map<String, dynamic> json) =
      _$CreatePaymentImpl.fromJson;

  @override
  String get method;
  @override
  double get amount;
  @override
  String? get reference;

  /// Create a copy of CreatePayment
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreatePaymentImplCopyWith<_$CreatePaymentImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SaleListResponse _$SaleListResponseFromJson(Map<String, dynamic> json) {
  return _SaleListResponse.fromJson(json);
}

/// @nodoc
mixin _$SaleListResponse {
  List<Sale> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this SaleListResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SaleListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SaleListResponseCopyWith<SaleListResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SaleListResponseCopyWith<$Res> {
  factory $SaleListResponseCopyWith(
          SaleListResponse value, $Res Function(SaleListResponse) then) =
      _$SaleListResponseCopyWithImpl<$Res, SaleListResponse>;
  @useResult
  $Res call({List<Sale> items, int total, int page, int limit});
}

/// @nodoc
class _$SaleListResponseCopyWithImpl<$Res, $Val extends SaleListResponse>
    implements $SaleListResponseCopyWith<$Res> {
  _$SaleListResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SaleListResponse
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
              as List<Sale>,
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
abstract class _$$SaleListResponseImplCopyWith<$Res>
    implements $SaleListResponseCopyWith<$Res> {
  factory _$$SaleListResponseImplCopyWith(_$SaleListResponseImpl value,
          $Res Function(_$SaleListResponseImpl) then) =
      __$$SaleListResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<Sale> items, int total, int page, int limit});
}

/// @nodoc
class __$$SaleListResponseImplCopyWithImpl<$Res>
    extends _$SaleListResponseCopyWithImpl<$Res, _$SaleListResponseImpl>
    implements _$$SaleListResponseImplCopyWith<$Res> {
  __$$SaleListResponseImplCopyWithImpl(_$SaleListResponseImpl _value,
      $Res Function(_$SaleListResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of SaleListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$SaleListResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<Sale>,
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
class _$SaleListResponseImpl implements _SaleListResponse {
  const _$SaleListResponseImpl(
      {required final List<Sale> items,
      required this.total,
      required this.page,
      required this.limit})
      : _items = items;

  factory _$SaleListResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$SaleListResponseImplFromJson(json);

  final List<Sale> _items;
  @override
  List<Sale> get items {
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
    return 'SaleListResponse(items: $items, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SaleListResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_items), total, page, limit);

  /// Create a copy of SaleListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SaleListResponseImplCopyWith<_$SaleListResponseImpl> get copyWith =>
      __$$SaleListResponseImplCopyWithImpl<_$SaleListResponseImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SaleListResponseImplToJson(
      this,
    );
  }
}

abstract class _SaleListResponse implements SaleListResponse {
  const factory _SaleListResponse(
      {required final List<Sale> items,
      required final int total,
      required final int page,
      required final int limit}) = _$SaleListResponseImpl;

  factory _SaleListResponse.fromJson(Map<String, dynamic> json) =
      _$SaleListResponseImpl.fromJson;

  @override
  List<Sale> get items;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of SaleListResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SaleListResponseImplCopyWith<_$SaleListResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
