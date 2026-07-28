// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'purchasing_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

PurchaseOrder _$PurchaseOrderFromJson(Map<String, dynamic> json) {
  return _PurchaseOrder.fromJson(json);
}

/// @nodoc
mixin _$PurchaseOrder {
  String get id => throw _privateConstructorUsedError;
  String get companyId => throw _privateConstructorUsedError;
  String get supplierId => throw _privateConstructorUsedError;
  String get orderNumber => throw _privateConstructorUsedError;
  DateTime get orderDate => throw _privateConstructorUsedError;
  DateTime? get expectedDate => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String get subtotal => throw _privateConstructorUsedError;
  String get discountAmount => throw _privateConstructorUsedError;
  String get taxAmount => throw _privateConstructorUsedError;
  String get grandTotal => throw _privateConstructorUsedError;
  String get paidAmount => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  String? get approvedBy => throw _privateConstructorUsedError;
  DateTime? get approvedAt => throw _privateConstructorUsedError;
  String? get cancelledBy => throw _privateConstructorUsedError;
  DateTime? get cancelledAt => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;
  DateTime? get deletedAt => throw _privateConstructorUsedError;
  List<PurchaseOrderItem> get items => throw _privateConstructorUsedError;

  /// Serializes this PurchaseOrder to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PurchaseOrder
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PurchaseOrderCopyWith<PurchaseOrder> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PurchaseOrderCopyWith<$Res> {
  factory $PurchaseOrderCopyWith(
          PurchaseOrder value, $Res Function(PurchaseOrder) then) =
      _$PurchaseOrderCopyWithImpl<$Res, PurchaseOrder>;
  @useResult
  $Res call(
      {String id,
      String companyId,
      String supplierId,
      String orderNumber,
      DateTime orderDate,
      DateTime? expectedDate,
      String status,
      String subtotal,
      String discountAmount,
      String taxAmount,
      String grandTotal,
      String paidAmount,
      String? notes,
      String? approvedBy,
      DateTime? approvedAt,
      String? cancelledBy,
      DateTime? cancelledAt,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt,
      List<PurchaseOrderItem> items});
}

/// @nodoc
class _$PurchaseOrderCopyWithImpl<$Res, $Val extends PurchaseOrder>
    implements $PurchaseOrderCopyWith<$Res> {
  _$PurchaseOrderCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PurchaseOrder
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? supplierId = null,
    Object? orderNumber = null,
    Object? orderDate = null,
    Object? expectedDate = freezed,
    Object? status = null,
    Object? subtotal = null,
    Object? discountAmount = null,
    Object? taxAmount = null,
    Object? grandTotal = null,
    Object? paidAmount = null,
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
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      orderNumber: null == orderNumber
          ? _value.orderNumber
          : orderNumber // ignore: cast_nullable_to_non_nullable
              as String,
      orderDate: null == orderDate
          ? _value.orderDate
          : orderDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      expectedDate: freezed == expectedDate
          ? _value.expectedDate
          : expectedDate // ignore: cast_nullable_to_non_nullable
              as DateTime?,
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
              as DateTime?,
      cancelledBy: freezed == cancelledBy
          ? _value.cancelledBy
          : cancelledBy // ignore: cast_nullable_to_non_nullable
              as String?,
      cancelledAt: freezed == cancelledAt
          ? _value.cancelledAt
          : cancelledAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
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
              as List<PurchaseOrderItem>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PurchaseOrderImplCopyWith<$Res>
    implements $PurchaseOrderCopyWith<$Res> {
  factory _$$PurchaseOrderImplCopyWith(
          _$PurchaseOrderImpl value, $Res Function(_$PurchaseOrderImpl) then) =
      __$$PurchaseOrderImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String companyId,
      String supplierId,
      String orderNumber,
      DateTime orderDate,
      DateTime? expectedDate,
      String status,
      String subtotal,
      String discountAmount,
      String taxAmount,
      String grandTotal,
      String paidAmount,
      String? notes,
      String? approvedBy,
      DateTime? approvedAt,
      String? cancelledBy,
      DateTime? cancelledAt,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt,
      List<PurchaseOrderItem> items});
}

