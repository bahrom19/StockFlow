// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'inventory_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

Warehouse _$WarehouseFromJson(Map<String, dynamic> json) {
  return _Warehouse.fromJson(json);
}

/// @nodoc
mixin _$Warehouse {
  String get id => throw _privateConstructorUsedError;
  String get companyId => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String get code => throw _privateConstructorUsedError;
  String? get address => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  String? get managerName => throw _privateConstructorUsedError;
  bool get isDefault => throw _privateConstructorUsedError;
  bool get isActive => throw _privateConstructorUsedError;
  int get rowVersion => throw _privateConstructorUsedError;
  String get createdAt => throw _privateConstructorUsedError;
  String get updatedAt => throw _privateConstructorUsedError;
  String? get deletedAt => throw _privateConstructorUsedError;

  /// Serializes this Warehouse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Warehouse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WarehouseCopyWith<Warehouse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WarehouseCopyWith<$Res> {
  factory $WarehouseCopyWith(Warehouse value, $Res Function(Warehouse) then) =
      _$WarehouseCopyWithImpl<$Res, Warehouse>;
  @useResult
  $Res call(
      {String id,
      String companyId,
      String name,
      String code,
      String? address,
      String? phone,
      String? managerName,
      bool isDefault,
      bool isActive,
      int rowVersion,
      String createdAt,
      String updatedAt,
      String? deletedAt});
}

/// @nodoc
class _$WarehouseCopyWithImpl<$Res, $Val extends Warehouse>
    implements $WarehouseCopyWith<$Res> {
  _$WarehouseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Warehouse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? name = null,
    Object? code = null,
    Object? address = freezed,
    Object? phone = freezed,
    Object? managerName = freezed,
    Object? isDefault = null,
    Object? isActive = null,
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
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      code: null == code
          ? _value.code
          : code // ignore: cast_nullable_to_non_nullable
              as String,
      address: freezed == address
          ? _value.address
          : address // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      managerName: freezed == managerName
          ? _value.managerName
          : managerName // ignore: cast_nullable_to_non_nullable
              as String?,
      isDefault: null == isDefault
          ? _value.isDefault
          : isDefault // ignore: cast_nullable_to_non_nullable
              as bool,
      isActive: null == isActive
          ? _value.isActive
          : isActive // ignore: cast_nullable_to_non_nullable
              as bool,
      rowVersion: null == rowVersion
          ? _value.rowVersion
          : rowVersion // ignore: cast_nullable_to_non_nullable
              as int,
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
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$WarehouseImplCopyWith<$Res>
    implements $WarehouseCopyWith<$Res> {
  factory _$$WarehouseImplCopyWith(
          _$WarehouseImpl value, $Res Function(_$WarehouseImpl) then) =
      __$$WarehouseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String companyId,
      String name,
      String code,
      String? address,
      String? phone,
      String? managerName,
      bool isDefault,
      bool isActive,
      int rowVersion,
      String createdAt,
      String updatedAt,
      String? deletedAt});
}

/// @nodoc
class __$$WarehouseImplCopyWithImpl<$Res>
    extends _$WarehouseCopyWithImpl<$Res, _$WarehouseImpl>
    implements _$$WarehouseImplCopyWith<$Res> {
  __$$WarehouseImplCopyWithImpl(
      _$WarehouseImpl _value, $Res Function(_$WarehouseImpl) _then)
      : super(_value, _then);

  /// Create a copy of Warehouse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? name = null,
    Object? code = null,
    Object? address = freezed,
    Object? phone = freezed,
    Object? managerName = freezed,
    Object? isDefault = null,
    Object? isActive = null,
    Object? rowVersion = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
  }) {
    return _then(_$WarehouseImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      companyId: null == companyId
          ? _value.companyId
          : companyId // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      code: null == code
          ? _value.code
          : code // ignore: cast_nullable_to_non_nullable
              as String,
      address: freezed == address
          ? _value.address
          : address // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      managerName: freezed == managerName
          ? _value.managerName
          : managerName // ignore: cast_nullable_to_non_nullable
              as String?,
      isDefault: null == isDefault
          ? _value.isDefault
          : isDefault // ignore: cast_nullable_to_non_nullable
              as bool,
      isActive: null == isActive
          ? _value.isActive
          : isActive // ignore: cast_nullable_to_non_nullable
              as bool,
      rowVersion: null == rowVersion
          ? _value.rowVersion
          : rowVersion // ignore: cast_nullable_to_non_nullable
              as int,
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
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$WarehouseImpl implements _Warehouse {
  const _$WarehouseImpl(
      {required this.id,
      required this.companyId,
      required this.name,
      required this.code,
      this.address,
      this.phone,
      this.managerName,
      this.isDefault = false,
      this.isActive = true,
      this.rowVersion = 0,
      required this.createdAt,
      required this.updatedAt,
      this.deletedAt});

  factory _$WarehouseImpl.fromJson(Map<String, dynamic> json) =>
      _$$WarehouseImplFromJson(json);

  @override
  final String id;
  @override
  final String companyId;
  @override
  final String name;
  @override
  final String code;
  @override
  final String? address;
  @override
  final String? phone;
  @override
  final String? managerName;
  @override
  @JsonKey()
  final bool isDefault;
  @override
  @JsonKey()
  final bool isActive;
  @override
  @JsonKey()
  final int rowVersion;
  @override
  final String createdAt;
  @override
  final String updatedAt;
  @override
  final String? deletedAt;

  @override
  String toString() {
    return 'Warehouse(id: $id, companyId: $companyId, name: $name, code: $code, address: $address, phone: $phone, managerName: $managerName, isDefault: $isDefault, isActive: $isActive, rowVersion: $rowVersion, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WarehouseImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.code, code) || other.code == code) &&
            (identical(other.address, address) || other.address == address) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.managerName, managerName) ||
                other.managerName == managerName) &&
            (identical(other.isDefault, isDefault) ||
                other.isDefault == isDefault) &&
            (identical(other.isActive, isActive) ||
                other.isActive == isActive) &&
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
      name,
      code,
      address,
      phone,
      managerName,
      isDefault,
      isActive,
      rowVersion,
      createdAt,
      updatedAt,
      deletedAt);

  /// Create a copy of Warehouse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WarehouseImplCopyWith<_$WarehouseImpl> get copyWith =>
      __$$WarehouseImplCopyWithImpl<_$WarehouseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WarehouseImplToJson(
      this,
    );
  }
}

