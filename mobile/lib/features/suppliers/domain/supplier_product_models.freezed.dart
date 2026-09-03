// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'supplier_product_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

SupplierProduct _$SupplierProductFromJson(Map<String, dynamic> json) {
  return _SupplierProduct.fromJson(json);
}

/// @nodoc
mixin _$SupplierProduct {
  String get id => throw _privateConstructorUsedError;
  String get companyId => throw _privateConstructorUsedError;
  String get supplierId => throw _privateConstructorUsedError;
  String get productId => throw _privateConstructorUsedError;
  String? get supplierSku => throw _privateConstructorUsedError;
  String? get purchasePrice => throw _privateConstructorUsedError;
  String get currency => throw _privateConstructorUsedError;
  bool get isPreferred => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;
  DateTime? get lastPurchaseAt => throw _privateConstructorUsedError;
  int get rowVersion => throw _privateConstructorUsedError;
  DateTime get createdAt => throw _privateConstructorUsedError;
  DateTime get updatedAt => throw _privateConstructorUsedError;
  DateTime? get deletedAt => throw _privateConstructorUsedError;
  SupplierProductProduct get product => throw _privateConstructorUsedError;

  /// Serializes this SupplierProduct to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierProduct
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierProductCopyWith<SupplierProduct> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierProductCopyWith<$Res> {
  factory $SupplierProductCopyWith(
          SupplierProduct value, $Res Function(SupplierProduct) then) =
      _$SupplierProductCopyWithImpl<$Res, SupplierProduct>;
  @useResult
  $Res call(
      {String id,
      String companyId,
      String supplierId,
      String productId,
      String? supplierSku,
      String? purchasePrice,
      String currency,
      bool isPreferred,
      String? notes,
      DateTime? lastPurchaseAt,
      int rowVersion,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt,
      SupplierProductProduct product});

  $SupplierProductProductCopyWith<$Res> get product;
}

/// @nodoc
class _$SupplierProductCopyWithImpl<$Res, $Val extends SupplierProduct>
    implements $SupplierProductCopyWith<$Res> {
  _$SupplierProductCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierProduct
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? supplierId = null,
    Object? productId = null,
    Object? supplierSku = freezed,
    Object? purchasePrice = freezed,
    Object? currency = null,
    Object? isPreferred = null,
    Object? notes = freezed,
    Object? lastPurchaseAt = freezed,
    Object? rowVersion = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
    Object? product = null,
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
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      supplierSku: freezed == supplierSku
          ? _value.supplierSku
          : supplierSku // ignore: cast_nullable_to_non_nullable
              as String?,
      purchasePrice: freezed == purchasePrice
          ? _value.purchasePrice
          : purchasePrice // ignore: cast_nullable_to_non_nullable
              as String?,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
      isPreferred: null == isPreferred
          ? _value.isPreferred
          : isPreferred // ignore: cast_nullable_to_non_nullable
              as bool,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      lastPurchaseAt: freezed == lastPurchaseAt
          ? _value.lastPurchaseAt
          : lastPurchaseAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
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
      product: null == product
          ? _value.product
          : product // ignore: cast_nullable_to_non_nullable
              as SupplierProductProduct,
    ) as $Val);
  }

  /// Create a copy of SupplierProduct
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SupplierProductProductCopyWith<$Res> get product {
    return $SupplierProductProductCopyWith<$Res>(_value.product, (value) {
      return _then(_value.copyWith(product: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$SupplierProductImplCopyWith<$Res>
    implements $SupplierProductCopyWith<$Res> {
  factory _$$SupplierProductImplCopyWith(_$SupplierProductImpl value,
          $Res Function(_$SupplierProductImpl) then) =
      __$$SupplierProductImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String companyId,
      String supplierId,
      String productId,
      String? supplierSku,
      String? purchasePrice,
      String currency,
      bool isPreferred,
      String? notes,
      DateTime? lastPurchaseAt,
      int rowVersion,
      DateTime createdAt,
      DateTime updatedAt,
      DateTime? deletedAt,
      SupplierProductProduct product});

  @override
  $SupplierProductProductCopyWith<$Res> get product;
}

/// @nodoc
class __$$SupplierProductImplCopyWithImpl<$Res>
    extends _$SupplierProductCopyWithImpl<$Res, _$SupplierProductImpl>
    implements _$$SupplierProductImplCopyWith<$Res> {
  __$$SupplierProductImplCopyWithImpl(
      _$SupplierProductImpl _value, $Res Function(_$SupplierProductImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierProduct
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? companyId = null,
    Object? supplierId = null,
    Object? productId = null,
    Object? supplierSku = freezed,
    Object? purchasePrice = freezed,
    Object? currency = null,
    Object? isPreferred = null,
    Object? notes = freezed,
    Object? lastPurchaseAt = freezed,
    Object? rowVersion = null,
    Object? createdAt = null,
    Object? updatedAt = null,
    Object? deletedAt = freezed,
    Object? product = null,
  }) {
    return _then(_$SupplierProductImpl(
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
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      supplierSku: freezed == supplierSku
          ? _value.supplierSku
          : supplierSku // ignore: cast_nullable_to_non_nullable
              as String?,
      purchasePrice: freezed == purchasePrice
          ? _value.purchasePrice
          : purchasePrice // ignore: cast_nullable_to_non_nullable
              as String?,
      currency: null == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String,
      isPreferred: null == isPreferred
          ? _value.isPreferred
          : isPreferred // ignore: cast_nullable_to_non_nullable
              as bool,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
      lastPurchaseAt: freezed == lastPurchaseAt
          ? _value.lastPurchaseAt
          : lastPurchaseAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
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
      product: null == product
          ? _value.product
          : product // ignore: cast_nullable_to_non_nullable
              as SupplierProductProduct,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SupplierProductImpl implements _SupplierProduct {
  const _$SupplierProductImpl(
      {required this.id,
      required this.companyId,
      required this.supplierId,
      required this.productId,
      this.supplierSku,
      this.purchasePrice,
      required this.currency,
      this.isPreferred = false,
      this.notes,
      this.lastPurchaseAt,
      this.rowVersion = 0,
      required this.createdAt,
      required this.updatedAt,
      this.deletedAt,
      required this.product});

  factory _$SupplierProductImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierProductImplFromJson(json);

  @override
  final String id;
  @override
  final String companyId;
  @override
  final String supplierId;
  @override
  final String productId;
  @override
  final String? supplierSku;
  @override
  final String? purchasePrice;
  @override
  final String currency;
  @override
  @JsonKey()
  final bool isPreferred;
  @override
  final String? notes;
  @override
  final DateTime? lastPurchaseAt;
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
  final SupplierProductProduct product;

  @override
  String toString() {
    return 'SupplierProduct(id: $id, companyId: $companyId, supplierId: $supplierId, productId: $productId, supplierSku: $supplierSku, purchasePrice: $purchasePrice, currency: $currency, isPreferred: $isPreferred, notes: $notes, lastPurchaseAt: $lastPurchaseAt, rowVersion: $rowVersion, createdAt: $createdAt, updatedAt: $updatedAt, deletedAt: $deletedAt, product: $product)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierProductImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.companyId, companyId) ||
                other.companyId == companyId) &&
            (identical(other.supplierId, supplierId) ||
                other.supplierId == supplierId) &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.supplierSku, supplierSku) ||
                other.supplierSku == supplierSku) &&
            (identical(other.purchasePrice, purchasePrice) ||
                other.purchasePrice == purchasePrice) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.isPreferred, isPreferred) ||
                other.isPreferred == isPreferred) &&
            (identical(other.notes, notes) || other.notes == notes) &&
            (identical(other.lastPurchaseAt, lastPurchaseAt) ||
                other.lastPurchaseAt == lastPurchaseAt) &&
            (identical(other.rowVersion, rowVersion) ||
                other.rowVersion == rowVersion) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.deletedAt, deletedAt) ||
                other.deletedAt == deletedAt) &&
            (identical(other.product, product) || other.product == product));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      companyId,
      supplierId,
      productId,
      supplierSku,
      purchasePrice,
      currency,
      isPreferred,
      notes,
      lastPurchaseAt,
      rowVersion,
      createdAt,
      updatedAt,
      deletedAt,
      product);

  /// Create a copy of SupplierProduct
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierProductImplCopyWith<_$SupplierProductImpl> get copyWith =>
      __$$SupplierProductImplCopyWithImpl<_$SupplierProductImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierProductImplToJson(
      this,
    );
  }
}