/// @nodoc
class __$$PurchaseOrderImplCopyWithImpl<$Res>
    extends _$PurchaseOrderCopyWithImpl<$Res, _$PurchaseOrderImpl>
    implements _$$PurchaseOrderImplCopyWith<$Res> {
  __$$PurchaseOrderImplCopyWithImpl(
      _$PurchaseOrderImpl _value, $Res Function(_$PurchaseOrderImpl) _then)
      : super(_value, _then);

  /// Create a copy of PurchaseOrder
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? supplierId = null,
    Object? orderNumber = null,
    Object? orderDate = null,
    Object? expectedDate = freezed,
    Object? status = null,
    Object? subtotal = null,
    Object? discountAmount = null,
    Object? taxAmount = null,
    Object? grandTotal = null,
    Object? paidAmount = null,
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
    return _then(_$PurchaseOrderImpl(
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
      orderNumber: null == orderNumber
          ? _value.orderNumber
          : orderNumber // ignore: cast_nullable_to_non_nullable
              as String,
      orderDate: null == orderDate
          ? _value.orderDate
          : orderDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      expectedDate: freezed == expectedDate
          ? _value.expectedDate
          : expectedDate // ignore: cast_nullable_to_non_nullable
              as DateTime?,
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
              as DateTime?,
      cancelledBy: freezed == cancelledBy
          ? _value.cancelledBy
          : cancelledBy // ignore: cast_nullable_to_non_nullable
              as String?,
      cancelledAt: freezed == cancelledAt
          ? _value.cancelledAt
          : cancelledAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
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
              as List<PurchaseOrderItem>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PurchaseOrderImpl implements _PurchaseOrder {
  const _$PurchaseOrderImpl(
      {required this.id,
      required this.companyId,
      required this.supplierId,
      required this.orderNumber,
      required this.orderDate,
      this.expectedDate,
      required this.status,
      required this.subtotal,
      required this.discountAmount,
      required this.taxAmount,
      required this.grandTotal,
      required this.paidAmount,
      this.notes,
      this.approvedBy,
      this.approvedAt,
      this.cancelledBy,
      this.cancelledAt,
      required this.createdAt,
      required this.updatedAt,
      this.deletedAt,
      final List<PurchaseOrderItem> items = const []})
      : _items = items;

  factory _$PurchaseOrderImpl.fromJson(Map<String, dynamic> json) =>
      _$$PurchaseOrderImplFromJson(json);

  @override
  final String id;
  @override
  final String companyId;
  @override
  final String supplierId;
  @override
  final String orderNumber;
  @override
  final DateTime orderDate;
  @override
  final DateTime? expectedDate;
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
  final String? notes;
  @override
  final String? approvedBy;
  @override
  final DateTime? approvedAt;
  @override
  final String? cancelledBy;
  @override
  final DateTime? cancelledAt;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;
  @override
  final DateTime? deletedAt;
  final List<PurchaseOrderItem> _items;
  @override
  @JsonKey()
  List<PurchaseOrderItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  String toString() {
    return 'PurchaseOrder(id: $id, companyId: $companyId, supplierId: $supplierId, orderNumber: $orderNumber, orderDate: $orderDate, expectedDate: $expectedDate, status: $status, subtotal: $subtotal, discountAmount: $discountAmount, taxAmount: $taxAmount, grandTotal: $grandTotal, paidAmount: $paidAmount, notes: $notes, approvedBy: $approvedBy, approvedAt: $approvedAt, cancelledBy: $cancelledBy, cancelledAt: $cancelledAt, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt, items: $items)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PurchaseOrderImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.supplierId, supplierId) ||
                other.supplierId == supplierId) &&
            (identical(other.orderNumber, orderNumber) ||
                other.orderNumber == orderNumber) &&
            (identical(other.orderDate, orderDate) ||
                other.orderDate == orderDate) &&
            (identical(other.expectedDate, expectedDate) ||
                other.expectedDate == expectedDate) &&
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
        supplierId,
        orderNumber,
        orderDate,
        expectedDate,
        status,
        subtotal,
        discountAmount,
        taxAmount,
        grandTotal,
        paidAmount,
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

  /// Create a copy of PurchaseOrder
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PurchaseOrderImplCopyWith<_$PurchaseOrderImpl> get copyWith =>
      __$$PurchaseOrderImplCopyWithImpl<_$PurchaseOrderImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PurchaseOrderImplToJson(
      this,
    );
  }
}

abstract class _PurchaseOrder implements PurchaseOrder {
  const factory _PurchaseOrder(
      {required final String id,
      required final String companyId,
      required final String supplierId,
      required final String orderNumber,
      required final DateTime orderDate,
      final DateTime? expectedDate,
      required final String status,
      required final String subtotal,
      required final String discountAmount,
      required final String taxAmount,
      required final String grandTotal,
      required final String paidAmount,
      final String? notes,
      final String? approvedBy,
      final DateTime? approvedAt,
      final String? cancelledBy,
      final DateTime? cancelledAt,
      required final DateTime createdAt,
      required final DateTime updatedAt,
      final DateTime? deletedAt,
      final List<PurchaseOrderItem> items}) = _$PurchaseOrderImpl;

  factory _PurchaseOrder.fromJson(Map<String, dynamic> json) =
      _$PurchaseOrderImpl.fromJson;

  @override
  String get id;
  @override
  String get companyId;
  @override
  String get supplierId;
  @override
  String get orderNumber;
  @override
  DateTime get orderDate;
  @override
  DateTime? get expectedDate;
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
  String? get notes;
  @override
  String? get approvedBy;
  @override
  DateTime? get approvedAt;
  @override
  String? get cancelledBy;
  @override
  DateTime? get cancelledAt;
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;
  @override
  DateTime? get deletedAt;
  @override
  List<PurchaseOrderItem> get items;

  /// Create a copy of PurchaseOrder
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PurchaseOrderImplCopyWith<_$PurchaseOrderImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PurchaseOrderItem _$PurchaseOrderItemFromJson(Map<String, dynamic> json) {
  return _PurchaseOrderItem.fromJson(json);
}

/// @nodoc
mixin _$PurchaseOrderItem {
  String get id => throw _privateConstructorUsedError;
  String get purchaseOrderId => throw _privateConstructorUsedError;
  String get productId => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  int get receivedQuantity => throw _privateConstructorUsedError;
  String get unitCost => throw _privateConstructorUsedError;
  String? get discountPercent => throw _privateConstructorUsedError;
  String get discountAmount => throw _privateConstructorUsedError;
  String? get taxPercent => throw _privateConstructorUsedError;
  String get taxAmount => throw _privateConstructorUsedError;
  String get subtotal => throw _privateConstructorUsedError;
  String get total => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this PurchaseOrderItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PurchaseOrderItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PurchaseOrderItemCopyWith<PurchaseOrderItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PurchaseOrderItemCopyWith<$Res> {
  factory $PurchaseOrderItemCopyWith(
          PurchaseOrderItem value, $Res Function(PurchaseOrderItem) then) =
      _$PurchaseOrderItemCopyWithImpl<$Res, PurchaseOrderItem>;
  @useResult
  $Res call(
      {String id,
      String purchaseOrderId,
      String productId,
      int quantity,
      int receivedQuantity,
      String unitCost,
      String? discountPercent,
      String discountAmount,
      String? taxPercent,
      String taxAmount,
      String subtotal,
      String total,
      String? notes,
      DateTime createdAt,
      DateTime updatedAt});
}

/// @nodoc
class _$PurchaseOrderItemCopyWithImpl<$Res, $Val extends PurchaseOrderItem>
    implements $PurchaseOrderItemCopyWith<$Res> {
  _$PurchaseOrderItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PurchaseOrderItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? purchaseOrderId = null,
    Object? productId = null,
    Object? quantity = null,
    Object? receivedQuantity = null,
    Object? unitCost = null,
    Object? discountPercent = freezed,
    Object? discountAmount = null,
    Object? taxPercent = freezed,
    Object? taxAmount = null,
    Object? subtotal = null,
    Object? total = null,
    Object? notes = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseOrderId: null == purchaseOrderId
          ? _value.purchaseOrderId
          : purchaseOrderId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      receivedQuantity: null == receivedQuantity
          ? _value.receivedQuantity
          : receivedQuantity // ignore: cast_nullable_to_non_nullable
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
abstract class _$$PurchaseOrderItemImplCopyWith<$Res>
    implements $PurchaseOrderItemCopyWith<$Res> {
  factory _$$PurchaseOrderItemImplCopyWith(_$PurchaseOrderItemImpl value,
          $Res Function(_$PurchaseOrderItemImpl) then) =
      __$$PurchaseOrderItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String purchaseOrderId,
      String productId,
      int quantity,
      int receivedQuantity,
      String unitCost,
      String? discountPercent,
      String discountAmount,
      String? taxPercent,
      String taxAmount,
      String subtotal,
      String total,
      String? notes,
      DateTime createdAt,
      DateTime updatedAt});
}

/// @nodoc
class __$$PurchaseOrderItemImplCopyWithImpl<$Res>
    extends _$PurchaseOrderItemCopyWithImpl<$Res, _$PurchaseOrderItemImpl>
    implements _$$PurchaseOrderItemImplCopyWith<$Res> {
  __$$PurchaseOrderItemImplCopyWithImpl(_$PurchaseOrderItemImpl _value,
      $Res Function(_$PurchaseOrderItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of PurchaseOrderItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? purchaseOrderId = null,
    Object? productId = null,
    Object? quantity = null,
    Object? receivedQuantity = null,
    Object? unitCost = null,
    Object? discountPercent = freezed,
    Object? discountAmount = null,
    Object? taxPercent = freezed,
    Object? taxAmount = null,
    Object? subtotal = null,
    Object? total = null,
    Object? notes = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_$PurchaseOrderItemImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseOrderId: null == purchaseOrderId
          ? _value.purchaseOrderId
          : purchaseOrderId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      receivedQuantity: null == receivedQuantity
          ? _value.receivedQuantity
          : receivedQuantity // ignore: cast_nullable_to_non_nullable
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
class _$PurchaseOrderItemImpl implements _PurchaseOrderItem {
  const _$PurchaseOrderItemImpl(
      {required this.id,
      required this.purchaseOrderId,
      required this.productId,
      required this.quantity,
      this.receivedQuantity = 0,
      required this.unitCost,
      this.discountPercent,
      required this.discountAmount,
      this.taxPercent,
      required this.taxAmount,
      required this.subtotal,
      required this.total,
      this.notes,
      required this.createdAt,
      required this.updatedAt});

  factory _$PurchaseOrderItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$PurchaseOrderItemImplFromJson(json);

  @override
  final String id;
  @override
  final String purchaseOrderId;
  @override
  final String productId;
  @override
  final int quantity;
  @override
  @JsonKey()
  final int receivedQuantity;
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
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  @override
  String toString() {
    return 'PurchaseOrderItem(id: $id, purchaseOrderId: $purchaseOrderId, productId: $productId, quantity: $quantity, receivedQuantity: $receivedQuantity, unitCost: $unitCost, discountPercent: $discountPercent, discountAmount: $discountAmount, taxPercent: $taxPercent, taxAmount: $taxAmount, subtotal: $subtotal, total: $total, notes: $notes, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PurchaseOrderItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.purchaseOrderId, purchaseOrderId) ||
                other.purchaseOrderId == purchaseOrderId) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.receivedQuantity, receivedQuantity) ||
                other.receivedQuantity == receivedQuantity) &&
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
            (identical(other.notes, notes) || other.notes == notes) &&
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
      purchaseOrderId,
      productId,
      quantity,
      receivedQuantity,
      unitCost,
      discountPercent,
      discountAmount,
      taxPercent,
      taxAmount,
      subtotal,
      total,
      notes,
      createdAt,
      updatedAt);

  /// Create a copy of PurchaseOrderItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PurchaseOrderItemImplCopyWith<_$PurchaseOrderItemImpl> get copyWith =>
      __$$PurchaseOrderItemImplCopyWithImpl<_$PurchaseOrderItemImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PurchaseOrderItemImplToJson(
      this,
    );
  }
}

abstract class _PurchaseOrderItem implements PurchaseOrderItem {
  const factory _PurchaseOrderItem(
      {required final String id,
      required final String purchaseOrderId,
      required final String productId,
      required final int quantity,
      final int receivedQuantity,
      required final String unitCost,
      final String? discountPercent,
      required final String discountAmount,
      final String? taxPercent,
      required final String taxAmount,
      required final String subtotal,
      required final String total,
      final String? notes,
      required final DateTime createdAt,
      required final DateTime updatedAt}) = _$PurchaseOrderItemImpl;

  factory _PurchaseOrderItem.fromJson(Map<String, dynamic> json) =
      _$PurchaseOrderItemImpl.fromJson;

  @override
  String get id;
  @override
  String get purchaseOrderId;
  @override
  String get productId;
  @override
  int get quantity;
  @override
  int get receivedQuantity;
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
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;

  /// Create a copy of PurchaseOrderItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PurchaseOrderItemImplCopyWith<_$PurchaseOrderItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PurchaseOrderListResponse _$PurchaseOrderListResponseFromJson(
    Map<String, dynamic> json) {
  return _PurchaseOrderListResponse.fromJson(json);
}

/// @nodoc
mixin _$PurchaseOrderListResponse {
  List<PurchaseOrder> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this PurchaseOrderListResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PurchaseOrderListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PurchaseOrderListResponseCopyWith<PurchaseOrderListResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PurchaseOrderListResponseCopyWith<$Res> {
  factory $PurchaseOrderListResponseCopyWith(PurchaseOrderListResponse value,
          $Res Function(PurchaseOrderListResponse) then) =
      _$PurchaseOrderListResponseCopyWithImpl<$Res, PurchaseOrderListResponse>;
  @useResult
  $Res call({List<PurchaseOrder> items, int total, int page, int limit});
}

/// @nodoc
class _$PurchaseOrderListResponseCopyWithImpl<$Res,
        $Val extends PurchaseOrderListResponse>
    implements $PurchaseOrderListResponseCopyWith<$Res> {
  _$PurchaseOrderListResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PurchaseOrderListResponse
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
              as List<PurchaseOrder>,
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
abstract class _$$PurchaseOrderListResponseImplCopyWith<$Res>
    implements $PurchaseOrderListResponseCopyWith<$Res> {
  factory _$$PurchaseOrderListResponseImplCopyWith(
          _$PurchaseOrderListResponseImpl value,
          $Res Function(_$PurchaseOrderListResponseImpl) then) =
      __$$PurchaseOrderListResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<PurchaseOrder> items, int total, int page, int limit});
}

/// @nodoc
class __$$PurchaseOrderListResponseImplCopyWithImpl<$Res>
    extends _$PurchaseOrderListResponseCopyWithImpl<$Res,
        _$PurchaseOrderListResponseImpl>
    implements _$$PurchaseOrderListResponseImplCopyWith<$Res> {
  __$$PurchaseOrderListResponseImplCopyWithImpl(
      _$PurchaseOrderListResponseImpl _value,
      $Res Function(_$PurchaseOrderListResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of PurchaseOrderListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$PurchaseOrderListResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<PurchaseOrder>,
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
class _$PurchaseOrderListResponseImpl implements _PurchaseOrderListResponse {
  const _$PurchaseOrderListResponseImpl(
      {required final List<PurchaseOrder> items,
      required this.total,
      required this.page,
      required this.limit})
      : _items = items;

  factory _$PurchaseOrderListResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$PurchaseOrderListResponseImplFromJson(json);

  final List<PurchaseOrder> _items;
  @override
  List<PurchaseOrder> get items {
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
    return 'PurchaseOrderListResponse(items: $items, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PurchaseOrderListResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_items), total, page, limit);

  /// Create a copy of PurchaseOrderListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PurchaseOrderListResponseImplCopyWith<_$PurchaseOrderListResponseImpl>
      get copyWith => __$$PurchaseOrderListResponseImplCopyWithImpl<
          _$PurchaseOrderListResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PurchaseOrderListResponseImplToJson(
      this,
    );
  }
}

abstract class _PurchaseOrderListResponse implements PurchaseOrderListResponse {
  const factory _PurchaseOrderListResponse(
      {required final List<PurchaseOrder> items,
      required final int total,
      required final int page,
      required final int limit}) = _$PurchaseOrderListResponseImpl;

  factory _PurchaseOrderListResponse.fromJson(Map<String, dynamic> json) =
      _$PurchaseOrderListResponseImpl.fromJson;

  @override
  List<PurchaseOrder> get items;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of PurchaseOrderListResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PurchaseOrderListResponseImplCopyWith<_$PurchaseOrderListResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

CreatePurchaseOrderRequest _$CreatePurchaseOrderRequestFromJson(
    Map<String, dynamic> json) {
  return _CreatePurchaseOrderRequest.fromJson(json);
}

/// @nodoc
mixin _$CreatePurchaseOrderRequest {
  String get supplierId => throw _privateConstructorUsedError;
  String? get orderNumber => throw _privateConstructorUsedError;
  String? get orderDate => throw _privateConstructorUsedError;
  String? get expectedDate => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  List<CreatePurchaseOrderItem> get items => throw _privateConstructorUsedError;

  /// Serializes this CreatePurchaseOrderRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreatePurchaseOrderRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreatePurchaseOrderRequestCopyWith<CreatePurchaseOrderRequest>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreatePurchaseOrderRequestCopyWith<$Res> {
  factory $CreatePurchaseOrderRequestCopyWith(CreatePurchaseOrderRequest value,
          $Res Function(CreatePurchaseOrderRequest) then) =
      _$CreatePurchaseOrderRequestCopyWithImpl<$Res,
          CreatePurchaseOrderRequest>;
  @useResult
  $Res call(
      {String supplierId,
      String? orderNumber,
      String? orderDate,
      String? expectedDate,
      String? notes,
      List<CreatePurchaseOrderItem> items});
}

/// @nodoc
class _$CreatePurchaseOrderRequestCopyWithImpl<$Res,
        $Val extends CreatePurchaseOrderRequest>
    implements $CreatePurchaseOrderRequestCopyWith<$Res> {
  _$CreatePurchaseOrderRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreatePurchaseOrderRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? supplierId = null,
    Object? orderNumber = freezed,
    Object? orderDate = freezed,
    Object? expectedDate = freezed,
    Object? notes = freezed,
    Object? items = null,
  }) {
    return _then(_value.copyWith(
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      orderNumber: freezed == orderNumber
          ? _value.orderNumber
          : orderNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      orderDate: freezed == orderDate
          ? _value.orderDate
          : orderDate // ignore: cast_nullable_to_non_nullable
              as String?,
      expectedDate: freezed == expectedDate
          ? _value.expectedDate
          : expectedDate // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      items: null == items
          ? _value.items
          : items // ignore: cast_nullable_to_non_nullable
              as List<CreatePurchaseOrderItem>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreatePurchaseOrderRequestImplCopyWith<$Res>
    implements $CreatePurchaseOrderRequestCopyWith<$Res> {
  factory _$$CreatePurchaseOrderRequestImplCopyWith(
          _$CreatePurchaseOrderRequestImpl value,
          $Res Function(_$CreatePurchaseOrderRequestImpl) then) =
      __$$CreatePurchaseOrderRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String supplierId,
      String? orderNumber,
      String? orderDate,
      String? expectedDate,
      String? notes,
      List<CreatePurchaseOrderItem> items});
}

/// @nodoc
class __$$CreatePurchaseOrderRequestImplCopyWithImpl<$Res>
    extends _$CreatePurchaseOrderRequestCopyWithImpl<$Res,
        _$CreatePurchaseOrderRequestImpl>
    implements _$$CreatePurchaseOrderRequestImplCopyWith<$Res> {
  __$$CreatePurchaseOrderRequestImplCopyWithImpl(
      _$CreatePurchaseOrderRequestImpl _value,
      $Res Function(_$CreatePurchaseOrderRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreatePurchaseOrderRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? supplierId = null,
    Object? orderNumber = freezed,
    Object? orderDate = freezed,
    Object? expectedDate = freezed,
    Object? notes = freezed,
    Object? items = null,
  }) {
    return _then(_$CreatePurchaseOrderRequestImpl(
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      orderNumber: freezed == orderNumber
          ? _value.orderNumber
          : orderNumber // ignore: cast_nullable_to_non_nullable
              as String?,
      orderDate: freezed == orderDate
          ? _value.orderDate
          : orderDate // ignore: cast_nullable_to_non_nullable
              as String?,
      expectedDate: freezed == expectedDate
          ? _value.expectedDate
          : expectedDate // ignore: cast_nullable_to_non_nullable
              as String?,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<CreatePurchaseOrderItem>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreatePurchaseOrderRequestImpl implements _CreatePurchaseOrderRequest {
  const _$CreatePurchaseOrderRequestImpl(
      {required this.supplierId,
      this.orderNumber,
      this.orderDate,
      this.expectedDate,
      this.notes,
      required final List<CreatePurchaseOrderItem> items})
      : _items = items;

  factory _$CreatePurchaseOrderRequestImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$CreatePurchaseOrderRequestImplFromJson(json);

  @override
  final String supplierId;
  @override
  final String? orderNumber;
  @override
  final String? orderDate;
  @override
  final String? expectedDate;
  @override
  final String? notes;
  final List<CreatePurchaseOrderItem> _items;
  @override
  List<CreatePurchaseOrderItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  String toString() {
    return 'CreatePurchaseOrderRequest(supplierId: $supplierId, orderNumber: $orderNumber, orderDate: $orderDate, expectedDate: $expectedDate, notes: $notes, items: $items)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreatePurchaseOrderRequestImpl &&
            (identical(other.supplierId, supplierId) ||
                other.supplierId == supplierId) &&
            (identical(other.orderNumber, orderNumber) ||
                other.orderNumber == orderNumber) &&
            (identical(other.orderDate, orderDate) ||
                other.orderDate == orderDate) &&
            (identical(other.expectedDate, expectedDate) ||
                other.expectedDate == expectedDate) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            const DeepCollectionEquality().equals(other._items, _items));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      supplierId,
      orderNumber,
      orderDate,
      expectedDate,
      notes,
      const DeepCollectionEquality().hash(_items));

  /// Create a copy of CreatePurchaseOrderRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreatePurchaseOrderRequestImplCopyWith<_$CreatePurchaseOrderRequestImpl>
      get copyWith => __$$CreatePurchaseOrderRequestImplCopyWithImpl<
          _$CreatePurchaseOrderRequestImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreatePurchaseOrderRequestImplToJson(
      this,
    );
  }
}

abstract class _CreatePurchaseOrderRequest
    implements CreatePurchaseOrderRequest {
  const factory _CreatePurchaseOrderRequest(
          {required final String supplierId,
          final String? orderNumber,
          final String? orderDate,
          final String? expectedDate,
          final String? notes,
          required final List<CreatePurchaseOrderItem> items}) =
      _$CreatePurchaseOrderRequestImpl;

  factory _CreatePurchaseOrderRequest.fromJson(Map<String, dynamic> json) =
      _$CreatePurchaseOrderRequestImpl.fromJson;

  @override
  String get supplierId;
  @override
  String? get orderNumber;
  @override
  String? get orderDate;
  @override
  String? get expectedDate;
  @override
  String? get notes;
  @override
  List<CreatePurchaseOrderItem> get items;

  /// Create a copy of CreatePurchaseOrderRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreatePurchaseOrderRequestImplCopyWith<_$CreatePurchaseOrderRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}

CreatePurchaseOrderItem _$CreatePurchaseOrderItemFromJson(
    Map<String, dynamic> json) {
  return _CreatePurchaseOrderItem.fromJson(json);
}

/// @nodoc
mixin _$CreatePurchaseOrderItem {
  String get productId => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  double get unitCost => throw _privateConstructorUsedError;
  double get discountPercent => throw _privateConstructorUsedError;
  double get taxPercent => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;

  /// Serializes this CreatePurchaseOrderItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreatePurchaseOrderItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreatePurchaseOrderItemCopyWith<CreatePurchaseOrderItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreatePurchaseOrderItemCopyWith<$Res> {
  factory $CreatePurchaseOrderItemCopyWith(CreatePurchaseOrderItem value,
          $Res Function(CreatePurchaseOrderItem) then) =
      _$CreatePurchaseOrderItemCopyWithImpl<$Res, CreatePurchaseOrderItem>;
  @useResult
  $Res call(
      {String productId,
      int quantity,
      double unitCost,
      double discountPercent,
      double taxPercent,
      String? notes});
}

/// @nodoc
class _$CreatePurchaseOrderItemCopyWithImpl<$Res,
        $Val extends CreatePurchaseOrderItem>
    implements $CreatePurchaseOrderItemCopyWith<$Res> {
  _$CreatePurchaseOrderItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreatePurchaseOrderItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? quantity = null,
    Object? unitCost = null,
    Object? discountPercent = null,
    Object? taxPercent = null,
    Object? notes = freezed,
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
      unitCost: null == unitCost
          ? _value.unitCost
          : unitCost // ignore: cast_nullable_to_non_nullable
              as double,
      discountPercent: null == discountPercent
          ? _value.discountPercent
          : discountPercent // ignore: cast_nullable_to_non_nullable
              as double,
      taxPercent: null == taxPercent
          ? _value.taxPercent
          : taxPercent // ignore: cast_nullable_to_non_nullable
              as double,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreatePurchaseOrderItemImplCopyWith<$Res>
    implements $CreatePurchaseOrderItemCopyWith<$Res> {
  factory _$$CreatePurchaseOrderItemImplCopyWith(
          _$CreatePurchaseOrderItemImpl value,
          $Res Function(_$CreatePurchaseOrderItemImpl) then) =
      __$$CreatePurchaseOrderItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String productId,
      int quantity,
      double unitCost,
      double discountPercent,
      double taxPercent,
      String? notes});
}

/// @nodoc
class __$$CreatePurchaseOrderItemImplCopyWithImpl<$Res>
    extends _$CreatePurchaseOrderItemCopyWithImpl<$Res,
        _$CreatePurchaseOrderItemImpl>
    implements _$$CreatePurchaseOrderItemImplCopyWith<$Res> {
  __$$CreatePurchaseOrderItemImplCopyWithImpl(
      _$CreatePurchaseOrderItemImpl _value,
      $Res Function(_$CreatePurchaseOrderItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreatePurchaseOrderItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? quantity = null,
    Object? unitCost = null,
    Object? discountPercent = null,
    Object? taxPercent = null,
    Object? notes = freezed,
  }) {
    return _then(_$CreatePurchaseOrderItemImpl(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitCost: null == unitCost
          ? _value.unitCost
          : unitCost // ignore: cast_nullable_to_non_nullable
              as double,
      discountPercent: null == discountPercent
          ? _value.discountPercent
          : discountPercent // ignore: cast_nullable_to_non_nullable
              as double,
      taxPercent: null == taxPercent
          ? _value.taxPercent
          : taxPercent // ignore: cast_nullable_to_non_nullable
              as double,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreatePurchaseOrderItemImpl implements _CreatePurchaseOrderItem {
  const _$CreatePurchaseOrderItemImpl(
      {required this.productId,
      required this.quantity,
      required this.unitCost,
      this.discountPercent = 0,
      this.taxPercent = 0,
      this.notes});

  factory _$CreatePurchaseOrderItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreatePurchaseOrderItemImplFromJson(json);

  @override
  final String productId;
  @override
  final int quantity;
  @override
  final double unitCost;
  @override
  @JsonKey()
  final double discountPercent;
  @override
  @JsonKey()
  final double taxPercent;
  @override
  final String? notes;

  @override
  String toString() {
    return 'CreatePurchaseOrderItem(productId: $productId, quantity: $quantity, unitCost: $unitCost, discountPercent: $discountPercent, taxPercent: $taxPercent, notes: $notes)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreatePurchaseOrderItemImpl &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.unitCost, unitCost) ||
                other.unitCost == unitCost) &&
            (identical(other.discountPercent, discountPercent) ||
                other.discountPercent == discountPercent) &&
            (identical(other.taxPercent, taxPercent) ||
                other.taxPercent == taxPercent) &&
            (identical(other.notes, notes) || other.notes == notes));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, productId, quantity, unitCost,
      discountPercent, taxPercent, notes);

  /// Create a copy of CreatePurchaseOrderItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreatePurchaseOrderItemImplCopyWith<_$CreatePurchaseOrderItemImpl>
      get copyWith => __$$CreatePurchaseOrderItemImplCopyWithImpl<
          _$CreatePurchaseOrderItemImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreatePurchaseOrderItemImplToJson(
      this,
    );
  }
}

abstract class _CreatePurchaseOrderItem implements CreatePurchaseOrderItem {
  const factory _CreatePurchaseOrderItem(
      {required final String productId,
      required final int quantity,
      required final double unitCost,
      final double discountPercent,
      final double taxPercent,
      final String? notes}) = _$CreatePurchaseOrderItemImpl;

  factory _CreatePurchaseOrderItem.fromJson(Map<String, dynamic> json) =
      _$CreatePurchaseOrderItemImpl.fromJson;

  @override
  String get productId;
  @override
  int get quantity;
  @override
  double get unitCost;
  @override
  double get discountPercent;
  @override
  double get taxPercent;
  @override
  String? get notes;

  /// Create a copy of CreatePurchaseOrderItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreatePurchaseOrderItemImplCopyWith<_$CreatePurchaseOrderItemImpl>
      get copyWith => throw _privateConstructorUsedError;
}

GoodsReceipt _$GoodsReceiptFromJson(Map<String, dynamic> json) {
  return _GoodsReceipt.fromJson(json);
}

/// @nodoc
mixin _$GoodsReceipt {
  String get id => throw _privateConstructorUsedError;
  String get companyId => throw _privateConstructorUsedError;
  String get purchaseOrderId => throw _privateConstructorUsedError;
  String get receiptNumber => throw _privateConstructorUsedError;
  DateTime get receiptDate => throw _privateConstructorUsedError;
  String get warehouseId => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  String? get receivedBy => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;
  DateTime? get deletedAt => throw _privateConstructorUsedError;
  List<GoodsReceiptItem> get items => throw _privateConstructorUsedError;

  /// Serializes this GoodsReceipt to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of GoodsReceipt
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GoodsReceiptCopyWith<GoodsReceipt> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GoodsReceiptCopyWith<$Res> {
  factory $GoodsReceiptCopyWith(
          GoodsReceipt value, $Res Function(GoodsReceipt) then) =
      _$GoodsReceiptCopyWithImpl<$Res, GoodsReceipt>;
  @useResult
  $Res call(
      {String id,
      String companyId,
      String purchaseOrderId,
      String receiptNumber,
      DateTime receiptDate,
      String warehouseId,
      String status,
      String? notes,
      String? receivedBy,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt,
      List<GoodsReceiptItem> items});
}

/// @nodoc
class _$GoodsReceiptCopyWithImpl<$Res, $Val extends GoodsReceipt>
    implements $GoodsReceiptCopyWith<$Res> {
  _$GoodsReceiptCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of GoodsReceipt
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? purchaseOrderId = null,
    Object? receiptNumber = null,
    Object? receiptDate = null,
    Object? warehouseId = null,
    Object? status = null,
    Object? notes = freezed,
    Object? receivedBy = freezed,
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
      receiptNumber: null == receiptNumber
          ? _value.receiptNumber
          : receiptNumber // ignore: cast_nullable_to_non_nullable
              as String,
      receiptDate: null == receiptDate
          ? _value.receiptDate
          : receiptDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      receivedBy: freezed == receivedBy
          ? _value.receivedBy
          : receivedBy // ignore: cast_nullable_to_non_nullable
              as String?,
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
              as List<GoodsReceiptItem>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$GoodsReceiptImplCopyWith<$Res>
    implements $GoodsReceiptCopyWith<$Res> {
  factory _$$GoodsReceiptImplCopyWith(
          _$GoodsReceiptImpl value, $Res Function(_$GoodsReceiptImpl) then) =
      __$$GoodsReceiptImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String companyId,
      String purchaseOrderId,
      String receiptNumber,
      DateTime receiptDate,
      String warehouseId,
      String status,
      String? notes,
      String? receivedBy,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt,
      List<GoodsReceiptItem> items});
}

/// @nodoc
class __$$GoodsReceiptImplCopyWithImpl<$Res>
    extends _$GoodsReceiptCopyWithImpl<$Res, _$GoodsReceiptImpl>
    implements _$$GoodsReceiptImplCopyWith<$Res> {
  __$$GoodsReceiptImplCopyWithImpl(
      _$GoodsReceiptImpl _value, $Res Function(_$GoodsReceiptImpl) _then)
      : super(_value, _then);

  /// Create a copy of GoodsReceipt
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? purchaseOrderId = null,
    Object? receiptNumber = null,
    Object? receiptDate = null,
    Object? warehouseId = null,
    Object? status = null,
    Object? notes = freezed,
    Object? receivedBy = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
    Object? items = null,
  }) {
    return _then(_$GoodsReceiptImpl(
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
      receiptNumber: null == receiptNumber
          ? _value.receiptNumber
          : receiptNumber // ignore: cast_nullable_to_non_nullable
              as String,
      receiptDate: null == receiptDate
          ? _value.receiptDate
          : receiptDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      receivedBy: freezed == receivedBy
          ? _value.receivedBy
          : receivedBy // ignore: cast_nullable_to_non_nullable
              as String?,
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
              as List<GoodsReceiptItem>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$GoodsReceiptImpl implements _GoodsReceipt {
  const _$GoodsReceiptImpl(
      {required this.id,
      required this.companyId,
      required this.purchaseOrderId,
      required this.receiptNumber,
      required this.receiptDate,
      required this.warehouseId,
      required this.status,
      this.notes,
      this.receivedBy,
      required this.createdAt,
      required this.updatedAt,
      this.deletedAt,
      final List<GoodsReceiptItem> items = const []})
      : _items = items;

  factory _$GoodsReceiptImpl.fromJson(Map<String, dynamic> json) =>
      _$$GoodsReceiptImplFromJson(json);

  @override
  final String id;
  @override
  final String companyId;
  @override
  final String purchaseOrderId;
  @override
  final String receiptNumber;
  @override
  final DateTime receiptDate;
  @override
  final String warehouseId;
  @override
  final String status;
  @override
  final String? notes;
  @override
  final String? receivedBy;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;
  @override
  final DateTime? deletedAt;
  final List<GoodsReceiptItem> _items;
  @override
  @JsonKey()
  List<GoodsReceiptItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  String toString() {
    return 'GoodsReceipt(id: $id, companyId: $companyId, purchaseOrderId: $purchaseOrderId, receiptNumber: $receiptNumber, receiptDate: $receiptDate, warehouseId: $warehouseId, status: $status, notes: $notes, receivedBy: $receivedBy, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt, items: $items)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GoodsReceiptImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.purchaseOrderId, purchaseOrderId) ||
                other.purchaseOrderId == purchaseOrderId) &&
            (identical(other.receiptNumber, receiptNumber) ||
                other.receiptNumber == receiptNumber) &&
            (identical(other.receiptDate, receiptDate) ||
                other.receiptDate == receiptDate) &&
            (identical(other.warehouseId, warehouseId) ||
                other.warehouseId == warehouseId) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.receivedBy, receivedBy) ||
                other.receivedBy == receivedBy) &&
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
  int get hashCode => Object.hash(
      runtimeType,
      id,
      companyId,
      purchaseOrderId,
      receiptNumber,
      receiptDate,
      warehouseId,
      status,
      notes,
      receivedBy,
      createdAt,
      updatedAt,
      deletedAt,
      const DeepCollectionEquality().hash(_items));

  /// Create a copy of GoodsReceipt
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GoodsReceiptImplCopyWith<_$GoodsReceiptImpl> get copyWith =>
      __$$GoodsReceiptImplCopyWithImpl<_$GoodsReceiptImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GoodsReceiptImplToJson(
      this,
    );
  }
}

abstract class _GoodsReceipt implements GoodsReceipt {
  const factory _GoodsReceipt(
      {required final String id,
      required final String companyId,
      required final String purchaseOrderId,
      required final String receiptNumber,
      required final DateTime receiptDate,
      required final String warehouseId,
      required final String status,
      final String? notes,
      final String? receivedBy,
      required final DateTime createdAt,
      required final DateTime updatedAt,
      final DateTime? deletedAt,
      final List<GoodsReceiptItem> items}) = _$GoodsReceiptImpl;

  factory _GoodsReceipt.fromJson(Map<String, dynamic> json) =
      _$GoodsReceiptImpl.fromJson;

  @override
  String get id;
  @override
  String get companyId;
  @override
  String get purchaseOrderId;
  @override
  String get receiptNumber;
  @override
  DateTime get receiptDate;
  @override
  String get warehouseId;
  @override
  String get status;
  @override
  String? get notes;
  @override
  String? get receivedBy;
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;
  @override
  DateTime? get deletedAt;
  @override
  List<GoodsReceiptItem> get items;

  /// Create a copy of GoodsReceipt
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GoodsReceiptImplCopyWith<_$GoodsReceiptImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

GoodsReceiptItem _$GoodsReceiptItemFromJson(Map<String, dynamic> json) {
  return _GoodsReceiptItem.fromJson(json);
}

/// @nodoc
mixin _$GoodsReceiptItem {
  String get id => throw _privateConstructorUsedError;
  String get goodsReceiptId => throw _privateConstructorUsedError;
  String get purchaseOrderItemId => throw _privateConstructorUsedError;
  String get productId => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  String get unitCost => throw _privateConstructorUsedError;
  String get subtotal => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this GoodsReceiptItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of GoodsReceiptItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $GoodsReceiptItemCopyWith<GoodsReceiptItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $GoodsReceiptItemCopyWith<$Res> {
  factory $GoodsReceiptItemCopyWith(
          GoodsReceiptItem value, $Res Function(GoodsReceiptItem) then) =
      _$GoodsReceiptItemCopyWithImpl<$Res, GoodsReceiptItem>;
  @useResult
  $Res call(
      {String id,
      String goodsReceiptId,
      String purchaseOrderItemId,
      String productId,
      int quantity,
      String unitCost,
      String subtotal,
      String? notes,
      DateTime createdAt,
      DateTime updatedAt});
}

/// @nodoc
class _$GoodsReceiptItemCopyWithImpl<$Res, $Val extends GoodsReceiptItem>
    implements $GoodsReceiptItemCopyWith<$Res> {
  _$GoodsReceiptItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of GoodsReceiptItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? goodsReceiptId = null,
    Object? purchaseOrderItemId = null,
    Object? productId = null,
    Object? quantity = null,
    Object? unitCost = null,
    Object? subtotal = null,
    Object? notes = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      goodsReceiptId: null == goodsReceiptId
          ? _value.goodsReceiptId
          : goodsReceiptId // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseOrderItemId: null == purchaseOrderItemId
          ? _value.purchaseOrderItemId
          : purchaseOrderItemId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitCost: null == unitCost
          ? _value.unitCost
          : unitCost // ignore: cast_nullable_to_non_nullable
              as String,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as String,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
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
abstract class _$$GoodsReceiptItemImplCopyWith<$Res>
    implements $GoodsReceiptItemCopyWith<$Res> {
  factory _$$GoodsReceiptItemImplCopyWith(_$GoodsReceiptItemImpl value,
          $Res Function(_$GoodsReceiptItemImpl) then) =
      __$$GoodsReceiptItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String goodsReceiptId,
      String purchaseOrderItemId,
      String productId,
      int quantity,
      String unitCost,
      String subtotal,
      String? notes,
      DateTime createdAt,
      DateTime updatedAt});
}

/// @nodoc
class __$$GoodsReceiptItemImplCopyWithImpl<$Res>
    extends _$GoodsReceiptItemCopyWithImpl<$Res, _$GoodsReceiptItemImpl>
    implements _$$GoodsReceiptItemImplCopyWith<$Res> {
  __$$GoodsReceiptItemImplCopyWithImpl(_$GoodsReceiptItemImpl _value,
      $Res Function(_$GoodsReceiptItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of GoodsReceiptItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? goodsReceiptId = null,
    Object? purchaseOrderItemId = null,
    Object? productId = null,
    Object? quantity = null,
    Object? unitCost = null,
    Object? subtotal = null,
    Object? notes = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_$GoodsReceiptItemImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      goodsReceiptId: null == goodsReceiptId
          ? _value.goodsReceiptId
          : goodsReceiptId // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseOrderItemId: null == purchaseOrderItemId
          ? _value.purchaseOrderItemId
          : purchaseOrderItemId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitCost: null == unitCost
          ? _value.unitCost
          : unitCost // ignore: cast_nullable_to_non_nullable
              as String,
      subtotal: null == subtotal
          ? _value.subtotal
          : subtotal // ignore: cast_nullable_to_non_nullable
              as String,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
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
class _$GoodsReceiptItemImpl implements _GoodsReceiptItem {
  const _$GoodsReceiptItemImpl(
      {required this.id,
      required this.goodsReceiptId,
      required this.purchaseOrderItemId,
      required this.productId,
      required this.quantity,
      required this.unitCost,
      required this.subtotal,
      this.notes,
      required this.createdAt,
      required this.updatedAt});

  factory _$GoodsReceiptItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$GoodsReceiptItemImplFromJson(json);

  @override
  final String id;
  @override
  final String goodsReceiptId;
  @override
  final String purchaseOrderItemId;
  @override
  final String productId;
  @override
  final int quantity;
  @override
  final String unitCost;
  @override
  final String subtotal;
  @override
  final String? notes;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  @override
  String toString() {
    return 'GoodsReceiptItem(id: $id, goodsReceiptId: $goodsReceiptId, purchaseOrderItemId: $purchaseOrderItemId, productId: $productId, quantity: $quantity, unitCost: $unitCost, subtotal: $subtotal, notes: $notes, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$GoodsReceiptItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.goodsReceiptId, goodsReceiptId) ||
                other.goodsReceiptId == goodsReceiptId) &&
            (identical(other.purchaseOrderItemId, purchaseOrderItemId) ||
                other.purchaseOrderItemId == purchaseOrderItemId) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.unitCost, unitCost) ||
                other.unitCost == unitCost) &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.notes, notes) || other.notes == notes) &&
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
      goodsReceiptId,
      purchaseOrderItemId,
      productId,
      quantity,
      unitCost,
      subtotal,
      notes,
      createdAt,
      updatedAt);

  /// Create a copy of GoodsReceiptItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$GoodsReceiptItemImplCopyWith<_$GoodsReceiptItemImpl> get copyWith =>
      __$$GoodsReceiptItemImplCopyWithImpl<_$GoodsReceiptItemImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$GoodsReceiptItemImplToJson(
      this,
    );
  }
}

abstract class _GoodsReceiptItem implements GoodsReceiptItem {
  const factory _GoodsReceiptItem(
      {required final String id,
      required final String goodsReceiptId,
      required final String purchaseOrderItemId,
      required final String productId,
      required final int quantity,
      required final String unitCost,
      required final String subtotal,
      final String? notes,
      required final DateTime createdAt,
      required final DateTime updatedAt}) = _$GoodsReceiptItemImpl;

  factory _GoodsReceiptItem.fromJson(Map<String, dynamic> json) =
      _$GoodsReceiptItemImpl.fromJson;

  @override
  String get id;
  @override
  String get goodsReceiptId;
  @override
  String get purchaseOrderItemId;
  @override
  String get productId;
  @override
  int get quantity;
  @override
  String get unitCost;
  @override
  String get subtotal;
  @override
  String? get notes;
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;

  /// Create a copy of GoodsReceiptItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$GoodsReceiptItemImplCopyWith<_$GoodsReceiptItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CreateGoodsReceiptRequest _$CreateGoodsReceiptRequestFromJson(
    Map<String, dynamic> json) {
  return _CreateGoodsReceiptRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateGoodsReceiptRequest {
  String get purchaseOrderId => throw _privateConstructorUsedError;
  String get warehouseId => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  List<CreateGoodsReceiptItem> get items => throw _privateConstructorUsedError;

  /// Serializes this CreateGoodsReceiptRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateGoodsReceiptRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateGoodsReceiptRequestCopyWith<CreateGoodsReceiptRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateGoodsReceiptRequestCopyWith<$Res> {
  factory $CreateGoodsReceiptRequestCopyWith(CreateGoodsReceiptRequest value,
          $Res Function(CreateGoodsReceiptRequest) then) =
      _$CreateGoodsReceiptRequestCopyWithImpl<$Res, CreateGoodsReceiptRequest>;
  @useResult
  $Res call(
      {String purchaseOrderId,
      String warehouseId,
      String? notes,
      List<CreateGoodsReceiptItem> items});
}

/// @nodoc
class _$CreateGoodsReceiptRequestCopyWithImpl<$Res,
        $Val extends CreateGoodsReceiptRequest>
    implements $CreateGoodsReceiptRequestCopyWith<$Res> {
  _$CreateGoodsReceiptRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateGoodsReceiptRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? purchaseOrderId = null,
    Object? warehouseId = null,
    Object? notes = freezed,
    Object? items = null,
  }) {
    return _then(_value.copyWith(
      purchaseOrderId: null == purchaseOrderId
          ? _value.purchaseOrderId
          : purchaseOrderId // ignore: cast_nullable_to_non_nullable
              as String,
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      items: null == items
          ? _value.items
          : items // ignore: cast_nullable_to_non_nullable
              as List<CreateGoodsReceiptItem>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreateGoodsReceiptRequestImplCopyWith<$Res>
    implements $CreateGoodsReceiptRequestCopyWith<$Res> {
  factory _$$CreateGoodsReceiptRequestImplCopyWith(
          _$CreateGoodsReceiptRequestImpl value,
          $Res Function(_$CreateGoodsReceiptRequestImpl) then) =
      __$$CreateGoodsReceiptRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String purchaseOrderId,
      String warehouseId,
      String? notes,
      List<CreateGoodsReceiptItem> items});
}

/// @nodoc
class __$$CreateGoodsReceiptRequestImplCopyWithImpl<$Res>
    extends _$CreateGoodsReceiptRequestCopyWithImpl<$Res,
        _$CreateGoodsReceiptRequestImpl>
    implements _$$CreateGoodsReceiptRequestImplCopyWith<$Res> {
  __$$CreateGoodsReceiptRequestImplCopyWithImpl(
      _$CreateGoodsReceiptRequestImpl _value,
      $Res Function(_$CreateGoodsReceiptRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreateGoodsReceiptRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? purchaseOrderId = null,
    Object? warehouseId = null,
    Object? notes = freezed,
    Object? items = null,
  }) {
    return _then(_$CreateGoodsReceiptRequestImpl(
      purchaseOrderId: null == purchaseOrderId
          ? _value.purchaseOrderId
          : purchaseOrderId // ignore: cast_nullable_to_non_nullable
              as String,
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<CreateGoodsReceiptItem>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateGoodsReceiptRequestImpl implements _CreateGoodsReceiptRequest {
  const _$CreateGoodsReceiptRequestImpl(
      {required this.purchaseOrderId,
      required this.warehouseId,
      this.notes,
      required final List<CreateGoodsReceiptItem> items})
      : _items = items;

  factory _$CreateGoodsReceiptRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateGoodsReceiptRequestImplFromJson(json);

  @override
  final String purchaseOrderId;
  @override
  final String warehouseId;
  @override
  final String? notes;
  final List<CreateGoodsReceiptItem> _items;
  @override
  List<CreateGoodsReceiptItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  String toString() {
    return 'CreateGoodsReceiptRequest(purchaseOrderId: $purchaseOrderId, warehouseId: $warehouseId, notes: $notes, items: $items)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateGoodsReceiptRequestImpl &&
            (identical(other.purchaseOrderId, purchaseOrderId) ||
                other.purchaseOrderId == purchaseOrderId) &&
            (identical(other.warehouseId, warehouseId) ||
                other.warehouseId == warehouseId) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            const DeepCollectionEquality().equals(other._items, _items));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, purchaseOrderId, warehouseId,
      notes, const DeepCollectionEquality().hash(_items));

  /// Create a copy of CreateGoodsReceiptRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateGoodsReceiptRequestImplCopyWith<_$CreateGoodsReceiptRequestImpl>
      get copyWith => __$$CreateGoodsReceiptRequestImplCopyWithImpl<
          _$CreateGoodsReceiptRequestImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateGoodsReceiptRequestImplToJson(
      this,
    );
  }
}

abstract class _CreateGoodsReceiptRequest implements CreateGoodsReceiptRequest {
  const factory _CreateGoodsReceiptRequest(
          {required final String purchaseOrderId,
          required final String warehouseId,
          final String? notes,
          required final List<CreateGoodsReceiptItem> items}) =
      _$CreateGoodsReceiptRequestImpl;

  factory _CreateGoodsReceiptRequest.fromJson(Map<String, dynamic> json) =
      _$CreateGoodsReceiptRequestImpl.fromJson;

  @override
  String get purchaseOrderId;
  @override
  String get warehouseId;
  @override
  String? get notes;
  @override
  List<CreateGoodsReceiptItem> get items;

  /// Create a copy of CreateGoodsReceiptRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateGoodsReceiptRequestImplCopyWith<_$CreateGoodsReceiptRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}

CreateGoodsReceiptItem _$CreateGoodsReceiptItemFromJson(
    Map<String, dynamic> json) {
  return _CreateGoodsReceiptItem.fromJson(json);
}

/// @nodoc
mixin _$CreateGoodsReceiptItem {
  String get purchaseOrderItemId => throw _privateConstructorUsedError;
  String get productId => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  double get unitCost => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;

  /// Serializes this CreateGoodsReceiptItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateGoodsReceiptItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateGoodsReceiptItemCopyWith<CreateGoodsReceiptItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateGoodsReceiptItemCopyWith<$Res> {
  factory $CreateGoodsReceiptItemCopyWith(CreateGoodsReceiptItem value,
          $Res Function(CreateGoodsReceiptItem) then) =
      _$CreateGoodsReceiptItemCopyWithImpl<$Res, CreateGoodsReceiptItem>;
  @useResult
  $Res call(
      {String purchaseOrderItemId,
      String productId,
      int quantity,
      double unitCost,
      String? notes});
}

/// @nodoc
class _$CreateGoodsReceiptItemCopyWithImpl<$Res,
        $Val extends CreateGoodsReceiptItem>
    implements $CreateGoodsReceiptItemCopyWith<$Res> {
  _$CreateGoodsReceiptItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateGoodsReceiptItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? purchaseOrderItemId = null,
    Object? productId = null,
    Object? quantity = null,
    Object? unitCost = null,
    Object? notes = freezed,
  }) {
    return _then(_value.copyWith(
      purchaseOrderItemId: null == purchaseOrderItemId
          ? _value.purchaseOrderItemId
          : purchaseOrderItemId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitCost: null == unitCost
          ? _value.unitCost
          : unitCost // ignore: cast_nullable_to_non_nullable
              as double,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreateGoodsReceiptItemImplCopyWith<$Res>
    implements $CreateGoodsReceiptItemCopyWith<$Res> {
  factory _$$CreateGoodsReceiptItemImplCopyWith(
          _$CreateGoodsReceiptItemImpl value,
          $Res Function(_$CreateGoodsReceiptItemImpl) then) =
      __$$CreateGoodsReceiptItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String purchaseOrderItemId,
      String productId,
      int quantity,
      double unitCost,
      String? notes});
}

/// @nodoc
class __$$CreateGoodsReceiptItemImplCopyWithImpl<$Res>
    extends _$CreateGoodsReceiptItemCopyWithImpl<$Res,
        _$CreateGoodsReceiptItemImpl>
    implements _$$CreateGoodsReceiptItemImplCopyWith<$Res> {
  __$$CreateGoodsReceiptItemImplCopyWithImpl(
      _$CreateGoodsReceiptItemImpl _value,
      $Res Function(_$CreateGoodsReceiptItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreateGoodsReceiptItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? purchaseOrderItemId = null,
    Object? productId = null,
    Object? quantity = null,
    Object? unitCost = null,
    Object? notes = freezed,
  }) {
    return _then(_$CreateGoodsReceiptItemImpl(
      purchaseOrderItemId: null == purchaseOrderItemId
          ? _value.purchaseOrderItemId
          : purchaseOrderItemId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      unitCost: null == unitCost
          ? _value.unitCost
          : unitCost // ignore: cast_nullable_to_non_nullable
              as double,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CreateGoodsReceiptItemImpl implements _CreateGoodsReceiptItem {
  const _$CreateGoodsReceiptItemImpl(
      {required this.purchaseOrderItemId,
      required this.productId,
      required this.quantity,
      required this.unitCost,
      this.notes});

  factory _$CreateGoodsReceiptItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateGoodsReceiptItemImplFromJson(json);

  @override
  final String purchaseOrderItemId;
  @override
  final String productId;
  @override
  final int quantity;
  @override
  final double unitCost;
  @override
  final String? notes;

  @override
  String toString() {
    return 'CreateGoodsReceiptItem(purchaseOrderItemId: $purchaseOrderItemId, productId: $productId, quantity: $quantity, unitCost: $unitCost, notes: $notes)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateGoodsReceiptItemImpl &&
            (identical(other.purchaseOrderItemId, purchaseOrderItemId) ||
                other.purchaseOrderItemId == purchaseOrderItemId) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.unitCost, unitCost) ||
                other.unitCost == unitCost) &&
            (identical(other.notes, notes) || other.notes == notes));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, purchaseOrderItemId, productId, quantity, unitCost, notes);

  /// Create a copy of CreateGoodsReceiptItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateGoodsReceiptItemImplCopyWith<_$CreateGoodsReceiptItemImpl>
      get copyWith => __$$CreateGoodsReceiptItemImplCopyWithImpl<
          _$CreateGoodsReceiptItemImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateGoodsReceiptItemImplToJson(
      this,
    );
  }
}

abstract class _CreateGoodsReceiptItem implements CreateGoodsReceiptItem {
  const factory _CreateGoodsReceiptItem(
      {required final String purchaseOrderItemId,
      required final String productId,
      required final int quantity,
      required final double unitCost,
      final String? notes}) = _$CreateGoodsReceiptItemImpl;

  factory _CreateGoodsReceiptItem.fromJson(Map<String, dynamic> json) =
      _$CreateGoodsReceiptItemImpl.fromJson;

  @override
  String get purchaseOrderItemId;
  @override
  String get productId;
  @override
  int get quantity;
  @override
  double get unitCost;
  @override
  String? get notes;

  /// Create a copy of CreateGoodsReceiptItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateGoodsReceiptItemImplCopyWith<_$CreateGoodsReceiptItemImpl>
      get copyWith => throw _privateConstructorUsedError;
}

PurchaseReturn _$PurchaseReturnFromJson(Map<String, dynamic> json) {
  return _PurchaseReturn.fromJson(json);
}

/// @nodoc
mixin _$PurchaseReturn {
  String get id => throw _privateConstructorUsedError;
  String get companyId => throw _privateConstructorUsedError;
  String get supplierId => throw _privateConstructorUsedError;
  String get returnNumber => throw _privateConstructorUsedError;
  DateTime get returnDate => throw _privateConstructorUsedError;
  String get warehouseId => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String get subtotal => throw _privateConstructorUsedError;
  String get discountAmount => throw _privateConstructorUsedError;
  String get taxAmount => throw _privateConstructorUsedError;
  String get grandTotal => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  String? get approvedBy => throw _privateConstructorUsedError;
  DateTime? get approvedAt => throw _privateConstructorUsedError;
  String? get cancelledBy => throw _privateConstructorUsedError;
  DateTime? get cancelledAt => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;
  DateTime? get deletedAt => throw _privateConstructorUsedError;
  List<PurchaseReturnItem> get items => throw _privateConstructorUsedError;

  /// Serializes this PurchaseReturn to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PurchaseReturn
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PurchaseReturnCopyWith<PurchaseReturn> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PurchaseReturnCopyWith<$Res> {
  factory $PurchaseReturnCopyWith(
          PurchaseReturn value, $Res Function(PurchaseReturn) then) =
      _$PurchaseReturnCopyWithImpl<$Res, PurchaseReturn>;
  @useResult
  $Res call(
      {String id,
      String companyId,
      String supplierId,
      String returnNumber,
      DateTime returnDate,
      String warehouseId,
      String status,
      String subtotal,
      String discountAmount,
      String taxAmount,
      String grandTotal,
      String? notes,
      String? approvedBy,
      DateTime? approvedAt,
      String? cancelledBy,
      DateTime? cancelledAt,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt,
      List<PurchaseReturnItem> items});
}

/// @nodoc
class _$PurchaseReturnCopyWithImpl<$Res, $Val extends PurchaseReturn>
    implements $PurchaseReturnCopyWith<$Res> {
  _$PurchaseReturnCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PurchaseReturn
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? supplierId = null,
    Object? returnNumber = null,
    Object? returnDate = null,
    Object? warehouseId = null,
    Object? status = null,
    Object? subtotal = null,
    Object? discountAmount = null,
    Object? taxAmount = null,
    Object? grandTotal = null,
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
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      returnNumber: null == returnNumber
          ? _value.returnNumber
          : returnNumber // ignore: cast_nullable_to_non_nullable
              as String,
      returnDate: null == returnDate
          ? _value.returnDate
          : returnDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
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
              as DateTime?,
      cancelledBy: freezed == cancelledBy
          ? _value.cancelledBy
          : cancelledBy // ignore: cast_nullable_to_non_nullable
              as String?,
      cancelledAt: freezed == cancelledAt
          ? _value.cancelledAt
          : cancelledAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
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
              as List<PurchaseReturnItem>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PurchaseReturnImplCopyWith<$Res>
    implements $PurchaseReturnCopyWith<$Res> {
  factory _$$PurchaseReturnImplCopyWith(_$PurchaseReturnImpl value,
          $Res Function(_$PurchaseReturnImpl) then) =
      __$$PurchaseReturnImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String companyId,
      String supplierId,
      String returnNumber,
      DateTime returnDate,
      String warehouseId,
      String status,
      String subtotal,
      String discountAmount,
      String taxAmount,
      String grandTotal,
      String? notes,
      String? approvedBy,
      DateTime? approvedAt,
      String? cancelledBy,
      DateTime? cancelledAt,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt,
      List<PurchaseReturnItem> items});
}

/// @nodoc
class __$$PurchaseReturnImplCopyWithImpl<$Res>
    extends _$PurchaseReturnCopyWithImpl<$Res, _$PurchaseReturnImpl>
    implements _$$PurchaseReturnImplCopyWith<$Res> {
  __$$PurchaseReturnImplCopyWithImpl(
      _$PurchaseReturnImpl _value, $Res Function(_$PurchaseReturnImpl) _then)
      : super(_value, _then);

  /// Create a copy of PurchaseReturn
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? supplierId = null,
    Object? returnNumber = null,
    Object? returnDate = null,
    Object? warehouseId = null,
    Object? status = null,
    Object? subtotal = null,
    Object? discountAmount = null,
    Object? taxAmount = null,
    Object? grandTotal = null,
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
    return _then(_$PurchaseReturnImpl(
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
      returnNumber: null == returnNumber
          ? _value.returnNumber
          : returnNumber // ignore: cast_nullable_to_non_nullable
              as String,
      returnDate: null == returnDate
          ? _value.returnDate
          : returnDate // ignore: cast_nullable_to_non_nullable
              as DateTime,
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
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
              as DateTime?,
      cancelledBy: freezed == cancelledBy
          ? _value.cancelledBy
          : cancelledBy // ignore: cast_nullable_to_non_nullable
              as String?,
      cancelledAt: freezed == cancelledAt
          ? _value.cancelledAt
          : cancelledAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
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
              as List<PurchaseReturnItem>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PurchaseReturnImpl implements _PurchaseReturn {
  const _$PurchaseReturnImpl(
      {required this.id,
      required this.companyId,
      required this.supplierId,
      required this.returnNumber,
      required this.returnDate,
      required this.warehouseId,
      required this.status,
      required this.subtotal,
      required this.discountAmount,
      required this.taxAmount,
      required this.grandTotal,
      this.notes,
      this.approvedBy,
      this.approvedAt,
      this.cancelledBy,
      this.cancelledAt,
      required this.createdAt,
      required this.updatedAt,
      this.deletedAt,
      final List<PurchaseReturnItem> items = const []})
      : _items = items;

  factory _$PurchaseReturnImpl.fromJson(Map<String, dynamic> json) =>
      _$$PurchaseReturnImplFromJson(json);

  @override
  final String id;
  @override
  final String companyId;
  @override
  final String supplierId;
  @override
  final String returnNumber;
  @override
  final DateTime returnDate;
  @override
  final String warehouseId;
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
  final String? notes;
  @override
  final String? approvedBy;
  @override
  final DateTime? approvedAt;
  @override
  final String? cancelledBy;
  @override
  final DateTime? cancelledAt;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;
  @override
  final DateTime? deletedAt;
  final List<PurchaseReturnItem> _items;
  @override
  @JsonKey()
  List<PurchaseReturnItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  String toString() {
    return 'PurchaseReturn(id: $id, companyId: $companyId, supplierId: $supplierId, returnNumber: $returnNumber, returnDate: $returnDate, warehouseId: $warehouseId, status: $status, subtotal: $subtotal, discountAmount: $discountAmount, taxAmount: $taxAmount, grandTotal: $grandTotal, notes: $notes, approvedBy: $approvedBy, approvedAt: $approvedAt, cancelledBy: $cancelledBy, cancelledAt: $cancelledAt, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt, items: $items)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PurchaseReturnImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.supplierId, supplierId) ||
                other.supplierId == supplierId) &&
            (identical(other.returnNumber, returnNumber) ||
                other.returnNumber == returnNumber) &&
            (identical(other.returnDate, returnDate) ||
                other.returnDate == returnDate) &&
            (identical(other.warehouseId, warehouseId) ||
                other.warehouseId == warehouseId) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.subtotal, subtotal) ||
                other.subtotal == subtotal) &&
            (identical(other.discountAmount, discountAmount) ||
                other.discountAmount == discountAmount) &&
            (identical(other.taxAmount, taxAmount) ||
                other.taxAmount == taxAmount) &&
            (identical(other.grandTotal, grandTotal) ||
                other.grandTotal == grandTotal) &&
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
        supplierId,
        returnNumber,
        returnDate,
        warehouseId,
        status,
        subtotal,
        discountAmount,
        taxAmount,
        grandTotal,
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

  /// Create a copy of PurchaseReturn
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PurchaseReturnImplCopyWith<_$PurchaseReturnImpl> get copyWith =>
      __$$PurchaseReturnImplCopyWithImpl<_$PurchaseReturnImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PurchaseReturnImplToJson(
      this,
    );
  }
}

abstract class _PurchaseReturn implements PurchaseReturn {
  const factory _PurchaseReturn(
      {required final String id,
      required final String companyId,
      required final String supplierId,
      required final String returnNumber,
      required final DateTime returnDate,
      required final String warehouseId,
      required final String status,
      required final String subtotal,
      required final String discountAmount,
      required final String taxAmount,
      required final String grandTotal,
      final String? notes,
      final String? approvedBy,
      final DateTime? approvedAt,
      final String? cancelledBy,
      final DateTime? cancelledAt,
      required final DateTime createdAt,
      required final DateTime updatedAt,
      final DateTime? deletedAt,
      final List<PurchaseReturnItem> items}) = _$PurchaseReturnImpl;

  factory _PurchaseReturn.fromJson(Map<String, dynamic> json) =
      _$PurchaseReturnImpl.fromJson;

  @override
  String get id;
  @override
  String get companyId;
  @override
  String get supplierId;
  @override
  String get returnNumber;
  @override
  DateTime get returnDate;
  @override
  String get warehouseId;
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
  String? get notes;
  @override
  String? get approvedBy;
  @override
  DateTime? get approvedAt;
  @override
  String? get cancelledBy;
  @override
  DateTime? get cancelledAt;
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;
  @override
  DateTime? get deletedAt;
  @override
  List<PurchaseReturnItem> get items;

  /// Create a copy of PurchaseReturn
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PurchaseReturnImplCopyWith<_$PurchaseReturnImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PurchaseReturnItem _$PurchaseReturnItemFromJson(Map<String, dynamic> json) {
  return _PurchaseReturnItem.fromJson(json);
}

/// @nodoc
mixin _$PurchaseReturnItem {
  String get id => throw _privateConstructorUsedError;
  String get purchaseReturnId => throw _privateConstructorUsedError;
  String get productId => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  String get unitCost => throw _privateConstructorUsedError;
  String? get discountPercent => throw _privateConstructorUsedError;
  String get discountAmount => throw _privateConstructorUsedError;
  String? get taxPercent => throw _privateConstructorUsedError;
  String get taxAmount => throw _privateConstructorUsedError;
  String get subtotal => throw _privateConstructorUsedError;
  String get total => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this PurchaseReturnItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PurchaseReturnItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PurchaseReturnItemCopyWith<PurchaseReturnItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PurchaseReturnItemCopyWith<$Res> {
  factory $PurchaseReturnItemCopyWith(
          PurchaseReturnItem value, $Res Function(PurchaseReturnItem) then) =
      _$PurchaseReturnItemCopyWithImpl<$Res, PurchaseReturnItem>;
  @useResult
  $Res call(
      {String id,
      String purchaseReturnId,
      String productId,
      int quantity,
      String unitCost,
      String? discountPercent,
      String discountAmount,
      String? taxPercent,
      String taxAmount,
      String subtotal,
      String total,
      String? notes,
      DateTime createdAt,
      DateTime updatedAt});
}

/// @nodoc
class _$PurchaseReturnItemCopyWithImpl<$Res, $Val extends PurchaseReturnItem>
    implements $PurchaseReturnItemCopyWith<$Res> {
  _$PurchaseReturnItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PurchaseReturnItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? purchaseReturnId = null,
    Object? productId = null,
    Object? quantity = null,
    Object? unitCost = null,
    Object? discountPercent = freezed,
    Object? discountAmount = null,
    Object? taxPercent = freezed,
    Object? taxAmount = null,
    Object? subtotal = null,
    Object? total = null,
    Object? notes = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseReturnId: null == purchaseReturnId
          ? _value.purchaseReturnId
          : purchaseReturnId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
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
abstract class _$$PurchaseReturnItemImplCopyWith<$Res>
    implements $PurchaseReturnItemCopyWith<$Res> {
  factory _$$PurchaseReturnItemImplCopyWith(_$PurchaseReturnItemImpl value,
          $Res Function(_$PurchaseReturnItemImpl) then) =
      __$$PurchaseReturnItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String purchaseReturnId,
      String productId,
      int quantity,
      String unitCost,
      String? discountPercent,
      String discountAmount,
      String? taxPercent,
      String taxAmount,
      String subtotal,
      String total,
      String? notes,
      DateTime createdAt,
      DateTime updatedAt});
}

/// @nodoc
class __$$PurchaseReturnItemImplCopyWithImpl<$Res>
    extends _$PurchaseReturnItemCopyWithImpl<$Res, _$PurchaseReturnItemImpl>
    implements _$$PurchaseReturnItemImplCopyWith<$Res> {
  __$$PurchaseReturnItemImplCopyWithImpl(_$PurchaseReturnItemImpl _value,
      $Res Function(_$PurchaseReturnItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of PurchaseReturnItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? purchaseReturnId = null,
    Object? productId = null,
    Object? quantity = null,
    Object? unitCost = null,
    Object? discountPercent = freezed,
    Object? discountAmount = null,
    Object? taxPercent = freezed,
    Object? taxAmount = null,
    Object? subtotal = null,
    Object? total = null,
    Object? notes = freezed,
    Object? createdAt = null,
    Object? updatedAt = null,
  }) {
    return _then(_$PurchaseReturnItemImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      purchaseReturnId: null == purchaseReturnId
          ? _value.purchaseReturnId
          : purchaseReturnId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
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
class _$PurchaseReturnItemImpl implements _PurchaseReturnItem {
  const _$PurchaseReturnItemImpl(
      {required this.id,
      required this.purchaseReturnId,
      required this.productId,
      required this.quantity,
      required this.unitCost,
      this.discountPercent,
      required this.discountAmount,
      this.taxPercent,
      required this.taxAmount,
      required this.subtotal,
      required this.total,
      this.notes,
      required this.createdAt,
      required this.updatedAt});

  factory _$PurchaseReturnItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$PurchaseReturnItemImplFromJson(json);

  @override
  final String id;
  @override
  final String purchaseReturnId;
  @override
  final String productId;
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
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  @override
  String toString() {
    return 'PurchaseReturnItem(id: $id, purchaseReturnId: $purchaseReturnId, productId: $productId, quantity: $quantity, unitCost: $unitCost, discountPercent: $discountPercent, discountAmount: $discountAmount, taxPercent: $taxPercent, taxAmount: $taxAmount, subtotal: $subtotal, total: $total, notes: $notes, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PurchaseReturnItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.purchaseReturnId, purchaseReturnId) ||
                other.purchaseReturnId == purchaseReturnId) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
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
            (identical(other.notes, notes) || other.notes == notes) &&
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
      purchaseReturnId,
      productId,
      quantity,
      unitCost,
      discountPercent,
      discountAmount,
      taxPercent,
      taxAmount,
      subtotal,
      total,
      notes,
      createdAt,
      updatedAt);

  /// Create a copy of PurchaseReturnItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PurchaseReturnItemImplCopyWith<_$PurchaseReturnItemImpl> get copyWith =>
      __$$PurchaseReturnItemImplCopyWithImpl<_$PurchaseReturnItemImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PurchaseReturnItemImplToJson(
      this,
    );
  }
}

abstract class _PurchaseReturnItem implements PurchaseReturnItem {
  const factory _PurchaseReturnItem(
      {required final String id,
      required final String purchaseReturnId,
      required final String productId,
      required final int quantity,
      required final String unitCost,
      final String? discountPercent,
      required final String discountAmount,
      final String? taxPercent,
      required final String taxAmount,
      required final String subtotal,
      required final String total,
      final String? notes,
      required final DateTime createdAt,
      required final DateTime updatedAt}) = _$PurchaseReturnItemImpl;

  factory _PurchaseReturnItem.fromJson(Map<String, dynamic> json) =
      _$PurchaseReturnItemImpl.fromJson;

  @override
  String get id;
  @override
  String get purchaseReturnId;
  @override
  String get productId;
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
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;

  /// Create a copy of PurchaseReturnItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PurchaseReturnItemImplCopyWith<_$PurchaseReturnItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PurchaseReturnListResponse _$PurchaseReturnListResponseFromJson(
    Map<String, dynamic> json) {
  return _PurchaseReturnListResponse.fromJson(json);
}

/// @nodoc
mixin _$PurchaseReturnListResponse {
  List<PurchaseReturn> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this PurchaseReturnListResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PurchaseReturnListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PurchaseReturnListResponseCopyWith<PurchaseReturnListResponse>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PurchaseReturnListResponseCopyWith<$Res> {
  factory $PurchaseReturnListResponseCopyWith(PurchaseReturnListResponse value,
          $Res Function(PurchaseReturnListResponse) then) =
      _$PurchaseReturnListResponseCopyWithImpl<$Res,
          PurchaseReturnListResponse>;
  @useResult
  $Res call({List<PurchaseReturn> items, int total, int page, int limit});
}

/// @nodoc
class _$PurchaseReturnListResponseCopyWithImpl<$Res,
        $Val extends PurchaseReturnListResponse>
    implements $PurchaseReturnListResponseCopyWith<$Res> {
  _$PurchaseReturnListResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PurchaseReturnListResponse
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
              as List<PurchaseReturn>,
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
abstract class _$$PurchaseReturnListResponseImplCopyWith<$Res>
    implements $PurchaseReturnListResponseCopyWith<$Res> {
  factory _$$PurchaseReturnListResponseImplCopyWith(
          _$PurchaseReturnListResponseImpl value,
          $Res Function(_$PurchaseReturnListResponseImpl) then) =
      __$$PurchaseReturnListResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<PurchaseReturn> items, int total, int page, int limit});
}

/// @nodoc
class __$$PurchaseReturnListResponseImplCopyWithImpl<$Res>
    extends _$PurchaseReturnListResponseCopyWithImpl<$Res,
        _$PurchaseReturnListResponseImpl>
    implements _$$PurchaseReturnListResponseImplCopyWith<$Res> {
  __$$PurchaseReturnListResponseImplCopyWithImpl(
      _$PurchaseReturnListResponseImpl _value,
      $Res Function(_$PurchaseReturnListResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of PurchaseReturnListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$PurchaseReturnListResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<PurchaseReturn>,
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
class _$PurchaseReturnListResponseImpl implements _PurchaseReturnListResponse {
  const _$PurchaseReturnListResponseImpl(
      {required final List<PurchaseReturn> items,
      required this.total,
      required this.page,
      required this.limit})
      : _items = items;

  factory _$PurchaseReturnListResponseImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$PurchaseReturnListResponseImplFromJson(json);

  final List<PurchaseReturn> _items;
  @override
  List<PurchaseReturn> get items {
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
    return 'PurchaseReturnListResponse(items: $items, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PurchaseReturnListResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_items), total, page, limit);

  /// Create a copy of PurchaseReturnListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PurchaseReturnListResponseImplCopyWith<_$PurchaseReturnListResponseImpl>
      get copyWith => __$$PurchaseReturnListResponseImplCopyWithImpl<
          _$PurchaseReturnListResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PurchaseReturnListResponseImplToJson(
      this,
    );
  }
}

abstract class _PurchaseReturnListResponse
    implements PurchaseReturnListResponse {
  const factory _PurchaseReturnListResponse(
      {required final List<PurchaseReturn> items,
      required final int total,
      required final int page,
      required final int limit}) = _$PurchaseReturnListResponseImpl;

  factory _PurchaseReturnListResponse.fromJson(Map<String, dynamic> json) =
      _$PurchaseReturnListResponseImpl.fromJson;

  @override
  List<PurchaseReturn> get items;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of PurchaseReturnListResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PurchaseReturnListResponseImplCopyWith<_$PurchaseReturnListResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}
