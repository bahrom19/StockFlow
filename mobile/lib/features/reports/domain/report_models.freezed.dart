// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'report_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

TopProductsResponse _$TopProductsResponseFromJson(Map<String, dynamic> json) {
  return _TopProductsResponse.fromJson(json);
}

/// @nodoc
mixin _$TopProductsResponse {
  List<TopProductItem> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;

  /// Serializes this TopProductsResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of TopProductsResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $TopProductsResponseCopyWith<TopProductsResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $TopProductsResponseCopyWith<$Res> {
  factory $TopProductsResponseCopyWith(
          TopProductsResponse value, $Res Function(TopProductsResponse) then) =
      _$TopProductsResponseCopyWithImpl<$Res, TopProductsResponse>;
  @useResult
  $Res call({List<TopProductItem> items, int total});
}

/// @nodoc
class _$TopProductsResponseCopyWithImpl<$Res, $Val extends TopProductsResponse>
    implements $TopProductsResponseCopyWith<$Res> {
  _$TopProductsResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of TopProductsResponse
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
              as List<TopProductItem>,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$TopProductsResponseImplCopyWith<$Res>
    implements $TopProductsResponseCopyWith<$Res> {
  factory _$$TopProductsResponseImplCopyWith(_$TopProductsResponseImpl value,
          $Res Function(_$TopProductsResponseImpl) then) =
      __$$TopProductsResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<TopProductItem> items, int total});
}

