// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardSummary _$DashboardSummaryFromJson(Map<String, dynamic> json) {
  return _DashboardSummary.fromJson(json);
}

/// @nodoc
mixin _$DashboardSummary {
  DaySales get todaySales => throw _privateConstructorUsedError;
  DaySales get yesterdaySales => throw _privateConstructorUsedError;
  DaySales get monthSales => throw _privateConstructorUsedError;
  int get ordersCount => throw _privateConstructorUsedError;
  String get grossRevenue => throw _privateConstructorUsedError;
  String get grossProfit => throw _privateConstructorUsedError;
  String get inventoryValue => throw _privateConstructorUsedError;
  int get lowStockProducts => throw _privateConstructorUsedError;
  int get outOfStockProducts => throw _privateConstructorUsedError;
  int get customerCount => throw _privateConstructorUsedError;
  int get supplierCount => throw _privateConstructorUsedError;
  String get purchaseTotal => throw _privateConstructorUsedError;

  /// Serializes this DashboardSummary to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardSummaryCopyWith<DashboardSummary> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardSummaryCopyWith<$Res> {
  factory $DashboardSummaryCopyWith(
          DashboardSummary value, $Res Function(DashboardSummary) then) =
      _$DashboardSummaryCopyWithImpl<$Res, DashboardSummary>;
  @useResult
  $Res call(
      {DaySales todaySales,
      DaySales yesterdaySales,
      DaySales monthSales,
      int ordersCount,
      String grossRevenue,
      String grossProfit,
      String inventoryValue,
      int lowStockProducts,
      int outOfStockProducts,
      int customerCount,
      int supplierCount,
      String purchaseTotal});

  $DaySalesCopyWith<$Res> get todaySales;
  $DaySalesCopyWith<$Res> get yesterdaySales;
  $DaySalesCopyWith<$Res> get monthSales;
}