abstract class _SupplierProduct implements SupplierProduct {
  const factory _SupplierProduct(
      {required final String id,
      required final String companyId,
      required final String supplierId,
      required final String productId,
      final String? supplierSku,
      final String? purchasePrice,
      required final String currency,
      final bool isPreferred,
      final String? notes,
      final DateTime? lastPurchaseAt,
      final int rowVersion,
      required final DateTime createdAt,
      required final DateTime updatedAt,
      final DateTime? deletedAt,
      required final SupplierProductProduct product}) = _$SupplierProductImpl;

  factory _SupplierProduct.fromJson(Map<String, dynamic> json) =
      _$SupplierProductImpl.fromJson;

  @override
  String get id;
  @override
  String get companyId;
  @override
  String get supplierId;
  @override
  String get productId;
  @override
  String? get supplierSku;
  @override
  String? get purchasePrice;
  @override
  String get currency;
  @override
  bool get isPreferred;
  @override
  String? get notes;
  @override
  DateTime? get lastPurchaseAt;
  @override
  int get rowVersion;
  @override
  DateTime get createdAt;
  @override
  DateTime get updatedAt;
  @override
  DateTime? get deletedAt;
  @override
  SupplierProductProduct get product;

  /// Create a copy of SupplierProduct
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierProductImplCopyWith<_$SupplierProductImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SupplierProductProduct _$SupplierProductProductFromJson(
    Map<String, dynamic> json) {
  return _SupplierProductProduct.fromJson(json);
}

/// @nodoc
mixin _$SupplierProductProduct {
  String get id => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String? get sku => throw _privateConstructorUsedError;

  /// Serializes this SupplierProductProduct to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierProductProduct
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierProductProductCopyWith<SupplierProductProduct> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierProductProductCopyWith<$Res> {
  factory $SupplierProductProductCopyWith(SupplierProductProduct value,
          $Res Function(SupplierProductProduct) then) =
      _$SupplierProductProductCopyWithImpl<$Res, SupplierProductProduct>;
  @useResult
  $Res call({String id, String name, String? sku});
}

/// @nodoc
class _$SupplierProductProductCopyWithImpl<$Res,
        $Val extends SupplierProductProduct>
    implements $SupplierProductProductCopyWith<$Res> {
  _$SupplierProductProductCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierProductProduct
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? sku = freezed,
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
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SupplierProductProductImplCopyWith<$Res>
    implements $SupplierProductProductCopyWith<$Res> {
  factory _$$SupplierProductProductImplCopyWith(
          _$SupplierProductProductImpl value,
          $Res Function(_$SupplierProductProductImpl) then) =
      __$$SupplierProductProductImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String name, String? sku});
}

/// @nodoc
class __$$SupplierProductProductImplCopyWithImpl<$Res>
    extends _$SupplierProductProductCopyWithImpl<$Res,
        _$SupplierProductProductImpl>
    implements _$$SupplierProductProductImplCopyWith<$Res> {
  __$$SupplierProductProductImplCopyWithImpl(
      _$SupplierProductProductImpl _value,
      $Res Function(_$SupplierProductProductImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierProductProduct
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? sku = freezed,
  }) {
    return _then(_$SupplierProductProductImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SupplierProductProductImpl implements _SupplierProductProduct {
  const _$SupplierProductProductImpl(
      {required this.id, required this.name, this.sku});

  factory _$SupplierProductProductImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierProductProductImplFromJson(json);

  @override
  final String id;
  @override
  final String name;
  @override
  final String? sku;

  @override
  String toString() {
    return 'SupplierProductProduct(id: $id, name: $name, sku: $sku)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierProductProductImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.sku, sku) || other.sku == sku));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, name, sku);

  /// Create a copy of SupplierProductProduct
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierProductProductImplCopyWith<_$SupplierProductProductImpl>
      get copyWith => __$$SupplierProductProductImplCopyWithImpl<
          _$SupplierProductProductImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierProductProductImplToJson(
      this,
    );
  }
}

abstract class _SupplierProductProduct implements SupplierProductProduct {
  const factory _SupplierProductProduct(
      {required final String id,
      required final String name,
      final String? sku}) = _$SupplierProductProductImpl;

  factory _SupplierProductProduct.fromJson(Map<String, dynamic> json) =
      _$SupplierProductProductImpl.fromJson;

  @override
  String get id;
  @override
  String get name;
  @override
  String? get sku;

  /// Create a copy of SupplierProductProduct
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierProductProductImplCopyWith<_$SupplierProductProductImpl>
      get copyWith => throw _privateConstructorUsedError;
}

SupplierProductListResponse _$SupplierProductListResponseFromJson(
    Map<String, dynamic> json) {
  return _SupplierProductListResponse.fromJson(json);
}

/// @nodoc
mixin _$SupplierProductListResponse {
  List<SupplierProduct> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this SupplierProductListResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierProductListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierProductListResponseCopyWith<SupplierProductListResponse>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierProductListResponseCopyWith<$Res> {
  factory $SupplierProductListResponseCopyWith(
          SupplierProductListResponse value,
          $Res Function(SupplierProductListResponse) then) =
      _$SupplierProductListResponseCopyWithImpl<$Res,
          SupplierProductListResponse>;
  @useResult
  $Res call({List<SupplierProduct> items, int total, int page, int limit});
}

/// @nodoc
class _$SupplierProductListResponseCopyWithImpl<$Res,
        $Val extends SupplierProductListResponse>
    implements $SupplierProductListResponseCopyWith<$Res> {
  _$SupplierProductListResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierProductListResponse
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
              as List<SupplierProduct>,
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
abstract class _$$SupplierProductListResponseImplCopyWith<$Res>
    implements $SupplierProductListResponseCopyWith<$Res> {
  factory _$$SupplierProductListResponseImplCopyWith(
          _$SupplierProductListResponseImpl value,
          $Res Function(_$SupplierProductListResponseImpl) then) =
      __$$SupplierProductListResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<SupplierProduct> items, int total, int page, int limit});
}

/// @nodoc
class __$$SupplierProductListResponseImplCopyWithImpl<$Res>
    extends _$SupplierProductListResponseCopyWithImpl<$Res,
        _$SupplierProductListResponseImpl>
    implements _$$SupplierProductListResponseImplCopyWith<$Res> {
  __$$SupplierProductListResponseImplCopyWithImpl(
      _$SupplierProductListResponseImpl _value,
      $Res Function(_$SupplierProductListResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierProductListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$SupplierProductListResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<SupplierProduct>,
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
class _$SupplierProductListResponseImpl
    implements _SupplierProductListResponse {
  const _$SupplierProductListResponseImpl(
      {required final List<SupplierProduct> items,
      required this.total,
      required this.page,
      required this.limit})
      : _items = items;

  factory _$SupplierProductListResponseImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$SupplierProductListResponseImplFromJson(json);

  final List<SupplierProduct> _items;
  @override
  List<SupplierProduct> get items {
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
    return 'SupplierProductListResponse(items: $items, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierProductListResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_items), total, page, limit);

  /// Create a copy of SupplierProductListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierProductListResponseImplCopyWith<_$SupplierProductListResponseImpl>
      get copyWith => __$$SupplierProductListResponseImplCopyWithImpl<
          _$SupplierProductListResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierProductListResponseImplToJson(
      this,
    );
  }
}

abstract class _SupplierProductListResponse
    implements SupplierProductListResponse {
  const factory _SupplierProductListResponse(
      {required final List<SupplierProduct> items,
      required final int total,
      required final int page,
      required final int limit}) = _$SupplierProductListResponseImpl;

  factory _SupplierProductListResponse.fromJson(Map<String, dynamic> json) =
      _$SupplierProductListResponseImpl.fromJson;

  @override
  List<SupplierProduct> get items;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of SupplierProductListResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierProductListResponseImplCopyWith<_$SupplierProductListResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

CreateSupplierProductRequest _$CreateSupplierProductRequestFromJson(
    Map<String, dynamic> json) {
  return _CreateSupplierProductRequest.fromJson(json);
}

/// @nodoc
mixin _$CreateSupplierProductRequest {
  String get productId => throw _privateConstructorUsedError;
  String? get supplierSku => throw _privateConstructorUsedError;
  double? get purchasePrice => throw _privateConstructorUsedError;
  String? get currency => throw _privateConstructorUsedError;
  bool get isPreferred => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;

  /// Serializes this CreateSupplierProductRequest to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CreateSupplierProductRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CreateSupplierProductRequestCopyWith<CreateSupplierProductRequest>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CreateSupplierProductRequestCopyWith<$Res> {
  factory $CreateSupplierProductRequestCopyWith(
          CreateSupplierProductRequest value,
          $Res Function(CreateSupplierProductRequest) then) =
      _$CreateSupplierProductRequestCopyWithImpl<$Res,
          CreateSupplierProductRequest>;
  @useResult
  $Res call(
      {String productId,
      String? supplierSku,
      double? purchasePrice,
      String? currency,
      bool isPreferred,
      String? notes});
}

/// @nodoc
class _$CreateSupplierProductRequestCopyWithImpl<$Res,
        $Val extends CreateSupplierProductRequest>
    implements $CreateSupplierProductRequestCopyWith<$Res> {
  _$CreateSupplierProductRequestCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CreateSupplierProductRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? supplierSku = freezed,
    Object? purchasePrice = freezed,
    Object? currency = freezed,
    Object? isPreferred = null,
    Object? notes = freezed,
  }) {
    return _then(_value.copyWith(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      supplierSku: freezed == supplierSku
          ? _value.supplierSku
          : supplierSku // ignore: cast_nullable_to_non_nullable
              as String?,
      purchasePrice: freezed == purchasePrice
          ? _value.purchasePrice
          : purchasePrice // ignore: cast_nullable_to_non_nullable
              as double?,
      currency: freezed == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String?,
      isPreferred: null == isPreferred
          ? _value.isPreferred
          : isPreferred // ignore: cast_nullable_to_non_nullable
              as bool,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CreateSupplierProductRequestImplCopyWith<$Res>
    implements $CreateSupplierProductRequestCopyWith<$Res> {
  factory _$$CreateSupplierProductRequestImplCopyWith(
          _$CreateSupplierProductRequestImpl value,
          $Res Function(_$CreateSupplierProductRequestImpl) then) =
      __$$CreateSupplierProductRequestImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String productId,
      String? supplierSku,
      double? purchasePrice,
      String? currency,
      bool isPreferred,
      String? notes});
}

/// @nodoc
class __$$CreateSupplierProductRequestImplCopyWithImpl<$Res>
    extends _$CreateSupplierProductRequestCopyWithImpl<$Res,
        _$CreateSupplierProductRequestImpl>
    implements _$$CreateSupplierProductRequestImplCopyWith<$Res> {
  __$$CreateSupplierProductRequestImplCopyWithImpl(
      _$CreateSupplierProductRequestImpl _value,
      $Res Function(_$CreateSupplierProductRequestImpl) _then)
      : super(_value, _then);

  /// Create a copy of CreateSupplierProductRequest
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? supplierSku = freezed,
    Object? purchasePrice = freezed,
    Object? currency = freezed,
    Object? isPreferred = null,
    Object? notes = freezed,
  }) {
    return _then(_$CreateSupplierProductRequestImpl(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      supplierSku: freezed == supplierSku
          ? _value.supplierSku
          : supplierSku // ignore: cast_nullable_to_non_nullable
              as String?,
      purchasePrice: freezed == purchasePrice
          ? _value.purchasePrice
          : purchasePrice // ignore: cast_nullable_to_non_nullable
              as double?,
      currency: freezed == currency
          ? _value.currency
          : currency // ignore: cast_nullable_to_non_nullable
              as String?,
      isPreferred: null == isPreferred
          ? _value.isPreferred
          : isPreferred // ignore: cast_nullable_to_non_nullable
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
class _$CreateSupplierProductRequestImpl
    implements _CreateSupplierProductRequest {
  const _$CreateSupplierProductRequestImpl(
      {required this.productId,
      this.supplierSku,
      this.purchasePrice,
      this.currency,
      this.isPreferred = false,
      this.notes});

  factory _$CreateSupplierProductRequestImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$CreateSupplierProductRequestImplFromJson(json);

  @override
  final String productId;
  @override
  final String? supplierSku;
  @override
  final double? purchasePrice;
  @override
  final String? currency;
  @override
  @JsonKey()
  final bool isPreferred;
  @override
  final String? notes;

  @override
  String toString() {
    return 'CreateSupplierProductRequest(productId: $productId, supplierSku: $supplierSku, purchasePrice: $purchasePrice, currency: $currency, isPreferred: $isPreferred, notes: $notes)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CreateSupplierProductRequestImpl &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.supplierSku, supplierSku) ||
                other.supplierSku == supplierSku) &&
            (identical(other.purchasePrice, purchasePrice) ||
                other.purchasePrice == purchasePrice) &&
            (identical(other.currency, currency) ||
                other.currency == currency) &&
            (identical(other.isPreferred, isPreferred) ||
                other.isPreferred == isPreferred) &&
            (identical(other.notes, notes) || other.notes == notes));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, productId, supplierSku,
      purchasePrice, currency, isPreferred, notes);

  /// Create a copy of CreateSupplierProductRequest
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CreateSupplierProductRequestImplCopyWith<
          _$CreateSupplierProductRequestImpl>
      get copyWith => __$$CreateSupplierProductRequestImplCopyWithImpl<
          _$CreateSupplierProductRequestImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CreateSupplierProductRequestImplToJson(
      this,
    );
  }
}

abstract class _CreateSupplierProductRequest
    implements CreateSupplierProductRequest {
  const factory _CreateSupplierProductRequest(
      {required final String productId,
      final String? supplierSku,
      final double? purchasePrice,
      final String? currency,
      final bool isPreferred,
      final String? notes}) = _$CreateSupplierProductRequestImpl;

  factory _CreateSupplierProductRequest.fromJson(Map<String, dynamic> json) =
      _$CreateSupplierProductRequestImpl.fromJson;

  @override
  String get productId;
  @override
  String? get supplierSku;
  @override
  double? get purchasePrice;
  @override
  String? get currency;
  @override
  bool get isPreferred;
  @override
  String? get notes;

  /// Create a copy of CreateSupplierProductRequest
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CreateSupplierProductRequestImplCopyWith<
          _$CreateSupplierProductRequestImpl>
      get copyWith => throw _privateConstructorUsedError;
}