abstract class _Warehouse implements Warehouse {
  const factory _Warehouse(
      {required final String id,
      required final String companyId,
      required final String name,
      required final String code,
      final String? address,
      final String? phone,
      final String? managerName,
      final bool isDefault,
      final bool isActive,
      final int rowVersion,
      required final String createdAt,
      required final String updatedAt,
      final String? deletedAt}) = _$WarehouseImpl;

  factory _Warehouse.fromJson(Map<String, dynamic> json) =
      _$WarehouseImpl.fromJson;

  @override
  String get id;
  @override
  String get companyId;
  @override
  String get name;
  @override
  String get code;
  @override
  String? get address;
  @override
  String? get phone;
  @override
  String? get managerName;
  @override
  bool get isDefault;
  @override
  bool get isActive;
  @override
  int get rowVersion;
  @override
  String get createdAt;
  @override
  String get updatedAt;
  @override
  String? get deletedAt;

  /// Create a copy of Warehouse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WarehouseImplCopyWith<_$WarehouseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

StockItem _$StockItemFromJson(Map<String, dynamic> json) {
  return _StockItem.fromJson(json);
}

/// @nodoc
mixin _$StockItem {
  String get id => throw _privateConstructorUsedError;
  String get companyId => throw _privateConstructorUsedError;
  String get productId => throw _privateConstructorUsedError;
  String get warehouseId => throw _privateConstructorUsedError;
  String get productName => throw _privateConstructorUsedError;
  String get productSku => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  int get reservedQuantity => throw _privateConstructorUsedError;
  int get availableQuantity => throw _privateConstructorUsedError;
  int get minQuantity => throw _privateConstructorUsedError;
  int get maxQuantity => throw _privateConstructorUsedError;
  int get rowVersion => throw _privateConstructorUsedError;
  String get createdAt => throw _privateConstructorUsedError;
  String get updatedAt => throw _privateConstructorUsedError;
  Warehouse? get warehouse => throw _privateConstructorUsedError;

  /// Serializes this StockItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of StockItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $StockItemCopyWith<StockItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $StockItemCopyWith<$Res> {
  factory $StockItemCopyWith(StockItem value, $Res Function(StockItem) then) =
      _$StockItemCopyWithImpl<$Res, StockItem>;
  @useResult
  $Res call(
      {String id,
      String companyId,
      String productId,
      String warehouseId,
      String productName,
      String productSku,
      int quantity,
      int reservedQuantity,
      int availableQuantity,
      int minQuantity,
      int maxQuantity,
      int rowVersion,
      String createdAt,
      String updatedAt,
      Warehouse? warehouse});

  $WarehouseCopyWith<$Res>? get warehouse;
}

/// @nodoc
class _$StockItemCopyWithImpl<$Res, $Val extends StockItem>
    implements $StockItemCopyWith<$Res> {
  _$StockItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of StockItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? productId = null,
    Object? warehouseId = null,
    Object? productName = null,
    Object? productSku = null,
    Object? quantity = null,
    Object? reservedQuantity = null,
    Object? availableQuantity = null,
    Object? minQuantity = null,
    Object? maxQuantity = null,
    Object? rowVersion = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? warehouse = freezed,
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
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      productName: null == productName
          ? _value.productName
          : productName // ignore: cast_nullable_to_non_nullable
              as String,
      productSku: null == productSku
          ? _value.productSku
          : productSku // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      reservedQuantity: null == reservedQuantity
          ? _value.reservedQuantity
          : reservedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      availableQuantity: null == availableQuantity
          ? _value.availableQuantity
          : availableQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      minQuantity: null == minQuantity
          ? _value.minQuantity
          : minQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      maxQuantity: null == maxQuantity
          ? _value.maxQuantity
          : maxQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      rowVersion: null == rowVersion
          ? _value.rowVersion
          : rowVersion // ignore: cast_nullable_to_non_nullable
              as int,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String,
      warehouse: freezed == warehouse
          ? _value.warehouse
          : warehouse // ignore: cast_nullable_to_non_nullable
              as Warehouse?,
    ) as $Val);
  }

  /// Create a copy of StockItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $WarehouseCopyWith<$Res>? get warehouse {
    if (_value.warehouse == null) {
      return null;
    }

    return $WarehouseCopyWith<$Res>(_value.warehouse!, (value) {
      return _then(_value.copyWith(warehouse: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$StockItemImplCopyWith<$Res>
    implements $StockItemCopyWith<$Res> {
  factory _$$StockItemImplCopyWith(
          _$StockItemImpl value, $Res Function(_$StockItemImpl) then) =
      __$$StockItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String companyId,
      String productId,
      String warehouseId,
      String productName,
      String productSku,
      int quantity,
      int reservedQuantity,
      int availableQuantity,
      int minQuantity,
      int maxQuantity,
      int rowVersion,
      String createdAt,
      String updatedAt,
      Warehouse? warehouse});

  @override
  $WarehouseCopyWith<$Res>? get warehouse;
}

/// @nodoc
class __$$StockItemImplCopyWithImpl<$Res>
    extends _$StockItemCopyWithImpl<$Res, _$StockItemImpl>
    implements _$$StockItemImplCopyWith<$Res> {
  __$$StockItemImplCopyWithImpl(
      _$StockItemImpl _value, $Res Function(_$StockItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of StockItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? productId = null,
    Object? warehouseId = null,
    Object? productName = null,
    Object? productSku = null,
    Object? quantity = null,
    Object? reservedQuantity = null,
    Object? availableQuantity = null,
    Object? minQuantity = null,
    Object? maxQuantity = null,
    Object? rowVersion = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? warehouse = freezed,
  }) {
    return _then(_$StockItemImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      companyId: null == companyId
          ? _value.companyId
          : companyId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      productName: null == productName
          ? _value.productName
          : productName // ignore: cast_nullable_to_non_nullable
              as String,
      productSku: null == productSku
          ? _value.productSku
          : productSku // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      reservedQuantity: null == reservedQuantity
          ? _value.reservedQuantity
          : reservedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      availableQuantity: null == availableQuantity
          ? _value.availableQuantity
          : availableQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      minQuantity: null == minQuantity
          ? _value.minQuantity
          : minQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      maxQuantity: null == maxQuantity
          ? _value.maxQuantity
          : maxQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      rowVersion: null == rowVersion
          ? _value.rowVersion
          : rowVersion // ignore: cast_nullable_to_non_nullable
              as int,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      updatedAt: null == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as String,
      warehouse: freezed == warehouse
          ? _value.warehouse
          : warehouse // ignore: cast_nullable_to_non_nullable
              as Warehouse?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$StockItemImpl implements _StockItem {
  const _$StockItemImpl(
      {required this.id,
      required this.companyId,
      required this.productId,
      required this.warehouseId,
      this.productName = '',
      this.productSku = '',
      this.quantity = 0,
      this.reservedQuantity = 0,
      this.availableQuantity = 0,
      this.minQuantity = 5,
      this.maxQuantity = 200,
      this.rowVersion = 0,
      required this.createdAt,
      required this.updatedAt,
      this.warehouse});

  factory _$StockItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$StockItemImplFromJson(json);

  @override
  final String id;
  @override
  final String companyId;
  @override
  final String productId;
  @override
  final String warehouseId;
  @override
  @JsonKey()
  final String productName;
  @override
  @JsonKey()
  final String productSku;
  @override
  @JsonKey()
  final int quantity;
  @override
  @JsonKey()
  final int reservedQuantity;
  @override
  @JsonKey()
  final int availableQuantity;
  @override
  @JsonKey()
  final int minQuantity;
  @override
  @JsonKey()
  final int maxQuantity;
  @override
  @JsonKey()
  final int rowVersion;
  @override
  final String createdAt;
  @override
  final String updatedAt;
  @override
  final Warehouse? warehouse;

  @override
  String toString() {
    return 'StockItem(id: $id, companyId: $companyId, productId: $productId, warehouseId: $warehouseId, productName: $productName, productSku: $productSku, quantity: $quantity, reservedQuantity: $reservedQuantity, availableQuantity: $availableQuantity, minQuantity: $minQuantity, maxQuantity: $maxQuantity, rowVersion: $rowVersion, createdAt: $createdAt, updatedAt: $updatedAt, warehouse: $warehouse)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$StockItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.warehouseId, warehouseId) ||
                other.warehouseId == warehouseId) &&
            (identical(other.productName, productName) ||
                other.productName == productName) &&
            (identical(other.productSku, productSku) ||
                other.productSku == productSku) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.reservedQuantity, reservedQuantity) ||
                other.reservedQuantity == reservedQuantity) &&
            (identical(other.availableQuantity, availableQuantity) ||
                other.availableQuantity == availableQuantity) &&
            (identical(other.minQuantity, minQuantity) ||
                other.minQuantity == minQuantity) &&
            (identical(other.maxQuantity, maxQuantity) ||
                other.maxQuantity == maxQuantity) &&
            (identical(other.rowVersion, rowVersion) ||
                other.rowVersion == rowVersion) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.warehouse, warehouse) ||
                other.warehouse == warehouse));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      companyId,
      productId,
      warehouseId,
      productName,
      productSku,
      quantity,
      reservedQuantity,
      availableQuantity,
      minQuantity,
      maxQuantity,
      rowVersion,
      createdAt,
      updatedAt,
      warehouse);

  /// Create a copy of StockItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$StockItemImplCopyWith<_$StockItemImpl> get copyWith =>
      __$$StockItemImplCopyWithImpl<_$StockItemImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$StockItemImplToJson(
      this,
    );
  }
}