/// @nodoc
class _$DashboardSummaryCopyWithImpl<$Res, $Val extends DashboardSummary>
    implements $DashboardSummaryCopyWith<$Res> {
  _$DashboardSummaryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? todaySales = null,
    Object? yesterdaySales = null,
    Object? monthSales = null,
    Object? ordersCount = null,
    Object? grossRevenue = null,
    Object? grossProfit = null,
    Object? inventoryValue = null,
    Object? lowStockProducts = null,
    Object? outOfStockProducts = null,
    Object? customerCount = null,
    Object? supplierCount = null,
    Object? purchaseTotal = null,
  }) {
    return _then(_value.copyWith(
      todaySales: null == todaySales
          ? _value.todaySales
          : todaySales // ignore: cast_nullable_to_non_nullable
              as DaySales,
      yesterdaySales: null == yesterdaySales
          ? _value.yesterdaySales
          : yesterdaySales // ignore: cast_nullable_to_non_nullable
              as DaySales,
      monthSales: null == monthSales
          ? _value.monthSales
          : monthSales // ignore: cast_nullable_to_non_nullable
              as DaySales,
      ordersCount: null == ordersCount
          ? _value.ordersCount
          : ordersCount // ignore: cast_nullable_to_non_nullable
              as int,
      grossRevenue: null == grossRevenue
          ? _value.grossRevenue
          : grossRevenue // ignore: cast_nullable_to_non_nullable
              as String,
      grossProfit: null == grossProfit
          ? _value.grossProfit
          : grossProfit // ignore: cast_nullable_to_non_nullable
              as String,
      inventoryValue: null == inventoryValue
          ? _value.inventoryValue
          : inventoryValue // ignore: cast_nullable_to_non_nullable
              as String,
      lowStockProducts: null == lowStockProducts
          ? _value.lowStockProducts
          : lowStockProducts // ignore: cast_nullable_to_non_nullable
              as int,
      outOfStockProducts: null == outOfStockProducts
          ? _value.outOfStockProducts
          : outOfStockProducts // ignore: cast_nullable_to_non_nullable
              as int,
      customerCount: null == customerCount
          ? _value.customerCount
          : customerCount // ignore: cast_nullable_to_non_nullable
              as int,
      supplierCount: null == supplierCount
          ? _value.supplierCount
          : supplierCount // ignore: cast_nullable_to_non_nullable
              as int,
      purchaseTotal: null == purchaseTotal
          ? _value.purchaseTotal
          : purchaseTotal // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }

  /// Create a copy of DashboardSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DaySalesCopyWith<$Res> get todaySales {
    return $DaySalesCopyWith<$Res>(_value.todaySales, (value) {
      return _then(_value.copyWith(todaySales: value) as $Val);
    });
  }

  /// Create a copy of DashboardSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DaySalesCopyWith<$Res> get yesterdaySales {
    return $DaySalesCopyWith<$Res>(_value.yesterdaySales, (value) {
      return _then(_value.copyWith(yesterdaySales: value) as $Val);
    });
  }

  /// Create a copy of DashboardSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DaySalesCopyWith<$Res> get monthSales {
    return $DaySalesCopyWith<$Res>(_value.monthSales, (value) {
      return _then(_value.copyWith(monthSales: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardSummaryImplCopyWith<$Res>
    implements $DashboardSummaryCopyWith<$Res> {
  factory _$$DashboardSummaryImplCopyWith(_$DashboardSummaryImpl value,
          $Res Function(_$DashboardSummaryImpl) then) =
      __$$DashboardSummaryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {DaySales todaySales,
      DaySales yesterdaySales,
      DaySales monthSales,
      int ordersCount,
      String grossRevenue,
      String grossProfit,
      String inventoryValue,
      int lowStockProducts,
      int outOfStockProducts,
      int customerCount,
      int supplierCount,
      String purchaseTotal});

  @override
  $DaySalesCopyWith<$Res> get todaySales;
  @override
  $DaySalesCopyWith<$Res> get yesterdaySales;
  @override
  $DaySalesCopyWith<$Res> get monthSales;
}

/// @nodoc
class __$$DashboardSummaryImplCopyWithImpl<$Res>
    extends _$DashboardSummaryCopyWithImpl<$Res, _$DashboardSummaryImpl>
    implements _$$DashboardSummaryImplCopyWith<$Res> {
  __$$DashboardSummaryImplCopyWithImpl(_$DashboardSummaryImpl _value,
      $Res Function(_$DashboardSummaryImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? todaySales = null,
    Object? yesterdaySales = null,
    Object? monthSales = null,
    Object? ordersCount = null,
    Object? grossRevenue = null,
    Object? grossProfit = null,
    Object? inventoryValue = null,
    Object? lowStockProducts = null,
    Object? outOfStockProducts = null,
    Object? customerCount = null,
    Object? supplierCount = null,
    Object? purchaseTotal = null,
  }) {
    return _then(_$DashboardSummaryImpl(
      todaySales: null == todaySales
          ? _value.todaySales
          : todaySales // ignore: cast_nullable_to_non_nullable
              as DaySales,
      yesterdaySales: null == yesterdaySales
          ? _value.yesterdaySales
          : yesterdaySales // ignore: cast_nullable_to_non_nullable
              as DaySales,
      monthSales: null == monthSales
          ? _value.monthSales
          : monthSales // ignore: cast_nullable_to_non_nullable
              as DaySales,
      ordersCount: null == ordersCount
          ? _value.ordersCount
          : ordersCount // ignore: cast_nullable_to_non_nullable
              as int,
      grossRevenue: null == grossRevenue
          ? _value.grossRevenue
          : grossRevenue // ignore: cast_nullable_to_non_nullable
              as String,
      grossProfit: null == grossProfit
          ? _value.grossProfit
          : grossProfit // ignore: cast_nullable_to_non_nullable
              as String,
      inventoryValue: null == inventoryValue
          ? _value.inventoryValue
          : inventoryValue // ignore: cast_nullable_to_non_nullable
              as String,
      lowStockProducts: null == lowStockProducts
          ? _value.lowStockProducts
          : lowStockProducts // ignore: cast_nullable_to_non_nullable
              as int,
      outOfStockProducts: null == outOfStockProducts
          ? _value.outOfStockProducts
          : outOfStockProducts // ignore: cast_nullable_to_non_nullable
              as int,
      customerCount: null == customerCount
          ? _value.customerCount
          : customerCount // ignore: cast_nullable_to_non_nullable
              as int,
      supplierCount: null == supplierCount
          ? _value.supplierCount
          : supplierCount // ignore: cast_nullable_to_non_nullable
              as int,
      purchaseTotal: null == purchaseTotal
          ? _value.purchaseTotal
          : purchaseTotal // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardSummaryImpl implements _DashboardSummary {
  const _$DashboardSummaryImpl(
      {required this.todaySales,
      required this.yesterdaySales,
      required this.monthSales,
      required this.ordersCount,
      required this.grossRevenue,
      required this.grossProfit,
      required this.inventoryValue,
      required this.lowStockProducts,
      required this.outOfStockProducts,
      required this.customerCount,
      required this.supplierCount,
      required this.purchaseTotal});

  factory _$DashboardSummaryImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardSummaryImplFromJson(json);

  @override
  final DaySales todaySales;
  @override
  final DaySales yesterdaySales;
  @override
  final DaySales monthSales;
  @override
  final int ordersCount;
  @override
  final String grossRevenue;
  @override
  final String grossProfit;
  @override
  final String inventoryValue;
  @override
  final int lowStockProducts;
  @override
  final int outOfStockProducts;
  @override
  final int customerCount;
  @override
  final int supplierCount;
  @override
  final String purchaseTotal;

  @override
  String toString() {
    return 'DashboardSummary(todaySales: $todaySales, yesterdaySales: $yesterdaySales, monthSales: $monthSales, ordersCount: $ordersCount, grossRevenue: $grossRevenue, grossProfit: $grossProfit, inventoryValue: $inventoryValue, lowStockProducts: $lowStockProducts, outOfStockProducts: $outOfStockProducts, customerCount: $customerCount, supplierCount: $supplierCount, purchaseTotal: $purchaseTotal)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardSummaryImpl &&
            (identical(other.todaySales, todaySales) ||
                other.todaySales == todaySales) &&
            (identical(other.yesterdaySales, yesterdaySales) ||
                other.yesterdaySales == yesterdaySales) &&
            (identical(other.monthSales, monthSales) ||
                other.monthSales == monthSales) &&
            (identical(other.ordersCount, ordersCount) ||
                other.ordersCount == ordersCount) &&
            (identical(other.grossRevenue, grossRevenue) ||
                other.grossRevenue == grossRevenue) &&
            (identical(other.grossProfit, grossProfit) ||
                other.grossProfit == grossProfit) &&
            (identical(other.inventoryValue, inventoryValue) ||
                other.inventoryValue == inventoryValue) &&
            (identical(other.lowStockProducts, lowStockProducts) ||
                other.lowStockProducts == lowStockProducts) &&
            (identical(other.outOfStockProducts, outOfStockProducts) ||
                other.outOfStockProducts == outOfStockProducts) &&
            (identical(other.customerCount, customerCount) ||
                other.customerCount == customerCount) &&
            (identical(other.supplierCount, supplierCount) ||
                other.supplierCount == supplierCount) &&
            (identical(other.purchaseTotal, purchaseTotal) ||
                other.purchaseTotal == purchaseTotal));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      todaySales,
      yesterdaySales,
      monthSales,
      ordersCount,
      grossRevenue,
      grossProfit,
      inventoryValue,
      lowStockProducts,
      outOfStockProducts,
      customerCount,
      supplierCount,
      purchaseTotal);

  /// Create a copy of DashboardSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardSummaryImplCopyWith<_$DashboardSummaryImpl> get copyWith =>
      __$$DashboardSummaryImplCopyWithImpl<_$DashboardSummaryImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardSummaryImplToJson(
      this,
    );
  }
}

abstract class _DashboardSummary implements DashboardSummary {
  const factory _DashboardSummary(
      {required final DaySales todaySales,
      required final DaySales yesterdaySales,
      required final DaySales monthSales,
      required final int ordersCount,
      required final String grossRevenue,
      required final String grossProfit,
      required final String inventoryValue,
      required final int lowStockProducts,
      required final int outOfStockProducts,
      required final int customerCount,
      required final int supplierCount,
      required final String purchaseTotal}) = _$DashboardSummaryImpl;

  factory _DashboardSummary.fromJson(Map<String, dynamic> json) =
      _$DashboardSummaryImpl.fromJson;

  @override
  DaySales get todaySales;
  @override
  DaySales get yesterdaySales;
  @override
  DaySales get monthSales;
  @override
  int get ordersCount;
  @override
  String get grossRevenue;
  @override
  String get grossProfit;
  @override
  String get inventoryValue;
  @override
  int get lowStockProducts;
  @override
  int get outOfStockProducts;
  @override
  int get customerCount;
  @override
  int get supplierCount;
  @override
  String get purchaseTotal;

  /// Create a copy of DashboardSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardSummaryImplCopyWith<_$DashboardSummaryImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

DaySales _$DaySalesFromJson(Map<String, dynamic> json) {
  return _DaySales.fromJson(json);
}

/// @nodoc
mixin _$DaySales {
  String get revenue => throw _privateConstructorUsedError;
  int get count => throw _privateConstructorUsedError;
  String? get averageReceipt => throw _privateConstructorUsedError;

  /// Serializes this DaySales to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DaySales
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DaySalesCopyWith<DaySales> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DaySalesCopyWith<$Res> {
  factory $DaySalesCopyWith(DaySales value, $Res Function(DaySales) then) =
      _$DaySalesCopyWithImpl<$Res, DaySales>;
  @useResult
  $Res call({String revenue, int count, String? averageReceipt});
}

/// @nodoc
class _$DaySalesCopyWithImpl<$Res, $Val extends DaySales>
    implements $DaySalesCopyWith<$Res> {
  _$DaySalesCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DaySales
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? revenue = null,
    Object? count = null,
    Object? averageReceipt = freezed,
  }) {
    return _then(_value.copyWith(
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      count: null == count
          ? _value.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
      averageReceipt: freezed == averageReceipt
          ? _value.averageReceipt
          : averageReceipt // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DaySalesImplCopyWith<$Res>
    implements $DaySalesCopyWith<$Res> {
  factory _$$DaySalesImplCopyWith(
          _$DaySalesImpl value, $Res Function(_$DaySalesImpl) then) =
      __$$DaySalesImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String revenue, int count, String? averageReceipt});
}

/// @nodoc
class __$$DaySalesImplCopyWithImpl<$Res>
    extends _$DaySalesCopyWithImpl<$Res, _$DaySalesImpl>
    implements _$$DaySalesImplCopyWith<$Res> {
  __$$DaySalesImplCopyWithImpl(
      _$DaySalesImpl _value, $Res Function(_$DaySalesImpl) _then)
      : super(_value, _then);

  /// Create a copy of DaySales
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? revenue = null,
    Object? count = null,
    Object? averageReceipt = freezed,
  }) {
    return _then(_$DaySalesImpl(
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      count: null == count
          ? _value.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
      averageReceipt: freezed == averageReceipt
          ? _value.averageReceipt
          : averageReceipt // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DaySalesImpl implements _DaySales {
  const _$DaySalesImpl(
      {required this.revenue, required this.count, this.averageReceipt});

  factory _$DaySalesImpl.fromJson(Map<String, dynamic> json) =>
      _$$DaySalesImplFromJson(json);

  @override
  final String revenue;
  @override
  final int count;
  @override
  final String? averageReceipt;

  @override
  String toString() {
    return 'DaySales(revenue: $revenue, count: $count, averageReceipt: $averageReceipt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DaySalesImpl &&
            (identical(other.revenue, revenue) || other.revenue == revenue) &&
            (identical(other.count, count) || other.count == count) &&
            (identical(other.averageReceipt, averageReceipt) ||
                other.averageReceipt == averageReceipt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, revenue, count, averageReceipt);

  /// Create a copy of DaySales
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DaySalesImplCopyWith<_$DaySalesImpl> get copyWith =>
      __$$DaySalesImplCopyWithImpl<_$DaySalesImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DaySalesImplToJson(
      this,
    );
  }
}

abstract class _DaySales implements DaySales {
  const factory _DaySales(
      {required final String revenue,
      required final int count,
      final String? averageReceipt}) = _$DaySalesImpl;

  factory _DaySales.fromJson(Map<String, dynamic> json) =
      _$DaySalesImpl.fromJson;

  @override
  String get revenue;
  @override
  int get count;
  @override
  String? get averageReceipt;

  /// Create a copy of DaySales
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DaySalesImplCopyWith<_$DaySalesImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

RecentSale _$RecentSaleFromJson(Map<String, dynamic> json) {
  return _RecentSale.fromJson(json);
}

/// @nodoc
mixin _$RecentSale {
  String get id => throw _privateConstructorUsedError;
  String get saleNumber => throw _privateConstructorUsedError;
  String get createdAt => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String get total => throw _privateConstructorUsedError;
  String get paidAmount => throw _privateConstructorUsedError;

  /// Serializes this RecentSale to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of RecentSale
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $RecentSaleCopyWith<RecentSale> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $RecentSaleCopyWith<$Res> {
  factory $RecentSaleCopyWith(
          RecentSale value, $Res Function(RecentSale) then) =
      _$RecentSaleCopyWithImpl<$Res, RecentSale>;
  @useResult
  $Res call(
      {String id,
      String saleNumber,
      String createdAt,
      String status,
      String total,
      String paidAmount});
}

/// @nodoc
class _$RecentSaleCopyWithImpl<$Res, $Val extends RecentSale>
    implements $RecentSaleCopyWith<$Res> {
  _$RecentSaleCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of RecentSale
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? saleNumber = null,
    Object? createdAt = null,
    Object? status = null,
    Object? total = null,
    Object? paidAmount = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      saleNumber: null == saleNumber
          ? _value.saleNumber
          : saleNumber // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as String,
      paidAmount: null == paidAmount
          ? _value.paidAmount
          : paidAmount // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$RecentSaleImplCopyWith<$Res>
    implements $RecentSaleCopyWith<$Res> {
  factory _$$RecentSaleImplCopyWith(
          _$RecentSaleImpl value, $Res Function(_$RecentSaleImpl) then) =
      __$$RecentSaleImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String saleNumber,
      String createdAt,
      String status,
      String total,
      String paidAmount});
}

/// @nodoc
class __$$RecentSaleImplCopyWithImpl<$Res>
    extends _$RecentSaleCopyWithImpl<$Res, _$RecentSaleImpl>
    implements _$$RecentSaleImplCopyWith<$Res> {
  __$$RecentSaleImplCopyWithImpl(
      _$RecentSaleImpl _value, $Res Function(_$RecentSaleImpl) _then)
      : super(_value, _then);

  /// Create a copy of RecentSale
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? saleNumber = null,
    Object? createdAt = null,
    Object? status = null,
    Object? total = null,
    Object? paidAmount = null,
  }) {
    return _then(_$RecentSaleImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      saleNumber: null == saleNumber
          ? _value.saleNumber
          : saleNumber // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as String,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as String,
      paidAmount: null == paidAmount
          ? _value.paidAmount
          : paidAmount // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$RecentSaleImpl implements _RecentSale {
  const _$RecentSaleImpl(
      {required this.id,
      required this.saleNumber,
      required this.createdAt,
      required this.status,
      required this.total,
      required this.paidAmount});

  factory _$RecentSaleImpl.fromJson(Map<String, dynamic> json) =>
      _$$RecentSaleImplFromJson(json);

  @override
  final String id;
  @override
  final String saleNumber;
  @override
  final String createdAt;
  @override
  final String status;
  @override
  final String total;
  @override
  final String paidAmount;

  @override
  String toString() {
    return 'RecentSale(id: $id, saleNumber: $saleNumber, createdAt: $createdAt, status: $status, total: $total, paidAmount: $paidAmount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$RecentSaleImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.saleNumber, saleNumber) ||
                other.saleNumber == saleNumber) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.paidAmount, paidAmount) ||
                other.paidAmount == paidAmount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, id, saleNumber, createdAt, status, total, paidAmount);

  /// Create a copy of RecentSale
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$RecentSaleImplCopyWith<_$RecentSaleImpl> get copyWith =>
      __$$RecentSaleImplCopyWithImpl<_$RecentSaleImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$RecentSaleImplToJson(
      this,
    );
  }
}

abstract class _RecentSale implements RecentSale {
  const factory _RecentSale(
      {required final String id,
      required final String saleNumber,
      required final String createdAt,
      required final String status,
      required final String total,
      required final String paidAmount}) = _$RecentSaleImpl;

  factory _RecentSale.fromJson(Map<String, dynamic> json) =
      _$RecentSaleImpl.fromJson;

  @override
  String get id;
  @override
  String get saleNumber;
  @override
  String get createdAt;
  @override
  String get status;
  @override
  String get total;
  @override
  String get paidAmount;

  /// Create a copy of RecentSale
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$RecentSaleImplCopyWith<_$RecentSaleImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SalesReport _$SalesReportFromJson(Map<String, dynamic> json) {
  return _SalesReport.fromJson(json);
}

/// @nodoc
mixin _$SalesReport {
  List<RecentSale> get sales => throw _privateConstructorUsedError;
  SalesSummary get summary => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this SalesReport to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SalesReport
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SalesReportCopyWith<SalesReport> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SalesReportCopyWith<$Res> {
  factory $SalesReportCopyWith(
          SalesReport value, $Res Function(SalesReport) then) =
      _$SalesReportCopyWithImpl<$Res, SalesReport>;
  @useResult
  $Res call(
      {List<RecentSale> sales,
      SalesSummary summary,
      int total,
      int page,
      int limit});

  $SalesSummaryCopyWith<$Res> get summary;
}

/// @nodoc
class _$SalesReportCopyWithImpl<$Res, $Val extends SalesReport>
    implements $SalesReportCopyWith<$Res> {
  _$SalesReportCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SalesReport
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? sales = null,
    Object? summary = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_value.copyWith(
      sales: null == sales
          ? _value.sales
          : sales // ignore: cast_nullable_to_non_nullable
              as List<RecentSale>,
      summary: null == summary
          ? _value.summary
          : summary // ignore: cast_nullable_to_non_nullable
              as SalesSummary,
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

  /// Create a copy of SalesReport
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $SalesSummaryCopyWith<$Res> get summary {
    return $SalesSummaryCopyWith<$Res>(_value.summary, (value) {
      return _then(_value.copyWith(summary: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$SalesReportImplCopyWith<$Res>
    implements $SalesReportCopyWith<$Res> {
  factory _$$SalesReportImplCopyWith(
          _$SalesReportImpl value, $Res Function(_$SalesReportImpl) then) =
      __$$SalesReportImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {List<RecentSale> sales,
      SalesSummary summary,
      int total,
      int page,
      int limit});

  @override
  $SalesSummaryCopyWith<$Res> get summary;
}

/// @nodoc
class __$$SalesReportImplCopyWithImpl<$Res>
    extends _$SalesReportCopyWithImpl<$Res, _$SalesReportImpl>
    implements _$$SalesReportImplCopyWith<$Res> {
  __$$SalesReportImplCopyWithImpl(
      _$SalesReportImpl _value, $Res Function(_$SalesReportImpl) _then)
      : super(_value, _then);

  /// Create a copy of SalesReport
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? sales = null,
    Object? summary = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$SalesReportImpl(
      sales: null == sales
          ? _value._sales
          : sales // ignore: cast_nullable_to_non_nullable
              as List<RecentSale>,
      summary: null == summary
          ? _value.summary
          : summary // ignore: cast_nullable_to_non_nullable
              as SalesSummary,
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
class _$SalesReportImpl implements _SalesReport {
  const _$SalesReportImpl(
      {required final List<RecentSale> sales,
      required this.summary,
      required this.total,
      required this.page,
      required this.limit})
      : _sales = sales;

  factory _$SalesReportImpl.fromJson(Map<String, dynamic> json) =>
      _$$SalesReportImplFromJson(json);

  final List<RecentSale> _sales;
  @override
  List<RecentSale> get sales {
    if (_sales is EqualUnmodifiableListView) return _sales;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_sales);
  }

  @override
  final SalesSummary summary;
  @override
  final int total;
  @override
  final int page;
  @override
  final int limit;

  @override
  String toString() {
    return 'SalesReport(sales: $sales, summary: $summary, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SalesReportImpl &&
            const DeepCollectionEquality().equals(other._sales, _sales) &&
            (identical(other.summary, summary) || other.summary == summary) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_sales), summary, total, page, limit);

  /// Create a copy of SalesReport
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SalesReportImplCopyWith<_$SalesReportImpl> get copyWith =>
      __$$SalesReportImplCopyWithImpl<_$SalesReportImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SalesReportImplToJson(
      this,
    );
  }
}

abstract class _SalesReport implements SalesReport {
  const factory _SalesReport(
      {required final List<RecentSale> sales,
      required final SalesSummary summary,
      required final int total,
      required final int page,
      required final int limit}) = _$SalesReportImpl;

  factory _SalesReport.fromJson(Map<String, dynamic> json) =
      _$SalesReportImpl.fromJson;

  @override
  List<RecentSale> get sales;
  @override
  SalesSummary get summary;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of SalesReport
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SalesReportImplCopyWith<_$SalesReportImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SalesSummary _$SalesSummaryFromJson(Map<String, dynamic> json) {
  return _SalesSummary.fromJson(json);
}

/// @nodoc
mixin _$SalesSummary {
  String get revenue => throw _privateConstructorUsedError;
  String get profit => throw _privateConstructorUsedError;
  String get margin => throw _privateConstructorUsedError;
  String get averageReceipt => throw _privateConstructorUsedError;
  int get productsSold => throw _privateConstructorUsedError;
  int get count => throw _privateConstructorUsedError;
  PaymentBreakdown get payments => throw _privateConstructorUsedError;

  /// Serializes this SalesSummary to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SalesSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SalesSummaryCopyWith<SalesSummary> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SalesSummaryCopyWith<$Res> {
  factory $SalesSummaryCopyWith(
          SalesSummary value, $Res Function(SalesSummary) then) =
      _$SalesSummaryCopyWithImpl<$Res, SalesSummary>;
  @useResult
  $Res call(
      {String revenue,
      String profit,
      String margin,
      String averageReceipt,
      int productsSold,
      int count,
      PaymentBreakdown payments});

  $PaymentBreakdownCopyWith<$Res> get payments;
}

/// @nodoc
class _$SalesSummaryCopyWithImpl<$Res, $Val extends SalesSummary>
    implements $SalesSummaryCopyWith<$Res> {
  _$SalesSummaryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SalesSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? revenue = null,
    Object? profit = null,
    Object? margin = null,
    Object? averageReceipt = null,
    Object? productsSold = null,
    Object? count = null,
    Object? payments = null,
  }) {
    return _then(_value.copyWith(
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
      averageReceipt: null == averageReceipt
          ? _value.averageReceipt
          : averageReceipt // ignore: cast_nullable_to_non_nullable
              as String,
      productsSold: null == productsSold
          ? _value.productsSold
          : productsSold // ignore: cast_nullable_to_non_nullable
              as int,
      count: null == count
          ? _value.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
      payments: null == payments
          ? _value.payments
          : payments // ignore: cast_nullable_to_non_nullable
              as PaymentBreakdown,
    ) as $Val);
  }

  /// Create a copy of SalesSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $PaymentBreakdownCopyWith<$Res> get payments {
    return $PaymentBreakdownCopyWith<$Res>(_value.payments, (value) {
      return _then(_value.copyWith(payments: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$SalesSummaryImplCopyWith<$Res>
    implements $SalesSummaryCopyWith<$Res> {
  factory _$$SalesSummaryImplCopyWith(
          _$SalesSummaryImpl value, $Res Function(_$SalesSummaryImpl) then) =
      __$$SalesSummaryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String revenue,
      String profit,
      String margin,
      String averageReceipt,
      int productsSold,
      int count,
      PaymentBreakdown payments});

  @override
  $PaymentBreakdownCopyWith<$Res> get payments;
}

/// @nodoc
class __$$SalesSummaryImplCopyWithImpl<$Res>
    extends _$SalesSummaryCopyWithImpl<$Res, _$SalesSummaryImpl>
    implements _$$SalesSummaryImplCopyWith<$Res> {
  __$$SalesSummaryImplCopyWithImpl(
      _$SalesSummaryImpl _value, $Res Function(_$SalesSummaryImpl) _then)
      : super(_value, _then);

  /// Create a copy of SalesSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? revenue = null,
    Object? profit = null,
    Object? margin = null,
    Object? averageReceipt = null,
    Object? productsSold = null,
    Object? count = null,
    Object? payments = null,
  }) {
    return _then(_$SalesSummaryImpl(
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
      averageReceipt: null == averageReceipt
          ? _value.averageReceipt
          : averageReceipt // ignore: cast_nullable_to_non_nullable
              as String,
      productsSold: null == productsSold
          ? _value.productsSold
          : productsSold // ignore: cast_nullable_to_non_nullable
              as int,
      count: null == count
          ? _value.count
          : count // ignore: cast_nullable_to_non_nullable
              as int,
      payments: null == payments
          ? _value.payments
          : payments // ignore: cast_nullable_to_non_nullable
              as PaymentBreakdown,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SalesSummaryImpl implements _SalesSummary {
  const _$SalesSummaryImpl(
      {required this.revenue,
      required this.profit,
      required this.margin,
      required this.averageReceipt,
      required this.productsSold,
      required this.count,
      required this.payments});

  factory _$SalesSummaryImpl.fromJson(Map<String, dynamic> json) =>
      _$$SalesSummaryImplFromJson(json);

  @override
  final String revenue;
  @override
  final String profit;
  @override
  final String margin;
  @override
  final String averageReceipt;
  @override
  final int productsSold;
  @override
  final int count;
  @override
  final PaymentBreakdown payments;

  @override
  String toString() {
    return 'SalesSummary(revenue: $revenue, profit: $profit, margin: $margin, averageReceipt: $averageReceipt, productsSold: $productsSold, count: $count, payments: $payments)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SalesSummaryImpl &&
            (identical(other.revenue, revenue) || other.revenue == revenue) &&
            (identical(other.profit, profit) || other.profit == profit) &&
            (identical(other.margin, margin) || other.margin == margin) &&
            (identical(other.averageReceipt, averageReceipt) ||
                other.averageReceipt == averageReceipt) &&
            (identical(other.productsSold, productsSold) ||
                other.productsSold == productsSold) &&
            (identical(other.count, count) || other.count == count) &&
            (identical(other.payments, payments) ||
                other.payments == payments));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, revenue, profit, margin,
      averageReceipt, productsSold, count, payments);

  /// Create a copy of SalesSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SalesSummaryImplCopyWith<_$SalesSummaryImpl> get copyWith =>
      __$$SalesSummaryImplCopyWithImpl<_$SalesSummaryImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SalesSummaryImplToJson(
      this,
    );
  }
}

abstract class _SalesSummary implements SalesSummary {
  const factory _SalesSummary(
      {required final String revenue,
      required final String profit,
      required final String margin,
      required final String averageReceipt,
      required final int productsSold,
      required final int count,
      required final PaymentBreakdown payments}) = _$SalesSummaryImpl;

  factory _SalesSummary.fromJson(Map<String, dynamic> json) =
      _$SalesSummaryImpl.fromJson;

  @override
  String get revenue;
  @override
  String get profit;
  @override
  String get margin;
  @override
  String get averageReceipt;
  @override
  int get productsSold;
  @override
  int get count;
  @override
  PaymentBreakdown get payments;

  /// Create a copy of SalesSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SalesSummaryImplCopyWith<_$SalesSummaryImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PaymentBreakdown _$PaymentBreakdownFromJson(Map<String, dynamic> json) {
  return _PaymentBreakdown.fromJson(json);
}

/// @nodoc
mixin _$PaymentBreakdown {
  String get cash => throw _privateConstructorUsedError;
  String get card => throw _privateConstructorUsedError;
  String get qr => throw _privateConstructorUsedError;
  String get bankTransfer => throw _privateConstructorUsedError;
  String get mobileWallet => throw _privateConstructorUsedError;
  String get other => throw _privateConstructorUsedError;

  /// Serializes this PaymentBreakdown to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PaymentBreakdown
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PaymentBreakdownCopyWith<PaymentBreakdown> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PaymentBreakdownCopyWith<$Res> {
  factory $PaymentBreakdownCopyWith(
          PaymentBreakdown value, $Res Function(PaymentBreakdown) then) =
      _$PaymentBreakdownCopyWithImpl<$Res, PaymentBreakdown>;
  @useResult
  $Res call(
      {String cash,
      String card,
      String qr,
      String bankTransfer,
      String mobileWallet,
      String other});
}

/// @nodoc
class _$PaymentBreakdownCopyWithImpl<$Res, $Val extends PaymentBreakdown>
    implements $PaymentBreakdownCopyWith<$Res> {
  _$PaymentBreakdownCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PaymentBreakdown
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? cash = null,
    Object? card = null,
    Object? qr = null,
    Object? bankTransfer = null,
    Object? mobileWallet = null,
    Object? other = null,
  }) {
    return _then(_value.copyWith(
      cash: null == cash
          ? _value.cash
          : cash // ignore: cast_nullable_to_non_nullable
              as String,
      card: null == card
          ? _value.card
          : card // ignore: cast_nullable_to_non_nullable
              as String,
      qr: null == qr
          ? _value.qr
          : qr // ignore: cast_nullable_to_non_nullable
              as String,
      bankTransfer: null == bankTransfer
          ? _value.bankTransfer
          : bankTransfer // ignore: cast_nullable_to_non_nullable
              as String,
      mobileWallet: null == mobileWallet
          ? _value.mobileWallet
          : mobileWallet // ignore: cast_nullable_to_non_nullable
              as String,
      other: null == other
          ? _value.other
          : other // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PaymentBreakdownImplCopyWith<$Res>
    implements $PaymentBreakdownCopyWith<$Res> {
  factory _$$PaymentBreakdownImplCopyWith(_$PaymentBreakdownImpl value,
          $Res Function(_$PaymentBreakdownImpl) then) =
      __$$PaymentBreakdownImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String cash,
      String card,
      String qr,
      String bankTransfer,
      String mobileWallet,
      String other});
}

/// @nodoc
class __$$PaymentBreakdownImplCopyWithImpl<$Res>
    extends _$PaymentBreakdownCopyWithImpl<$Res, _$PaymentBreakdownImpl>
    implements _$$PaymentBreakdownImplCopyWith<$Res> {
  __$$PaymentBreakdownImplCopyWithImpl(_$PaymentBreakdownImpl _value,
      $Res Function(_$PaymentBreakdownImpl) _then)
      : super(_value, _then);

  /// Create a copy of PaymentBreakdown
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? cash = null,
    Object? card = null,
    Object? qr = null,
    Object? bankTransfer = null,
    Object? mobileWallet = null,
    Object? other = null,
  }) {
    return _then(_$PaymentBreakdownImpl(
      cash: null == cash
          ? _value.cash
          : cash // ignore: cast_nullable_to_non_nullable
              as String,
      card: null == card
          ? _value.card
          : card // ignore: cast_nullable_to_non_nullable
              as String,
      qr: null == qr
          ? _value.qr
          : qr // ignore: cast_nullable_to_non_nullable
              as String,
      bankTransfer: null == bankTransfer
          ? _value.bankTransfer
          : bankTransfer // ignore: cast_nullable_to_non_nullable
              as String,
      mobileWallet: null == mobileWallet
          ? _value.mobileWallet
          : mobileWallet // ignore: cast_nullable_to_non_nullable
              as String,
      other: null == other
          ? _value.other
          : other // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PaymentBreakdownImpl extends _PaymentBreakdown {
  const _$PaymentBreakdownImpl(
      {required this.cash,
      required this.card,
      required this.qr,
      this.bankTransfer = '0.0000',
      this.mobileWallet = '0.0000',
      this.other = '0.0000'})
      : super._();

  factory _$PaymentBreakdownImpl.fromJson(Map<String, dynamic> json) =>
      _$$PaymentBreakdownImplFromJson(json);

  @override
  final String cash;
  @override
  final String card;
  @override
  final String qr;
  @override
  @JsonKey()
  final String bankTransfer;
  @override
  @JsonKey()
  final String mobileWallet;
  @override
  @JsonKey()
  final String other;

  @override
  String toString() {
    return 'PaymentBreakdown(cash: $cash, card: $card, qr: $qr, bankTransfer: $bankTransfer, mobileWallet: $mobileWallet, other: $other)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PaymentBreakdownImpl &&
            (identical(other.cash, cash) || other.cash == cash) &&
            (identical(other.card, card) || other.card == card) &&
            (identical(other.qr, qr) || other.qr == qr) &&
            (identical(other.bankTransfer, bankTransfer) ||
                other.bankTransfer == bankTransfer) &&
            (identical(other.mobileWallet, mobileWallet) ||
                other.mobileWallet == mobileWallet) &&
            (identical(other.other, this.other) || other.other == this.other));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, cash, card, qr, bankTransfer, mobileWallet, other);

  /// Create a copy of PaymentBreakdown
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PaymentBreakdownImplCopyWith<_$PaymentBreakdownImpl> get copyWith =>
      __$$PaymentBreakdownImplCopyWithImpl<_$PaymentBreakdownImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PaymentBreakdownImplToJson(
      this,
    );
  }
}

abstract class _PaymentBreakdown extends PaymentBreakdown {
  const factory _PaymentBreakdown(
      {required final String cash,
      required final String card,
      required final String qr,
      final String bankTransfer,
      final String mobileWallet,
      final String other}) = _$PaymentBreakdownImpl;
  const _PaymentBreakdown._() : super._();

  factory _PaymentBreakdown.fromJson(Map<String, dynamic> json) =
      _$PaymentBreakdownImpl.fromJson;

  @override
  String get cash;
  @override
  String get card;
  @override
  String get qr;
  @override
  String get bankTransfer;
  @override
  String get mobileWallet;
  @override
  String get other;

  /// Create a copy of PaymentBreakdown
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PaymentBreakdownImplCopyWith<_$PaymentBreakdownImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ProfitReport _$ProfitReportFromJson(Map<String, dynamic> json) {
  return _ProfitReport.fromJson(json);
}

/// @nodoc
mixin _$ProfitReport {
  ProfitSummary get summary => throw _privateConstructorUsedError;
  List<DailyProfit> get daily => throw _privateConstructorUsedError;
  List<WeeklyProfit> get weekly => throw _privateConstructorUsedError;
  List<MonthlyProfit> get monthly => throw _privateConstructorUsedError;

  /// Serializes this ProfitReport to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProfitReport
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProfitReportCopyWith<ProfitReport> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProfitReportCopyWith<$Res> {
  factory $ProfitReportCopyWith(
          ProfitReport value, $Res Function(ProfitReport) then) =
      _$ProfitReportCopyWithImpl<$Res, ProfitReport>;
  @useResult
  $Res call(
      {ProfitSummary summary,
      List<DailyProfit> daily,
      List<WeeklyProfit> weekly,
      List<MonthlyProfit> monthly});

  $ProfitSummaryCopyWith<$Res> get summary;
}

/// @nodoc
class _$ProfitReportCopyWithImpl<$Res, $Val extends ProfitReport>
    implements $ProfitReportCopyWith<$Res> {
  _$ProfitReportCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProfitReport
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? summary = null,
    Object? daily = null,
    Object? weekly = null,
    Object? monthly = null,
  }) {
    return _then(_value.copyWith(
      summary: null == summary
          ? _value.summary
          : summary // ignore: cast_nullable_to_non_nullable
              as ProfitSummary,
      daily: null == daily
          ? _value.daily
          : daily // ignore: cast_nullable_to_non_nullable
              as List<DailyProfit>,
      weekly: null == weekly
          ? _value.weekly
          : weekly // ignore: cast_nullable_to_non_nullable
              as List<WeeklyProfit>,
      monthly: null == monthly
          ? _value.monthly
          : monthly // ignore: cast_nullable_to_non_nullable
              as List<MonthlyProfit>,
    ) as $Val);
  }

  /// Create a copy of ProfitReport
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ProfitSummaryCopyWith<$Res> get summary {
    return $ProfitSummaryCopyWith<$Res>(_value.summary, (value) {
      return _then(_value.copyWith(summary: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$ProfitReportImplCopyWith<$Res>
    implements $ProfitReportCopyWith<$Res> {
  factory _$$ProfitReportImplCopyWith(
          _$ProfitReportImpl value, $Res Function(_$ProfitReportImpl) then) =
      __$$ProfitReportImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {ProfitSummary summary,
      List<DailyProfit> daily,
      List<WeeklyProfit> weekly,
      List<MonthlyProfit> monthly});

  @override
  $ProfitSummaryCopyWith<$Res> get summary;
}

/// @nodoc
class __$$ProfitReportImplCopyWithImpl<$Res>
    extends _$ProfitReportCopyWithImpl<$Res, _$ProfitReportImpl>
    implements _$$ProfitReportImplCopyWith<$Res> {
  __$$ProfitReportImplCopyWithImpl(
      _$ProfitReportImpl _value, $Res Function(_$ProfitReportImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProfitReport
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? summary = null,
    Object? daily = null,
    Object? weekly = null,
    Object? monthly = null,
  }) {
    return _then(_$ProfitReportImpl(
      summary: null == summary
          ? _value.summary
          : summary // ignore: cast_nullable_to_non_nullable
              as ProfitSummary,
      daily: null == daily
          ? _value._daily
          : daily // ignore: cast_nullable_to_non_nullable
              as List<DailyProfit>,
      weekly: null == weekly
          ? _value._weekly
          : weekly // ignore: cast_nullable_to_non_nullable
              as List<WeeklyProfit>,
      monthly: null == monthly
          ? _value._monthly
          : monthly // ignore: cast_nullable_to_non_nullable
              as List<MonthlyProfit>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ProfitReportImpl implements _ProfitReport {
  const _$ProfitReportImpl(
      {required this.summary,
      required final List<DailyProfit> daily,
      required final List<WeeklyProfit> weekly,
      required final List<MonthlyProfit> monthly})
      : _daily = daily,
        _weekly = weekly,
        _monthly = monthly;

  factory _$ProfitReportImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProfitReportImplFromJson(json);

  @override
  final ProfitSummary summary;
  final List<DailyProfit> _daily;
  @override
  List<DailyProfit> get daily {
    if (_daily is EqualUnmodifiableListView) return _daily;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_daily);
  }

  final List<WeeklyProfit> _weekly;
  @override
  List<WeeklyProfit> get weekly {
    if (_weekly is EqualUnmodifiableListView) return _weekly;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_weekly);
  }

  final List<MonthlyProfit> _monthly;
  @override
  List<MonthlyProfit> get monthly {
    if (_monthly is EqualUnmodifiableListView) return _monthly;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_monthly);
  }

  @override
  String toString() {
    return 'ProfitReport(summary: $summary, daily: $daily, weekly: $weekly, monthly: $monthly)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProfitReportImpl &&
            (identical(other.summary, summary) || other.summary == summary) &&
            const DeepCollectionEquality().equals(other._daily, _daily) &&
            const DeepCollectionEquality().equals(other._weekly, _weekly) &&
            const DeepCollectionEquality().equals(other._monthly, _monthly));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      summary,
      const DeepCollectionEquality().hash(_daily),
      const DeepCollectionEquality().hash(_weekly),
      const DeepCollectionEquality().hash(_monthly));

  /// Create a copy of ProfitReport
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProfitReportImplCopyWith<_$ProfitReportImpl> get copyWith =>
      __$$ProfitReportImplCopyWithImpl<_$ProfitReportImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProfitReportImplToJson(
      this,
    );
  }
}

abstract class _ProfitReport implements ProfitReport {
  const factory _ProfitReport(
      {required final ProfitSummary summary,
      required final List<DailyProfit> daily,
      required final List<WeeklyProfit> weekly,
      required final List<MonthlyProfit> monthly}) = _$ProfitReportImpl;

  factory _ProfitReport.fromJson(Map<String, dynamic> json) =
      _$ProfitReportImpl.fromJson;

  @override
  ProfitSummary get summary;
  @override
  List<DailyProfit> get daily;
  @override
  List<WeeklyProfit> get weekly;
  @override
  List<MonthlyProfit> get monthly;

  /// Create a copy of ProfitReport
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProfitReportImplCopyWith<_$ProfitReportImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ProfitSummary _$ProfitSummaryFromJson(Map<String, dynamic> json) {
  return _ProfitSummary.fromJson(json);
}

/// @nodoc
mixin _$ProfitSummary {
  String get revenue => throw _privateConstructorUsedError;
  String get cost => throw _privateConstructorUsedError;
  String get profit => throw _privateConstructorUsedError;
  String get margin => throw _privateConstructorUsedError;

  /// Serializes this ProfitSummary to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProfitSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProfitSummaryCopyWith<ProfitSummary> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProfitSummaryCopyWith<$Res> {
  factory $ProfitSummaryCopyWith(
          ProfitSummary value, $Res Function(ProfitSummary) then) =
      _$ProfitSummaryCopyWithImpl<$Res, ProfitSummary>;
  @useResult
  $Res call({String revenue, String cost, String profit, String margin});
}

/// @nodoc
class _$ProfitSummaryCopyWithImpl<$Res, $Val extends ProfitSummary>
    implements $ProfitSummaryCopyWith<$Res> {
  _$ProfitSummaryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProfitSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? revenue = null,
    Object? cost = null,
    Object? profit = null,
    Object? margin = null,
  }) {
    return _then(_value.copyWith(
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      cost: null == cost
          ? _value.cost
          : cost // ignore: cast_nullable_to_non_nullable
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
abstract class _$$ProfitSummaryImplCopyWith<$Res>
    implements $ProfitSummaryCopyWith<$Res> {
  factory _$$ProfitSummaryImplCopyWith(
          _$ProfitSummaryImpl value, $Res Function(_$ProfitSummaryImpl) then) =
      __$$ProfitSummaryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String revenue, String cost, String profit, String margin});
}

/// @nodoc
class __$$ProfitSummaryImplCopyWithImpl<$Res>
    extends _$ProfitSummaryCopyWithImpl<$Res, _$ProfitSummaryImpl>
    implements _$$ProfitSummaryImplCopyWith<$Res> {
  __$$ProfitSummaryImplCopyWithImpl(
      _$ProfitSummaryImpl _value, $Res Function(_$ProfitSummaryImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProfitSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? revenue = null,
    Object? cost = null,
    Object? profit = null,
    Object? margin = null,
  }) {
    return _then(_$ProfitSummaryImpl(
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      cost: null == cost
          ? _value.cost
          : cost // ignore: cast_nullable_to_non_nullable
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
class _$ProfitSummaryImpl implements _ProfitSummary {
  const _$ProfitSummaryImpl(
      {required this.revenue,
      required this.cost,
      required this.profit,
      required this.margin});

  factory _$ProfitSummaryImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProfitSummaryImplFromJson(json);

  @override
  final String revenue;
  @override
  final String cost;
  @override
  final String profit;
  @override
  final String margin;

  @override
  String toString() {
    return 'ProfitSummary(revenue: $revenue, cost: $cost, profit: $profit, margin: $margin)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProfitSummaryImpl &&
            (identical(other.revenue, revenue) || other.revenue == revenue) &&
            (identical(other.cost, cost) || other.cost == cost) &&
            (identical(other.profit, profit) || other.profit == profit) &&
            (identical(other.margin, margin) || other.margin == margin));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, revenue, cost, profit, margin);

  /// Create a copy of ProfitSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProfitSummaryImplCopyWith<_$ProfitSummaryImpl> get copyWith =>
      __$$ProfitSummaryImplCopyWithImpl<_$ProfitSummaryImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProfitSummaryImplToJson(
      this,
    );
  }
}

abstract class _ProfitSummary implements ProfitSummary {
  const factory _ProfitSummary(
      {required final String revenue,
      required final String cost,
      required final String profit,
      required final String margin}) = _$ProfitSummaryImpl;

  factory _ProfitSummary.fromJson(Map<String, dynamic> json) =
      _$ProfitSummaryImpl.fromJson;

  @override
  String get revenue;
  @override
  String get cost;
  @override
  String get profit;
  @override
  String get margin;

  /// Create a copy of ProfitSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProfitSummaryImplCopyWith<_$ProfitSummaryImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

DailyProfit _$DailyProfitFromJson(Map<String, dynamic> json) {
  return _DailyProfit.fromJson(json);
}

/// @nodoc
mixin _$DailyProfit {
  String get date => throw _privateConstructorUsedError;
  String get revenue => throw _privateConstructorUsedError;
  String get cost => throw _privateConstructorUsedError;
  String get profit => throw _privateConstructorUsedError;
  String get margin => throw _privateConstructorUsedError;

  /// Serializes this DailyProfit to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DailyProfit
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DailyProfitCopyWith<DailyProfit> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DailyProfitCopyWith<$Res> {
  factory $DailyProfitCopyWith(
          DailyProfit value, $Res Function(DailyProfit) then) =
      _$DailyProfitCopyWithImpl<$Res, DailyProfit>;
  @useResult
  $Res call(
      {String date, String revenue, String cost, String profit, String margin});
}

/// @nodoc
class _$DailyProfitCopyWithImpl<$Res, $Val extends DailyProfit>
    implements $DailyProfitCopyWith<$Res> {
  _$DailyProfitCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DailyProfit
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? date = null,
    Object? revenue = null,
    Object? cost = null,
    Object? profit = null,
    Object? margin = null,
  }) {
    return _then(_value.copyWith(
      date: null == date
          ? _value.date
          : date // ignore: cast_nullable_to_non_nullable
              as String,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      cost: null == cost
          ? _value.cost
          : cost // ignore: cast_nullable_to_non_nullable
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
abstract class _$$DailyProfitImplCopyWith<$Res>
    implements $DailyProfitCopyWith<$Res> {
  factory _$$DailyProfitImplCopyWith(
          _$DailyProfitImpl value, $Res Function(_$DailyProfitImpl) then) =
      __$$DailyProfitImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String date, String revenue, String cost, String profit, String margin});
}

/// @nodoc
class __$$DailyProfitImplCopyWithImpl<$Res>
    extends _$DailyProfitCopyWithImpl<$Res, _$DailyProfitImpl>
    implements _$$DailyProfitImplCopyWith<$Res> {
  __$$DailyProfitImplCopyWithImpl(
      _$DailyProfitImpl _value, $Res Function(_$DailyProfitImpl) _then)
      : super(_value, _then);

  /// Create a copy of DailyProfit
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? date = null,
    Object? revenue = null,
    Object? cost = null,
    Object? profit = null,
    Object? margin = null,
  }) {
    return _then(_$DailyProfitImpl(
      date: null == date
          ? _value.date
          : date // ignore: cast_nullable_to_non_nullable
              as String,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      cost: null == cost
          ? _value.cost
          : cost // ignore: cast_nullable_to_non_nullable
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
class _$DailyProfitImpl implements _DailyProfit {
  const _$DailyProfitImpl(
      {required this.date,
      required this.revenue,
      required this.cost,
      required this.profit,
      required this.margin});

  factory _$DailyProfitImpl.fromJson(Map<String, dynamic> json) =>
      _$$DailyProfitImplFromJson(json);

  @override
  final String date;
  @override
  final String revenue;
  @override
  final String cost;
  @override
  final String profit;
  @override
  final String margin;

  @override
  String toString() {
    return 'DailyProfit(date: $date, revenue: $revenue, cost: $cost, profit: $profit, margin: $margin)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DailyProfitImpl &&
            (identical(other.date, date) || other.date == date) &&
            (identical(other.revenue, revenue) || other.revenue == revenue) &&
            (identical(other.cost, cost) || other.cost == cost) &&
            (identical(other.profit, profit) || other.profit == profit) &&
            (identical(other.margin, margin) || other.margin == margin));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, date, revenue, cost, profit, margin);

  /// Create a copy of DailyProfit
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DailyProfitImplCopyWith<_$DailyProfitImpl> get copyWith =>
      __$$DailyProfitImplCopyWithImpl<_$DailyProfitImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DailyProfitImplToJson(
      this,
    );
  }
}

abstract class _DailyProfit implements DailyProfit {
  const factory _DailyProfit(
      {required final String date,
      required final String revenue,
      required final String cost,
      required final String profit,
      required final String margin}) = _$DailyProfitImpl;

  factory _DailyProfit.fromJson(Map<String, dynamic> json) =
      _$DailyProfitImpl.fromJson;

  @override
  String get date;
  @override
  String get revenue;
  @override
  String get cost;
  @override
  String get profit;
  @override
  String get margin;

  /// Create a copy of DailyProfit
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DailyProfitImplCopyWith<_$DailyProfitImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

WeeklyProfit _$WeeklyProfitFromJson(Map<String, dynamic> json) {
  return _WeeklyProfit.fromJson(json);
}

/// @nodoc
mixin _$WeeklyProfit {
  String get week => throw _privateConstructorUsedError;
  String get revenue => throw _privateConstructorUsedError;
  String get cost => throw _privateConstructorUsedError;
  String get profit => throw _privateConstructorUsedError;
  String get margin => throw _privateConstructorUsedError;

  /// Serializes this WeeklyProfit to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of WeeklyProfit
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $WeeklyProfitCopyWith<WeeklyProfit> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $WeeklyProfitCopyWith<$Res> {
  factory $WeeklyProfitCopyWith(
          WeeklyProfit value, $Res Function(WeeklyProfit) then) =
      _$WeeklyProfitCopyWithImpl<$Res, WeeklyProfit>;
  @useResult
  $Res call(
      {String week, String revenue, String cost, String profit, String margin});
}

/// @nodoc
class _$WeeklyProfitCopyWithImpl<$Res, $Val extends WeeklyProfit>
    implements $WeeklyProfitCopyWith<$Res> {
  _$WeeklyProfitCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of WeeklyProfit
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? week = null,
    Object? revenue = null,
    Object? cost = null,
    Object? profit = null,
    Object? margin = null,
  }) {
    return _then(_value.copyWith(
      week: null == week
          ? _value.week
          : week // ignore: cast_nullable_to_non_nullable
              as String,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      cost: null == cost
          ? _value.cost
          : cost // ignore: cast_nullable_to_non_nullable
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
abstract class _$$WeeklyProfitImplCopyWith<$Res>
    implements $WeeklyProfitCopyWith<$Res> {
  factory _$$WeeklyProfitImplCopyWith(
          _$WeeklyProfitImpl value, $Res Function(_$WeeklyProfitImpl) then) =
      __$$WeeklyProfitImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String week, String revenue, String cost, String profit, String margin});
}

/// @nodoc
class __$$WeeklyProfitImplCopyWithImpl<$Res>
    extends _$WeeklyProfitCopyWithImpl<$Res, _$WeeklyProfitImpl>
    implements _$$WeeklyProfitImplCopyWith<$Res> {
  __$$WeeklyProfitImplCopyWithImpl(
      _$WeeklyProfitImpl _value, $Res Function(_$WeeklyProfitImpl) _then)
      : super(_value, _then);

  /// Create a copy of WeeklyProfit
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? week = null,
    Object? revenue = null,
    Object? cost = null,
    Object? profit = null,
    Object? margin = null,
  }) {
    return _then(_$WeeklyProfitImpl(
      week: null == week
          ? _value.week
          : week // ignore: cast_nullable_to_non_nullable
              as String,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      cost: null == cost
          ? _value.cost
          : cost // ignore: cast_nullable_to_non_nullable
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
class _$WeeklyProfitImpl implements _WeeklyProfit {
  const _$WeeklyProfitImpl(
      {required this.week,
      required this.revenue,
      required this.cost,
      required this.profit,
      required this.margin});

  factory _$WeeklyProfitImpl.fromJson(Map<String, dynamic> json) =>
      _$$WeeklyProfitImplFromJson(json);

  @override
  final String week;
  @override
  final String revenue;
  @override
  final String cost;
  @override
  final String profit;
  @override
  final String margin;

  @override
  String toString() {
    return 'WeeklyProfit(week: $week, revenue: $revenue, cost: $cost, profit: $profit, margin: $margin)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$WeeklyProfitImpl &&
            (identical(other.week, week) || other.week == week) &&
            (identical(other.revenue, revenue) || other.revenue == revenue) &&
            (identical(other.cost, cost) || other.cost == cost) &&
            (identical(other.profit, profit) || other.profit == profit) &&
            (identical(other.margin, margin) || other.margin == margin));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, week, revenue, cost, profit, margin);

  /// Create a copy of WeeklyProfit
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$WeeklyProfitImplCopyWith<_$WeeklyProfitImpl> get copyWith =>
      __$$WeeklyProfitImplCopyWithImpl<_$WeeklyProfitImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$WeeklyProfitImplToJson(
      this,
    );
  }
}

abstract class _WeeklyProfit implements WeeklyProfit {
  const factory _WeeklyProfit(
      {required final String week,
      required final String revenue,
      required final String cost,
      required final String profit,
      required final String margin}) = _$WeeklyProfitImpl;

  factory _WeeklyProfit.fromJson(Map<String, dynamic> json) =
      _$WeeklyProfitImpl.fromJson;

  @override
  String get week;
  @override
  String get revenue;
  @override
  String get cost;
  @override
  String get profit;
  @override
  String get margin;

  /// Create a copy of WeeklyProfit
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$WeeklyProfitImplCopyWith<_$WeeklyProfitImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

MonthlyProfit _$MonthlyProfitFromJson(Map<String, dynamic> json) {
  return _MonthlyProfit.fromJson(json);
}

/// @nodoc
mixin _$MonthlyProfit {
  String get month => throw _privateConstructorUsedError;
  String get revenue => throw _privateConstructorUsedError;
  String get cost => throw _privateConstructorUsedError;
  String get profit => throw _privateConstructorUsedError;
  String get margin => throw _privateConstructorUsedError;

  /// Serializes this MonthlyProfit to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MonthlyProfit
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MonthlyProfitCopyWith<MonthlyProfit> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MonthlyProfitCopyWith<$Res> {
  factory $MonthlyProfitCopyWith(
          MonthlyProfit value, $Res Function(MonthlyProfit) then) =
      _$MonthlyProfitCopyWithImpl<$Res, MonthlyProfit>;
  @useResult
  $Res call(
      {String month,
      String revenue,
      String cost,
      String profit,
      String margin});
}

/// @nodoc
class _$MonthlyProfitCopyWithImpl<$Res, $Val extends MonthlyProfit>
    implements $MonthlyProfitCopyWith<$Res> {
  _$MonthlyProfitCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MonthlyProfit
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? month = null,
    Object? revenue = null,
    Object? cost = null,
    Object? profit = null,
    Object? margin = null,
  }) {
    return _then(_value.copyWith(
      month: null == month
          ? _value.month
          : month // ignore: cast_nullable_to_non_nullable
              as String,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      cost: null == cost
          ? _value.cost
          : cost // ignore: cast_nullable_to_non_nullable
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
abstract class _$$MonthlyProfitImplCopyWith<$Res>
    implements $MonthlyProfitCopyWith<$Res> {
  factory _$$MonthlyProfitImplCopyWith(
          _$MonthlyProfitImpl value, $Res Function(_$MonthlyProfitImpl) then) =
      __$$MonthlyProfitImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String month,
      String revenue,
      String cost,
      String profit,
      String margin});
}

/// @nodoc
class __$$MonthlyProfitImplCopyWithImpl<$Res>
    extends _$MonthlyProfitCopyWithImpl<$Res, _$MonthlyProfitImpl>
    implements _$$MonthlyProfitImplCopyWith<$Res> {
  __$$MonthlyProfitImplCopyWithImpl(
      _$MonthlyProfitImpl _value, $Res Function(_$MonthlyProfitImpl) _then)
      : super(_value, _then);

  /// Create a copy of MonthlyProfit
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? month = null,
    Object? revenue = null,
    Object? cost = null,
    Object? profit = null,
    Object? margin = null,
  }) {
    return _then(_$MonthlyProfitImpl(
      month: null == month
          ? _value.month
          : month // ignore: cast_nullable_to_non_nullable
              as String,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as String,
      cost: null == cost
          ? _value.cost
          : cost // ignore: cast_nullable_to_non_nullable
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
class _$MonthlyProfitImpl implements _MonthlyProfit {
  const _$MonthlyProfitImpl(
      {required this.month,
      required this.revenue,
      required this.cost,
      required this.profit,
      required this.margin});

  factory _$MonthlyProfitImpl.fromJson(Map<String, dynamic> json) =>
      _$$MonthlyProfitImplFromJson(json);

  @override
  final String month;
  @override
  final String revenue;
  @override
  final String cost;
  @override
  final String profit;
  @override
  final String margin;

  @override
  String toString() {
    return 'MonthlyProfit(month: $month, revenue: $revenue, cost: $cost, profit: $profit, margin: $margin)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MonthlyProfitImpl &&
            (identical(other.month, month) || other.month == month) &&
            (identical(other.revenue, revenue) || other.revenue == revenue) &&
            (identical(other.cost, cost) || other.cost == cost) &&
            (identical(other.profit, profit) || other.profit == profit) &&
            (identical(other.margin, margin) || other.margin == margin));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, month, revenue, cost, profit, margin);

  /// Create a copy of MonthlyProfit
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MonthlyProfitImplCopyWith<_$MonthlyProfitImpl> get copyWith =>
      __$$MonthlyProfitImplCopyWithImpl<_$MonthlyProfitImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$MonthlyProfitImplToJson(
      this,
    );
  }
}

abstract class _MonthlyProfit implements MonthlyProfit {
  const factory _MonthlyProfit(
      {required final String month,
      required final String revenue,
      required final String cost,
      required final String profit,
      required final String margin}) = _$MonthlyProfitImpl;

  factory _MonthlyProfit.fromJson(Map<String, dynamic> json) =
      _$MonthlyProfitImpl.fromJson;

  @override
  String get month;
  @override
  String get revenue;
  @override
  String get cost;
  @override
  String get profit;
  @override
  String get margin;

  /// Create a copy of MonthlyProfit
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MonthlyProfitImplCopyWith<_$MonthlyProfitImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
mixin _$ChartDataPoint {
  String get label => throw _privateConstructorUsedError;
  double get revenue => throw _privateConstructorUsedError;
  double get profit => throw _privateConstructorUsedError;

  /// Create a copy of ChartDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ChartDataPointCopyWith<ChartDataPoint> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ChartDataPointCopyWith<$Res> {
  factory $ChartDataPointCopyWith(
          ChartDataPoint value, $Res Function(ChartDataPoint) then) =
      _$ChartDataPointCopyWithImpl<$Res, ChartDataPoint>;
  @useResult
  $Res call({String label, double revenue, double profit});
}

/// @nodoc
class _$ChartDataPointCopyWithImpl<$Res, $Val extends ChartDataPoint>
    implements $ChartDataPointCopyWith<$Res> {
  _$ChartDataPointCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ChartDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? label = null,
    Object? revenue = null,
    Object? profit = null,
  }) {
    return _then(_value.copyWith(
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as double,
      profit: null == profit
          ? _value.profit
          : profit // ignore: cast_nullable_to_non_nullable
              as double,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ChartDataPointImplCopyWith<$Res>
    implements $ChartDataPointCopyWith<$Res> {
  factory _$$ChartDataPointImplCopyWith(_$ChartDataPointImpl value,
          $Res Function(_$ChartDataPointImpl) then) =
      __$$ChartDataPointImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String label, double revenue, double profit});
}

/// @nodoc
class __$$ChartDataPointImplCopyWithImpl<$Res>
    extends _$ChartDataPointCopyWithImpl<$Res, _$ChartDataPointImpl>
    implements _$$ChartDataPointImplCopyWith<$Res> {
  __$$ChartDataPointImplCopyWithImpl(
      _$ChartDataPointImpl _value, $Res Function(_$ChartDataPointImpl) _then)
      : super(_value, _then);

  /// Create a copy of ChartDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? label = null,
    Object? revenue = null,
    Object? profit = null,
  }) {
    return _then(_$ChartDataPointImpl(
      label: null == label
          ? _value.label
          : label // ignore: cast_nullable_to_non_nullable
              as String,
      revenue: null == revenue
          ? _value.revenue
          : revenue // ignore: cast_nullable_to_non_nullable
              as double,
      profit: null == profit
          ? _value.profit
          : profit // ignore: cast_nullable_to_non_nullable
              as double,
    ));
  }
}

/// @nodoc

class _$ChartDataPointImpl implements _ChartDataPoint {
  const _$ChartDataPointImpl(
      {required this.label, required this.revenue, required this.profit});

  @override
  final String label;
  @override
  final double revenue;
  @override
  final double profit;

  @override
  String toString() {
    return 'ChartDataPoint(label: $label, revenue: $revenue, profit: $profit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ChartDataPointImpl &&
            (identical(other.label, label) || other.label == label) &&
            (identical(other.revenue, revenue) || other.revenue == revenue) &&
            (identical(other.profit, profit) || other.profit == profit));
  }

  @override
  int get hashCode => Object.hash(runtimeType, label, revenue, profit);

  /// Create a copy of ChartDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ChartDataPointImplCopyWith<_$ChartDataPointImpl> get copyWith =>
      __$$ChartDataPointImplCopyWithImpl<_$ChartDataPointImpl>(
          this, _$identity);
}

abstract class _ChartDataPoint implements ChartDataPoint {
  const factory _ChartDataPoint(
      {required final String label,
      required final double revenue,
      required final double profit}) = _$ChartDataPointImpl;

  @override
  String get label;
  @override
  double get revenue;
  @override
  double get profit;

  /// Create a copy of ChartDataPoint
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ChartDataPointImplCopyWith<_$ChartDataPointImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