/// @nodoc
class __$$TopProductsResponseImplCopyWithImpl<$Res>
    extends _$TopProductsResponseCopyWithImpl<$Res, _$TopProductsResponseImpl>
    implements _$$TopProductsResponseImplCopyWith<$Res> {
  __$$TopProductsResponseImplCopyWithImpl(_$TopProductsResponseImpl _value,
      $Res Function(_$TopProductsResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of TopProductsResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
  }) {
    return _then(_$TopProductsResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<TopProductItem>,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$TopProductsResponseImpl implements _TopProductsResponse {
  const _$TopProductsResponseImpl(
      {required final List<TopProductItem> items, required this.total})
      : _items = items;

  factory _$TopProductsResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$TopProductsResponseImplFromJson(json);

  final List<TopProductItem> _items;
  @override
  List<TopProductItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  final int total;

  @override
  String toString() {
    return 'TopProductsResponse(items: $items, total: $total)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$TopProductsResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, const DeepCollectionEquality().hash(_items), total);

  /// Create a copy of TopProductsResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$TopProductsResponseImplCopyWith<_$TopProductsResponseImpl> get copyWith =>
      __$$TopProductsResponseImplCopyWithImpl<_$TopProductsResponseImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$TopProductsResponseImplToJson(
      this,
    );
  }
}

abstract class _TopProductsResponse implements TopProductsResponse {
  const factory _TopProductsResponse(
      {required final List<TopProductItem> items,
      required final int total}) = _$TopProductsResponseImpl;

  factory _TopProductsResponse.fromJson(Map<String, dynamic> json) =
      _$TopProductsResponseImpl.fromJson;

  @override
  List<TopProductItem> get items;
  @override
  int get total;

  /// Create a copy of TopProductsResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$TopProductsResponseImplCopyWith<_$TopProductsResponseImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

TopProductItem _$TopProductItemFromJson(Map<String, dynamic> json) {
  return _TopProductItem.fromJson(json);
}

/// @nodoc
mixin _$TopProductItem {
  String get productId => throw _privateConstructorUsedError;
  String get productName => throw _privateConstructorUsedError;
  String get sku => throw _privateConstructorUsedError;
  int get quantitySold => throw _privateConstructorUsedError;
  String get revenue => throw _privateConstructorUsedError;
  String get profit => throw _privateConstructorUsedError;
  String get margin => throw _privateConstructorUsedError;

  /// Serializes this TopProductItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of TopProductItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $TopProductItemCopyWith<TopProductItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $TopProductItemCopyWith<$Res> {
  factory $TopProductItemCopyWith(
          TopProductItem value, $Res Function(TopProductItem) then) =
      _$TopProductItemCopyWithImpl<$Res, TopProductItem>;
  @useResult
  $Res call(
      {String productId,
      String productName,
      String sku,
      int quantitySold,
      String revenue,
      String profit,
      String margin});
}

/// @nodoc
class _$TopProductItemCopyWithImpl<$Res, $Val extends TopProductItem>
    implements $TopProductItemCopyWith<$Res> {
  _$TopProductItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of TopProductItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? productName = null,
    Object? sku = null,
    Object? quantitySold = null,
    Object? revenue = null,
    Object? profit = null,
    Object? margin = null,
  }) {
    return _then(_value.copyWith(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      productName: null == productName
          ? _value.productName
          : productName // ignore: cast_nullable_to_non_nullable
              as String,
      sku: null == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String,
      quantitySold: null == quantitySold
          ? _value.quantitySold
          : quantitySold // ignore: cast_nullable_to_non_nullable
              as int,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      profit: null == profit
          ? _value.profit
          : profit // ignore: cast_nullable_to_non_nullable
              as String,
      margin: null == margin
          ? _value.margin
          : margin // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$TopProductItemImplCopyWith<$Res>
    implements $TopProductItemCopyWith<$Res> {
  factory _$$TopProductItemImplCopyWith(_$TopProductItemImpl value,
          $Res Function(_$TopProductItemImpl) then) =
      __$$TopProductItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String productId,
      String productName,
      String sku,
      int quantitySold,
      String revenue,
      String profit,
      String margin});
}

/// @nodoc
class __$$TopProductItemImplCopyWithImpl<$Res>
    extends _$TopProductItemCopyWithImpl<$Res, _$TopProductItemImpl>
    implements _$$TopProductItemImplCopyWith<$Res> {
  __$$TopProductItemImplCopyWithImpl(
      _$TopProductItemImpl _value, $Res Function(_$TopProductItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of TopProductItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? productName = null,
    Object? sku = null,
    Object? quantitySold = null,
    Object? revenue = null,
    Object? profit = null,
    Object? margin = null,
  }) {
    return _then(_$TopProductItemImpl(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      productName: null == productName
          ? _value.productName
          : productName // ignore: cast_nullable_to_non_nullable
              as String,
      sku: null == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String,
      quantitySold: null == quantitySold
          ? _value.quantitySold
          : quantitySold // ignore: cast_nullable_to_non_nullable
              as int,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      profit: null == profit
          ? _value.profit
          : profit // ignore: cast_nullable_to_non_nullable
              as String,
      margin: null == margin
          ? _value.margin
          : margin // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$TopProductItemImpl implements _TopProductItem {
  const _$TopProductItemImpl(
      {required this.productId,
      required this.productName,
      this.sku = '',
      this.quantitySold = 0,
      required this.revenue,
      required this.profit,
      required this.margin});

  factory _$TopProductItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$TopProductItemImplFromJson(json);

  @override
  final String productId;
  @override
  final String productName;
  @override
  @JsonKey()
  final String sku;
  @override
  @JsonKey()
  final int quantitySold;
  @override
  final String revenue;
  @override
  final String profit;
  @override
  final String margin;

  @override
  String toString() {
    return 'TopProductItem(productId: $productId, productName: $productName, sku: $sku, quantitySold: $quantitySold, revenue: $revenue, profit: $profit, margin: $margin)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$TopProductItemImpl &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.productName, productName) ||
                other.productName == productName) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.quantitySold, quantitySold) ||
                other.quantitySold == quantitySold) &&
            (identical(other.revenue, revenue) || other.revenue == revenue) &&
            (identical(other.profit, profit) || other.profit == profit) &&
            (identical(other.margin, margin) || other.margin == margin));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, productId, productName, sku,
      quantitySold, revenue, profit, margin);

  /// Create a copy of TopProductItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$TopProductItemImplCopyWith<_$TopProductItemImpl> get copyWith =>
      __$$TopProductItemImplCopyWithImpl<_$TopProductItemImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$TopProductItemImplToJson(
      this,
    );
  }
}

abstract class _TopProductItem implements TopProductItem {
  const factory _TopProductItem(
      {required final String productId,
      required final String productName,
      final String sku,
      final int quantitySold,
      required final String revenue,
      required final String profit,
      required final String margin}) = _$TopProductItemImpl;

  factory _TopProductItem.fromJson(Map<String, dynamic> json) =
      _$TopProductItemImpl.fromJson;

  @override
  String get productId;
  @override
  String get productName;
  @override
  String get sku;
  @override
  int get quantitySold;
  @override
  String get revenue;
  @override
  String get profit;
  @override
  String get margin;

  /// Create a copy of TopProductItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$TopProductItemImplCopyWith<_$TopProductItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

InventoryValuationResponse _$InventoryValuationResponseFromJson(
    Map<String, dynamic> json) {
  return _InventoryValuationResponse.fromJson(json);
}

/// @nodoc
mixin _$InventoryValuationResponse {
  List<InventoryValuationItem> get items => throw _privateConstructorUsedError;
  String get totalValue => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this InventoryValuationResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of InventoryValuationResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $InventoryValuationResponseCopyWith<InventoryValuationResponse>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $InventoryValuationResponseCopyWith<$Res> {
  factory $InventoryValuationResponseCopyWith(InventoryValuationResponse value,
          $Res Function(InventoryValuationResponse) then) =
      _$InventoryValuationResponseCopyWithImpl<$Res,
          InventoryValuationResponse>;
  @useResult
  $Res call(
      {List<InventoryValuationItem> items,
      String totalValue,
      int total,
      int page,
      int limit});
}

/// @nodoc
class _$InventoryValuationResponseCopyWithImpl<$Res,
        $Val extends InventoryValuationResponse>
    implements $InventoryValuationResponseCopyWith<$Res> {
  _$InventoryValuationResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of InventoryValuationResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? totalValue = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_value.copyWith(
      items: null == items
          ? _value.items
          : items // ignore: cast_nullable_to_non_nullable
              as List<InventoryValuationItem>,
      totalValue: null == totalValue
          ? _value.totalValue
          : totalValue // ignore: cast_nullable_to_non_nullable
              as String,
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
abstract class _$$InventoryValuationResponseImplCopyWith<$Res>
    implements $InventoryValuationResponseCopyWith<$Res> {
  factory _$$InventoryValuationResponseImplCopyWith(
          _$InventoryValuationResponseImpl value,
          $Res Function(_$InventoryValuationResponseImpl) then) =
      __$$InventoryValuationResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {List<InventoryValuationItem> items,
      String totalValue,
      int total,
      int page,
      int limit});
}

/// @nodoc
class __$$InventoryValuationResponseImplCopyWithImpl<$Res>
    extends _$InventoryValuationResponseCopyWithImpl<$Res,
        _$InventoryValuationResponseImpl>
    implements _$$InventoryValuationResponseImplCopyWith<$Res> {
  __$$InventoryValuationResponseImplCopyWithImpl(
      _$InventoryValuationResponseImpl _value,
      $Res Function(_$InventoryValuationResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of InventoryValuationResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? totalValue = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$InventoryValuationResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<InventoryValuationItem>,
      totalValue: null == totalValue
          ? _value.totalValue
          : totalValue // ignore: cast_nullable_to_non_nullable
              as String,
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
class _$InventoryValuationResponseImpl implements _InventoryValuationResponse {
  const _$InventoryValuationResponseImpl(
      {required final List<InventoryValuationItem> items,
      required this.totalValue,
      required this.total,
      required this.page,
      required this.limit})
      : _items = items;

  factory _$InventoryValuationResponseImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$InventoryValuationResponseImplFromJson(json);

  final List<InventoryValuationItem> _items;
  @override
  List<InventoryValuationItem> get items {
    if (_items is EqualUnmodifiableListView) return _items;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_items);
  }

  @override
  final String totalValue;
  @override
  final int total;
  @override
  final int page;
  @override
  final int limit;

  @override
  String toString() {
    return 'InventoryValuationResponse(items: $items, totalValue: $totalValue, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$InventoryValuationResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.totalValue, totalValue) ||
                other.totalValue == totalValue) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      const DeepCollectionEquality().hash(_items),
      totalValue,
      total,
      page,
      limit);

  /// Create a copy of InventoryValuationResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$InventoryValuationResponseImplCopyWith<_$InventoryValuationResponseImpl>
      get copyWith => __$$InventoryValuationResponseImplCopyWithImpl<
          _$InventoryValuationResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$InventoryValuationResponseImplToJson(
      this,
    );
  }
}

abstract class _InventoryValuationResponse
    implements InventoryValuationResponse {
  const factory _InventoryValuationResponse(
      {required final List<InventoryValuationItem> items,
      required final String totalValue,
      required final int total,
      required final int page,
      required final int limit}) = _$InventoryValuationResponseImpl;

  factory _InventoryValuationResponse.fromJson(Map<String, dynamic> json) =
      _$InventoryValuationResponseImpl.fromJson;

  @override
  List<InventoryValuationItem> get items;
  @override
  String get totalValue;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of InventoryValuationResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$InventoryValuationResponseImplCopyWith<_$InventoryValuationResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

InventoryValuationItem _$InventoryValuationItemFromJson(
    Map<String, dynamic> json) {
  return _InventoryValuationItem.fromJson(json);
}

/// @nodoc
mixin _$InventoryValuationItem {
  String get productId => throw _privateConstructorUsedError;
  String get productName => throw _privateConstructorUsedError;
  String get sku => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  String get averageCost => throw _privateConstructorUsedError;
  String get inventoryValue => throw _privateConstructorUsedError;

  /// Serializes this InventoryValuationItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of InventoryValuationItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $InventoryValuationItemCopyWith<InventoryValuationItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $InventoryValuationItemCopyWith<$Res> {
  factory $InventoryValuationItemCopyWith(InventoryValuationItem value,
          $Res Function(InventoryValuationItem) then) =
      _$InventoryValuationItemCopyWithImpl<$Res, InventoryValuationItem>;
  @useResult
  $Res call(
      {String productId,
      String productName,
      String sku,
      int quantity,
      String averageCost,
      String inventoryValue});
}

/// @nodoc
class _$InventoryValuationItemCopyWithImpl<$Res,
        $Val extends InventoryValuationItem>
    implements $InventoryValuationItemCopyWith<$Res> {
  _$InventoryValuationItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of InventoryValuationItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? productName = null,
    Object? sku = null,
    Object? quantity = null,
    Object? averageCost = null,
    Object? inventoryValue = null,
  }) {
    return _then(_value.copyWith(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      productName: null == productName
          ? _value.productName
          : productName // ignore: cast_nullable_to_non_nullable
              as String,
      sku: null == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      averageCost: null == averageCost
          ? _value.averageCost
          : averageCost // ignore: cast_nullable_to_non_nullable
              as String,
      inventoryValue: null == inventoryValue
          ? _value.inventoryValue
          : inventoryValue // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$InventoryValuationItemImplCopyWith<$Res>
    implements $InventoryValuationItemCopyWith<$Res> {
  factory _$$InventoryValuationItemImplCopyWith(
          _$InventoryValuationItemImpl value,
          $Res Function(_$InventoryValuationItemImpl) then) =
      __$$InventoryValuationItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String productId,
      String productName,
      String sku,
      int quantity,
      String averageCost,
      String inventoryValue});
}

/// @nodoc
class __$$InventoryValuationItemImplCopyWithImpl<$Res>
    extends _$InventoryValuationItemCopyWithImpl<$Res,
        _$InventoryValuationItemImpl>
    implements _$$InventoryValuationItemImplCopyWith<$Res> {
  __$$InventoryValuationItemImplCopyWithImpl(
      _$InventoryValuationItemImpl _value,
      $Res Function(_$InventoryValuationItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of InventoryValuationItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? productName = null,
    Object? sku = null,
    Object? quantity = null,
    Object? averageCost = null,
    Object? inventoryValue = null,
  }) {
    return _then(_$InventoryValuationItemImpl(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      productName: null == productName
          ? _value.productName
          : productName // ignore: cast_nullable_to_non_nullable
              as String,
      sku: null == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      averageCost: null == averageCost
          ? _value.averageCost
          : averageCost // ignore: cast_nullable_to_non_nullable
              as String,
      inventoryValue: null == inventoryValue
          ? _value.inventoryValue
          : inventoryValue // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$InventoryValuationItemImpl implements _InventoryValuationItem {
  const _$InventoryValuationItemImpl(
      {required this.productId,
      required this.productName,
      this.sku = '',
      required this.quantity,
      required this.averageCost,
      required this.inventoryValue});

  factory _$InventoryValuationItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$InventoryValuationItemImplFromJson(json);

  @override
  final String productId;
  @override
  final String productName;
  @override
  @JsonKey()
  final String sku;
  @override
  final int quantity;
  @override
  final String averageCost;
  @override
  final String inventoryValue;

  @override
  String toString() {
    return 'InventoryValuationItem(productId: $productId, productName: $productName, sku: $sku, quantity: $quantity, averageCost: $averageCost, inventoryValue: $inventoryValue)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$InventoryValuationItemImpl &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.productName, productName) ||
                other.productName == productName) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.averageCost, averageCost) ||
                other.averageCost == averageCost) &&
            (identical(other.inventoryValue, inventoryValue) ||
                other.inventoryValue == inventoryValue));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, productId, productName, sku,
      quantity, averageCost, inventoryValue);

  /// Create a copy of InventoryValuationItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$InventoryValuationItemImplCopyWith<_$InventoryValuationItemImpl>
      get copyWith => __$$InventoryValuationItemImplCopyWithImpl<
          _$InventoryValuationItemImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$InventoryValuationItemImplToJson(
      this,
    );
  }
}

abstract class _InventoryValuationItem implements InventoryValuationItem {
  const factory _InventoryValuationItem(
      {required final String productId,
      required final String productName,
      final String sku,
      required final int quantity,
      required final String averageCost,
      required final String inventoryValue}) = _$InventoryValuationItemImpl;

  factory _InventoryValuationItem.fromJson(Map<String, dynamic> json) =
      _$InventoryValuationItemImpl.fromJson;

  @override
  String get productId;
  @override
  String get productName;
  @override
  String get sku;
  @override
  int get quantity;
  @override
  String get averageCost;
  @override
  String get inventoryValue;

  /// Create a copy of InventoryValuationItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$InventoryValuationItemImplCopyWith<_$InventoryValuationItemImpl>
      get copyWith => throw _privateConstructorUsedError;
}

CustomerReportResponse _$CustomerReportResponseFromJson(
    Map<String, dynamic> json) {
  return _CustomerReportResponse.fromJson(json);
}

/// @nodoc
mixin _$CustomerReportResponse {
  List<CustomerReportItem> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this CustomerReportResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CustomerReportResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CustomerReportResponseCopyWith<CustomerReportResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CustomerReportResponseCopyWith<$Res> {
  factory $CustomerReportResponseCopyWith(CustomerReportResponse value,
          $Res Function(CustomerReportResponse) then) =
      _$CustomerReportResponseCopyWithImpl<$Res, CustomerReportResponse>;
  @useResult
  $Res call({List<CustomerReportItem> items, int total, int page, int limit});
}

/// @nodoc
class _$CustomerReportResponseCopyWithImpl<$Res,
        $Val extends CustomerReportResponse>
    implements $CustomerReportResponseCopyWith<$Res> {
  _$CustomerReportResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CustomerReportResponse
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
              as List<CustomerReportItem>,
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
abstract class _$$CustomerReportResponseImplCopyWith<$Res>
    implements $CustomerReportResponseCopyWith<$Res> {
  factory _$$CustomerReportResponseImplCopyWith(
          _$CustomerReportResponseImpl value,
          $Res Function(_$CustomerReportResponseImpl) then) =
      __$$CustomerReportResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<CustomerReportItem> items, int total, int page, int limit});
}

/// @nodoc
class __$$CustomerReportResponseImplCopyWithImpl<$Res>
    extends _$CustomerReportResponseCopyWithImpl<$Res,
        _$CustomerReportResponseImpl>
    implements _$$CustomerReportResponseImplCopyWith<$Res> {
  __$$CustomerReportResponseImplCopyWithImpl(
      _$CustomerReportResponseImpl _value,
      $Res Function(_$CustomerReportResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of CustomerReportResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$CustomerReportResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<CustomerReportItem>,
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
class _$CustomerReportResponseImpl implements _CustomerReportResponse {
  const _$CustomerReportResponseImpl(
      {required final List<CustomerReportItem> items,
      required this.total,
      required this.page,
      required this.limit})
      : _items = items;

  factory _$CustomerReportResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$CustomerReportResponseImplFromJson(json);

  final List<CustomerReportItem> _items;
  @override
  List<CustomerReportItem> get items {
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
    return 'CustomerReportResponse(items: $items, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CustomerReportResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_items), total, page, limit);

  /// Create a copy of CustomerReportResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CustomerReportResponseImplCopyWith<_$CustomerReportResponseImpl>
      get copyWith => __$$CustomerReportResponseImplCopyWithImpl<
          _$CustomerReportResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CustomerReportResponseImplToJson(
      this,
    );
  }
}

abstract class _CustomerReportResponse implements CustomerReportResponse {
  const factory _CustomerReportResponse(
      {required final List<CustomerReportItem> items,
      required final int total,
      required final int page,
      required final int limit}) = _$CustomerReportResponseImpl;

  factory _CustomerReportResponse.fromJson(Map<String, dynamic> json) =
      _$CustomerReportResponseImpl.fromJson;

  @override
  List<CustomerReportItem> get items;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of CustomerReportResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CustomerReportResponseImplCopyWith<_$CustomerReportResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

CustomerReportItem _$CustomerReportItemFromJson(Map<String, dynamic> json) {
  return _CustomerReportItem.fromJson(json);
}

/// @nodoc
mixin _$CustomerReportItem {
  String get customerId => throw _privateConstructorUsedError;
  String get name => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  int get orders => throw _privateConstructorUsedError;
  String get revenue => throw _privateConstructorUsedError;
  String get averageReceipt => throw _privateConstructorUsedError;
  String? get lastPurchase => throw _privateConstructorUsedError;

  /// Serializes this CustomerReportItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CustomerReportItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CustomerReportItemCopyWith<CustomerReportItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CustomerReportItemCopyWith<$Res> {
  factory $CustomerReportItemCopyWith(
          CustomerReportItem value, $Res Function(CustomerReportItem) then) =
      _$CustomerReportItemCopyWithImpl<$Res, CustomerReportItem>;
  @useResult
  $Res call(
      {String customerId,
      String name,
      String? email,
      String? phone,
      int orders,
      String revenue,
      String averageReceipt,
      String? lastPurchase});
}

/// @nodoc
class _$CustomerReportItemCopyWithImpl<$Res, $Val extends CustomerReportItem>
    implements $CustomerReportItemCopyWith<$Res> {
  _$CustomerReportItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CustomerReportItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? customerId = null,
    Object? name = null,
    Object? email = freezed,
    Object? phone = freezed,
    Object? orders = null,
    Object? revenue = null,
    Object? averageReceipt = null,
    Object? lastPurchase = freezed,
  }) {
    return _then(_value.copyWith(
      customerId: null == customerId
          ? _value.customerId
          : customerId // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      orders: null == orders
          ? _value.orders
          : orders // ignore: cast_nullable_to_non_nullable
              as int,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      averageReceipt: null == averageReceipt
          ? _value.averageReceipt
          : averageReceipt // ignore: cast_nullable_to_non_nullable
              as String,
      lastPurchase: freezed == lastPurchase
          ? _value.lastPurchase
          : lastPurchase // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CustomerReportItemImplCopyWith<$Res>
    implements $CustomerReportItemCopyWith<$Res> {
  factory _$$CustomerReportItemImplCopyWith(_$CustomerReportItemImpl value,
          $Res Function(_$CustomerReportItemImpl) then) =
      __$$CustomerReportItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String customerId,
      String name,
      String? email,
      String? phone,
      int orders,
      String revenue,
      String averageReceipt,
      String? lastPurchase});
}

/// @nodoc
class __$$CustomerReportItemImplCopyWithImpl<$Res>
    extends _$CustomerReportItemCopyWithImpl<$Res, _$CustomerReportItemImpl>
    implements _$$CustomerReportItemImplCopyWith<$Res> {
  __$$CustomerReportItemImplCopyWithImpl(_$CustomerReportItemImpl _value,
      $Res Function(_$CustomerReportItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of CustomerReportItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? customerId = null,
    Object? name = null,
    Object? email = freezed,
    Object? phone = freezed,
    Object? orders = null,
    Object? revenue = null,
    Object? averageReceipt = null,
    Object? lastPurchase = freezed,
  }) {
    return _then(_$CustomerReportItemImpl(
      customerId: null == customerId
          ? _value.customerId
          : customerId // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      orders: null == orders
          ? _value.orders
          : orders // ignore: cast_nullable_to_non_nullable
              as int,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      averageReceipt: null == averageReceipt
          ? _value.averageReceipt
          : averageReceipt // ignore: cast_nullable_to_non_nullable
              as String,
      lastPurchase: freezed == lastPurchase
          ? _value.lastPurchase
          : lastPurchase // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$CustomerReportItemImpl implements _CustomerReportItem {
  const _$CustomerReportItemImpl(
      {required this.customerId,
      required this.name,
      this.email,
      this.phone,
      this.orders = 0,
      this.revenue = '0.0000',
      this.averageReceipt = '0.0000',
      this.lastPurchase});

  factory _$CustomerReportItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$CustomerReportItemImplFromJson(json);

  @override
  final String customerId;
  @override
  final String name;
  @override
  final String? email;
  @override
  final String? phone;
  @override
  @JsonKey()
  final int orders;
  @override
  @JsonKey()
  final String revenue;
  @override
  @JsonKey()
  final String averageReceipt;
  @override
  final String? lastPurchase;

  @override
  String toString() {
    return 'CustomerReportItem(customerId: $customerId, name: $name, email: $email, phone: $phone, orders: $orders, revenue: $revenue, averageReceipt: $averageReceipt, lastPurchase: $lastPurchase)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CustomerReportItemImpl &&
            (identical(other.customerId, customerId) ||
                other.customerId == customerId) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.orders, orders) || other.orders == orders) &&
            (identical(other.revenue, revenue) || other.revenue == revenue) &&
            (identical(other.averageReceipt, averageReceipt) ||
                other.averageReceipt == averageReceipt) &&
            (identical(other.lastPurchase, lastPurchase) ||
                other.lastPurchase == lastPurchase));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, customerId, name, email, phone,
      orders, revenue, averageReceipt, lastPurchase);

  /// Create a copy of CustomerReportItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CustomerReportItemImplCopyWith<_$CustomerReportItemImpl> get copyWith =>
      __$$CustomerReportItemImplCopyWithImpl<_$CustomerReportItemImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CustomerReportItemImplToJson(
      this,
    );
  }
}

abstract class _CustomerReportItem implements CustomerReportItem {
  const factory _CustomerReportItem(
      {required final String customerId,
      required final String name,
      final String? email,
      final String? phone,
      final int orders,
      final String revenue,
      final String averageReceipt,
      final String? lastPurchase}) = _$CustomerReportItemImpl;

  factory _CustomerReportItem.fromJson(Map<String, dynamic> json) =
      _$CustomerReportItemImpl.fromJson;

  @override
  String get customerId;
  @override
  String get name;
  @override
  String? get email;
  @override
  String? get phone;
  @override
  int get orders;
  @override
  String get revenue;
  @override
  String get averageReceipt;
  @override
  String? get lastPurchase;

  /// Create a copy of CustomerReportItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CustomerReportItemImplCopyWith<_$CustomerReportItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SupplierReportResponse _$SupplierReportResponseFromJson(
    Map<String, dynamic> json) {
  return _SupplierReportResponse.fromJson(json);
}

/// @nodoc
mixin _$SupplierReportResponse {
  List<SupplierReportItem> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this SupplierReportResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierReportResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierReportResponseCopyWith<SupplierReportResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierReportResponseCopyWith<$Res> {
  factory $SupplierReportResponseCopyWith(SupplierReportResponse value,
          $Res Function(SupplierReportResponse) then) =
      _$SupplierReportResponseCopyWithImpl<$Res, SupplierReportResponse>;
  @useResult
  $Res call({List<SupplierReportItem> items, int total, int page, int limit});
}

/// @nodoc
class _$SupplierReportResponseCopyWithImpl<$Res,
        $Val extends SupplierReportResponse>
    implements $SupplierReportResponseCopyWith<$Res> {
  _$SupplierReportResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierReportResponse
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
              as List<SupplierReportItem>,
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
abstract class _$$SupplierReportResponseImplCopyWith<$Res>
    implements $SupplierReportResponseCopyWith<$Res> {
  factory _$$SupplierReportResponseImplCopyWith(
          _$SupplierReportResponseImpl value,
          $Res Function(_$SupplierReportResponseImpl) then) =
      __$$SupplierReportResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<SupplierReportItem> items, int total, int page, int limit});
}

/// @nodoc
class __$$SupplierReportResponseImplCopyWithImpl<$Res>
    extends _$SupplierReportResponseCopyWithImpl<$Res,
        _$SupplierReportResponseImpl>
    implements _$$SupplierReportResponseImplCopyWith<$Res> {
  __$$SupplierReportResponseImplCopyWithImpl(
      _$SupplierReportResponseImpl _value,
      $Res Function(_$SupplierReportResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierReportResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$SupplierReportResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<SupplierReportItem>,
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
class _$SupplierReportResponseImpl implements _SupplierReportResponse {
  const _$SupplierReportResponseImpl(
      {required final List<SupplierReportItem> items,
      required this.total,
      required this.page,
      required this.limit})
      : _items = items;

  factory _$SupplierReportResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierReportResponseImplFromJson(json);

  final List<SupplierReportItem> _items;
  @override
  List<SupplierReportItem> get items {
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
    return 'SupplierReportResponse(items: $items, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierReportResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_items), total, page, limit);

  /// Create a copy of SupplierReportResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierReportResponseImplCopyWith<_$SupplierReportResponseImpl>
      get copyWith => __$$SupplierReportResponseImplCopyWithImpl<
          _$SupplierReportResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierReportResponseImplToJson(
      this,
    );
  }
}

abstract class _SupplierReportResponse implements SupplierReportResponse {
  const factory _SupplierReportResponse(
      {required final List<SupplierReportItem> items,
      required final int total,
      required final int page,
      required final int limit}) = _$SupplierReportResponseImpl;

  factory _SupplierReportResponse.fromJson(Map<String, dynamic> json) =
      _$SupplierReportResponseImpl.fromJson;

  @override
  List<SupplierReportItem> get items;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of SupplierReportResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierReportResponseImplCopyWith<_$SupplierReportResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

SupplierReportItem _$SupplierReportItemFromJson(Map<String, dynamic> json) {
  return _SupplierReportItem.fromJson(json);
}

/// @nodoc
mixin _$SupplierReportItem {
  String get supplierId => throw _privateConstructorUsedError;
  String get companyName => throw _privateConstructorUsedError;
  String? get email => throw _privateConstructorUsedError;
  String? get phone => throw _privateConstructorUsedError;
  int get purchaseOrders => throw _privateConstructorUsedError;
  String get purchaseTotal => throw _privateConstructorUsedError;
  String? get lastPurchase => throw _privateConstructorUsedError;

  /// Serializes this SupplierReportItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierReportItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierReportItemCopyWith<SupplierReportItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierReportItemCopyWith<$Res> {
  factory $SupplierReportItemCopyWith(
          SupplierReportItem value, $Res Function(SupplierReportItem) then) =
      _$SupplierReportItemCopyWithImpl<$Res, SupplierReportItem>;
  @useResult
  $Res call(
      {String supplierId,
      String companyName,
      String? email,
      String? phone,
      int purchaseOrders,
      String purchaseTotal,
      String? lastPurchase});
}

/// @nodoc
class _$SupplierReportItemCopyWithImpl<$Res, $Val extends SupplierReportItem>
    implements $SupplierReportItemCopyWith<$Res> {
  _$SupplierReportItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierReportItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? supplierId = null,
    Object? companyName = null,
    Object? email = freezed,
    Object? phone = freezed,
    Object? purchaseOrders = null,
    Object? purchaseTotal = null,
    Object? lastPurchase = freezed,
  }) {
    return _then(_value.copyWith(
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      companyName: null == companyName
          ? _value.companyName
          : companyName // ignore: cast_nullable_to_non_nullable
              as String,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      purchaseOrders: null == purchaseOrders
          ? _value.purchaseOrders
          : purchaseOrders // ignore: cast_nullable_to_non_nullable
              as int,
      purchaseTotal: null == purchaseTotal
          ? _value.purchaseTotal
          : purchaseTotal // ignore: cast_nullable_to_non_nullable
              as String,
      lastPurchase: freezed == lastPurchase
          ? _value.lastPurchase
          : lastPurchase // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SupplierReportItemImplCopyWith<$Res>
    implements $SupplierReportItemCopyWith<$Res> {
  factory _$$SupplierReportItemImplCopyWith(_$SupplierReportItemImpl value,
          $Res Function(_$SupplierReportItemImpl) then) =
      __$$SupplierReportItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String supplierId,
      String companyName,
      String? email,
      String? phone,
      int purchaseOrders,
      String purchaseTotal,
      String? lastPurchase});
}

/// @nodoc
class __$$SupplierReportItemImplCopyWithImpl<$Res>
    extends _$SupplierReportItemCopyWithImpl<$Res, _$SupplierReportItemImpl>
    implements _$$SupplierReportItemImplCopyWith<$Res> {
  __$$SupplierReportItemImplCopyWithImpl(_$SupplierReportItemImpl _value,
      $Res Function(_$SupplierReportItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierReportItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? supplierId = null,
    Object? companyName = null,
    Object? email = freezed,
    Object? phone = freezed,
    Object? purchaseOrders = null,
    Object? purchaseTotal = null,
    Object? lastPurchase = freezed,
  }) {
    return _then(_$SupplierReportItemImpl(
      supplierId: null == supplierId
          ? _value.supplierId
          : supplierId // ignore: cast_nullable_to_non_nullable
              as String,
      companyName: null == companyName
          ? _value.companyName
          : companyName // ignore: cast_nullable_to_non_nullable
              as String,
      email: freezed == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String?,
      phone: freezed == phone
          ? _value.phone
          : phone // ignore: cast_nullable_to_non_nullable
              as String?,
      purchaseOrders: null == purchaseOrders
          ? _value.purchaseOrders
          : purchaseOrders // ignore: cast_nullable_to_non_nullable
              as int,
      purchaseTotal: null == purchaseTotal
          ? _value.purchaseTotal
          : purchaseTotal // ignore: cast_nullable_to_non_nullable
              as String,
      lastPurchase: freezed == lastPurchase
          ? _value.lastPurchase
          : lastPurchase // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SupplierReportItemImpl implements _SupplierReportItem {
  const _$SupplierReportItemImpl(
      {required this.supplierId,
      this.companyName = '',
      this.email,
      this.phone,
      this.purchaseOrders = 0,
      this.purchaseTotal = '0.0000',
      this.lastPurchase});

  factory _$SupplierReportItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierReportItemImplFromJson(json);

  @override
  final String supplierId;
  @override
  @JsonKey()
  final String companyName;
  @override
  final String? email;
  @override
  final String? phone;
  @override
  @JsonKey()
  final int purchaseOrders;
  @override
  @JsonKey()
  final String purchaseTotal;
  @override
  final String? lastPurchase;

  @override
  String toString() {
    return 'SupplierReportItem(supplierId: $supplierId, companyName: $companyName, email: $email, phone: $phone, purchaseOrders: $purchaseOrders, purchaseTotal: $purchaseTotal, lastPurchase: $lastPurchase)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierReportItemImpl &&
            (identical(other.supplierId, supplierId) ||
                other.supplierId == supplierId) &&
            (identical(other.companyName, companyName) ||
                other.companyName == companyName) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.phone, phone) || other.phone == phone) &&
            (identical(other.purchaseOrders, purchaseOrders) ||
                other.purchaseOrders == purchaseOrders) &&
            (identical(other.purchaseTotal, purchaseTotal) ||
                other.purchaseTotal == purchaseTotal) &&
            (identical(other.lastPurchase, lastPurchase) ||
                other.lastPurchase == lastPurchase));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, supplierId, companyName, email,
      phone, purchaseOrders, purchaseTotal, lastPurchase);

  /// Create a copy of SupplierReportItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierReportItemImplCopyWith<_$SupplierReportItemImpl> get copyWith =>
      __$$SupplierReportItemImplCopyWithImpl<_$SupplierReportItemImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierReportItemImplToJson(
      this,
    );
  }
}

abstract class _SupplierReportItem implements SupplierReportItem {
  const factory _SupplierReportItem(
      {required final String supplierId,
      final String companyName,
      final String? email,
      final String? phone,
      final int purchaseOrders,
      final String purchaseTotal,
      final String? lastPurchase}) = _$SupplierReportItemImpl;

  factory _SupplierReportItem.fromJson(Map<String, dynamic> json) =
      _$SupplierReportItemImpl.fromJson;

  @override
  String get supplierId;
  @override
  String get companyName;
  @override
  String? get email;
  @override
  String? get phone;
  @override
  int get purchaseOrders;
  @override
  String get purchaseTotal;
  @override
  String? get lastPurchase;

  /// Create a copy of SupplierReportItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierReportItemImplCopyWith<_$SupplierReportItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

CashShiftReportResponse _$CashShiftReportResponseFromJson(
    Map<String, dynamic> json) {
  return _CashShiftReportResponse.fromJson(json);
}

/// @nodoc
mixin _$CashShiftReportResponse {
  List<CashShiftReportItem> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this CashShiftReportResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CashShiftReportResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CashShiftReportResponseCopyWith<CashShiftReportResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CashShiftReportResponseCopyWith<$Res> {
  factory $CashShiftReportResponseCopyWith(CashShiftReportResponse value,
          $Res Function(CashShiftReportResponse) then) =
      _$CashShiftReportResponseCopyWithImpl<$Res, CashShiftReportResponse>;
  @useResult
  $Res call({List<CashShiftReportItem> items, int total, int page, int limit});
}

/// @nodoc
class _$CashShiftReportResponseCopyWithImpl<$Res,
        $Val extends CashShiftReportResponse>
    implements $CashShiftReportResponseCopyWith<$Res> {
  _$CashShiftReportResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CashShiftReportResponse
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
              as List<CashShiftReportItem>,
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
abstract class _$$CashShiftReportResponseImplCopyWith<$Res>
    implements $CashShiftReportResponseCopyWith<$Res> {
  factory _$$CashShiftReportResponseImplCopyWith(
          _$CashShiftReportResponseImpl value,
          $Res Function(_$CashShiftReportResponseImpl) then) =
      __$$CashShiftReportResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({List<CashShiftReportItem> items, int total, int page, int limit});
}

/// @nodoc
class __$$CashShiftReportResponseImplCopyWithImpl<$Res>
    extends _$CashShiftReportResponseCopyWithImpl<$Res,
        _$CashShiftReportResponseImpl>
    implements _$$CashShiftReportResponseImplCopyWith<$Res> {
  __$$CashShiftReportResponseImplCopyWithImpl(
      _$CashShiftReportResponseImpl _value,
      $Res Function(_$CashShiftReportResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of CashShiftReportResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$CashShiftReportResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<CashShiftReportItem>,
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
class _$CashShiftReportResponseImpl implements _CashShiftReportResponse {
  const _$CashShiftReportResponseImpl(
      {required final List<CashShiftReportItem> items,
      required this.total,
      required this.page,
      required this.limit})
      : _items = items;

  factory _$CashShiftReportResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$CashShiftReportResponseImplFromJson(json);

  final List<CashShiftReportItem> _items;
  @override
  List<CashShiftReportItem> get items {
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
    return 'CashShiftReportResponse(items: $items, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CashShiftReportResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_items), total, page, limit);

  /// Create a copy of CashShiftReportResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CashShiftReportResponseImplCopyWith<_$CashShiftReportResponseImpl>
      get copyWith => __$$CashShiftReportResponseImplCopyWithImpl<
          _$CashShiftReportResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CashShiftReportResponseImplToJson(
      this,
    );
  }
}

abstract class _CashShiftReportResponse implements CashShiftReportResponse {
  const factory _CashShiftReportResponse(
      {required final List<CashShiftReportItem> items,
      required final int total,
      required final int page,
      required final int limit}) = _$CashShiftReportResponseImpl;

  factory _CashShiftReportResponse.fromJson(Map<String, dynamic> json) =
      _$CashShiftReportResponseImpl.fromJson;

  @override
  List<CashShiftReportItem> get items;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of CashShiftReportResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CashShiftReportResponseImplCopyWith<_$CashShiftReportResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

CashShiftReportItem _$CashShiftReportItemFromJson(Map<String, dynamic> json) {
  return _CashShiftReportItem.fromJson(json);
}

/// @nodoc
mixin _$CashShiftReportItem {
  String get id => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String get openedAt => throw _privateConstructorUsedError;
  String? get closedAt => throw _privateConstructorUsedError;
  String get warehouseName => throw _privateConstructorUsedError;
  String get cashierName => throw _privateConstructorUsedError;
  String get openingBalance => throw _privateConstructorUsedError;
  String get closingBalance => throw _privateConstructorUsedError;
  String get cashSales => throw _privateConstructorUsedError;
  String get cardSales => throw _privateConstructorUsedError;
  String get qrSales => throw _privateConstructorUsedError;
  String get bankTransferSales => throw _privateConstructorUsedError;
  String get mobileWalletSales => throw _privateConstructorUsedError;
  String get totalSales => throw _privateConstructorUsedError;
  String get cashIn => throw _privateConstructorUsedError;
  String get cashOut => throw _privateConstructorUsedError;
  String get expectedClosing => throw _privateConstructorUsedError;
  String get difference => throw _privateConstructorUsedError;
  String? get notes => throw _privateConstructorUsedError;

  /// Serializes this CashShiftReportItem to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of CashShiftReportItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $CashShiftReportItemCopyWith<CashShiftReportItem> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $CashShiftReportItemCopyWith<$Res> {
  factory $CashShiftReportItemCopyWith(
          CashShiftReportItem value, $Res Function(CashShiftReportItem) then) =
      _$CashShiftReportItemCopyWithImpl<$Res, CashShiftReportItem>;
  @useResult
  $Res call(
      {String id,
      String status,
      String openedAt,
      String? closedAt,
      String warehouseName,
      String cashierName,
      String openingBalance,
      String closingBalance,
      String cashSales,
      String cardSales,
      String qrSales,
      String bankTransferSales,
      String mobileWalletSales,
      String totalSales,
      String cashIn,
      String cashOut,
      String expectedClosing,
      String difference,
      String? notes});
}

/// @nodoc
class _$CashShiftReportItemCopyWithImpl<$Res, $Val extends CashShiftReportItem>
    implements $CashShiftReportItemCopyWith<$Res> {
  _$CashShiftReportItemCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of CashShiftReportItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? status = null,
    Object? openedAt = null,
    Object? closedAt = freezed,
    Object? warehouseName = null,
    Object? cashierName = null,
    Object? openingBalance = null,
    Object? closingBalance = null,
    Object? cashSales = null,
    Object? cardSales = null,
    Object? qrSales = null,
    Object? bankTransferSales = null,
    Object? mobileWalletSales = null,
    Object? totalSales = null,
    Object? cashIn = null,
    Object? cashOut = null,
    Object? expectedClosing = null,
    Object? difference = null,
    Object? notes = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      openedAt: null == openedAt
          ? _value.openedAt
          : openedAt // ignore: cast_nullable_to_non_nullable
              as String,
      closedAt: freezed == closedAt
          ? _value.closedAt
          : closedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      warehouseName: null == warehouseName
          ? _value.warehouseName
          : warehouseName // ignore: cast_nullable_to_non_nullable
              as String,
      cashierName: null == cashierName
          ? _value.cashierName
          : cashierName // ignore: cast_nullable_to_non_nullable
              as String,
      openingBalance: null == openingBalance
          ? _value.openingBalance
          : openingBalance // ignore: cast_nullable_to_non_nullable
              as String,
      closingBalance: null == closingBalance
          ? _value.closingBalance
          : closingBalance // ignore: cast_nullable_to_non_nullable
              as String,
      cashSales: null == cashSales
          ? _value.cashSales
          : cashSales // ignore: cast_nullable_to_non_nullable
              as String,
      cardSales: null == cardSales
          ? _value.cardSales
          : cardSales // ignore: cast_nullable_to_non_nullable
              as String,
      qrSales: null == qrSales
          ? _value.qrSales
          : qrSales // ignore: cast_nullable_to_non_nullable
              as String,
      bankTransferSales: null == bankTransferSales
          ? _value.bankTransferSales
          : bankTransferSales // ignore: cast_nullable_to_non_nullable
              as String,
      mobileWalletSales: null == mobileWalletSales
          ? _value.mobileWalletSales
          : mobileWalletSales // ignore: cast_nullable_to_non_nullable
              as String,
      totalSales: null == totalSales
          ? _value.totalSales
          : totalSales // ignore: cast_nullable_to_non_nullable
              as String,
      cashIn: null == cashIn
          ? _value.cashIn
          : cashIn // ignore: cast_nullable_to_non_nullable
              as String,
      cashOut: null == cashOut
          ? _value.cashOut
          : cashOut // ignore: cast_nullable_to_non_nullable
              as String,
      expectedClosing: null == expectedClosing
          ? _value.expectedClosing
          : expectedClosing // ignore: cast_nullable_to_non_nullable
              as String,
      difference: null == difference
          ? _value.difference
          : difference // ignore: cast_nullable_to_non_nullable
              as String,
      notes: freezed == notes
          ? _value.notes
          : notes // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$CashShiftReportItemImplCopyWith<$Res>
    implements $CashShiftReportItemCopyWith<$Res> {
  factory _$$CashShiftReportItemImplCopyWith(_$CashShiftReportItemImpl value,
          $Res Function(_$CashShiftReportItemImpl) then) =
      __$$CashShiftReportItemImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String status,
      String openedAt,
      String? closedAt,
      String warehouseName,
      String cashierName,
      String openingBalance,
      String closingBalance,
      String cashSales,
      String cardSales,
      String qrSales,
      String bankTransferSales,
      String mobileWalletSales,
      String totalSales,
      String cashIn,
      String cashOut,
      String expectedClosing,
      String difference,
      String? notes});
}

/// @nodoc
class __$$CashShiftReportItemImplCopyWithImpl<$Res>
    extends _$CashShiftReportItemCopyWithImpl<$Res, _$CashShiftReportItemImpl>
    implements _$$CashShiftReportItemImplCopyWith<$Res> {
  __$$CashShiftReportItemImplCopyWithImpl(_$CashShiftReportItemImpl _value,
      $Res Function(_$CashShiftReportItemImpl) _then)
      : super(_value, _then);

  /// Create a copy of CashShiftReportItem
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? status = null,
    Object? openedAt = null,
    Object? closedAt = freezed,
    Object? warehouseName = null,
    Object? cashierName = null,
    Object? openingBalance = null,
    Object? closingBalance = null,
    Object? cashSales = null,
    Object? cardSales = null,
    Object? qrSales = null,
    Object? bankTransferSales = null,
    Object? mobileWalletSales = null,
    Object? totalSales = null,
    Object? cashIn = null,
    Object? cashOut = null,
    Object? expectedClosing = null,
    Object? difference = null,
    Object? notes = freezed,
  }) {
    return _then(_$CashShiftReportItemImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      openedAt: null == openedAt
          ? _value.openedAt
          : openedAt // ignore: cast_nullable_to_non_nullable
              as String,
      closedAt: freezed == closedAt
          ? _value.closedAt
          : closedAt // ignore: cast_nullable_to_non_nullable
              as String?,
      warehouseName: null == warehouseName
          ? _value.warehouseName
          : warehouseName // ignore: cast_nullable_to_non_nullable
              as String,
      cashierName: null == cashierName
          ? _value.cashierName
          : cashierName // ignore: cast_nullable_to_non_nullable
              as String,
      openingBalance: null == openingBalance
          ? _value.openingBalance
          : openingBalance // ignore: cast_nullable_to_non_nullable
              as String,
      closingBalance: null == closingBalance
          ? _value.closingBalance
          : closingBalance // ignore: cast_nullable_to_non_nullable
              as String,
      cashSales: null == cashSales
          ? _value.cashSales
          : cashSales // ignore: cast_nullable_to_non_nullable
              as String,
      cardSales: null == cardSales
          ? _value.cardSales
          : cardSales // ignore: cast_nullable_to_non_nullable
              as String,
      qrSales: null == qrSales
          ? _value.qrSales
          : qrSales // ignore: cast_nullable_to_non_nullable
              as String,
      bankTransferSales: null == bankTransferSales
          ? _value.bankTransferSales
          : bankTransferSales // ignore: cast_nullable_to_non_nullable
              as String,
      mobileWalletSales: null == mobileWalletSales
          ? _value.mobileWalletSales
          : mobileWalletSales // ignore: cast_nullable_to_non_nullable
              as String,
      totalSales: null == totalSales
          ? _value.totalSales
          : totalSales // ignore: cast_nullable_to_non_nullable
              as String,
      cashIn: null == cashIn
          ? _value.cashIn
          : cashIn // ignore: cast_nullable_to_non_nullable
              as String,
      cashOut: null == cashOut
          ? _value.cashOut
          : cashOut // ignore: cast_nullable_to_non_nullable
              as String,
      expectedClosing: null == expectedClosing
          ? _value.expectedClosing
          : expectedClosing // ignore: cast_nullable_to_non_nullable
              as String,
      difference: null == difference
          ? _value.difference
          : difference // ignore: cast_nullable_to_non_nullable
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
class _$CashShiftReportItemImpl extends _CashShiftReportItem {
  const _$CashShiftReportItemImpl(
      {required this.id,
      required this.status,
      required this.openedAt,
      this.closedAt,
      this.warehouseName = '',
      this.cashierName = '',
      required this.openingBalance,
      required this.closingBalance,
      this.cashSales = '0.0000',
      this.cardSales = '0.0000',
      this.qrSales = '0.0000',
      this.bankTransferSales = '0.0000',
      this.mobileWalletSales = '0.0000',
      this.totalSales = '0.0000',
      this.cashIn = '0.0000',
      this.cashOut = '0.0000',
      this.expectedClosing = '0.0000',
      this.difference = '0.0000',
      this.notes})
      : super._();

  factory _$CashShiftReportItemImpl.fromJson(Map<String, dynamic> json) =>
      _$$CashShiftReportItemImplFromJson(json);

  @override
  final String id;
  @override
  final String status;
  @override
  final String openedAt;
  @override
  final String? closedAt;
  @override
  @JsonKey()
  final String warehouseName;
  @override
  @JsonKey()
  final String cashierName;
  @override
  final String openingBalance;
  @override
  final String closingBalance;
  @override
  @JsonKey()
  final String cashSales;
  @override
  @JsonKey()
  final String cardSales;
  @override
  @JsonKey()
  final String qrSales;
  @override
  @JsonKey()
  final String bankTransferSales;
  @override
  @JsonKey()
  final String mobileWalletSales;
  @override
  @JsonKey()
  final String totalSales;
  @override
  @JsonKey()
  final String cashIn;
  @override
  @JsonKey()
  final String cashOut;
  @override
  @JsonKey()
  final String expectedClosing;
  @override
  @JsonKey()
  final String difference;
  @override
  final String? notes;

  @override
  String toString() {
    return 'CashShiftReportItem(id: $id, status: $status, openedAt: $openedAt, closedAt: $closedAt, warehouseName: $warehouseName, cashierName: $cashierName, openingBalance: $openingBalance, closingBalance: $closingBalance, cashSales: $cashSales, cardSales: $cardSales, qrSales: $qrSales, bankTransferSales: $bankTransferSales, mobileWalletSales: $mobileWalletSales, totalSales: $totalSales, cashIn: $cashIn, cashOut: $cashOut, expectedClosing: $expectedClosing, difference: $difference, notes: $notes)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$CashShiftReportItemImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.openedAt, openedAt) ||
                other.openedAt == openedAt) &&
            (identical(other.closedAt, closedAt) ||
                other.closedAt == closedAt) &&
            (identical(other.warehouseName, warehouseName) ||
                other.warehouseName == warehouseName) &&
            (identical(other.cashierName, cashierName) ||
                other.cashierName == cashierName) &&
            (identical(other.openingBalance, openingBalance) ||
                other.openingBalance == openingBalance) &&
            (identical(other.closingBalance, closingBalance) ||
                other.closingBalance == closingBalance) &&
            (identical(other.cashSales, cashSales) ||
                other.cashSales == cashSales) &&
            (identical(other.cardSales, cardSales) ||
                other.cardSales == cardSales) &&
            (identical(other.qrSales, qrSales) || other.qrSales == qrSales) &&
            (identical(other.bankTransferSales, bankTransferSales) ||
                other.bankTransferSales == bankTransferSales) &&
            (identical(other.mobileWalletSales, mobileWalletSales) ||
                other.mobileWalletSales == mobileWalletSales) &&
            (identical(other.totalSales, totalSales) ||
                other.totalSales == totalSales) &&
            (identical(other.cashIn, cashIn) || other.cashIn == cashIn) &&
            (identical(other.cashOut, cashOut) || other.cashOut == cashOut) &&
            (identical(other.expectedClosing, expectedClosing) ||
                other.expectedClosing == expectedClosing) &&
            (identical(other.difference, difference) ||
                other.difference == difference) &&
            (identical(other.notes, notes) || other.notes == notes));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hashAll([
        runtimeType,
        id,
        status,
        openedAt,
        closedAt,
        warehouseName,
        cashierName,
        openingBalance,
        closingBalance,
        cashSales,
        cardSales,
        qrSales,
        bankTransferSales,
        mobileWalletSales,
        totalSales,
        cashIn,
        cashOut,
        expectedClosing,
        difference,
        notes
      ]);

  /// Create a copy of CashShiftReportItem
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$CashShiftReportItemImplCopyWith<_$CashShiftReportItemImpl> get copyWith =>
      __$$CashShiftReportItemImplCopyWithImpl<_$CashShiftReportItemImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$CashShiftReportItemImplToJson(
      this,
    );
  }
}

abstract class _CashShiftReportItem extends CashShiftReportItem {
  const factory _CashShiftReportItem(
      {required final String id,
      required final String status,
      required final String openedAt,
      final String? closedAt,
      final String warehouseName,
      final String cashierName,
      required final String openingBalance,
      required final String closingBalance,
      final String cashSales,
      final String cardSales,
      final String qrSales,
      final String bankTransferSales,
      final String mobileWalletSales,
      final String totalSales,
      final String cashIn,
      final String cashOut,
      final String expectedClosing,
      final String difference,
      final String? notes}) = _$CashShiftReportItemImpl;
  const _CashShiftReportItem._() : super._();

  factory _CashShiftReportItem.fromJson(Map<String, dynamic> json) =
      _$CashShiftReportItemImpl.fromJson;

  @override
  String get id;
  @override
  String get status;
  @override
  String get openedAt;
  @override
  String? get closedAt;
  @override
  String get warehouseName;
  @override
  String get cashierName;
  @override
  String get openingBalance;
  @override
  String get closingBalance;
  @override
  String get cashSales;
  @override
  String get cardSales;
  @override
  String get qrSales;
  @override
  String get bankTransferSales;
  @override
  String get mobileWalletSales;
  @override
  String get totalSales;
  @override
  String get cashIn;
  @override
  String get cashOut;
  @override
  String get expectedClosing;
  @override
  String get difference;
  @override
  String? get notes;

  /// Create a copy of CashShiftReportItem
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$CashShiftReportItemImplCopyWith<_$CashShiftReportItemImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