abstract class _StockItem implements StockItem {
  const factory _StockItem(
      {required final String id,
      required final String companyId,
      required final String productId,
      required final String warehouseId,
      final String productName,
      final String productSku,
      final int quantity,
      final int reservedQuantity,
      final int availableQuantity,
      final int minQuantity,
      final int maxQuantity,
      final int rowVersion,
      required final String createdAt,
      required final String updatedAt,
      final Warehouse? warehouse}) = _$StockItemImpl;

  factory _StockItem.fromJson(Map<String, dynamic> json) =
      _$StockItemImpl.fromJson;

  @override
  String get id;
  @override
  String get companyId;
  @override
  String get productId;
  @override
  String get warehouseId;
  @override
  String get productName;
  @override
  String get productSku;
  @override
  int get quantity;
  @override
  int get reservedQuantity;
  @override
  int get availableQuantity;
  @override
  int get minQuantity;
  @override
  int get maxQuantity;
  @override
  int get rowVersion;
  @override
  String get createdAt;
  @override
  String get updatedAt;
  @override
  Warehouse? get warehouse;

  /// Create a copy of StockItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$StockItemImplCopyWith<_$StockItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

StockListResponse _$StockListResponseFromJson(Map<String, dynamic> json) {
  return _StockListResponse.fromJson(json);
}

/// @nodoc
mixin _$StockListResponse {
  List<StockItem> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;

  /// Serializes this StockListResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of StockListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $StockListResponseCopyWith<StockListResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $StockListResponseCopyWith<$Res> {
  factory $StockListResponseCopyWith(
          StockListResponse value, $Res Function(StockListResponse) then) =
      _$StockListResponseCopyWithImpl<$Res, StockListResponse>;
  @useResult
  $Res call({List<StockItem> items, int total});
}

/// @nodoc
class _$StockListResponseCopyWithImpl<$Res, $Val extends StockListResponse>
    implements $StockListResponseCopyWith<$Res> {
  _$StockListResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of StockListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
  }) {
    return _then(_value.copyWith(
      items: null == items
          ? _value.items
          : items // ignore: cast_nullable_to_non_nullable
              as List<StockItem>,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$StockListResponseImplCopyWith<$Res>
    implements $StockListResponseCopyWith<$Res> {
  factory _$$StockListResponseImplCopyWith(_$StockListResponseImpl value,
          $Res Function(_$StockListResponseImpl) then) =
      __$$StockListResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<StockItem> items, int total});
}

/// @nodoc
class __$$StockListResponseImplCopyWithImpl<$Res>
    extends _$StockListResponseCopyWithImpl<$Res, _$StockListResponseImpl>
    implements _$$StockListResponseImplCopyWith<$Res> {
  __$$StockListResponseImplCopyWithImpl(_$StockListResponseImpl _value,
      $Res Function(_$StockListResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of StockListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
  }) {
    return _then(_$StockListResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<StockItem>,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$StockListResponseImpl implements _StockListResponse {
  const _$StockListResponseImpl(
      {required final List<StockItem> items, required this.total})
      : _items = items;

  factory _$StockListResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$StockListResponseImplFromJson(json);

  final List<StockItem> _items;
  @override
  List<StockItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  final int total;

  @override
  String toString() {
    return 'StockListResponse(items: $items, total: $total)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$StockListResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, const DeepCollectionEquality().hash(_items), total);

  /// Create a copy of StockListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$StockListResponseImplCopyWith<_$StockListResponseImpl> get copyWith =>
      __$$StockListResponseImplCopyWithImpl<_$StockListResponseImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$StockListResponseImplToJson(
      this,
    );
  }
}

abstract class _StockListResponse implements StockListResponse {
  const factory _StockListResponse(
      {required final List<StockItem> items,
      required final int total}) = _$StockListResponseImpl;

  factory _StockListResponse.fromJson(Map<String, dynamic> json) =
      _$StockListResponseImpl.fromJson;

  @override
  List<StockItem> get items;
  @override
  int get total;

  /// Create a copy of StockListResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$StockListResponseImplCopyWith<_$StockListResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

StockMovement _$StockMovementFromJson(Map<String, dynamic> json) {
  return _StockMovement.fromJson(json);
}

/// @nodoc
mixin _$StockMovement {
  String get id => throw _privateConstructorUsedError;
  String get companyId => throw _privateConstructorUsedError;
  String get productId => throw _privateConstructorUsedError;
  String get warehouseId => throw _privateConstructorUsedError;
  String get type => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  int get beforeQuantity => throw _privateConstructorUsedError;
  int get afterQuantity => throw _privateConstructorUsedError;
  String? get referenceType => throw _privateConstructorUsedError;
  String? get referenceId => throw _privateConstructorUsedError;
  String? get comment => throw _privateConstructorUsedError;
  String? get createdBy => throw _privateConstructorUsedError;
  String get createdAt => throw _privateConstructorUsedError;

  /// Serializes this StockMovement to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of StockMovement
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $StockMovementCopyWith<StockMovement> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $StockMovementCopyWith<$Res> {
  factory $StockMovementCopyWith(
          StockMovement value, $Res Function(StockMovement) then) =
      _$StockMovementCopyWithImpl<$Res, StockMovement>;
  @useResult
  $Res call(
      {String id,
      String companyId,
      String productId,
      String warehouseId,
      String type,
      int quantity,
      int beforeQuantity,
      int afterQuantity,
      String? referenceType,
      String? referenceId,
      String? comment,
      String? createdBy,
      String createdAt});
}

/// @nodoc
class _$StockMovementCopyWithImpl<$Res, $Val extends StockMovement>
    implements $StockMovementCopyWith<$Res> {
  _$StockMovementCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of StockMovement
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? productId = null,
    Object? warehouseId = null,
    Object? type = null,
    Object? quantity = null,
    Object? beforeQuantity = null,
    Object? afterQuantity = null,
    Object? referenceType = freezed,
    Object? referenceId = freezed,
    Object? comment = freezed,
    Object? createdBy = freezed,
    Object? createdAt = null,
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
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      beforeQuantity: null == beforeQuantity
          ? _value.beforeQuantity
          : beforeQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      afterQuantity: null == afterQuantity
          ? _value.afterQuantity
          : afterQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      referenceType: freezed == referenceType
          ? _value.referenceType
          : referenceType // ignore: cast_nullable_to_non_nullable
              as String?,
      referenceId: freezed == referenceId
          ? _value.referenceId
          : referenceId // ignore: cast_nullable_to_non_nullable
              as String?,
      comment: freezed == comment
          ? _value.comment
          : comment // ignore: cast_nullable_to_non_nullable
              as String?,
      createdBy: freezed == createdBy
          ? _value.createdBy
          : createdBy // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$StockMovementImplCopyWith<$Res>
    implements $StockMovementCopyWith<$Res> {
  factory _$$StockMovementImplCopyWith(
          _$StockMovementImpl value, $Res Function(_$StockMovementImpl) then) =
      __$$StockMovementImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String companyId,
      String productId,
      String warehouseId,
      String type,
      int quantity,
      int beforeQuantity,
      int afterQuantity,
      String? referenceType,
      String? referenceId,
      String? comment,
      String? createdBy,
      String createdAt});
}

/// @nodoc
class __$$StockMovementImplCopyWithImpl<$Res>
    extends _$StockMovementCopyWithImpl<$Res, _$StockMovementImpl>
    implements _$$StockMovementImplCopyWith<$Res> {
  __$$StockMovementImplCopyWithImpl(
      _$StockMovementImpl _value, $Res Function(_$StockMovementImpl) _then)
      : super(_value, _then);

  /// Create a copy of StockMovement
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? productId = null,
    Object? warehouseId = null,
    Object? type = null,
    Object? quantity = null,
    Object? beforeQuantity = null,
    Object? afterQuantity = null,
    Object? referenceType = freezed,
    Object? referenceId = freezed,
    Object? comment = freezed,
    Object? createdBy = freezed,
    Object? createdAt = null,
  }) {
    return _then(_$StockMovementImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      companyId: null == companyId
          ? _value.companyId
          : companyId // ignore: cast_nullable_to_non_nullable
              as String,
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      beforeQuantity: null == beforeQuantity
          ? _value.beforeQuantity
          : beforeQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      afterQuantity: null == afterQuantity
          ? _value.afterQuantity
          : afterQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      referenceType: freezed == referenceType
          ? _value.referenceType
          : referenceType // ignore: cast_nullable_to_non_nullable
              as String?,
      referenceId: freezed == referenceId
          ? _value.referenceId
          : referenceId // ignore: cast_nullable_to_non_nullable
              as String?,
      comment: freezed == comment
          ? _value.comment
          : comment // ignore: cast_nullable_to_non_nullable
              as String?,
      createdBy: freezed == createdBy
          ? _value.createdBy
          : createdBy // ignore: cast_nullable_to_non_nullable
              as String?,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$StockMovementImpl implements _StockMovement {
  const _$StockMovementImpl(
      {required this.id,
      required this.companyId,
      required this.productId,
      required this.warehouseId,
      required this.type,
      required this.quantity,
      required this.beforeQuantity,
      required this.afterQuantity,
      this.referenceType,
      this.referenceId,
      this.comment,
      this.createdBy,
      required this.createdAt});

  factory _$StockMovementImpl.fromJson(Map<String, dynamic> json) =>
      _$$StockMovementImplFromJson(json);

  @override
  final String id;
  @override
  final String companyId;
  @override
  final String productId;
  @override
  final String warehouseId;
  @override
  final String type;
  @override
  final int quantity;
  @override
  final int beforeQuantity;
  @override
  final int afterQuantity;
  @override
  final String? referenceType;
  @override
  final String? referenceId;
  @override
  final String? comment;
  @override
  final String? createdBy;
  @override
  final String createdAt;

  @override
  String toString() {
    return 'StockMovement(id: $id, companyId: $companyId, productId: $productId, warehouseId: $warehouseId, type: $type, quantity: $quantity, beforeQuantity: $beforeQuantity, afterQuantity: $afterQuantity, referenceType: $referenceType, referenceId: $referenceId, comment: $comment, createdBy: $createdBy, createdAt: $createdAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$StockMovementImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.warehouseId, warehouseId) ||
                other.warehouseId == warehouseId) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.beforeQuantity, beforeQuantity) ||
                other.beforeQuantity == beforeQuantity) &&
            (identical(other.afterQuantity, afterQuantity) ||
                other.afterQuantity == afterQuantity) &&
            (identical(other.referenceType, referenceType) ||
                other.referenceType == referenceType) &&
            (identical(other.referenceId, referenceId) ||
                other.referenceId == referenceId) &&
            (identical(other.comment, comment) || other.comment == comment) &&
            (identical(other.createdBy, createdBy) ||
                other.createdBy == createdBy) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      companyId,
      productId,
      warehouseId,
      type,
      quantity,
      beforeQuantity,
      afterQuantity,
      referenceType,
      referenceId,
      comment,
      createdBy,
      createdAt);

  /// Create a copy of StockMovement
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$StockMovementImplCopyWith<_$StockMovementImpl> get copyWith =>
      __$$StockMovementImplCopyWithImpl<_$StockMovementImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$StockMovementImplToJson(
      this,
    );
  }
}

abstract class _StockMovement implements StockMovement {
  const factory _StockMovement(
      {required final String id,
      required final String companyId,
      required final String productId,
      required final String warehouseId,
      required final String type,
      required final int quantity,
      required final int beforeQuantity,
      required final int afterQuantity,
      final String? referenceType,
      final String? referenceId,
      final String? comment,
      final String? createdBy,
      required final String createdAt}) = _$StockMovementImpl;

  factory _StockMovement.fromJson(Map<String, dynamic> json) =
      _$StockMovementImpl.fromJson;

  @override
  String get id;
  @override
  String get companyId;
  @override
  String get productId;
  @override
  String get warehouseId;
  @override
  String get type;
  @override
  int get quantity;
  @override
  int get beforeQuantity;
  @override
  int get afterQuantity;
  @override
  String? get referenceType;
  @override
  String? get referenceId;
  @override
  String? get comment;
  @override
  String? get createdBy;
  @override
  String get createdAt;

  /// Create a copy of StockMovement
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$StockMovementImplCopyWith<_$StockMovementImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CreateWarehouseRequest _$CreateWarehouseRequestFromJson(
    Map<String, dynamic> json) {
  return _CreateWarehouseRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateWarehouseRequest {
  String get name => throw _privateConstructorUsedError;
  String get code => throw _privateConstructorUsedError;
  String? get address => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  String? get managerName => throw _privateConstructorUsedError;
  bool get isDefault => throw _privateConstructorUsedError;

  /// Serializes this CreateWarehouseRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateWarehouseRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateWarehouseRequestCopyWith<CreateWarehouseRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateWarehouseRequestCopyWith<$Res> {
  factory $CreateWarehouseRequestCopyWith(CreateWarehouseRequest value,
          $Res Function(CreateWarehouseRequest) then) =
      _$CreateWarehouseRequestCopyWithImpl<$Res, CreateWarehouseRequest>;
  @useResult
  $Res call(
      {String name,
      String code,
      String? address,
      String? phone,
      String? managerName,
      bool isDefault});
}

/// @nodoc
class _$CreateWarehouseRequestCopyWithImpl<$Res,
        $Val extends CreateWarehouseRequest>
    implements $CreateWarehouseRequestCopyWith<$Res> {
  _$CreateWarehouseRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateWarehouseRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? code = null,
    Object? address = freezed,
    Object? phone = freezed,
    Object? managerName = freezed,
    Object? isDefault = null,
  }) {
    return _then(_value.copyWith(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      code: null == code
          ? _value.code
          : code // ignore: cast_nullable_to_non_nullable
              as String,
      address: freezed == address
          ? _value.address
          : address // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      managerName: freezed == managerName
          ? _value.managerName
          : managerName // ignore: cast_nullable_to_non_nullable
              as String?,
      isDefault: null == isDefault
          ? _value.isDefault
          : isDefault // ignore: cast_nullable_to_non_nullable
              as bool,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreateWarehouseRequestImplCopyWith<$Res>
    implements $CreateWarehouseRequestCopyWith<$Res> {
  factory _$$CreateWarehouseRequestImplCopyWith(
          _$CreateWarehouseRequestImpl value,
          $Res Function(_$CreateWarehouseRequestImpl) then) =
      __$$CreateWarehouseRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String name,
      String code,
      String? address,
      String? phone,
      String? managerName,
      bool isDefault});
}

/// @nodoc
class __$$CreateWarehouseRequestImplCopyWithImpl<$Res>
    extends _$CreateWarehouseRequestCopyWithImpl<$Res,
        _$CreateWarehouseRequestImpl>
    implements _$$CreateWarehouseRequestImplCopyWith<$Res> {
  __$$CreateWarehouseRequestImplCopyWithImpl(
      _$CreateWarehouseRequestImpl _value,
      $Res Function(_$CreateWarehouseRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreateWarehouseRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = null,
    Object? code = null,
    Object? address = freezed,
    Object? phone = freezed,
    Object? managerName = freezed,
    Object? isDefault = null,
  }) {
    return _then(_$CreateWarehouseRequestImpl(
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      code: null == code
          ? _value.code
          : code // ignore: cast_nullable_to_non_nullable
              as String,
      address: freezed == address
          ? _value.address
          : address // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      managerName: freezed == managerName
          ? _value.managerName
          : managerName // ignore: cast_nullable_to_non_nullable
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
class _$CreateWarehouseRequestImpl implements _CreateWarehouseRequest {
  const _$CreateWarehouseRequestImpl(
      {required this.name,
      required this.code,
      this.address,
      this.phone,
      this.managerName,
      this.isDefault = false});

  factory _$CreateWarehouseRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$CreateWarehouseRequestImplFromJson(json);

  @override
  final String name;
  @override
  final String code;
  @override
  final String? address;
  @override
  final String? phone;
  @override
  final String? managerName;
  @override
  @JsonKey()
  final bool isDefault;

  @override
  String toString() {
    return 'CreateWarehouseRequest(name: $name, code: $code, address: $address, phone: $phone, managerName: $managerName, isDefault: $isDefault)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateWarehouseRequestImpl &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.code, code) || other.code == code) &&
            (identical(other.address, address) || other.address == address) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.managerName, managerName) ||
                other.managerName == managerName) &&
            (identical(other.isDefault, isDefault) ||
                other.isDefault == isDefault));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, name, code, address, phone, managerName, isDefault);

  /// Create a copy of CreateWarehouseRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateWarehouseRequestImplCopyWith<_$CreateWarehouseRequestImpl>
      get copyWith => __$$CreateWarehouseRequestImplCopyWithImpl<
          _$CreateWarehouseRequestImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateWarehouseRequestImplToJson(
      this,
    );
  }
}

abstract class _CreateWarehouseRequest implements CreateWarehouseRequest {
  const factory _CreateWarehouseRequest(
      {required final String name,
      required final String code,
      final String? address,
      final String? phone,
      final String? managerName,
      final bool isDefault}) = _$CreateWarehouseRequestImpl;

  factory _CreateWarehouseRequest.fromJson(Map<String, dynamic> json) =
      _$CreateWarehouseRequestImpl.fromJson;

  @override
  String get name;
  @override
  String get code;
  @override
  String? get address;
  @override
  String? get phone;
  @override
  String? get managerName;
  @override
  bool get isDefault;

  /// Create a copy of CreateWarehouseRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateWarehouseRequestImplCopyWith<_$CreateWarehouseRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}

UpdateWarehouseRequest _$UpdateWarehouseRequestFromJson(
    Map<String, dynamic> json) {
  return _UpdateWarehouseRequest.fromJson(json);
}

/// @nodoc
mixin _$UpdateWarehouseRequest {
  String? get name => throw _privateConstructorUsedError;
  String? get code => throw _privateConstructorUsedError;
  String? get address => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  String? get managerName => throw _privateConstructorUsedError;
  bool? get isDefault => throw _privateConstructorUsedError;
  int get rowVersion => throw _privateConstructorUsedError;

  /// Serializes this UpdateWarehouseRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of UpdateWarehouseRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $UpdateWarehouseRequestCopyWith<UpdateWarehouseRequest> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $UpdateWarehouseRequestCopyWith<$Res> {
  factory $UpdateWarehouseRequestCopyWith(UpdateWarehouseRequest value,
          $Res Function(UpdateWarehouseRequest) then) =
      _$UpdateWarehouseRequestCopyWithImpl<$Res, UpdateWarehouseRequest>;
  @useResult
  $Res call(
      {String? name,
      String? code,
      String? address,
      String? phone,
      String? managerName,
      bool? isDefault,
      int rowVersion});
}

/// @nodoc
class _$UpdateWarehouseRequestCopyWithImpl<$Res,
        $Val extends UpdateWarehouseRequest>
    implements $UpdateWarehouseRequestCopyWith<$Res> {
  _$UpdateWarehouseRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of UpdateWarehouseRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = freezed,
    Object? code = freezed,
    Object? address = freezed,
    Object? phone = freezed,
    Object? managerName = freezed,
    Object? isDefault = freezed,
    Object? rowVersion = null,
  }) {
    return _then(_value.copyWith(
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
      code: freezed == code
          ? _value.code
          : code // ignore: cast_nullable_to_non_nullable
              as String?,
      address: freezed == address
          ? _value.address
          : address // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      managerName: freezed == managerName
          ? _value.managerName
          : managerName // ignore: cast_nullable_to_non_nullable
              as String?,
      isDefault: freezed == isDefault
          ? _value.isDefault
          : isDefault // ignore: cast_nullable_to_non_nullable
              as bool?,
      rowVersion: null == rowVersion
          ? _value.rowVersion
          : rowVersion // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$UpdateWarehouseRequestImplCopyWith<$Res>
    implements $UpdateWarehouseRequestCopyWith<$Res> {
  factory _$$UpdateWarehouseRequestImplCopyWith(
          _$UpdateWarehouseRequestImpl value,
          $Res Function(_$UpdateWarehouseRequestImpl) then) =
      __$$UpdateWarehouseRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String? name,
      String? code,
      String? address,
      String? phone,
      String? managerName,
      bool? isDefault,
      int rowVersion});
}

/// @nodoc
class __$$UpdateWarehouseRequestImplCopyWithImpl<$Res>
    extends _$UpdateWarehouseRequestCopyWithImpl<$Res,
        _$UpdateWarehouseRequestImpl>
    implements _$$UpdateWarehouseRequestImplCopyWith<$Res> {
  __$$UpdateWarehouseRequestImplCopyWithImpl(
      _$UpdateWarehouseRequestImpl _value,
      $Res Function(_$UpdateWarehouseRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of UpdateWarehouseRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? name = freezed,
    Object? code = freezed,
    Object? address = freezed,
    Object? phone = freezed,
    Object? managerName = freezed,
    Object? isDefault = freezed,
    Object? rowVersion = null,
  }) {
    return _then(_$UpdateWarehouseRequestImpl(
      name: freezed == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String?,
      code: freezed == code
          ? _value.code
          : code // ignore: cast_nullable_to_non_nullable
              as String?,
      address: freezed == address
          ? _value.address
          : address // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      managerName: freezed == managerName
          ? _value.managerName
          : managerName // ignore: cast_nullable_to_non_nullable
              as String?,
      isDefault: freezed == isDefault
          ? _value.isDefault
          : isDefault // ignore: cast_nullable_to_non_nullable
              as bool?,
      rowVersion: null == rowVersion
          ? _value.rowVersion
          : rowVersion // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$UpdateWarehouseRequestImpl implements _UpdateWarehouseRequest {
  const _$UpdateWarehouseRequestImpl(
      {this.name,
      this.code,
      this.address,
      this.phone,
      this.managerName,
      this.isDefault,
      this.rowVersion = 0});

  factory _$UpdateWarehouseRequestImpl.fromJson(Map<String, dynamic> json) =>
      _$$UpdateWarehouseRequestImplFromJson(json);

  @override
  final String? name;
  @override
  final String? code;
  @override
  final String? address;
  @override
  final String? phone;
  @override
  final String? managerName;
  @override
  final bool? isDefault;
  @override
  @JsonKey()
  final int rowVersion;

  @override
  String toString() {
    return 'UpdateWarehouseRequest(name: $name, code: $code, address: $address, phone: $phone, managerName: $managerName, isDefault: $isDefault, rowVersion: $rowVersion)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$UpdateWarehouseRequestImpl &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.code, code) || other.code == code) &&
            (identical(other.address, address) || other.address == address) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.managerName, managerName) ||
                other.managerName == managerName) &&
            (identical(other.isDefault, isDefault) ||
                other.isDefault == isDefault) &&
            (identical(other.rowVersion, rowVersion) ||
                other.rowVersion == rowVersion));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, name, code, address, phone,
      managerName, isDefault, rowVersion);

  /// Create a copy of UpdateWarehouseRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$UpdateWarehouseRequestImplCopyWith<_$UpdateWarehouseRequestImpl>
      get copyWith => __$$UpdateWarehouseRequestImplCopyWithImpl<
          _$UpdateWarehouseRequestImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$UpdateWarehouseRequestImplToJson(
      this,
    );
  }
}

abstract class _UpdateWarehouseRequest implements UpdateWarehouseRequest {
  const factory _UpdateWarehouseRequest(
      {final String? name,
      final String? code,
      final String? address,
      final String? phone,
      final String? managerName,
      final bool? isDefault,
      final int rowVersion}) = _$UpdateWarehouseRequestImpl;

  factory _UpdateWarehouseRequest.fromJson(Map<String, dynamic> json) =
      _$UpdateWarehouseRequestImpl.fromJson;

  @override
  String? get name;
  @override
  String? get code;
  @override
  String? get address;
  @override
  String? get phone;
  @override
  String? get managerName;
  @override
  bool? get isDefault;
  @override
  int get rowVersion;

  /// Create a copy of UpdateWarehouseRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$UpdateWarehouseRequestImplCopyWith<_$UpdateWarehouseRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}

AdjustStockDto _$AdjustStockDtoFromJson(Map<String, dynamic> json) {
  return _AdjustStockDto.fromJson(json);
}

/// @nodoc
mixin _$AdjustStockDto {
  String get productId => throw _privateConstructorUsedError;
  String get warehouseId => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  String? get reason => throw _privateConstructorUsedError;
  String? get referenceType => throw _privateConstructorUsedError;
  String? get referenceId => throw _privateConstructorUsedError;
  String? get comment => throw _privateConstructorUsedError;

  /// Serializes this AdjustStockDto to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AdjustStockDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AdjustStockDtoCopyWith<AdjustStockDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AdjustStockDtoCopyWith<$Res> {
  factory $AdjustStockDtoCopyWith(
          AdjustStockDto value, $Res Function(AdjustStockDto) then) =
      _$AdjustStockDtoCopyWithImpl<$Res, AdjustStockDto>;
  @useResult
  $Res call(
      {String productId,
      String warehouseId,
      int quantity,
      String? reason,
      String? referenceType,
      String? referenceId,
      String? comment});
}

/// @nodoc
class _$AdjustStockDtoCopyWithImpl<$Res, $Val extends AdjustStockDto>
    implements $AdjustStockDtoCopyWith<$Res> {
  _$AdjustStockDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AdjustStockDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? warehouseId = null,
    Object? quantity = null,
    Object? reason = freezed,
    Object? referenceType = freezed,
    Object? referenceId = freezed,
    Object? comment = freezed,
  }) {
    return _then(_value.copyWith(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      reason: freezed == reason
          ? _value.reason
          : reason // ignore: cast_nullable_to_non_nullable
              as String?,
      referenceType: freezed == referenceType
          ? _value.referenceType
          : referenceType // ignore: cast_nullable_to_non_nullable
              as String?,
      referenceId: freezed == referenceId
          ? _value.referenceId
          : referenceId // ignore: cast_nullable_to_non_nullable
              as String?,
      comment: freezed == comment
          ? _value.comment
          : comment // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AdjustStockDtoImplCopyWith<$Res>
    implements $AdjustStockDtoCopyWith<$Res> {
  factory _$$AdjustStockDtoImplCopyWith(_$AdjustStockDtoImpl value,
          $Res Function(_$AdjustStockDtoImpl) then) =
      __$$AdjustStockDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String productId,
      String warehouseId,
      int quantity,
      String? reason,
      String? referenceType,
      String? referenceId,
      String? comment});
}

/// @nodoc
class __$$AdjustStockDtoImplCopyWithImpl<$Res>
    extends _$AdjustStockDtoCopyWithImpl<$Res, _$AdjustStockDtoImpl>
    implements _$$AdjustStockDtoImplCopyWith<$Res> {
  __$$AdjustStockDtoImplCopyWithImpl(
      _$AdjustStockDtoImpl _value, $Res Function(_$AdjustStockDtoImpl) _then)
      : super(_value, _then);

  /// Create a copy of AdjustStockDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? warehouseId = null,
    Object? quantity = null,
    Object? reason = freezed,
    Object? referenceType = freezed,
    Object? referenceId = freezed,
    Object? comment = freezed,
  }) {
    return _then(_$AdjustStockDtoImpl(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      warehouseId: null == warehouseId
          ? _value.warehouseId
          : warehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      reason: freezed == reason
          ? _value.reason
          : reason // ignore: cast_nullable_to_non_nullable
              as String?,
      referenceType: freezed == referenceType
          ? _value.referenceType
          : referenceType // ignore: cast_nullable_to_non_nullable
              as String?,
      referenceId: freezed == referenceId
          ? _value.referenceId
          : referenceId // ignore: cast_nullable_to_non_nullable
              as String?,
      comment: freezed == comment
          ? _value.comment
          : comment // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AdjustStockDtoImpl implements _AdjustStockDto {
  const _$AdjustStockDtoImpl(
      {required this.productId,
      required this.warehouseId,
      required this.quantity,
      this.reason,
      this.referenceType,
      this.referenceId,
      this.comment});

  factory _$AdjustStockDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$AdjustStockDtoImplFromJson(json);

  @override
  final String productId;
  @override
  final String warehouseId;
  @override
  final int quantity;
  @override
  final String? reason;
  @override
  final String? referenceType;
  @override
  final String? referenceId;
  @override
  final String? comment;

  @override
  String toString() {
    return 'AdjustStockDto(productId: $productId, warehouseId: $warehouseId, quantity: $quantity, reason: $reason, referenceType: $referenceType, referenceId: $referenceId, comment: $comment)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AdjustStockDtoImpl &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.warehouseId, warehouseId) ||
                other.warehouseId == warehouseId) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.reason, reason) || other.reason == reason) &&
            (identical(other.referenceType, referenceType) ||
                other.referenceType == referenceType) &&
            (identical(other.referenceId, referenceId) ||
                other.referenceId == referenceId) &&
            (identical(other.comment, comment) || other.comment == comment));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, productId, warehouseId, quantity,
      reason, referenceType, referenceId, comment);

  /// Create a copy of AdjustStockDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AdjustStockDtoImplCopyWith<_$AdjustStockDtoImpl> get copyWith =>
      __$$AdjustStockDtoImplCopyWithImpl<_$AdjustStockDtoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AdjustStockDtoImplToJson(
      this,
    );
  }
}

abstract class _AdjustStockDto implements AdjustStockDto {
  const factory _AdjustStockDto(
      {required final String productId,
      required final String warehouseId,
      required final int quantity,
      final String? reason,
      final String? referenceType,
      final String? referenceId,
      final String? comment}) = _$AdjustStockDtoImpl;

  factory _AdjustStockDto.fromJson(Map<String, dynamic> json) =
      _$AdjustStockDtoImpl.fromJson;

  @override
  String get productId;
  @override
  String get warehouseId;
  @override
  int get quantity;
  @override
  String? get reason;
  @override
  String? get referenceType;
  @override
  String? get referenceId;
  @override
  String? get comment;

  /// Create a copy of AdjustStockDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AdjustStockDtoImplCopyWith<_$AdjustStockDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

TransferStockDto _$TransferStockDtoFromJson(Map<String, dynamic> json) {
  return _TransferStockDto.fromJson(json);
}

/// @nodoc
mixin _$TransferStockDto {
  String get productId => throw _privateConstructorUsedError;
  String get fromWarehouseId => throw _privateConstructorUsedError;
  String get toWarehouseId => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  String? get comment => throw _privateConstructorUsedError;

  /// Serializes this TransferStockDto to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of TransferStockDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $TransferStockDtoCopyWith<TransferStockDto> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $TransferStockDtoCopyWith<$Res> {
  factory $TransferStockDtoCopyWith(
          TransferStockDto value, $Res Function(TransferStockDto) then) =
      _$TransferStockDtoCopyWithImpl<$Res, TransferStockDto>;
  @useResult
  $Res call(
      {String productId,
      String fromWarehouseId,
      String toWarehouseId,
      int quantity,
      String? comment});
}

/// @nodoc
class _$TransferStockDtoCopyWithImpl<$Res, $Val extends TransferStockDto>
    implements $TransferStockDtoCopyWith<$Res> {
  _$TransferStockDtoCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of TransferStockDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? fromWarehouseId = null,
    Object? toWarehouseId = null,
    Object? quantity = null,
    Object? comment = freezed,
  }) {
    return _then(_value.copyWith(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      fromWarehouseId: null == fromWarehouseId
          ? _value.fromWarehouseId
          : fromWarehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      toWarehouseId: null == toWarehouseId
          ? _value.toWarehouseId
          : toWarehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      comment: freezed == comment
          ? _value.comment
          : comment // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$TransferStockDtoImplCopyWith<$Res>
    implements $TransferStockDtoCopyWith<$Res> {
  factory _$$TransferStockDtoImplCopyWith(_$TransferStockDtoImpl value,
          $Res Function(_$TransferStockDtoImpl) then) =
      __$$TransferStockDtoImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String productId,
      String fromWarehouseId,
      String toWarehouseId,
      int quantity,
      String? comment});
}

/// @nodoc
class __$$TransferStockDtoImplCopyWithImpl<$Res>
    extends _$TransferStockDtoCopyWithImpl<$Res, _$TransferStockDtoImpl>
    implements _$$TransferStockDtoImplCopyWith<$Res> {
  __$$TransferStockDtoImplCopyWithImpl(_$TransferStockDtoImpl _value,
      $Res Function(_$TransferStockDtoImpl) _then)
      : super(_value, _then);

  /// Create a copy of TransferStockDto
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? fromWarehouseId = null,
    Object? toWarehouseId = null,
    Object? quantity = null,
    Object? comment = freezed,
  }) {
    return _then(_$TransferStockDtoImpl(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      fromWarehouseId: null == fromWarehouseId
          ? _value.fromWarehouseId
          : fromWarehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      toWarehouseId: null == toWarehouseId
          ? _value.toWarehouseId
          : toWarehouseId // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      comment: freezed == comment
          ? _value.comment
          : comment // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$TransferStockDtoImpl implements _TransferStockDto {
  const _$TransferStockDtoImpl(
      {required this.productId,
      required this.fromWarehouseId,
      required this.toWarehouseId,
      required this.quantity,
      this.comment});

  factory _$TransferStockDtoImpl.fromJson(Map<String, dynamic> json) =>
      _$$TransferStockDtoImplFromJson(json);

  @override
  final String productId;
  @override
  final String fromWarehouseId;
  @override
  final String toWarehouseId;
  @override
  final int quantity;
  @override
  final String? comment;

  @override
  String toString() {
    return 'TransferStockDto(productId: $productId, fromWarehouseId: $fromWarehouseId, toWarehouseId: $toWarehouseId, quantity: $quantity, comment: $comment)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$TransferStockDtoImpl &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.fromWarehouseId, fromWarehouseId) ||
                other.fromWarehouseId == fromWarehouseId) &&
            (identical(other.toWarehouseId, toWarehouseId) ||
                other.toWarehouseId == toWarehouseId) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.comment, comment) || other.comment == comment));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, productId, fromWarehouseId,
      toWarehouseId, quantity, comment);

  /// Create a copy of TransferStockDto
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$TransferStockDtoImplCopyWith<_$TransferStockDtoImpl> get copyWith =>
      __$$TransferStockDtoImplCopyWithImpl<_$TransferStockDtoImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$TransferStockDtoImplToJson(
      this,
    );
  }
}

abstract class _TransferStockDto implements TransferStockDto {
  const factory _TransferStockDto(
      {required final String productId,
      required final String fromWarehouseId,
      required final String toWarehouseId,
      required final int quantity,
      final String? comment}) = _$TransferStockDtoImpl;

  factory _TransferStockDto.fromJson(Map<String, dynamic> json) =
      _$TransferStockDtoImpl.fromJson;

  @override
  String get productId;
  @override
  String get fromWarehouseId;
  @override
  String get toWarehouseId;
  @override
  int get quantity;
  @override
  String? get comment;

  /// Create a copy of TransferStockDto
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$TransferStockDtoImplCopyWith<_$TransferStockDtoImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
