// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'supplier_purchase_summary_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

MonthlySpend _$MonthlySpendFromJson(Map<String, dynamic> json) {
  return _MonthlySpend.fromJson(json);
}

/// @nodoc
mixin _$MonthlySpend {
  String get month => throw _privateConstructorUsedError;
  String get amount => throw _privateConstructorUsedError;

  /// Serializes this MonthlySpend to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of MonthlySpend
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $MonthlySpendCopyWith<MonthlySpend> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $MonthlySpendCopyWith<$Res> {
  factory $MonthlySpendCopyWith(
          MonthlySpend value, $Res Function(MonthlySpend) then) =
      _$MonthlySpendCopyWithImpl<$Res, MonthlySpend>;
  @useResult
  $Res call({String month, String amount});
}

/// @nodoc
class _$MonthlySpendCopyWithImpl<$Res, $Val extends MonthlySpend>
    implements $MonthlySpendCopyWith<$Res> {
  _$MonthlySpendCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of MonthlySpend
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? month = null,
    Object? amount = null,
  }) {
    return _then(_value.copyWith(
      month: null == month
          ? _value.month
          : month // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$MonthlySpendImplCopyWith<$Res>
    implements $MonthlySpendCopyWith<$Res> {
  factory _$$MonthlySpendImplCopyWith(
          _$MonthlySpendImpl value, $Res Function(_$MonthlySpendImpl) then) =
      __$$MonthlySpendImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String month, String amount});
}

/// @nodoc
class __$$MonthlySpendImplCopyWithImpl<$Res>
    extends _$MonthlySpendCopyWithImpl<$Res, _$MonthlySpendImpl>
    implements _$$MonthlySpendImplCopyWith<$Res> {
  __$$MonthlySpendImplCopyWithImpl(
      _$MonthlySpendImpl _value, $Res Function(_$MonthlySpendImpl) _then)
      : super(_value, _then);

  /// Create a copy of MonthlySpend
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? month = null,
    Object? amount = null,
  }) {
    return _then(_$MonthlySpendImpl(
      month: null == month
          ? _value.month
          : month // ignore: cast_nullable_to_non_nullable
              as String,
      amount: null == amount
          ? _value.amount
          : amount // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$MonthlySpendImpl implements _MonthlySpend {
  const _$MonthlySpendImpl({required this.month, required this.amount});

  factory _$MonthlySpendImpl.fromJson(Map<String, dynamic> json) =>
      _$$MonthlySpendImplFromJson(json);

  @override
  final String month;
  @override
  final String amount;

  @override
  String toString() {
    return 'MonthlySpend(month: $month, amount: $amount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$MonthlySpendImpl &&
            (identical(other.month, month) || other.month == month) &&
            (identical(other.amount, amount) || other.amount == amount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, month, amount);

  /// Create a copy of MonthlySpend
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$MonthlySpendImplCopyWith<_$MonthlySpendImpl> get copyWith =>
      __$$MonthlySpendImplCopyWithImpl<_$MonthlySpendImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$MonthlySpendImplToJson(
      this,
    );
  }
}

abstract class _MonthlySpend implements MonthlySpend {
  const factory _MonthlySpend(
      {required final String month,
      required final String amount}) = _$MonthlySpendImpl;

  factory _MonthlySpend.fromJson(Map<String, dynamic> json) =
      _$MonthlySpendImpl.fromJson;

  @override
  String get month;
  @override
  String get amount;

  /// Create a copy of MonthlySpend
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$MonthlySpendImplCopyWith<_$MonthlySpendImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SupplierPurchaseSummary _$SupplierPurchaseSummaryFromJson(
    Map<String, dynamic> json) {
  return _SupplierPurchaseSummary.fromJson(json);
}

/// @nodoc
mixin _$SupplierPurchaseSummary {
  String get dateFrom => throw _privateConstructorUsedError;
  String get dateTo => throw _privateConstructorUsedError;
  String get totalInvoiced => throw _privateConstructorUsedError;
  String get totalReturned => throw _privateConstructorUsedError;
  String get netPurchaseSpend => throw _privateConstructorUsedError;
  int get totalPurchasedQuantity => throw _privateConstructorUsedError;
  String get weightedAverageUnitCost => throw _privateConstructorUsedError;
  int get invoiceCount => throw _privateConstructorUsedError;
  int get returnCount => throw _privateConstructorUsedError;
  String? get firstPurchaseDate => throw _privateConstructorUsedError;
  String? get lastPurchaseDate => throw _privateConstructorUsedError;
  List<MonthlySpend> get monthlySpend => throw _privateConstructorUsedError;
  String get currentTotalPaid => throw _privateConstructorUsedError;
  String get currentOutstanding => throw _privateConstructorUsedError;

  /// Serializes this SupplierPurchaseSummary to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierPurchaseSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierPurchaseSummaryCopyWith<SupplierPurchaseSummary> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierPurchaseSummaryCopyWith<$Res> {
  factory $SupplierPurchaseSummaryCopyWith(SupplierPurchaseSummary value,
          $Res Function(SupplierPurchaseSummary) then) =
      _$SupplierPurchaseSummaryCopyWithImpl<$Res, SupplierPurchaseSummary>;
  @useResult
  $Res call(
      {String dateFrom,
      String dateTo,
      String totalInvoiced,
      String totalReturned,
      String netPurchaseSpend,
      int totalPurchasedQuantity,
      String weightedAverageUnitCost,
      int invoiceCount,
      int returnCount,
      String? firstPurchaseDate,
      String? lastPurchaseDate,
      List<MonthlySpend> monthlySpend,
      String currentTotalPaid,
      String currentOutstanding});
}

/// @nodoc
class _$SupplierPurchaseSummaryCopyWithImpl<$Res,
        $Val extends SupplierPurchaseSummary>
    implements $SupplierPurchaseSummaryCopyWith<$Res> {
  _$SupplierPurchaseSummaryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierPurchaseSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dateFrom = null,
    Object? dateTo = null,
    Object? totalInvoiced = null,
    Object? totalReturned = null,
    Object? netPurchaseSpend = null,
    Object? totalPurchasedQuantity = null,
    Object? weightedAverageUnitCost = null,
    Object? invoiceCount = null,
    Object? returnCount = null,
    Object? firstPurchaseDate = freezed,
    Object? lastPurchaseDate = freezed,
    Object? monthlySpend = null,
    Object? currentTotalPaid = null,
    Object? currentOutstanding = null,
  }) {
    return _then(_value.copyWith(
      dateFrom: null == dateFrom
          ? _value.dateFrom
          : dateFrom // ignore: cast_nullable_to_non_nullable
              as String,
      dateTo: null == dateTo
          ? _value.dateTo
          : dateTo // ignore: cast_nullable_to_non_nullable
              as String,
      totalInvoiced: null == totalInvoiced
          ? _value.totalInvoiced
          : totalInvoiced // ignore: cast_nullable_to_non_nullable
              as String,
      totalReturned: null == totalReturned
          ? _value.totalReturned
          : totalReturned // ignore: cast_nullable_to_non_nullable
              as String,
      netPurchaseSpend: null == netPurchaseSpend
          ? _value.netPurchaseSpend
          : netPurchaseSpend // ignore: cast_nullable_to_non_nullable
              as String,
      totalPurchasedQuantity: null == totalPurchasedQuantity
          ? _value.totalPurchasedQuantity
          : totalPurchasedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      weightedAverageUnitCost: null == weightedAverageUnitCost
          ? _value.weightedAverageUnitCost
          : weightedAverageUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceCount: null == invoiceCount
          ? _value.invoiceCount
          : invoiceCount // ignore: cast_nullable_to_non_nullable
              as int,
      returnCount: null == returnCount
          ? _value.returnCount
          : returnCount // ignore: cast_nullable_to_non_nullable
              as int,
      firstPurchaseDate: freezed == firstPurchaseDate
          ? _value.firstPurchaseDate
          : firstPurchaseDate // ignore: cast_nullable_to_non_nullable
              as String?,
      lastPurchaseDate: freezed == lastPurchaseDate
          ? _value.lastPurchaseDate
          : lastPurchaseDate // ignore: cast_nullable_to_non_nullable
              as String?,
      monthlySpend: null == monthlySpend
          ? _value.monthlySpend
          : monthlySpend // ignore: cast_nullable_to_non_nullable
              as List<MonthlySpend>,
      currentTotalPaid: null == currentTotalPaid
          ? _value.currentTotalPaid
          : currentTotalPaid // ignore: cast_nullable_to_non_nullable
              as String,
      currentOutstanding: null == currentOutstanding
          ? _value.currentOutstanding
          : currentOutstanding // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SupplierPurchaseSummaryImplCopyWith<$Res>
    implements $SupplierPurchaseSummaryCopyWith<$Res> {
  factory _$$SupplierPurchaseSummaryImplCopyWith(
          _$SupplierPurchaseSummaryImpl value,
          $Res Function(_$SupplierPurchaseSummaryImpl) then) =
      __$$SupplierPurchaseSummaryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String dateFrom,
      String dateTo,
      String totalInvoiced,
      String totalReturned,
      String netPurchaseSpend,
      int totalPurchasedQuantity,
      String weightedAverageUnitCost,
      int invoiceCount,
      int returnCount,
      String? firstPurchaseDate,
      String? lastPurchaseDate,
      List<MonthlySpend> monthlySpend,
      String currentTotalPaid,
      String currentOutstanding});
}

/// @nodoc
class __$$SupplierPurchaseSummaryImplCopyWithImpl<$Res>
    extends _$SupplierPurchaseSummaryCopyWithImpl<$Res,
        _$SupplierPurchaseSummaryImpl>
    implements _$$SupplierPurchaseSummaryImplCopyWith<$Res> {
  __$$SupplierPurchaseSummaryImplCopyWithImpl(
      _$SupplierPurchaseSummaryImpl _value,
      $Res Function(_$SupplierPurchaseSummaryImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierPurchaseSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dateFrom = null,
    Object? dateTo = null,
    Object? totalInvoiced = null,
    Object? totalReturned = null,
    Object? netPurchaseSpend = null,
    Object? totalPurchasedQuantity = null,
    Object? weightedAverageUnitCost = null,
    Object? invoiceCount = null,
    Object? returnCount = null,
    Object? firstPurchaseDate = freezed,
    Object? lastPurchaseDate = freezed,
    Object? monthlySpend = null,
    Object? currentTotalPaid = null,
    Object? currentOutstanding = null,
  }) {
    return _then(_$SupplierPurchaseSummaryImpl(
      dateFrom: null == dateFrom
          ? _value.dateFrom
          : dateFrom // ignore: cast_nullable_to_non_nullable
              as String,
      dateTo: null == dateTo
          ? _value.dateTo
          : dateTo // ignore: cast_nullable_to_non_nullable
              as String,
      totalInvoiced: null == totalInvoiced
          ? _value.totalInvoiced
          : totalInvoiced // ignore: cast_nullable_to_non_nullable
              as String,
      totalReturned: null == totalReturned
          ? _value.totalReturned
          : totalReturned // ignore: cast_nullable_to_non_nullable
              as String,
      netPurchaseSpend: null == netPurchaseSpend
          ? _value.netPurchaseSpend
          : netPurchaseSpend // ignore: cast_nullable_to_non_nullable
              as String,
      totalPurchasedQuantity: null == totalPurchasedQuantity
          ? _value.totalPurchasedQuantity
          : totalPurchasedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      weightedAverageUnitCost: null == weightedAverageUnitCost
          ? _value.weightedAverageUnitCost
          : weightedAverageUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceCount: null == invoiceCount
          ? _value.invoiceCount
          : invoiceCount // ignore: cast_nullable_to_non_nullable
              as int,
      returnCount: null == returnCount
          ? _value.returnCount
          : returnCount // ignore: cast_nullable_to_non_nullable
              as int,
      firstPurchaseDate: freezed == firstPurchaseDate
          ? _value.firstPurchaseDate
          : firstPurchaseDate // ignore: cast_nullable_to_non_nullable
              as String?,
      lastPurchaseDate: freezed == lastPurchaseDate
          ? _value.lastPurchaseDate
          : lastPurchaseDate // ignore: cast_nullable_to_non_nullable
              as String?,
      monthlySpend: null == monthlySpend
          ? _value._monthlySpend
          : monthlySpend // ignore: cast_nullable_to_non_nullable
              as List<MonthlySpend>,
      currentTotalPaid: null == currentTotalPaid
          ? _value.currentTotalPaid
          : currentTotalPaid // ignore: cast_nullable_to_non_nullable
              as String,
      currentOutstanding: null == currentOutstanding
          ? _value.currentOutstanding
          : currentOutstanding // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SupplierPurchaseSummaryImpl implements _SupplierPurchaseSummary {
  const _$SupplierPurchaseSummaryImpl(
      {required this.dateFrom,
      required this.dateTo,
      required this.totalInvoiced,
      required this.totalReturned,
      required this.netPurchaseSpend,
      required this.totalPurchasedQuantity,
      required this.weightedAverageUnitCost,
      required this.invoiceCount,
      required this.returnCount,
      this.firstPurchaseDate,
      this.lastPurchaseDate,
      final List<MonthlySpend> monthlySpend = const [],
      required this.currentTotalPaid,
      required this.currentOutstanding})
      : _monthlySpend = monthlySpend;

  factory _$SupplierPurchaseSummaryImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierPurchaseSummaryImplFromJson(json);

  @override
  final String dateFrom;
  @override
  final String dateTo;
  @override
  final String totalInvoiced;
  @override
  final String totalReturned;
  @override
  final String netPurchaseSpend;
  @override
  final int totalPurchasedQuantity;
  @override
  final String weightedAverageUnitCost;
  @override
  final int invoiceCount;
  @override
  final int returnCount;
  @override
  final String? firstPurchaseDate;
  @override
  final String? lastPurchaseDate;
  final List<MonthlySpend> _monthlySpend;
  @override
  @JsonKey()
  List<MonthlySpend> get monthlySpend {
    if (_monthlySpend is EqualUnmodifiableListView) return _monthlySpend;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_monthlySpend);
  }

  @override
  final String currentTotalPaid;
  @override
  final String currentOutstanding;

  @override
  String toString() {
    return 'SupplierPurchaseSummary(dateFrom: $dateFrom, dateTo: $dateTo, totalInvoiced: $totalInvoiced, totalReturned: $totalReturned, netPurchaseSpend: $netPurchaseSpend, totalPurchasedQuantity: $totalPurchasedQuantity, weightedAverageUnitCost: $weightedAverageUnitCost, invoiceCount: $invoiceCount, returnCount: $returnCount, firstPurchaseDate: $firstPurchaseDate, lastPurchaseDate: $lastPurchaseDate, monthlySpend: $monthlySpend, currentTotalPaid: $currentTotalPaid, currentOutstanding: $currentOutstanding)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierPurchaseSummaryImpl &&
            (identical(other.dateFrom, dateFrom) ||
                other.dateFrom == dateFrom) &&
            (identical(other.dateTo, dateTo) || other.dateTo == dateTo) &&
            (identical(other.totalInvoiced, totalInvoiced) ||
                other.totalInvoiced == totalInvoiced) &&
            (identical(other.totalReturned, totalReturned) ||
                other.totalReturned == totalReturned) &&
            (identical(other.netPurchaseSpend, netPurchaseSpend) ||
                other.netPurchaseSpend == netPurchaseSpend) &&
            (identical(other.totalPurchasedQuantity, totalPurchasedQuantity) ||
                other.totalPurchasedQuantity == totalPurchasedQuantity) &&
            (identical(
                    other.weightedAverageUnitCost, weightedAverageUnitCost) ||
                other.weightedAverageUnitCost == weightedAverageUnitCost) &&
            (identical(other.invoiceCount, invoiceCount) ||
                other.invoiceCount == invoiceCount) &&
            (identical(other.returnCount, returnCount) ||
                other.returnCount == returnCount) &&
            (identical(other.firstPurchaseDate, firstPurchaseDate) ||
                other.firstPurchaseDate == firstPurchaseDate) &&
            (identical(other.lastPurchaseDate, lastPurchaseDate) ||
                other.lastPurchaseDate == lastPurchaseDate) &&
            const DeepCollectionEquality()
                .equals(other._monthlySpend, _monthlySpend) &&
            (identical(other.currentTotalPaid, currentTotalPaid) ||
                other.currentTotalPaid == currentTotalPaid) &&
            (identical(other.currentOutstanding, currentOutstanding) ||
                other.currentOutstanding == currentOutstanding));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      dateFrom,
      dateTo,
      totalInvoiced,
      totalReturned,
      netPurchaseSpend,
      totalPurchasedQuantity,
      weightedAverageUnitCost,
      invoiceCount,
      returnCount,
      firstPurchaseDate,
      lastPurchaseDate,
      const DeepCollectionEquality().hash(_monthlySpend),
      currentTotalPaid,
      currentOutstanding);

  /// Create a copy of SupplierPurchaseSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierPurchaseSummaryImplCopyWith<_$SupplierPurchaseSummaryImpl>
      get copyWith => __$$SupplierPurchaseSummaryImplCopyWithImpl<
          _$SupplierPurchaseSummaryImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierPurchaseSummaryImplToJson(
      this,
    );
  }
}

abstract class _SupplierPurchaseSummary implements SupplierPurchaseSummary {
  const factory _SupplierPurchaseSummary(
          {required final String dateFrom,
          required final String dateTo,
          required final String totalInvoiced,
          required final String totalReturned,
          required final String netPurchaseSpend,
          required final int totalPurchasedQuantity,
          required final String weightedAverageUnitCost,
          required final int invoiceCount,
          required final int returnCount,
          final String? firstPurchaseDate,
          final String? lastPurchaseDate,
          final List<MonthlySpend> monthlySpend,
          required final String currentTotalPaid,
          required final String currentOutstanding}) =
      _$SupplierPurchaseSummaryImpl;

  factory _SupplierPurchaseSummary.fromJson(Map<String, dynamic> json) =
      _$SupplierPurchaseSummaryImpl.fromJson;

  @override
  String get dateFrom;
  @override
  String get dateTo;
  @override
  String get totalInvoiced;
  @override
  String get totalReturned;
  @override
  String get netPurchaseSpend;
  @override
  int get totalPurchasedQuantity;
  @override
  String get weightedAverageUnitCost;
  @override
  int get invoiceCount;
  @override
  int get returnCount;
  @override
  String? get firstPurchaseDate;
  @override
  String? get lastPurchaseDate;
  @override
  List<MonthlySpend> get monthlySpend;
  @override
  String get currentTotalPaid;
  @override
  String get currentOutstanding;

  /// Create a copy of SupplierPurchaseSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierPurchaseSummaryImplCopyWith<_$SupplierPurchaseSummaryImpl>
      get copyWith => throw _privateConstructorUsedError;
}

ProductPurchaseDetail _$ProductPurchaseDetailFromJson(
    Map<String, dynamic> json) {
  return _ProductPurchaseDetail.fromJson(json);
}

/// @nodoc
mixin _$ProductPurchaseDetail {
  String get productId => throw _privateConstructorUsedError;
  String get productName => throw _privateConstructorUsedError;
  String? get sku => throw _privateConstructorUsedError;
  int get totalPurchasedQuantity => throw _privateConstructorUsedError;
  String get totalPurchaseSpend => throw _privateConstructorUsedError;
  String get weightedAverageUnitCost => throw _privateConstructorUsedError;
  String get minUnitCost => throw _privateConstructorUsedError;
  String get maxUnitCost => throw _privateConstructorUsedError;
  int get totalReturnedQuantity => throw _privateConstructorUsedError;
  String get totalReturnedSpend => throw _privateConstructorUsedError;
  int get netPurchasedQuantity => throw _privateConstructorUsedError;
  String get netPurchaseSpend => throw _privateConstructorUsedError;
  int get invoiceCount => throw _privateConstructorUsedError;
  String? get firstPurchaseDate => throw _privateConstructorUsedError;
  String? get lastPurchaseDate => throw _privateConstructorUsedError;

  /// Serializes this ProductPurchaseDetail to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProductPurchaseDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProductPurchaseDetailCopyWith<ProductPurchaseDetail> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProductPurchaseDetailCopyWith<$Res> {
  factory $ProductPurchaseDetailCopyWith(ProductPurchaseDetail value,
          $Res Function(ProductPurchaseDetail) then) =
      _$ProductPurchaseDetailCopyWithImpl<$Res, ProductPurchaseDetail>;
  @useResult
  $Res call(
      {String productId,
      String productName,
      String? sku,
      int totalPurchasedQuantity,
      String totalPurchaseSpend,
      String weightedAverageUnitCost,
      String minUnitCost,
      String maxUnitCost,
      int totalReturnedQuantity,
      String totalReturnedSpend,
      int netPurchasedQuantity,
      String netPurchaseSpend,
      int invoiceCount,
      String? firstPurchaseDate,
      String? lastPurchaseDate});
}

/// @nodoc
class _$ProductPurchaseDetailCopyWithImpl<$Res,
        $Val extends ProductPurchaseDetail>
    implements $ProductPurchaseDetailCopyWith<$Res> {
  _$ProductPurchaseDetailCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProductPurchaseDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? productName = null,
    Object? sku = freezed,
    Object? totalPurchasedQuantity = null,
    Object? totalPurchaseSpend = null,
    Object? weightedAverageUnitCost = null,
    Object? minUnitCost = null,
    Object? maxUnitCost = null,
    Object? totalReturnedQuantity = null,
    Object? totalReturnedSpend = null,
    Object? netPurchasedQuantity = null,
    Object? netPurchaseSpend = null,
    Object? invoiceCount = null,
    Object? firstPurchaseDate = freezed,
    Object? lastPurchaseDate = freezed,
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
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
      totalPurchasedQuantity: null == totalPurchasedQuantity
          ? _value.totalPurchasedQuantity
          : totalPurchasedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      totalPurchaseSpend: null == totalPurchaseSpend
          ? _value.totalPurchaseSpend
          : totalPurchaseSpend // ignore: cast_nullable_to_non_nullable
              as String,
      weightedAverageUnitCost: null == weightedAverageUnitCost
          ? _value.weightedAverageUnitCost
          : weightedAverageUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      minUnitCost: null == minUnitCost
          ? _value.minUnitCost
          : minUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      maxUnitCost: null == maxUnitCost
          ? _value.maxUnitCost
          : maxUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      totalReturnedQuantity: null == totalReturnedQuantity
          ? _value.totalReturnedQuantity
          : totalReturnedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      totalReturnedSpend: null == totalReturnedSpend
          ? _value.totalReturnedSpend
          : totalReturnedSpend // ignore: cast_nullable_to_non_nullable
              as String,
      netPurchasedQuantity: null == netPurchasedQuantity
          ? _value.netPurchasedQuantity
          : netPurchasedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      netPurchaseSpend: null == netPurchaseSpend
          ? _value.netPurchaseSpend
          : netPurchaseSpend // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceCount: null == invoiceCount
          ? _value.invoiceCount
          : invoiceCount // ignore: cast_nullable_to_non_nullable
              as int,
      firstPurchaseDate: freezed == firstPurchaseDate
          ? _value.firstPurchaseDate
          : firstPurchaseDate // ignore: cast_nullable_to_non_nullable
              as String?,
      lastPurchaseDate: freezed == lastPurchaseDate
          ? _value.lastPurchaseDate
          : lastPurchaseDate // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ProductPurchaseDetailImplCopyWith<$Res>
    implements $ProductPurchaseDetailCopyWith<$Res> {
  factory _$$ProductPurchaseDetailImplCopyWith(
          _$ProductPurchaseDetailImpl value,
          $Res Function(_$ProductPurchaseDetailImpl) then) =
      __$$ProductPurchaseDetailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String productId,
      String productName,
      String? sku,
      int totalPurchasedQuantity,
      String totalPurchaseSpend,
      String weightedAverageUnitCost,
      String minUnitCost,
      String maxUnitCost,
      int totalReturnedQuantity,
      String totalReturnedSpend,
      int netPurchasedQuantity,
      String netPurchaseSpend,
      int invoiceCount,
      String? firstPurchaseDate,
      String? lastPurchaseDate});
}

/// @nodoc
class __$$ProductPurchaseDetailImplCopyWithImpl<$Res>
    extends _$ProductPurchaseDetailCopyWithImpl<$Res,
        _$ProductPurchaseDetailImpl>
    implements _$$ProductPurchaseDetailImplCopyWith<$Res> {
  __$$ProductPurchaseDetailImplCopyWithImpl(_$ProductPurchaseDetailImpl _value,
      $Res Function(_$ProductPurchaseDetailImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProductPurchaseDetail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? productName = null,
    Object? sku = freezed,
    Object? totalPurchasedQuantity = null,
    Object? totalPurchaseSpend = null,
    Object? weightedAverageUnitCost = null,
    Object? minUnitCost = null,
    Object? maxUnitCost = null,
    Object? totalReturnedQuantity = null,
    Object? totalReturnedSpend = null,
    Object? netPurchasedQuantity = null,
    Object? netPurchaseSpend = null,
    Object? invoiceCount = null,
    Object? firstPurchaseDate = freezed,
    Object? lastPurchaseDate = freezed,
  }) {
    return _then(_$ProductPurchaseDetailImpl(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      productName: null == productName
          ? _value.productName
          : productName // ignore: cast_nullable_to_non_nullable
              as String,
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
      totalPurchasedQuantity: null == totalPurchasedQuantity
          ? _value.totalPurchasedQuantity
          : totalPurchasedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      totalPurchaseSpend: null == totalPurchaseSpend
          ? _value.totalPurchaseSpend
          : totalPurchaseSpend // ignore: cast_nullable_to_non_nullable
              as String,
      weightedAverageUnitCost: null == weightedAverageUnitCost
          ? _value.weightedAverageUnitCost
          : weightedAverageUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      minUnitCost: null == minUnitCost
          ? _value.minUnitCost
          : minUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      maxUnitCost: null == maxUnitCost
          ? _value.maxUnitCost
          : maxUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      totalReturnedQuantity: null == totalReturnedQuantity
          ? _value.totalReturnedQuantity
          : totalReturnedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      totalReturnedSpend: null == totalReturnedSpend
          ? _value.totalReturnedSpend
          : totalReturnedSpend // ignore: cast_nullable_to_non_nullable
              as String,
      netPurchasedQuantity: null == netPurchasedQuantity
          ? _value.netPurchasedQuantity
          : netPurchasedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      netPurchaseSpend: null == netPurchaseSpend
          ? _value.netPurchaseSpend
          : netPurchaseSpend // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceCount: null == invoiceCount
          ? _value.invoiceCount
          : invoiceCount // ignore: cast_nullable_to_non_nullable
              as int,
      firstPurchaseDate: freezed == firstPurchaseDate
          ? _value.firstPurchaseDate
          : firstPurchaseDate // ignore: cast_nullable_to_non_nullable
              as String?,
      lastPurchaseDate: freezed == lastPurchaseDate
          ? _value.lastPurchaseDate
          : lastPurchaseDate // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ProductPurchaseDetailImpl implements _ProductPurchaseDetail {
  const _$ProductPurchaseDetailImpl(
      {required this.productId,
      required this.productName,
      this.sku,
      required this.totalPurchasedQuantity,
      required this.totalPurchaseSpend,
      required this.weightedAverageUnitCost,
      required this.minUnitCost,
      required this.maxUnitCost,
      required this.totalReturnedQuantity,
      required this.totalReturnedSpend,
      required this.netPurchasedQuantity,
      required this.netPurchaseSpend,
      required this.invoiceCount,
      this.firstPurchaseDate,
      this.lastPurchaseDate});

  factory _$ProductPurchaseDetailImpl.fromJson(Map<String, dynamic> json) =>
      _$$ProductPurchaseDetailImplFromJson(json);

  @override
  final String productId;
  @override
  final String productName;
  @override
  final String? sku;
  @override
  final int totalPurchasedQuantity;
  @override
  final String totalPurchaseSpend;
  @override
  final String weightedAverageUnitCost;
  @override
  final String minUnitCost;
  @override
  final String maxUnitCost;
  @override
  final int totalReturnedQuantity;
  @override
  final String totalReturnedSpend;
  @override
  final int netPurchasedQuantity;
  @override
  final String netPurchaseSpend;
  @override
  final int invoiceCount;
  @override
  final String? firstPurchaseDate;
  @override
  final String? lastPurchaseDate;

  @override
  String toString() {
    return 'ProductPurchaseDetail(productId: $productId, productName: $productName, sku: $sku, totalPurchasedQuantity: $totalPurchasedQuantity, totalPurchaseSpend: $totalPurchaseSpend, weightedAverageUnitCost: $weightedAverageUnitCost, minUnitCost: $minUnitCost, maxUnitCost: $maxUnitCost, totalReturnedQuantity: $totalReturnedQuantity, totalReturnedSpend: $totalReturnedSpend, netPurchasedQuantity: $netPurchasedQuantity, netPurchaseSpend: $netPurchaseSpend, invoiceCount: $invoiceCount, firstPurchaseDate: $firstPurchaseDate, lastPurchaseDate: $lastPurchaseDate)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProductPurchaseDetailImpl &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.productName, productName) ||
                other.productName == productName) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.totalPurchasedQuantity, totalPurchasedQuantity) ||
                other.totalPurchasedQuantity == totalPurchasedQuantity) &&
            (identical(other.totalPurchaseSpend, totalPurchaseSpend) ||
                other.totalPurchaseSpend == totalPurchaseSpend) &&
            (identical(
                    other.weightedAverageUnitCost, weightedAverageUnitCost) ||
                other.weightedAverageUnitCost == weightedAverageUnitCost) &&
            (identical(other.minUnitCost, minUnitCost) ||
                other.minUnitCost == minUnitCost) &&
            (identical(other.maxUnitCost, maxUnitCost) ||
                other.maxUnitCost == maxUnitCost) &&
            (identical(other.totalReturnedQuantity, totalReturnedQuantity) ||
                other.totalReturnedQuantity == totalReturnedQuantity) &&
            (identical(other.totalReturnedSpend, totalReturnedSpend) ||
                other.totalReturnedSpend == totalReturnedSpend) &&
            (identical(other.netPurchasedQuantity, netPurchasedQuantity) ||
                other.netPurchasedQuantity == netPurchasedQuantity) &&
            (identical(other.netPurchaseSpend, netPurchaseSpend) ||
                other.netPurchaseSpend == netPurchaseSpend) &&
            (identical(other.invoiceCount, invoiceCount) ||
                other.invoiceCount == invoiceCount) &&
            (identical(other.firstPurchaseDate, firstPurchaseDate) ||
                other.firstPurchaseDate == firstPurchaseDate) &&
            (identical(other.lastPurchaseDate, lastPurchaseDate) ||
                other.lastPurchaseDate == lastPurchaseDate));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      productId,
      productName,
      sku,
      totalPurchasedQuantity,
      totalPurchaseSpend,
      weightedAverageUnitCost,
      minUnitCost,
      maxUnitCost,
      totalReturnedQuantity,
      totalReturnedSpend,
      netPurchasedQuantity,
      netPurchaseSpend,
      invoiceCount,
      firstPurchaseDate,
      lastPurchaseDate);

  /// Create a copy of ProductPurchaseDetail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProductPurchaseDetailImplCopyWith<_$ProductPurchaseDetailImpl>
      get copyWith => __$$ProductPurchaseDetailImplCopyWithImpl<
          _$ProductPurchaseDetailImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProductPurchaseDetailImplToJson(
      this,
    );
  }
}

abstract class _ProductPurchaseDetail implements ProductPurchaseDetail {
  const factory _ProductPurchaseDetail(
      {required final String productId,
      required final String productName,
      final String? sku,
      required final int totalPurchasedQuantity,
      required final String totalPurchaseSpend,
      required final String weightedAverageUnitCost,
      required final String minUnitCost,
      required final String maxUnitCost,
      required final int totalReturnedQuantity,
      required final String totalReturnedSpend,
      required final int netPurchasedQuantity,
      required final String netPurchaseSpend,
      required final int invoiceCount,
      final String? firstPurchaseDate,
      final String? lastPurchaseDate}) = _$ProductPurchaseDetailImpl;

  factory _ProductPurchaseDetail.fromJson(Map<String, dynamic> json) =
      _$ProductPurchaseDetailImpl.fromJson;

  @override
  String get productId;
  @override
  String get productName;
  @override
  String? get sku;
  @override
  int get totalPurchasedQuantity;
  @override
  String get totalPurchaseSpend;
  @override
  String get weightedAverageUnitCost;
  @override
  String get minUnitCost;
  @override
  String get maxUnitCost;
  @override
  int get totalReturnedQuantity;
  @override
  String get totalReturnedSpend;
  @override
  int get netPurchasedQuantity;
  @override
  String get netPurchaseSpend;
  @override
  int get invoiceCount;
  @override
  String? get firstPurchaseDate;
  @override
  String? get lastPurchaseDate;

  /// Create a copy of ProductPurchaseDetail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProductPurchaseDetailImplCopyWith<_$ProductPurchaseDetailImpl>
      get copyWith => throw _privateConstructorUsedError;
}

ProductPurchaseListResponse _$ProductPurchaseListResponseFromJson(
    Map<String, dynamic> json) {
  return _ProductPurchaseListResponse.fromJson(json);
}

/// @nodoc
mixin _$ProductPurchaseListResponse {
  List<ProductPurchaseDetail> get items => throw _privateConstructorUsedError;
  int get total => throw _privateConstructorUsedError;
  int get page => throw _privateConstructorUsedError;
  int get limit => throw _privateConstructorUsedError;

  /// Serializes this ProductPurchaseListResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ProductPurchaseListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ProductPurchaseListResponseCopyWith<ProductPurchaseListResponse>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ProductPurchaseListResponseCopyWith<$Res> {
  factory $ProductPurchaseListResponseCopyWith(
          ProductPurchaseListResponse value,
          $Res Function(ProductPurchaseListResponse) then) =
      _$ProductPurchaseListResponseCopyWithImpl<$Res,
          ProductPurchaseListResponse>;
  @useResult
  $Res call(
      {List<ProductPurchaseDetail> items, int total, int page, int limit});
}

/// @nodoc
class _$ProductPurchaseListResponseCopyWithImpl<$Res,
        $Val extends ProductPurchaseListResponse>
    implements $ProductPurchaseListResponseCopyWith<$Res> {
  _$ProductPurchaseListResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ProductPurchaseListResponse
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
              as List<ProductPurchaseDetail>,
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
abstract class _$$ProductPurchaseListResponseImplCopyWith<$Res>
    implements $ProductPurchaseListResponseCopyWith<$Res> {
  factory _$$ProductPurchaseListResponseImplCopyWith(
          _$ProductPurchaseListResponseImpl value,
          $Res Function(_$ProductPurchaseListResponseImpl) then) =
      __$$ProductPurchaseListResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {List<ProductPurchaseDetail> items, int total, int page, int limit});
}

/// @nodoc
class __$$ProductPurchaseListResponseImplCopyWithImpl<$Res>
    extends _$ProductPurchaseListResponseCopyWithImpl<$Res,
        _$ProductPurchaseListResponseImpl>
    implements _$$ProductPurchaseListResponseImplCopyWith<$Res> {
  __$$ProductPurchaseListResponseImplCopyWithImpl(
      _$ProductPurchaseListResponseImpl _value,
      $Res Function(_$ProductPurchaseListResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of ProductPurchaseListResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? items = null,
    Object? total = null,
    Object? page = null,
    Object? limit = null,
  }) {
    return _then(_$ProductPurchaseListResponseImpl(
      items: null == items
          ? _value._items
          : items // ignore: cast_nullable_to_non_nullable
              as List<ProductPurchaseDetail>,
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
class _$ProductPurchaseListResponseImpl
    implements _ProductPurchaseListResponse {
  const _$ProductPurchaseListResponseImpl(
      {required final List<ProductPurchaseDetail> items,
      required this.total,
      required this.page,
      required this.limit})
      : _items = items;

  factory _$ProductPurchaseListResponseImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$ProductPurchaseListResponseImplFromJson(json);

  final List<ProductPurchaseDetail> _items;
  @override
  List<ProductPurchaseDetail> get items {
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
    return 'ProductPurchaseListResponse(items: $items, total: $total, page: $page, limit: $limit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ProductPurchaseListResponseImpl &&
            const DeepCollectionEquality().equals(other._items, _items) &&
            (identical(other.total, total) || other.total == total) &&
            (identical(other.page, page) || other.page == page) &&
            (identical(other.limit, limit) || other.limit == limit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_items), total, page, limit);

  /// Create a copy of ProductPurchaseListResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ProductPurchaseListResponseImplCopyWith<_$ProductPurchaseListResponseImpl>
      get copyWith => __$$ProductPurchaseListResponseImplCopyWithImpl<
          _$ProductPurchaseListResponseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ProductPurchaseListResponseImplToJson(
      this,
    );
  }
}

abstract class _ProductPurchaseListResponse
    implements ProductPurchaseListResponse {
  const factory _ProductPurchaseListResponse(
      {required final List<ProductPurchaseDetail> items,
      required final int total,
      required final int page,
      required final int limit}) = _$ProductPurchaseListResponseImpl;

  factory _ProductPurchaseListResponse.fromJson(Map<String, dynamic> json) =
      _$ProductPurchaseListResponseImpl.fromJson;

  @override
  List<ProductPurchaseDetail> get items;
  @override
  int get total;
  @override
  int get page;
  @override
  int get limit;

  /// Create a copy of ProductPurchaseListResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ProductPurchaseListResponseImplCopyWith<_$ProductPurchaseListResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}

RecentDelivery _$RecentDeliveryFromJson(Map<String, dynamic> json) {
  return _RecentDelivery.fromJson(json);
}

/// @nodoc
mixin _$RecentDelivery {
  String get orderNumber => throw _privateConstructorUsedError;
  String get orderDate => throw _privateConstructorUsedError;
  String? get expectedDate => throw _privateConstructorUsedError;
  String? get receiptDate => throw _privateConstructorUsedError;
  int? get leadTimeDays => throw _privateConstructorUsedError;
  bool? get onTime => throw _privateConstructorUsedError;
  String get status => throw _privateConstructorUsedError;
  String get grandTotal => throw _privateConstructorUsedError;

  /// Serializes this RecentDelivery to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of RecentDelivery
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $RecentDeliveryCopyWith<RecentDelivery> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $RecentDeliveryCopyWith<$Res> {
  factory $RecentDeliveryCopyWith(
          RecentDelivery value, $Res Function(RecentDelivery) then) =
      _$RecentDeliveryCopyWithImpl<$Res, RecentDelivery>;
  @useResult
  $Res call(
      {String orderNumber,
      String orderDate,
      String? expectedDate,
      String? receiptDate,
      int? leadTimeDays,
      bool? onTime,
      String status,
      String grandTotal});
}

/// @nodoc
class _$RecentDeliveryCopyWithImpl<$Res, $Val extends RecentDelivery>
    implements $RecentDeliveryCopyWith<$Res> {
  _$RecentDeliveryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of RecentDelivery
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? orderNumber = null,
    Object? orderDate = null,
    Object? expectedDate = freezed,
    Object? receiptDate = freezed,
    Object? leadTimeDays = freezed,
    Object? onTime = freezed,
    Object? status = null,
    Object? grandTotal = null,
  }) {
    return _then(_value.copyWith(
      orderNumber: null == orderNumber
          ? _value.orderNumber
          : orderNumber // ignore: cast_nullable_to_non_nullable
              as String,
      orderDate: null == orderDate
          ? _value.orderDate
          : orderDate // ignore: cast_nullable_to_non_nullable
              as String,
      expectedDate: freezed == expectedDate
          ? _value.expectedDate
          : expectedDate // ignore: cast_nullable_to_non_nullable
              as String?,
      receiptDate: freezed == receiptDate
          ? _value.receiptDate
          : receiptDate // ignore: cast_nullable_to_non_nullable
              as String?,
      leadTimeDays: freezed == leadTimeDays
          ? _value.leadTimeDays
          : leadTimeDays // ignore: cast_nullable_to_non_nullable
              as int?,
      onTime: freezed == onTime
          ? _value.onTime
          : onTime // ignore: cast_nullable_to_non_nullable
              as bool?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      grandTotal: null == grandTotal
          ? _value.grandTotal
          : grandTotal // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$RecentDeliveryImplCopyWith<$Res>
    implements $RecentDeliveryCopyWith<$Res> {
  factory _$$RecentDeliveryImplCopyWith(_$RecentDeliveryImpl value,
          $Res Function(_$RecentDeliveryImpl) then) =
      __$$RecentDeliveryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String orderNumber,
      String orderDate,
      String? expectedDate,
      String? receiptDate,
      int? leadTimeDays,
      bool? onTime,
      String status,
      String grandTotal});
}

/// @nodoc
class __$$RecentDeliveryImplCopyWithImpl<$Res>
    extends _$RecentDeliveryCopyWithImpl<$Res, _$RecentDeliveryImpl>
    implements _$$RecentDeliveryImplCopyWith<$Res> {
  __$$RecentDeliveryImplCopyWithImpl(
      _$RecentDeliveryImpl _value, $Res Function(_$RecentDeliveryImpl) _then)
      : super(_value, _then);

  /// Create a copy of RecentDelivery
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? orderNumber = null,
    Object? orderDate = null,
    Object? expectedDate = freezed,
    Object? receiptDate = freezed,
    Object? leadTimeDays = freezed,
    Object? onTime = freezed,
    Object? status = null,
    Object? grandTotal = null,
  }) {
    return _then(_$RecentDeliveryImpl(
      orderNumber: null == orderNumber
          ? _value.orderNumber
          : orderNumber // ignore: cast_nullable_to_non_nullable
              as String,
      orderDate: null == orderDate
          ? _value.orderDate
          : orderDate // ignore: cast_nullable_to_non_nullable
              as String,
      expectedDate: freezed == expectedDate
          ? _value.expectedDate
          : expectedDate // ignore: cast_nullable_to_non_nullable
              as String?,
      receiptDate: freezed == receiptDate
          ? _value.receiptDate
          : receiptDate // ignore: cast_nullable_to_non_nullable
              as String?,
      leadTimeDays: freezed == leadTimeDays
          ? _value.leadTimeDays
          : leadTimeDays // ignore: cast_nullable_to_non_nullable
              as int?,
      onTime: freezed == onTime
          ? _value.onTime
          : onTime // ignore: cast_nullable_to_non_nullable
              as bool?,
      status: null == status
          ? _value.status
          : status // ignore: cast_nullable_to_non_nullable
              as String,
      grandTotal: null == grandTotal
          ? _value.grandTotal
          : grandTotal // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$RecentDeliveryImpl implements _RecentDelivery {
  const _$RecentDeliveryImpl(
      {required this.orderNumber,
      required this.orderDate,
      this.expectedDate,
      this.receiptDate,
      this.leadTimeDays,
      this.onTime,
      required this.status,
      required this.grandTotal});

  factory _$RecentDeliveryImpl.fromJson(Map<String, dynamic> json) =>
      _$$RecentDeliveryImplFromJson(json);

  @override
  final String orderNumber;
  @override
  final String orderDate;
  @override
  final String? expectedDate;
  @override
  final String? receiptDate;
  @override
  final int? leadTimeDays;
  @override
  final bool? onTime;
  @override
  final String status;
  @override
  final String grandTotal;

  @override
  String toString() {
    return 'RecentDelivery(orderNumber: $orderNumber, orderDate: $orderDate, expectedDate: $expectedDate, receiptDate: $receiptDate, leadTimeDays: $leadTimeDays, onTime: $onTime, status: $status, grandTotal: $grandTotal)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$RecentDeliveryImpl &&
            (identical(other.orderNumber, orderNumber) ||
                other.orderNumber == orderNumber) &&
            (identical(other.orderDate, orderDate) ||
                other.orderDate == orderDate) &&
            (identical(other.expectedDate, expectedDate) ||
                other.expectedDate == expectedDate) &&
            (identical(other.receiptDate, receiptDate) ||
                other.receiptDate == receiptDate) &&
            (identical(other.leadTimeDays, leadTimeDays) ||
                other.leadTimeDays == leadTimeDays) &&
            (identical(other.onTime, onTime) || other.onTime == onTime) &&
            (identical(other.status, status) || other.status == status) &&
            (identical(other.grandTotal, grandTotal) ||
                other.grandTotal == grandTotal));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, orderNumber, orderDate,
      expectedDate, receiptDate, leadTimeDays, onTime, status, grandTotal);

  /// Create a copy of RecentDelivery
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$RecentDeliveryImplCopyWith<_$RecentDeliveryImpl> get copyWith =>
      __$$RecentDeliveryImplCopyWithImpl<_$RecentDeliveryImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$RecentDeliveryImplToJson(
      this,
    );
  }
}

abstract class _RecentDelivery implements RecentDelivery {
  const factory _RecentDelivery(
      {required final String orderNumber,
      required final String orderDate,
      final String? expectedDate,
      final String? receiptDate,
      final int? leadTimeDays,
      final bool? onTime,
      required final String status,
      required final String grandTotal}) = _$RecentDeliveryImpl;

  factory _RecentDelivery.fromJson(Map<String, dynamic> json) =
      _$RecentDeliveryImpl.fromJson;

  @override
  String get orderNumber;
  @override
  String get orderDate;
  @override
  String? get expectedDate;
  @override
  String? get receiptDate;
  @override
  int? get leadTimeDays;
  @override
  bool? get onTime;
  @override
  String get status;
  @override
  String get grandTotal;

  /// Create a copy of RecentDelivery
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$RecentDeliveryImplCopyWith<_$RecentDeliveryImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SupplierReliability _$SupplierReliabilityFromJson(Map<String, dynamic> json) {
  return _SupplierReliability.fromJson(json);
}

/// @nodoc
mixin _$SupplierReliability {
  String get dateFrom => throw _privateConstructorUsedError;
  String get dateTo => throw _privateConstructorUsedError;
  int get totalOrders => throw _privateConstructorUsedError;
  int get totalReceipts => throw _privateConstructorUsedError;
  double get onTimeDeliveryRate => throw _privateConstructorUsedError;
  double get averageLeadTimeDays => throw _privateConstructorUsedError;
  int? get minLeadTimeDays => throw _privateConstructorUsedError;
  int? get maxLeadTimeDays => throw _privateConstructorUsedError;
  int get ordersReceived => throw _privateConstructorUsedError;
  int get ordersPartiallyReceived => throw _privateConstructorUsedError;
  int get ordersCancelled => throw _privateConstructorUsedError;
  double get cancellationRate => throw _privateConstructorUsedError;
  List<RecentDelivery> get recentDeliveries =>
      throw _privateConstructorUsedError;

  /// Serializes this SupplierReliability to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierReliability
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierReliabilityCopyWith<SupplierReliability> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierReliabilityCopyWith<$Res> {
  factory $SupplierReliabilityCopyWith(
          SupplierReliability value, $Res Function(SupplierReliability) then) =
      _$SupplierReliabilityCopyWithImpl<$Res, SupplierReliability>;
  @useResult
  $Res call(
      {String dateFrom,
      String dateTo,
      int totalOrders,
      int totalReceipts,
      double onTimeDeliveryRate,
      double averageLeadTimeDays,
      int? minLeadTimeDays,
      int? maxLeadTimeDays,
      int ordersReceived,
      int ordersPartiallyReceived,
      int ordersCancelled,
      double cancellationRate,
      List<RecentDelivery> recentDeliveries});
}

/// @nodoc
class _$SupplierReliabilityCopyWithImpl<$Res, $Val extends SupplierReliability>
    implements $SupplierReliabilityCopyWith<$Res> {
  _$SupplierReliabilityCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierReliability
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dateFrom = null,
    Object? dateTo = null,
    Object? totalOrders = null,
    Object? totalReceipts = null,
    Object? onTimeDeliveryRate = null,
    Object? averageLeadTimeDays = null,
    Object? minLeadTimeDays = freezed,
    Object? maxLeadTimeDays = freezed,
    Object? ordersReceived = null,
    Object? ordersPartiallyReceived = null,
    Object? ordersCancelled = null,
    Object? cancellationRate = null,
    Object? recentDeliveries = null,
  }) {
    return _then(_value.copyWith(
      dateFrom: null == dateFrom
          ? _value.dateFrom
          : dateFrom // ignore: cast_nullable_to_non_nullable
              as String,
      dateTo: null == dateTo
          ? _value.dateTo
          : dateTo // ignore: cast_nullable_to_non_nullable
              as String,
      totalOrders: null == totalOrders
          ? _value.totalOrders
          : totalOrders // ignore: cast_nullable_to_non_nullable
              as int,
      totalReceipts: null == totalReceipts
          ? _value.totalReceipts
          : totalReceipts // ignore: cast_nullable_to_non_nullable
              as int,
      onTimeDeliveryRate: null == onTimeDeliveryRate
          ? _value.onTimeDeliveryRate
          : onTimeDeliveryRate // ignore: cast_nullable_to_non_nullable
              as double,
      averageLeadTimeDays: null == averageLeadTimeDays
          ? _value.averageLeadTimeDays
          : averageLeadTimeDays // ignore: cast_nullable_to_non_nullable
              as double,
      minLeadTimeDays: freezed == minLeadTimeDays
          ? _value.minLeadTimeDays
          : minLeadTimeDays // ignore: cast_nullable_to_non_nullable
              as int?,
      maxLeadTimeDays: freezed == maxLeadTimeDays
          ? _value.maxLeadTimeDays
          : maxLeadTimeDays // ignore: cast_nullable_to_non_nullable
              as int?,
      ordersReceived: null == ordersReceived
          ? _value.ordersReceived
          : ordersReceived // ignore: cast_nullable_to_non_nullable
              as int,
      ordersPartiallyReceived: null == ordersPartiallyReceived
          ? _value.ordersPartiallyReceived
          : ordersPartiallyReceived // ignore: cast_nullable_to_non_nullable
              as int,
      ordersCancelled: null == ordersCancelled
          ? _value.ordersCancelled
          : ordersCancelled // ignore: cast_nullable_to_non_nullable
              as int,
      cancellationRate: null == cancellationRate
          ? _value.cancellationRate
          : cancellationRate // ignore: cast_nullable_to_non_nullable
              as double,
      recentDeliveries: null == recentDeliveries
          ? _value.recentDeliveries
          : recentDeliveries // ignore: cast_nullable_to_non_nullable
              as List<RecentDelivery>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SupplierReliabilityImplCopyWith<$Res>
    implements $SupplierReliabilityCopyWith<$Res> {
  factory _$$SupplierReliabilityImplCopyWith(_$SupplierReliabilityImpl value,
          $Res Function(_$SupplierReliabilityImpl) then) =
      __$$SupplierReliabilityImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String dateFrom,
      String dateTo,
      int totalOrders,
      int totalReceipts,
      double onTimeDeliveryRate,
      double averageLeadTimeDays,
      int? minLeadTimeDays,
      int? maxLeadTimeDays,
      int ordersReceived,
      int ordersPartiallyReceived,
      int ordersCancelled,
      double cancellationRate,
      List<RecentDelivery> recentDeliveries});
}

/// @nodoc
class __$$SupplierReliabilityImplCopyWithImpl<$Res>
    extends _$SupplierReliabilityCopyWithImpl<$Res, _$SupplierReliabilityImpl>
    implements _$$SupplierReliabilityImplCopyWith<$Res> {
  __$$SupplierReliabilityImplCopyWithImpl(_$SupplierReliabilityImpl _value,
      $Res Function(_$SupplierReliabilityImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierReliability
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dateFrom = null,
    Object? dateTo = null,
    Object? totalOrders = null,
    Object? totalReceipts = null,
    Object? onTimeDeliveryRate = null,
    Object? averageLeadTimeDays = null,
    Object? minLeadTimeDays = freezed,
    Object? maxLeadTimeDays = freezed,
    Object? ordersReceived = null,
    Object? ordersPartiallyReceived = null,
    Object? ordersCancelled = null,
    Object? cancellationRate = null,
    Object? recentDeliveries = null,
  }) {
    return _then(_$SupplierReliabilityImpl(
      dateFrom: null == dateFrom
          ? _value.dateFrom
          : dateFrom // ignore: cast_nullable_to_non_nullable
              as String,
      dateTo: null == dateTo
          ? _value.dateTo
          : dateTo // ignore: cast_nullable_to_non_nullable
              as String,
      totalOrders: null == totalOrders
          ? _value.totalOrders
          : totalOrders // ignore: cast_nullable_to_non_nullable
              as int,
      totalReceipts: null == totalReceipts
          ? _value.totalReceipts
          : totalReceipts // ignore: cast_nullable_to_non_nullable
              as int,
      onTimeDeliveryRate: null == onTimeDeliveryRate
          ? _value.onTimeDeliveryRate
          : onTimeDeliveryRate // ignore: cast_nullable_to_non_nullable
              as double,
      averageLeadTimeDays: null == averageLeadTimeDays
          ? _value.averageLeadTimeDays
          : averageLeadTimeDays // ignore: cast_nullable_to_non_nullable
              as double,
      minLeadTimeDays: freezed == minLeadTimeDays
          ? _value.minLeadTimeDays
          : minLeadTimeDays // ignore: cast_nullable_to_non_nullable
              as int?,
      maxLeadTimeDays: freezed == maxLeadTimeDays
          ? _value.maxLeadTimeDays
          : maxLeadTimeDays // ignore: cast_nullable_to_non_nullable
              as int?,
      ordersReceived: null == ordersReceived
          ? _value.ordersReceived
          : ordersReceived // ignore: cast_nullable_to_non_nullable
              as int,
      ordersPartiallyReceived: null == ordersPartiallyReceived
          ? _value.ordersPartiallyReceived
          : ordersPartiallyReceived // ignore: cast_nullable_to_non_nullable
              as int,
      ordersCancelled: null == ordersCancelled
          ? _value.ordersCancelled
          : ordersCancelled // ignore: cast_nullable_to_non_nullable
              as int,
      cancellationRate: null == cancellationRate
          ? _value.cancellationRate
          : cancellationRate // ignore: cast_nullable_to_non_nullable
              as double,
      recentDeliveries: null == recentDeliveries
          ? _value._recentDeliveries
          : recentDeliveries // ignore: cast_nullable_to_non_nullable
              as List<RecentDelivery>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SupplierReliabilityImpl implements _SupplierReliability {
  const _$SupplierReliabilityImpl(
      {required this.dateFrom,
      required this.dateTo,
      required this.totalOrders,
      required this.totalReceipts,
      required this.onTimeDeliveryRate,
      required this.averageLeadTimeDays,
      this.minLeadTimeDays,
      this.maxLeadTimeDays,
      required this.ordersReceived,
      required this.ordersPartiallyReceived,
      required this.ordersCancelled,
      required this.cancellationRate,
      final List<RecentDelivery> recentDeliveries = const []})
      : _recentDeliveries = recentDeliveries;

  factory _$SupplierReliabilityImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierReliabilityImplFromJson(json);

  @override
  final String dateFrom;
  @override
  final String dateTo;
  @override
  final int totalOrders;
  @override
  final int totalReceipts;
  @override
  final double onTimeDeliveryRate;
  @override
  final double averageLeadTimeDays;
  @override
  final int? minLeadTimeDays;
  @override
  final int? maxLeadTimeDays;
  @override
  final int ordersReceived;
  @override
  final int ordersPartiallyReceived;
  @override
  final int ordersCancelled;
  @override
  final double cancellationRate;
  final List<RecentDelivery> _recentDeliveries;
  @override
  @JsonKey()
  List<RecentDelivery> get recentDeliveries {
    if (_recentDeliveries is EqualUnmodifiableListView)
      return _recentDeliveries;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_recentDeliveries);
  }

  @override
  String toString() {
    return 'SupplierReliability(dateFrom: $dateFrom, dateTo: $dateTo, totalOrders: $totalOrders, totalReceipts: $totalReceipts, onTimeDeliveryRate: $onTimeDeliveryRate, averageLeadTimeDays: $averageLeadTimeDays, minLeadTimeDays: $minLeadTimeDays, maxLeadTimeDays: $maxLeadTimeDays, ordersReceived: $ordersReceived, ordersPartiallyReceived: $ordersPartiallyReceived, ordersCancelled: $ordersCancelled, cancellationRate: $cancellationRate, recentDeliveries: $recentDeliveries)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierReliabilityImpl &&
            (identical(other.dateFrom, dateFrom) ||
                other.dateFrom == dateFrom) &&
            (identical(other.dateTo, dateTo) || other.dateTo == dateTo) &&
            (identical(other.totalOrders, totalOrders) ||
                other.totalOrders == totalOrders) &&
            (identical(other.totalReceipts, totalReceipts) ||
                other.totalReceipts == totalReceipts) &&
            (identical(other.onTimeDeliveryRate, onTimeDeliveryRate) ||
                other.onTimeDeliveryRate == onTimeDeliveryRate) &&
            (identical(other.averageLeadTimeDays, averageLeadTimeDays) ||
                other.averageLeadTimeDays == averageLeadTimeDays) &&
            (identical(other.minLeadTimeDays, minLeadTimeDays) ||
                other.minLeadTimeDays == minLeadTimeDays) &&
            (identical(other.maxLeadTimeDays, maxLeadTimeDays) ||
                other.maxLeadTimeDays == maxLeadTimeDays) &&
            (identical(other.ordersReceived, ordersReceived) ||
                other.ordersReceived == ordersReceived) &&
            (identical(
                    other.ordersPartiallyReceived, ordersPartiallyReceived) ||
                other.ordersPartiallyReceived == ordersPartiallyReceived) &&
            (identical(other.ordersCancelled, ordersCancelled) ||
                other.ordersCancelled == ordersCancelled) &&
            (identical(other.cancellationRate, cancellationRate) ||
                other.cancellationRate == cancellationRate) &&
            const DeepCollectionEquality()
                .equals(other._recentDeliveries, _recentDeliveries));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      dateFrom,
      dateTo,
      totalOrders,
      totalReceipts,
      onTimeDeliveryRate,
      averageLeadTimeDays,
      minLeadTimeDays,
      maxLeadTimeDays,
      ordersReceived,
      ordersPartiallyReceived,
      ordersCancelled,
      cancellationRate,
      const DeepCollectionEquality().hash(_recentDeliveries));

  /// Create a copy of SupplierReliability
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierReliabilityImplCopyWith<_$SupplierReliabilityImpl> get copyWith =>
      __$$SupplierReliabilityImplCopyWithImpl<_$SupplierReliabilityImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierReliabilityImplToJson(
      this,
    );
  }
}

abstract class _SupplierReliability implements SupplierReliability {
  const factory _SupplierReliability(
      {required final String dateFrom,
      required final String dateTo,
      required final int totalOrders,
      required final int totalReceipts,
      required final double onTimeDeliveryRate,
      required final double averageLeadTimeDays,
      final int? minLeadTimeDays,
      final int? maxLeadTimeDays,
      required final int ordersReceived,
      required final int ordersPartiallyReceived,
      required final int ordersCancelled,
      required final double cancellationRate,
      final List<RecentDelivery> recentDeliveries}) = _$SupplierReliabilityImpl;

  factory _SupplierReliability.fromJson(Map<String, dynamic> json) =
      _$SupplierReliabilityImpl.fromJson;

  @override
  String get dateFrom;
  @override
  String get dateTo;
  @override
  int get totalOrders;
  @override
  int get totalReceipts;
  @override
  double get onTimeDeliveryRate;
  @override
  double get averageLeadTimeDays;
  @override
  int? get minLeadTimeDays;
  @override
  int? get maxLeadTimeDays;
  @override
  int get ordersReceived;
  @override
  int get ordersPartiallyReceived;
  @override
  int get ordersCancelled;
  @override
  double get cancellationRate;
  @override
  List<RecentDelivery> get recentDeliveries;

  /// Create a copy of SupplierReliability
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierReliabilityImplCopyWith<_$SupplierReliabilityImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

PricePoint _$PricePointFromJson(Map<String, dynamic> json) {
  return _PricePoint.fromJson(json);
}

/// @nodoc
mixin _$PricePoint {
  String get invoiceDate => throw _privateConstructorUsedError;
  String get invoiceNumber => throw _privateConstructorUsedError;
  String get unitCost => throw _privateConstructorUsedError;
  int get quantity => throw _privateConstructorUsedError;
  String get total => throw _privateConstructorUsedError;

  /// Serializes this PricePoint to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PricePoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PricePointCopyWith<PricePoint> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PricePointCopyWith<$Res> {
  factory $PricePointCopyWith(
          PricePoint value, $Res Function(PricePoint) then) =
      _$PricePointCopyWithImpl<$Res, PricePoint>;
  @useResult
  $Res call(
      {String invoiceDate,
      String invoiceNumber,
      String unitCost,
      int quantity,
      String total});
}

/// @nodoc
class _$PricePointCopyWithImpl<$Res, $Val extends PricePoint>
    implements $PricePointCopyWith<$Res> {
  _$PricePointCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PricePoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? invoiceDate = null,
    Object? invoiceNumber = null,
    Object? unitCost = null,
    Object? quantity = null,
    Object? total = null,
  }) {
    return _then(_value.copyWith(
      invoiceDate: null == invoiceDate
          ? _value.invoiceDate
          : invoiceDate // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceNumber: null == invoiceNumber
          ? _value.invoiceNumber
          : invoiceNumber // ignore: cast_nullable_to_non_nullable
              as String,
      unitCost: null == unitCost
          ? _value.unitCost
          : unitCost // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PricePointImplCopyWith<$Res>
    implements $PricePointCopyWith<$Res> {
  factory _$$PricePointImplCopyWith(
          _$PricePointImpl value, $Res Function(_$PricePointImpl) then) =
      __$$PricePointImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String invoiceDate,
      String invoiceNumber,
      String unitCost,
      int quantity,
      String total});
}

/// @nodoc
class __$$PricePointImplCopyWithImpl<$Res>
    extends _$PricePointCopyWithImpl<$Res, _$PricePointImpl>
    implements _$$PricePointImplCopyWith<$Res> {
  __$$PricePointImplCopyWithImpl(
      _$PricePointImpl _value, $Res Function(_$PricePointImpl) _then)
      : super(_value, _then);

  /// Create a copy of PricePoint
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? invoiceDate = null,
    Object? invoiceNumber = null,
    Object? unitCost = null,
    Object? quantity = null,
    Object? total = null,
  }) {
    return _then(_$PricePointImpl(
      invoiceDate: null == invoiceDate
          ? _value.invoiceDate
          : invoiceDate // ignore: cast_nullable_to_non_nullable
              as String,
      invoiceNumber: null == invoiceNumber
          ? _value.invoiceNumber
          : invoiceNumber // ignore: cast_nullable_to_non_nullable
              as String,
      unitCost: null == unitCost
          ? _value.unitCost
          : unitCost // ignore: cast_nullable_to_non_nullable
              as String,
      quantity: null == quantity
          ? _value.quantity
          : quantity // ignore: cast_nullable_to_non_nullable
              as int,
      total: null == total
          ? _value.total
          : total // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PricePointImpl implements _PricePoint {
  const _$PricePointImpl(
      {required this.invoiceDate,
      required this.invoiceNumber,
      required this.unitCost,
      required this.quantity,
      required this.total});

  factory _$PricePointImpl.fromJson(Map<String, dynamic> json) =>
      _$$PricePointImplFromJson(json);

  @override
  final String invoiceDate;
  @override
  final String invoiceNumber;
  @override
  final String unitCost;
  @override
  final int quantity;
  @override
  final String total;

  @override
  String toString() {
    return 'PricePoint(invoiceDate: $invoiceDate, invoiceNumber: $invoiceNumber, unitCost: $unitCost, quantity: $quantity, total: $total)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PricePointImpl &&
            (identical(other.invoiceDate, invoiceDate) ||
                other.invoiceDate == invoiceDate) &&
            (identical(other.invoiceNumber, invoiceNumber) ||
                other.invoiceNumber == invoiceNumber) &&
            (identical(other.unitCost, unitCost) ||
                other.unitCost == unitCost) &&
            (identical(other.quantity, quantity) ||
                other.quantity == quantity) &&
            (identical(other.total, total) || other.total == total));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, invoiceDate, invoiceNumber, unitCost, quantity, total);

  /// Create a copy of PricePoint
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PricePointImplCopyWith<_$PricePointImpl> get copyWith =>
      __$$PricePointImplCopyWithImpl<_$PricePointImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PricePointImplToJson(
      this,
    );
  }
}

abstract class _PricePoint implements PricePoint {
  const factory _PricePoint(
      {required final String invoiceDate,
      required final String invoiceNumber,
      required final String unitCost,
      required final int quantity,
      required final String total}) = _$PricePointImpl;

  factory _PricePoint.fromJson(Map<String, dynamic> json) =
      _$PricePointImpl.fromJson;

  @override
  String get invoiceDate;
  @override
  String get invoiceNumber;
  @override
  String get unitCost;
  @override
  int get quantity;
  @override
  String get total;

  /// Create a copy of PricePoint
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PricePointImplCopyWith<_$PricePointImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SupplierPriceHistory _$SupplierPriceHistoryFromJson(Map<String, dynamic> json) {
  return _SupplierPriceHistory.fromJson(json);
}

/// @nodoc
mixin _$SupplierPriceHistory {
  String get productId => throw _privateConstructorUsedError;
  String get productName => throw _privateConstructorUsedError;
  String? get sku => throw _privateConstructorUsedError;
  String get dateFrom => throw _privateConstructorUsedError;
  String get dateTo => throw _privateConstructorUsedError;
  String? get currentQuotedPrice => throw _privateConstructorUsedError;
  String get averageUnitCost => throw _privateConstructorUsedError;
  String get minUnitCost => throw _privateConstructorUsedError;
  String get maxUnitCost => throw _privateConstructorUsedError;
  List<PricePoint> get pricePoints => throw _privateConstructorUsedError;

  /// Serializes this SupplierPriceHistory to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierPriceHistory
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierPriceHistoryCopyWith<SupplierPriceHistory> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierPriceHistoryCopyWith<$Res> {
  factory $SupplierPriceHistoryCopyWith(SupplierPriceHistory value,
          $Res Function(SupplierPriceHistory) then) =
      _$SupplierPriceHistoryCopyWithImpl<$Res, SupplierPriceHistory>;
  @useResult
  $Res call(
      {String productId,
      String productName,
      String? sku,
      String dateFrom,
      String dateTo,
      String? currentQuotedPrice,
      String averageUnitCost,
      String minUnitCost,
      String maxUnitCost,
      List<PricePoint> pricePoints});
}

/// @nodoc
class _$SupplierPriceHistoryCopyWithImpl<$Res,
        $Val extends SupplierPriceHistory>
    implements $SupplierPriceHistoryCopyWith<$Res> {
  _$SupplierPriceHistoryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierPriceHistory
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? productName = null,
    Object? sku = freezed,
    Object? dateFrom = null,
    Object? dateTo = null,
    Object? currentQuotedPrice = freezed,
    Object? averageUnitCost = null,
    Object? minUnitCost = null,
    Object? maxUnitCost = null,
    Object? pricePoints = null,
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
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
      dateFrom: null == dateFrom
          ? _value.dateFrom
          : dateFrom // ignore: cast_nullable_to_non_nullable
              as String,
      dateTo: null == dateTo
          ? _value.dateTo
          : dateTo // ignore: cast_nullable_to_non_nullable
              as String,
      currentQuotedPrice: freezed == currentQuotedPrice
          ? _value.currentQuotedPrice
          : currentQuotedPrice // ignore: cast_nullable_to_non_nullable
              as String?,
      averageUnitCost: null == averageUnitCost
          ? _value.averageUnitCost
          : averageUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      minUnitCost: null == minUnitCost
          ? _value.minUnitCost
          : minUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      maxUnitCost: null == maxUnitCost
          ? _value.maxUnitCost
          : maxUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      pricePoints: null == pricePoints
          ? _value.pricePoints
          : pricePoints // ignore: cast_nullable_to_non_nullable
              as List<PricePoint>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SupplierPriceHistoryImplCopyWith<$Res>
    implements $SupplierPriceHistoryCopyWith<$Res> {
  factory _$$SupplierPriceHistoryImplCopyWith(_$SupplierPriceHistoryImpl value,
          $Res Function(_$SupplierPriceHistoryImpl) then) =
      __$$SupplierPriceHistoryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String productId,
      String productName,
      String? sku,
      String dateFrom,
      String dateTo,
      String? currentQuotedPrice,
      String averageUnitCost,
      String minUnitCost,
      String maxUnitCost,
      List<PricePoint> pricePoints});
}

/// @nodoc
class __$$SupplierPriceHistoryImplCopyWithImpl<$Res>
    extends _$SupplierPriceHistoryCopyWithImpl<$Res, _$SupplierPriceHistoryImpl>
    implements _$$SupplierPriceHistoryImplCopyWith<$Res> {
  __$$SupplierPriceHistoryImplCopyWithImpl(_$SupplierPriceHistoryImpl _value,
      $Res Function(_$SupplierPriceHistoryImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierPriceHistory
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? productName = null,
    Object? sku = freezed,
    Object? dateFrom = null,
    Object? dateTo = null,
    Object? currentQuotedPrice = freezed,
    Object? averageUnitCost = null,
    Object? minUnitCost = null,
    Object? maxUnitCost = null,
    Object? pricePoints = null,
  }) {
    return _then(_$SupplierPriceHistoryImpl(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      productName: null == productName
          ? _value.productName
          : productName // ignore: cast_nullable_to_non_nullable
              as String,
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
      dateFrom: null == dateFrom
          ? _value.dateFrom
          : dateFrom // ignore: cast_nullable_to_non_nullable
              as String,
      dateTo: null == dateTo
          ? _value.dateTo
          : dateTo // ignore: cast_nullable_to_non_nullable
              as String,
      currentQuotedPrice: freezed == currentQuotedPrice
          ? _value.currentQuotedPrice
          : currentQuotedPrice // ignore: cast_nullable_to_non_nullable
              as String?,
      averageUnitCost: null == averageUnitCost
          ? _value.averageUnitCost
          : averageUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      minUnitCost: null == minUnitCost
          ? _value.minUnitCost
          : minUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      maxUnitCost: null == maxUnitCost
          ? _value.maxUnitCost
          : maxUnitCost // ignore: cast_nullable_to_non_nullable
              as String,
      pricePoints: null == pricePoints
          ? _value._pricePoints
          : pricePoints // ignore: cast_nullable_to_non_nullable
              as List<PricePoint>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SupplierPriceHistoryImpl implements _SupplierPriceHistory {
  const _$SupplierPriceHistoryImpl(
      {required this.productId,
      required this.productName,
      this.sku,
      required this.dateFrom,
      required this.dateTo,
      this.currentQuotedPrice,
      required this.averageUnitCost,
      required this.minUnitCost,
      required this.maxUnitCost,
      final List<PricePoint> pricePoints = const []})
      : _pricePoints = pricePoints;

  factory _$SupplierPriceHistoryImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierPriceHistoryImplFromJson(json);

  @override
  final String productId;
  @override
  final String productName;
  @override
  final String? sku;
  @override
  final String dateFrom;
  @override
  final String dateTo;
  @override
  final String? currentQuotedPrice;
  @override
  final String averageUnitCost;
  @override
  final String minUnitCost;
  @override
  final String maxUnitCost;
  final List<PricePoint> _pricePoints;
  @override
  @JsonKey()
  List<PricePoint> get pricePoints {
    if (_pricePoints is EqualUnmodifiableListView) return _pricePoints;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_pricePoints);
  }

  @override
  String toString() {
    return 'SupplierPriceHistory(productId: $productId, productName: $productName, sku: $sku, dateFrom: $dateFrom, dateTo: $dateTo, currentQuotedPrice: $currentQuotedPrice, averageUnitCost: $averageUnitCost, minUnitCost: $minUnitCost, maxUnitCost: $maxUnitCost, pricePoints: $pricePoints)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierPriceHistoryImpl &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.productName, productName) ||
                other.productName == productName) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.dateFrom, dateFrom) ||
                other.dateFrom == dateFrom) &&
            (identical(other.dateTo, dateTo) || other.dateTo == dateTo) &&
            (identical(other.currentQuotedPrice, currentQuotedPrice) ||
                other.currentQuotedPrice == currentQuotedPrice) &&
            (identical(other.averageUnitCost, averageUnitCost) ||
                other.averageUnitCost == averageUnitCost) &&
            (identical(other.minUnitCost, minUnitCost) ||
                other.minUnitCost == minUnitCost) &&
            (identical(other.maxUnitCost, maxUnitCost) ||
                other.maxUnitCost == maxUnitCost) &&
            const DeepCollectionEquality()
                .equals(other._pricePoints, _pricePoints));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      productId,
      productName,
      sku,
      dateFrom,
      dateTo,
      currentQuotedPrice,
      averageUnitCost,
      minUnitCost,
      maxUnitCost,
      const DeepCollectionEquality().hash(_pricePoints));

  /// Create a copy of SupplierPriceHistory
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierPriceHistoryImplCopyWith<_$SupplierPriceHistoryImpl>
      get copyWith =>
          __$$SupplierPriceHistoryImplCopyWithImpl<_$SupplierPriceHistoryImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierPriceHistoryImplToJson(
      this,
    );
  }
}

abstract class _SupplierPriceHistory implements SupplierPriceHistory {
  const factory _SupplierPriceHistory(
      {required final String productId,
      required final String productName,
      final String? sku,
      required final String dateFrom,
      required final String dateTo,
      final String? currentQuotedPrice,
      required final String averageUnitCost,
      required final String minUnitCost,
      required final String maxUnitCost,
      final List<PricePoint> pricePoints}) = _$SupplierPriceHistoryImpl;

  factory _SupplierPriceHistory.fromJson(Map<String, dynamic> json) =
      _$SupplierPriceHistoryImpl.fromJson;

  @override
  String get productId;
  @override
  String get productName;
  @override
  String? get sku;
  @override
  String get dateFrom;
  @override
  String get dateTo;
  @override
  String? get currentQuotedPrice;
  @override
  String get averageUnitCost;
  @override
  String get minUnitCost;
  @override
  String get maxUnitCost;
  @override
  List<PricePoint> get pricePoints;

  /// Create a copy of SupplierPriceHistory
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierPriceHistoryImplCopyWith<_$SupplierPriceHistoryImpl>
      get copyWith => throw _privateConstructorUsedError;
}

OverdueSupplierInvoice _$OverdueSupplierInvoiceFromJson(
    Map<String, dynamic> json) {
  return _OverdueSupplierInvoice.fromJson(json);
}

/// @nodoc
mixin _$OverdueSupplierInvoice {
  String get invoiceId => throw _privateConstructorUsedError;
  String get invoiceNumber => throw _privateConstructorUsedError;
  String get invoiceDate => throw _privateConstructorUsedError;
  String? get dueDate => throw _privateConstructorUsedError;
  String get grandTotal => throw _privateConstructorUsedError;
  String get paidAmount => throw _privateConstructorUsedError;
  String get outstanding => throw _privateConstructorUsedError;
  int get daysOverdue => throw _privateConstructorUsedError;

  /// Serializes this OverdueSupplierInvoice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of OverdueSupplierInvoice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $OverdueSupplierInvoiceCopyWith<OverdueSupplierInvoice> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $OverdueSupplierInvoiceCopyWith<$Res> {
  factory $OverdueSupplierInvoiceCopyWith(OverdueSupplierInvoice value,
          $Res Function(OverdueSupplierInvoice) then) =
      _$OverdueSupplierInvoiceCopyWithImpl<$Res, OverdueSupplierInvoice>;
  @useResult
  $Res call(
      {String invoiceId,
      String invoiceNumber,
      String invoiceDate,
      String? dueDate,
      String grandTotal,
      String paidAmount,
      String outstanding,
      int daysOverdue});
}

/// @nodoc
class _$OverdueSupplierInvoiceCopyWithImpl<$Res,
        $Val extends OverdueSupplierInvoice>
    implements $OverdueSupplierInvoiceCopyWith<$Res> {
  _$OverdueSupplierInvoiceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of OverdueSupplierInvoice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? invoiceId = null,
    Object? invoiceNumber = null,
    Object? invoiceDate = null,
    Object? dueDate = freezed,
    Object? grandTotal = null,
    Object? paidAmount = null,
    Object? outstanding = null,
    Object? daysOverdue = null,
  }) {
    return _then(_value.copyWith(
      invoiceId: null == invoiceId
          ? _value.invoiceId
          : invoiceId // ignore: cast_nullable_to_non_nullable
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
      grandTotal: null == grandTotal
          ? _value.grandTotal
          : grandTotal // ignore: cast_nullable_to_non_nullable
              as String,
      paidAmount: null == paidAmount
          ? _value.paidAmount
          : paidAmount // ignore: cast_nullable_to_non_nullable
              as String,
      outstanding: null == outstanding
          ? _value.outstanding
          : outstanding // ignore: cast_nullable_to_non_nullable
              as String,
      daysOverdue: null == daysOverdue
          ? _value.daysOverdue
          : daysOverdue // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$OverdueSupplierInvoiceImplCopyWith<$Res>
    implements $OverdueSupplierInvoiceCopyWith<$Res> {
  factory _$$OverdueSupplierInvoiceImplCopyWith(
          _$OverdueSupplierInvoiceImpl value,
          $Res Function(_$OverdueSupplierInvoiceImpl) then) =
      __$$OverdueSupplierInvoiceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String invoiceId,
      String invoiceNumber,
      String invoiceDate,
      String? dueDate,
      String grandTotal,
      String paidAmount,
      String outstanding,
      int daysOverdue});
}

/// @nodoc
class __$$OverdueSupplierInvoiceImplCopyWithImpl<$Res>
    extends _$OverdueSupplierInvoiceCopyWithImpl<$Res,
        _$OverdueSupplierInvoiceImpl>
    implements _$$OverdueSupplierInvoiceImplCopyWith<$Res> {
  __$$OverdueSupplierInvoiceImplCopyWithImpl(
      _$OverdueSupplierInvoiceImpl _value,
      $Res Function(_$OverdueSupplierInvoiceImpl) _then)
      : super(_value, _then);

  /// Create a copy of OverdueSupplierInvoice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? invoiceId = null,
    Object? invoiceNumber = null,
    Object? invoiceDate = null,
    Object? dueDate = freezed,
    Object? grandTotal = null,
    Object? paidAmount = null,
    Object? outstanding = null,
    Object? daysOverdue = null,
  }) {
    return _then(_$OverdueSupplierInvoiceImpl(
      invoiceId: null == invoiceId
          ? _value.invoiceId
          : invoiceId // ignore: cast_nullable_to_non_nullable
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
      grandTotal: null == grandTotal
          ? _value.grandTotal
          : grandTotal // ignore: cast_nullable_to_non_nullable
              as String,
      paidAmount: null == paidAmount
          ? _value.paidAmount
          : paidAmount // ignore: cast_nullable_to_non_nullable
              as String,
      outstanding: null == outstanding
          ? _value.outstanding
          : outstanding // ignore: cast_nullable_to_non_nullable
              as String,
      daysOverdue: null == daysOverdue
          ? _value.daysOverdue
          : daysOverdue // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$OverdueSupplierInvoiceImpl implements _OverdueSupplierInvoice {
  const _$OverdueSupplierInvoiceImpl(
      {required this.invoiceId,
      required this.invoiceNumber,
      required this.invoiceDate,
      this.dueDate,
      required this.grandTotal,
      required this.paidAmount,
      required this.outstanding,
      required this.daysOverdue});

  factory _$OverdueSupplierInvoiceImpl.fromJson(Map<String, dynamic> json) =>
      _$$OverdueSupplierInvoiceImplFromJson(json);

  @override
  final String invoiceId;
  @override
  final String invoiceNumber;
  @override
  final String invoiceDate;
  @override
  final String? dueDate;
  @override
  final String grandTotal;
  @override
  final String paidAmount;
  @override
  final String outstanding;
  @override
  final int daysOverdue;

  @override
  String toString() {
    return 'OverdueSupplierInvoice(invoiceId: $invoiceId, invoiceNumber: $invoiceNumber, invoiceDate: $invoiceDate, dueDate: $dueDate, grandTotal: $grandTotal, paidAmount: $paidAmount, outstanding: $outstanding, daysOverdue: $daysOverdue)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$OverdueSupplierInvoiceImpl &&
            (identical(other.invoiceId, invoiceId) ||
                other.invoiceId == invoiceId) &&
            (identical(other.invoiceNumber, invoiceNumber) ||
                other.invoiceNumber == invoiceNumber) &&
            (identical(other.invoiceDate, invoiceDate) ||
                other.invoiceDate == invoiceDate) &&
            (identical(other.dueDate, dueDate) || other.dueDate == dueDate) &&
            (identical(other.grandTotal, grandTotal) ||
                other.grandTotal == grandTotal) &&
            (identical(other.paidAmount, paidAmount) ||
                other.paidAmount == paidAmount) &&
            (identical(other.outstanding, outstanding) ||
                other.outstanding == outstanding) &&
            (identical(other.daysOverdue, daysOverdue) ||
                other.daysOverdue == daysOverdue));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, invoiceId, invoiceNumber,
      invoiceDate, dueDate, grandTotal, paidAmount, outstanding, daysOverdue);

  /// Create a copy of OverdueSupplierInvoice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$OverdueSupplierInvoiceImplCopyWith<_$OverdueSupplierInvoiceImpl>
      get copyWith => __$$OverdueSupplierInvoiceImplCopyWithImpl<
          _$OverdueSupplierInvoiceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$OverdueSupplierInvoiceImplToJson(
      this,
    );
  }
}

abstract class _OverdueSupplierInvoice implements OverdueSupplierInvoice {
  const factory _OverdueSupplierInvoice(
      {required final String invoiceId,
      required final String invoiceNumber,
      required final String invoiceDate,
      final String? dueDate,
      required final String grandTotal,
      required final String paidAmount,
      required final String outstanding,
      required final int daysOverdue}) = _$OverdueSupplierInvoiceImpl;

  factory _OverdueSupplierInvoice.fromJson(Map<String, dynamic> json) =
      _$OverdueSupplierInvoiceImpl.fromJson;

  @override
  String get invoiceId;
  @override
  String get invoiceNumber;
  @override
  String get invoiceDate;
  @override
  String? get dueDate;
  @override
  String get grandTotal;
  @override
  String get paidAmount;
  @override
  String get outstanding;
  @override
  int get daysOverdue;

  /// Create a copy of OverdueSupplierInvoice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$OverdueSupplierInvoiceImplCopyWith<_$OverdueSupplierInvoiceImpl>
      get copyWith => throw _privateConstructorUsedError;
}

PaymentAgingBuckets _$PaymentAgingBucketsFromJson(Map<String, dynamic> json) {
  return _PaymentAgingBuckets.fromJson(json);
}

/// @nodoc
mixin _$PaymentAgingBuckets {
  String get current => throw _privateConstructorUsedError;
  String get days1To30 => throw _privateConstructorUsedError;
  String get days31To60 => throw _privateConstructorUsedError;
  String get days61To90 => throw _privateConstructorUsedError;
  String get overdue90Plus => throw _privateConstructorUsedError;

  /// Serializes this PaymentAgingBuckets to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PaymentAgingBuckets
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PaymentAgingBucketsCopyWith<PaymentAgingBuckets> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PaymentAgingBucketsCopyWith<$Res> {
  factory $PaymentAgingBucketsCopyWith(
          PaymentAgingBuckets value, $Res Function(PaymentAgingBuckets) then) =
      _$PaymentAgingBucketsCopyWithImpl<$Res, PaymentAgingBuckets>;
  @useResult
  $Res call(
      {String current,
      String days1To30,
      String days31To60,
      String days61To90,
      String overdue90Plus});
}

/// @nodoc
class _$PaymentAgingBucketsCopyWithImpl<$Res, $Val extends PaymentAgingBuckets>
    implements $PaymentAgingBucketsCopyWith<$Res> {
  _$PaymentAgingBucketsCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PaymentAgingBuckets
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? current = null,
    Object? days1To30 = null,
    Object? days31To60 = null,
    Object? days61To90 = null,
    Object? overdue90Plus = null,
  }) {
    return _then(_value.copyWith(
      current: null == current
          ? _value.current
          : current // ignore: cast_nullable_to_non_nullable
              as String,
      days1To30: null == days1To30
          ? _value.days1To30
          : days1To30 // ignore: cast_nullable_to_non_nullable
              as String,
      days31To60: null == days31To60
          ? _value.days31To60
          : days31To60 // ignore: cast_nullable_to_non_nullable
              as String,
      days61To90: null == days61To90
          ? _value.days61To90
          : days61To90 // ignore: cast_nullable_to_non_nullable
              as String,
      overdue90Plus: null == overdue90Plus
          ? _value.overdue90Plus
          : overdue90Plus // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PaymentAgingBucketsImplCopyWith<$Res>
    implements $PaymentAgingBucketsCopyWith<$Res> {
  factory _$$PaymentAgingBucketsImplCopyWith(_$PaymentAgingBucketsImpl value,
          $Res Function(_$PaymentAgingBucketsImpl) then) =
      __$$PaymentAgingBucketsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String current,
      String days1To30,
      String days31To60,
      String days61To90,
      String overdue90Plus});
}

/// @nodoc
class __$$PaymentAgingBucketsImplCopyWithImpl<$Res>
    extends _$PaymentAgingBucketsCopyWithImpl<$Res, _$PaymentAgingBucketsImpl>
    implements _$$PaymentAgingBucketsImplCopyWith<$Res> {
  __$$PaymentAgingBucketsImplCopyWithImpl(_$PaymentAgingBucketsImpl _value,
      $Res Function(_$PaymentAgingBucketsImpl) _then)
      : super(_value, _then);

  /// Create a copy of PaymentAgingBuckets
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? current = null,
    Object? days1To30 = null,
    Object? days31To60 = null,
    Object? days61To90 = null,
    Object? overdue90Plus = null,
  }) {
    return _then(_$PaymentAgingBucketsImpl(
      current: null == current
          ? _value.current
          : current // ignore: cast_nullable_to_non_nullable
              as String,
      days1To30: null == days1To30
          ? _value.days1To30
          : days1To30 // ignore: cast_nullable_to_non_nullable
              as String,
      days31To60: null == days31To60
          ? _value.days31To60
          : days31To60 // ignore: cast_nullable_to_non_nullable
              as String,
      days61To90: null == days61To90
          ? _value.days61To90
          : days61To90 // ignore: cast_nullable_to_non_nullable
              as String,
      overdue90Plus: null == overdue90Plus
          ? _value.overdue90Plus
          : overdue90Plus // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PaymentAgingBucketsImpl implements _PaymentAgingBuckets {
  const _$PaymentAgingBucketsImpl(
      {required this.current,
      required this.days1To30,
      required this.days31To60,
      required this.days61To90,
      required this.overdue90Plus});

  factory _$PaymentAgingBucketsImpl.fromJson(Map<String, dynamic> json) =>
      _$$PaymentAgingBucketsImplFromJson(json);

  @override
  final String current;
  @override
  final String days1To30;
  @override
  final String days31To60;
  @override
  final String days61To90;
  @override
  final String overdue90Plus;

  @override
  String toString() {
    return 'PaymentAgingBuckets(current: $current, days1To30: $days1To30, days31To60: $days31To60, days61To90: $days61To90, overdue90Plus: $overdue90Plus)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PaymentAgingBucketsImpl &&
            (identical(other.current, current) || other.current == current) &&
            (identical(other.days1To30, days1To30) ||
                other.days1To30 == days1To30) &&
            (identical(other.days31To60, days31To60) ||
                other.days31To60 == days31To60) &&
            (identical(other.days61To90, days61To90) ||
                other.days61To90 == days61To90) &&
            (identical(other.overdue90Plus, overdue90Plus) ||
                other.overdue90Plus == overdue90Plus));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, current, days1To30, days31To60, days61To90, overdue90Plus);

  /// Create a copy of PaymentAgingBuckets
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PaymentAgingBucketsImplCopyWith<_$PaymentAgingBucketsImpl> get copyWith =>
      __$$PaymentAgingBucketsImplCopyWithImpl<_$PaymentAgingBucketsImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PaymentAgingBucketsImplToJson(
      this,
    );
  }
}

abstract class _PaymentAgingBuckets implements PaymentAgingBuckets {
  const factory _PaymentAgingBuckets(
      {required final String current,
      required final String days1To30,
      required final String days31To60,
      required final String days61To90,
      required final String overdue90Plus}) = _$PaymentAgingBucketsImpl;

  factory _PaymentAgingBuckets.fromJson(Map<String, dynamic> json) =
      _$PaymentAgingBucketsImpl.fromJson;

  @override
  String get current;
  @override
  String get days1To30;
  @override
  String get days31To60;
  @override
  String get days61To90;
  @override
  String get overdue90Plus;

  /// Create a copy of PaymentAgingBuckets
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PaymentAgingBucketsImplCopyWith<_$PaymentAgingBucketsImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SupplierPaymentAging _$SupplierPaymentAgingFromJson(Map<String, dynamic> json) {
  return _SupplierPaymentAging.fromJson(json);
}

/// @nodoc
mixin _$SupplierPaymentAging {
  String get totalOutstanding => throw _privateConstructorUsedError;
  PaymentAgingBuckets get aging => throw _privateConstructorUsedError;
  List<OverdueSupplierInvoice> get overdueInvoices =>
      throw _privateConstructorUsedError;
  int get invoiceCount => throw _privateConstructorUsedError;
  int get overdueCount => throw _privateConstructorUsedError;

  /// Serializes this SupplierPaymentAging to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierPaymentAging
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierPaymentAgingCopyWith<SupplierPaymentAging> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierPaymentAgingCopyWith<$Res> {
  factory $SupplierPaymentAgingCopyWith(SupplierPaymentAging value,
          $Res Function(SupplierPaymentAging) then) =
      _$SupplierPaymentAgingCopyWithImpl<$Res, SupplierPaymentAging>;
  @useResult
  $Res call(
      {String totalOutstanding,
      PaymentAgingBuckets aging,
      List<OverdueSupplierInvoice> overdueInvoices,
      int invoiceCount,
      int overdueCount});

  $PaymentAgingBucketsCopyWith<$Res> get aging;
}

/// @nodoc
class _$SupplierPaymentAgingCopyWithImpl<$Res,
        $Val extends SupplierPaymentAging>
    implements $SupplierPaymentAgingCopyWith<$Res> {
  _$SupplierPaymentAgingCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierPaymentAging
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? totalOutstanding = null,
    Object? aging = null,
    Object? overdueInvoices = null,
    Object? invoiceCount = null,
    Object? overdueCount = null,
  }) {
    return _then(_value.copyWith(
      totalOutstanding: null == totalOutstanding
          ? _value.totalOutstanding
          : totalOutstanding // ignore: cast_nullable_to_non_nullable
              as String,
      aging: null == aging
          ? _value.aging
          : aging // ignore: cast_nullable_to_non_nullable
              as PaymentAgingBuckets,
      overdueInvoices: null == overdueInvoices
          ? _value.overdueInvoices
          : overdueInvoices // ignore: cast_nullable_to_non_nullable
              as List<OverdueSupplierInvoice>,
      invoiceCount: null == invoiceCount
          ? _value.invoiceCount
          : invoiceCount // ignore: cast_nullable_to_non_nullable
              as int,
      overdueCount: null == overdueCount
          ? _value.overdueCount
          : overdueCount // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }

  /// Create a copy of SupplierPaymentAging
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $PaymentAgingBucketsCopyWith<$Res> get aging {
    return $PaymentAgingBucketsCopyWith<$Res>(_value.aging, (value) {
      return _then(_value.copyWith(aging: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$SupplierPaymentAgingImplCopyWith<$Res>
    implements $SupplierPaymentAgingCopyWith<$Res> {
  factory _$$SupplierPaymentAgingImplCopyWith(_$SupplierPaymentAgingImpl value,
          $Res Function(_$SupplierPaymentAgingImpl) then) =
      __$$SupplierPaymentAgingImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String totalOutstanding,
      PaymentAgingBuckets aging,
      List<OverdueSupplierInvoice> overdueInvoices,
      int invoiceCount,
      int overdueCount});

  @override
  $PaymentAgingBucketsCopyWith<$Res> get aging;
}

/// @nodoc
class __$$SupplierPaymentAgingImplCopyWithImpl<$Res>
    extends _$SupplierPaymentAgingCopyWithImpl<$Res, _$SupplierPaymentAgingImpl>
    implements _$$SupplierPaymentAgingImplCopyWith<$Res> {
  __$$SupplierPaymentAgingImplCopyWithImpl(_$SupplierPaymentAgingImpl _value,
      $Res Function(_$SupplierPaymentAgingImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierPaymentAging
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? totalOutstanding = null,
    Object? aging = null,
    Object? overdueInvoices = null,
    Object? invoiceCount = null,
    Object? overdueCount = null,
  }) {
    return _then(_$SupplierPaymentAgingImpl(
      totalOutstanding: null == totalOutstanding
          ? _value.totalOutstanding
          : totalOutstanding // ignore: cast_nullable_to_non_nullable
              as String,
      aging: null == aging
          ? _value.aging
          : aging // ignore: cast_nullable_to_non_nullable
              as PaymentAgingBuckets,
      overdueInvoices: null == overdueInvoices
          ? _value._overdueInvoices
          : overdueInvoices // ignore: cast_nullable_to_non_nullable
              as List<OverdueSupplierInvoice>,
      invoiceCount: null == invoiceCount
          ? _value.invoiceCount
          : invoiceCount // ignore: cast_nullable_to_non_nullable
              as int,
      overdueCount: null == overdueCount
          ? _value.overdueCount
          : overdueCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SupplierPaymentAgingImpl implements _SupplierPaymentAging {
  const _$SupplierPaymentAgingImpl(
      {required this.totalOutstanding,
      required this.aging,
      final List<OverdueSupplierInvoice> overdueInvoices = const [],
      required this.invoiceCount,
      required this.overdueCount})
      : _overdueInvoices = overdueInvoices;

  factory _$SupplierPaymentAgingImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierPaymentAgingImplFromJson(json);

  @override
  final String totalOutstanding;
  @override
  final PaymentAgingBuckets aging;
  final List<OverdueSupplierInvoice> _overdueInvoices;
  @override
  @JsonKey()
  List<OverdueSupplierInvoice> get overdueInvoices {
    if (_overdueInvoices is EqualUnmodifiableListView) return _overdueInvoices;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_overdueInvoices);
  }

  @override
  final int invoiceCount;
  @override
  final int overdueCount;

  @override
  String toString() {
    return 'SupplierPaymentAging(totalOutstanding: $totalOutstanding, aging: $aging, overdueInvoices: $overdueInvoices, invoiceCount: $invoiceCount, overdueCount: $overdueCount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierPaymentAgingImpl &&
            (identical(other.totalOutstanding, totalOutstanding) ||
                other.totalOutstanding == totalOutstanding) &&
            (identical(other.aging, aging) || other.aging == aging) &&
            const DeepCollectionEquality()
                .equals(other._overdueInvoices, _overdueInvoices) &&
            (identical(other.invoiceCount, invoiceCount) ||
                other.invoiceCount == invoiceCount) &&
            (identical(other.overdueCount, overdueCount) ||
                other.overdueCount == overdueCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      totalOutstanding,
      aging,
      const DeepCollectionEquality().hash(_overdueInvoices),
      invoiceCount,
      overdueCount);

  /// Create a copy of SupplierPaymentAging
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierPaymentAgingImplCopyWith<_$SupplierPaymentAgingImpl>
      get copyWith =>
          __$$SupplierPaymentAgingImplCopyWithImpl<_$SupplierPaymentAgingImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierPaymentAgingImplToJson(
      this,
    );
  }
}

abstract class _SupplierPaymentAging implements SupplierPaymentAging {
  const factory _SupplierPaymentAging(
      {required final String totalOutstanding,
      required final PaymentAgingBuckets aging,
      final List<OverdueSupplierInvoice> overdueInvoices,
      required final int invoiceCount,
      required final int overdueCount}) = _$SupplierPaymentAgingImpl;

  factory _SupplierPaymentAging.fromJson(Map<String, dynamic> json) =
      _$SupplierPaymentAgingImpl.fromJson;

  @override
  String get totalOutstanding;
  @override
  PaymentAgingBuckets get aging;
  @override
  List<OverdueSupplierInvoice> get overdueInvoices;
  @override
  int get invoiceCount;
  @override
  int get overdueCount;

  /// Create a copy of SupplierPaymentAging
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierPaymentAgingImplCopyWith<_$SupplierPaymentAgingImpl>
      get copyWith => throw _privateConstructorUsedError;
}

TopReturnedProduct _$TopReturnedProductFromJson(Map<String, dynamic> json) {
  return _TopReturnedProduct.fromJson(json);
}

/// @nodoc
mixin _$TopReturnedProduct {
  String get productId => throw _privateConstructorUsedError;
  String get productName => throw _privateConstructorUsedError;
  String? get sku => throw _privateConstructorUsedError;
  int get returnedQuantity => throw _privateConstructorUsedError;
  String get returnedAmount => throw _privateConstructorUsedError;
  int get returnCount => throw _privateConstructorUsedError;

  /// Serializes this TopReturnedProduct to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of TopReturnedProduct
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $TopReturnedProductCopyWith<TopReturnedProduct> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $TopReturnedProductCopyWith<$Res> {
  factory $TopReturnedProductCopyWith(
          TopReturnedProduct value, $Res Function(TopReturnedProduct) then) =
      _$TopReturnedProductCopyWithImpl<$Res, TopReturnedProduct>;
  @useResult
  $Res call(
      {String productId,
      String productName,
      String? sku,
      int returnedQuantity,
      String returnedAmount,
      int returnCount});
}

/// @nodoc
class _$TopReturnedProductCopyWithImpl<$Res, $Val extends TopReturnedProduct>
    implements $TopReturnedProductCopyWith<$Res> {
  _$TopReturnedProductCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of TopReturnedProduct
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? productName = null,
    Object? sku = freezed,
    Object? returnedQuantity = null,
    Object? returnedAmount = null,
    Object? returnCount = null,
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
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
      returnedQuantity: null == returnedQuantity
          ? _value.returnedQuantity
          : returnedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      returnedAmount: null == returnedAmount
          ? _value.returnedAmount
          : returnedAmount // ignore: cast_nullable_to_non_nullable
              as String,
      returnCount: null == returnCount
          ? _value.returnCount
          : returnCount // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$TopReturnedProductImplCopyWith<$Res>
    implements $TopReturnedProductCopyWith<$Res> {
  factory _$$TopReturnedProductImplCopyWith(_$TopReturnedProductImpl value,
          $Res Function(_$TopReturnedProductImpl) then) =
      __$$TopReturnedProductImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String productId,
      String productName,
      String? sku,
      int returnedQuantity,
      String returnedAmount,
      int returnCount});
}

/// @nodoc
class __$$TopReturnedProductImplCopyWithImpl<$Res>
    extends _$TopReturnedProductCopyWithImpl<$Res, _$TopReturnedProductImpl>
    implements _$$TopReturnedProductImplCopyWith<$Res> {
  __$$TopReturnedProductImplCopyWithImpl(_$TopReturnedProductImpl _value,
      $Res Function(_$TopReturnedProductImpl) _then)
      : super(_value, _then);

  /// Create a copy of TopReturnedProduct
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? productId = null,
    Object? productName = null,
    Object? sku = freezed,
    Object? returnedQuantity = null,
    Object? returnedAmount = null,
    Object? returnCount = null,
  }) {
    return _then(_$TopReturnedProductImpl(
      productId: null == productId
          ? _value.productId
          : productId // ignore: cast_nullable_to_non_nullable
              as String,
      productName: null == productName
          ? _value.productName
          : productName // ignore: cast_nullable_to_non_nullable
              as String,
      sku: freezed == sku
          ? _value.sku
          : sku // ignore: cast_nullable_to_non_nullable
              as String?,
      returnedQuantity: null == returnedQuantity
          ? _value.returnedQuantity
          : returnedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      returnedAmount: null == returnedAmount
          ? _value.returnedAmount
          : returnedAmount // ignore: cast_nullable_to_non_nullable
              as String,
      returnCount: null == returnCount
          ? _value.returnCount
          : returnCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$TopReturnedProductImpl implements _TopReturnedProduct {
  const _$TopReturnedProductImpl(
      {required this.productId,
      required this.productName,
      this.sku,
      required this.returnedQuantity,
      required this.returnedAmount,
      required this.returnCount});

  factory _$TopReturnedProductImpl.fromJson(Map<String, dynamic> json) =>
      _$$TopReturnedProductImplFromJson(json);

  @override
  final String productId;
  @override
  final String productName;
  @override
  final String? sku;
  @override
  final int returnedQuantity;
  @override
  final String returnedAmount;
  @override
  final int returnCount;

  @override
  String toString() {
    return 'TopReturnedProduct(productId: $productId, productName: $productName, sku: $sku, returnedQuantity: $returnedQuantity, returnedAmount: $returnedAmount, returnCount: $returnCount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$TopReturnedProductImpl &&
            (identical(other.productId, productId) ||
                other.productId == productId) &&
            (identical(other.productName, productName) ||
                other.productName == productName) &&
            (identical(other.sku, sku) || other.sku == sku) &&
            (identical(other.returnedQuantity, returnedQuantity) ||
                other.returnedQuantity == returnedQuantity) &&
            (identical(other.returnedAmount, returnedAmount) ||
                other.returnedAmount == returnedAmount) &&
            (identical(other.returnCount, returnCount) ||
                other.returnCount == returnCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, productId, productName, sku,
      returnedQuantity, returnedAmount, returnCount);

  /// Create a copy of TopReturnedProduct
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$TopReturnedProductImplCopyWith<_$TopReturnedProductImpl> get copyWith =>
      __$$TopReturnedProductImplCopyWithImpl<_$TopReturnedProductImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$TopReturnedProductImplToJson(
      this,
    );
  }
}

abstract class _TopReturnedProduct implements TopReturnedProduct {
  const factory _TopReturnedProduct(
      {required final String productId,
      required final String productName,
      final String? sku,
      required final int returnedQuantity,
      required final String returnedAmount,
      required final int returnCount}) = _$TopReturnedProductImpl;

  factory _TopReturnedProduct.fromJson(Map<String, dynamic> json) =
      _$TopReturnedProductImpl.fromJson;

  @override
  String get productId;
  @override
  String get productName;
  @override
  String? get sku;
  @override
  int get returnedQuantity;
  @override
  String get returnedAmount;
  @override
  int get returnCount;

  /// Create a copy of TopReturnedProduct
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$TopReturnedProductImplCopyWith<_$TopReturnedProductImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SupplierReturnSummary _$SupplierReturnSummaryFromJson(
    Map<String, dynamic> json) {
  return _SupplierReturnSummary.fromJson(json);
}

/// @nodoc
mixin _$SupplierReturnSummary {
  String get dateFrom => throw _privateConstructorUsedError;
  String get dateTo => throw _privateConstructorUsedError;
  String get totalReturnedAmount => throw _privateConstructorUsedError;
  int get totalReturnedQuantity => throw _privateConstructorUsedError;
  int get returnCount => throw _privateConstructorUsedError;
  String get totalPurchaseSpend => throw _privateConstructorUsedError;
  int get totalPurchasedQuantity => throw _privateConstructorUsedError;
  double get amountReturnRate => throw _privateConstructorUsedError;
  double get quantityReturnRate => throw _privateConstructorUsedError;
  List<TopReturnedProduct> get topReturnedProducts =>
      throw _privateConstructorUsedError;

  /// Serializes this SupplierReturnSummary to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierReturnSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierReturnSummaryCopyWith<SupplierReturnSummary> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierReturnSummaryCopyWith<$Res> {
  factory $SupplierReturnSummaryCopyWith(SupplierReturnSummary value,
          $Res Function(SupplierReturnSummary) then) =
      _$SupplierReturnSummaryCopyWithImpl<$Res, SupplierReturnSummary>;
  @useResult
  $Res call(
      {String dateFrom,
      String dateTo,
      String totalReturnedAmount,
      int totalReturnedQuantity,
      int returnCount,
      String totalPurchaseSpend,
      int totalPurchasedQuantity,
      double amountReturnRate,
      double quantityReturnRate,
      List<TopReturnedProduct> topReturnedProducts});
}

/// @nodoc
class _$SupplierReturnSummaryCopyWithImpl<$Res,
        $Val extends SupplierReturnSummary>
    implements $SupplierReturnSummaryCopyWith<$Res> {
  _$SupplierReturnSummaryCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierReturnSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dateFrom = null,
    Object? dateTo = null,
    Object? totalReturnedAmount = null,
    Object? totalReturnedQuantity = null,
    Object? returnCount = null,
    Object? totalPurchaseSpend = null,
    Object? totalPurchasedQuantity = null,
    Object? amountReturnRate = null,
    Object? quantityReturnRate = null,
    Object? topReturnedProducts = null,
  }) {
    return _then(_value.copyWith(
      dateFrom: null == dateFrom
          ? _value.dateFrom
          : dateFrom // ignore: cast_nullable_to_non_nullable
              as String,
      dateTo: null == dateTo
          ? _value.dateTo
          : dateTo // ignore: cast_nullable_to_non_nullable
              as String,
      totalReturnedAmount: null == totalReturnedAmount
          ? _value.totalReturnedAmount
          : totalReturnedAmount // ignore: cast_nullable_to_non_nullable
              as String,
      totalReturnedQuantity: null == totalReturnedQuantity
          ? _value.totalReturnedQuantity
          : totalReturnedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      returnCount: null == returnCount
          ? _value.returnCount
          : returnCount // ignore: cast_nullable_to_non_nullable
              as int,
      totalPurchaseSpend: null == totalPurchaseSpend
          ? _value.totalPurchaseSpend
          : totalPurchaseSpend // ignore: cast_nullable_to_non_nullable
              as String,
      totalPurchasedQuantity: null == totalPurchasedQuantity
          ? _value.totalPurchasedQuantity
          : totalPurchasedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      amountReturnRate: null == amountReturnRate
          ? _value.amountReturnRate
          : amountReturnRate // ignore: cast_nullable_to_non_nullable
              as double,
      quantityReturnRate: null == quantityReturnRate
          ? _value.quantityReturnRate
          : quantityReturnRate // ignore: cast_nullable_to_non_nullable
              as double,
      topReturnedProducts: null == topReturnedProducts
          ? _value.topReturnedProducts
          : topReturnedProducts // ignore: cast_nullable_to_non_nullable
              as List<TopReturnedProduct>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$SupplierReturnSummaryImplCopyWith<$Res>
    implements $SupplierReturnSummaryCopyWith<$Res> {
  factory _$$SupplierReturnSummaryImplCopyWith(
          _$SupplierReturnSummaryImpl value,
          $Res Function(_$SupplierReturnSummaryImpl) then) =
      __$$SupplierReturnSummaryImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String dateFrom,
      String dateTo,
      String totalReturnedAmount,
      int totalReturnedQuantity,
      int returnCount,
      String totalPurchaseSpend,
      int totalPurchasedQuantity,
      double amountReturnRate,
      double quantityReturnRate,
      List<TopReturnedProduct> topReturnedProducts});
}

/// @nodoc
class __$$SupplierReturnSummaryImplCopyWithImpl<$Res>
    extends _$SupplierReturnSummaryCopyWithImpl<$Res,
        _$SupplierReturnSummaryImpl>
    implements _$$SupplierReturnSummaryImplCopyWith<$Res> {
  __$$SupplierReturnSummaryImplCopyWithImpl(_$SupplierReturnSummaryImpl _value,
      $Res Function(_$SupplierReturnSummaryImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierReturnSummary
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dateFrom = null,
    Object? dateTo = null,
    Object? totalReturnedAmount = null,
    Object? totalReturnedQuantity = null,
    Object? returnCount = null,
    Object? totalPurchaseSpend = null,
    Object? totalPurchasedQuantity = null,
    Object? amountReturnRate = null,
    Object? quantityReturnRate = null,
    Object? topReturnedProducts = null,
  }) {
    return _then(_$SupplierReturnSummaryImpl(
      dateFrom: null == dateFrom
          ? _value.dateFrom
          : dateFrom // ignore: cast_nullable_to_non_nullable
              as String,
      dateTo: null == dateTo
          ? _value.dateTo
          : dateTo // ignore: cast_nullable_to_non_nullable
              as String,
      totalReturnedAmount: null == totalReturnedAmount
          ? _value.totalReturnedAmount
          : totalReturnedAmount // ignore: cast_nullable_to_non_nullable
              as String,
      totalReturnedQuantity: null == totalReturnedQuantity
          ? _value.totalReturnedQuantity
          : totalReturnedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      returnCount: null == returnCount
          ? _value.returnCount
          : returnCount // ignore: cast_nullable_to_non_nullable
              as int,
      totalPurchaseSpend: null == totalPurchaseSpend
          ? _value.totalPurchaseSpend
          : totalPurchaseSpend // ignore: cast_nullable_to_non_nullable
              as String,
      totalPurchasedQuantity: null == totalPurchasedQuantity
          ? _value.totalPurchasedQuantity
          : totalPurchasedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      amountReturnRate: null == amountReturnRate
          ? _value.amountReturnRate
          : amountReturnRate // ignore: cast_nullable_to_non_nullable
              as double,
      quantityReturnRate: null == quantityReturnRate
          ? _value.quantityReturnRate
          : quantityReturnRate // ignore: cast_nullable_to_non_nullable
              as double,
      topReturnedProducts: null == topReturnedProducts
          ? _value._topReturnedProducts
          : topReturnedProducts // ignore: cast_nullable_to_non_nullable
              as List<TopReturnedProduct>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SupplierReturnSummaryImpl implements _SupplierReturnSummary {
  const _$SupplierReturnSummaryImpl(
      {required this.dateFrom,
      required this.dateTo,
      required this.totalReturnedAmount,
      required this.totalReturnedQuantity,
      required this.returnCount,
      required this.totalPurchaseSpend,
      required this.totalPurchasedQuantity,
      required this.amountReturnRate,
      required this.quantityReturnRate,
      final List<TopReturnedProduct> topReturnedProducts = const []})
      : _topReturnedProducts = topReturnedProducts;

  factory _$SupplierReturnSummaryImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierReturnSummaryImplFromJson(json);

  @override
  final String dateFrom;
  @override
  final String dateTo;
  @override
  final String totalReturnedAmount;
  @override
  final int totalReturnedQuantity;
  @override
  final int returnCount;
  @override
  final String totalPurchaseSpend;
  @override
  final int totalPurchasedQuantity;
  @override
  final double amountReturnRate;
  @override
  final double quantityReturnRate;
  final List<TopReturnedProduct> _topReturnedProducts;
  @override
  @JsonKey()
  List<TopReturnedProduct> get topReturnedProducts {
    if (_topReturnedProducts is EqualUnmodifiableListView)
      return _topReturnedProducts;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_topReturnedProducts);
  }

  @override
  String toString() {
    return 'SupplierReturnSummary(dateFrom: $dateFrom, dateTo: $dateTo, totalReturnedAmount: $totalReturnedAmount, totalReturnedQuantity: $totalReturnedQuantity, returnCount: $returnCount, totalPurchaseSpend: $totalPurchaseSpend, totalPurchasedQuantity: $totalPurchasedQuantity, amountReturnRate: $amountReturnRate, quantityReturnRate: $quantityReturnRate, topReturnedProducts: $topReturnedProducts)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierReturnSummaryImpl &&
            (identical(other.dateFrom, dateFrom) ||
                other.dateFrom == dateFrom) &&
            (identical(other.dateTo, dateTo) || other.dateTo == dateTo) &&
            (identical(other.totalReturnedAmount, totalReturnedAmount) ||
                other.totalReturnedAmount == totalReturnedAmount) &&
            (identical(other.totalReturnedQuantity, totalReturnedQuantity) ||
                other.totalReturnedQuantity == totalReturnedQuantity) &&
            (identical(other.returnCount, returnCount) ||
                other.returnCount == returnCount) &&
            (identical(other.totalPurchaseSpend, totalPurchaseSpend) ||
                other.totalPurchaseSpend == totalPurchaseSpend) &&
            (identical(other.totalPurchasedQuantity, totalPurchasedQuantity) ||
                other.totalPurchasedQuantity == totalPurchasedQuantity) &&
            (identical(other.amountReturnRate, amountReturnRate) ||
                other.amountReturnRate == amountReturnRate) &&
            (identical(other.quantityReturnRate, quantityReturnRate) ||
                other.quantityReturnRate == quantityReturnRate) &&
            const DeepCollectionEquality()
                .equals(other._topReturnedProducts, _topReturnedProducts));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      dateFrom,
      dateTo,
      totalReturnedAmount,
      totalReturnedQuantity,
      returnCount,
      totalPurchaseSpend,
      totalPurchasedQuantity,
      amountReturnRate,
      quantityReturnRate,
      const DeepCollectionEquality().hash(_topReturnedProducts));

  /// Create a copy of SupplierReturnSummary
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierReturnSummaryImplCopyWith<_$SupplierReturnSummaryImpl>
      get copyWith => __$$SupplierReturnSummaryImplCopyWithImpl<
          _$SupplierReturnSummaryImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierReturnSummaryImplToJson(
      this,
    );
  }
}

abstract class _SupplierReturnSummary implements SupplierReturnSummary {
  const factory _SupplierReturnSummary(
          {required final String dateFrom,
          required final String dateTo,
          required final String totalReturnedAmount,
          required final int totalReturnedQuantity,
          required final int returnCount,
          required final String totalPurchaseSpend,
          required final int totalPurchasedQuantity,
          required final double amountReturnRate,
          required final double quantityReturnRate,
          final List<TopReturnedProduct> topReturnedProducts}) =
      _$SupplierReturnSummaryImpl;

  factory _SupplierReturnSummary.fromJson(Map<String, dynamic> json) =
      _$SupplierReturnSummaryImpl.fromJson;

  @override
  String get dateFrom;
  @override
  String get dateTo;
  @override
  String get totalReturnedAmount;
  @override
  int get totalReturnedQuantity;
  @override
  int get returnCount;
  @override
  String get totalPurchaseSpend;
  @override
  int get totalPurchasedQuantity;
  @override
  double get amountReturnRate;
  @override
  double get quantityReturnRate;
  @override
  List<TopReturnedProduct> get topReturnedProducts;

  /// Create a copy of SupplierReturnSummary
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierReturnSummaryImplCopyWith<_$SupplierReturnSummaryImpl>
      get copyWith => throw _privateConstructorUsedError;
}

PurchasePerformance _$PurchasePerformanceFromJson(Map<String, dynamic> json) {
  return _PurchasePerformance.fromJson(json);
}

/// @nodoc
mixin _$PurchasePerformance {
  String get netPurchaseSpend => throw _privateConstructorUsedError;
  int get totalPurchasedQuantity => throw _privateConstructorUsedError;
  int get invoiceCount => throw _privateConstructorUsedError;

  /// Serializes this PurchasePerformance to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of PurchasePerformance
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $PurchasePerformanceCopyWith<PurchasePerformance> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $PurchasePerformanceCopyWith<$Res> {
  factory $PurchasePerformanceCopyWith(
          PurchasePerformance value, $Res Function(PurchasePerformance) then) =
      _$PurchasePerformanceCopyWithImpl<$Res, PurchasePerformance>;
  @useResult
  $Res call(
      {String netPurchaseSpend, int totalPurchasedQuantity, int invoiceCount});
}

/// @nodoc
class _$PurchasePerformanceCopyWithImpl<$Res, $Val extends PurchasePerformance>
    implements $PurchasePerformanceCopyWith<$Res> {
  _$PurchasePerformanceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of PurchasePerformance
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? netPurchaseSpend = null,
    Object? totalPurchasedQuantity = null,
    Object? invoiceCount = null,
  }) {
    return _then(_value.copyWith(
      netPurchaseSpend: null == netPurchaseSpend
          ? _value.netPurchaseSpend
          : netPurchaseSpend // ignore: cast_nullable_to_non_nullable
              as String,
      totalPurchasedQuantity: null == totalPurchasedQuantity
          ? _value.totalPurchasedQuantity
          : totalPurchasedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      invoiceCount: null == invoiceCount
          ? _value.invoiceCount
          : invoiceCount // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$PurchasePerformanceImplCopyWith<$Res>
    implements $PurchasePerformanceCopyWith<$Res> {
  factory _$$PurchasePerformanceImplCopyWith(_$PurchasePerformanceImpl value,
          $Res Function(_$PurchasePerformanceImpl) then) =
      __$$PurchasePerformanceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String netPurchaseSpend, int totalPurchasedQuantity, int invoiceCount});
}

/// @nodoc
class __$$PurchasePerformanceImplCopyWithImpl<$Res>
    extends _$PurchasePerformanceCopyWithImpl<$Res, _$PurchasePerformanceImpl>
    implements _$$PurchasePerformanceImplCopyWith<$Res> {
  __$$PurchasePerformanceImplCopyWithImpl(_$PurchasePerformanceImpl _value,
      $Res Function(_$PurchasePerformanceImpl) _then)
      : super(_value, _then);

  /// Create a copy of PurchasePerformance
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? netPurchaseSpend = null,
    Object? totalPurchasedQuantity = null,
    Object? invoiceCount = null,
  }) {
    return _then(_$PurchasePerformanceImpl(
      netPurchaseSpend: null == netPurchaseSpend
          ? _value.netPurchaseSpend
          : netPurchaseSpend // ignore: cast_nullable_to_non_nullable
              as String,
      totalPurchasedQuantity: null == totalPurchasedQuantity
          ? _value.totalPurchasedQuantity
          : totalPurchasedQuantity // ignore: cast_nullable_to_non_nullable
              as int,
      invoiceCount: null == invoiceCount
          ? _value.invoiceCount
          : invoiceCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$PurchasePerformanceImpl implements _PurchasePerformance {
  const _$PurchasePerformanceImpl(
      {required this.netPurchaseSpend,
      required this.totalPurchasedQuantity,
      required this.invoiceCount});

  factory _$PurchasePerformanceImpl.fromJson(Map<String, dynamic> json) =>
      _$$PurchasePerformanceImplFromJson(json);

  @override
  final String netPurchaseSpend;
  @override
  final int totalPurchasedQuantity;
  @override
  final int invoiceCount;

  @override
  String toString() {
    return 'PurchasePerformance(netPurchaseSpend: $netPurchaseSpend, totalPurchasedQuantity: $totalPurchasedQuantity, invoiceCount: $invoiceCount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$PurchasePerformanceImpl &&
            (identical(other.netPurchaseSpend, netPurchaseSpend) ||
                other.netPurchaseSpend == netPurchaseSpend) &&
            (identical(other.totalPurchasedQuantity, totalPurchasedQuantity) ||
                other.totalPurchasedQuantity == totalPurchasedQuantity) &&
            (identical(other.invoiceCount, invoiceCount) ||
                other.invoiceCount == invoiceCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, netPurchaseSpend, totalPurchasedQuantity, invoiceCount);

  /// Create a copy of PurchasePerformance
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$PurchasePerformanceImplCopyWith<_$PurchasePerformanceImpl> get copyWith =>
      __$$PurchasePerformanceImplCopyWithImpl<_$PurchasePerformanceImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$PurchasePerformanceImplToJson(
      this,
    );
  }
}

abstract class _PurchasePerformance implements PurchasePerformance {
  const factory _PurchasePerformance(
      {required final String netPurchaseSpend,
      required final int totalPurchasedQuantity,
      required final int invoiceCount}) = _$PurchasePerformanceImpl;

  factory _PurchasePerformance.fromJson(Map<String, dynamic> json) =
      _$PurchasePerformanceImpl.fromJson;

  @override
  String get netPurchaseSpend;
  @override
  int get totalPurchasedQuantity;
  @override
  int get invoiceCount;

  /// Create a copy of PurchasePerformance
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$PurchasePerformanceImplCopyWith<_$PurchasePerformanceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

DeliveryPerformance _$DeliveryPerformanceFromJson(Map<String, dynamic> json) {
  return _DeliveryPerformance.fromJson(json);
}

/// @nodoc
mixin _$DeliveryPerformance {
  double get onTimeDeliveryRate => throw _privateConstructorUsedError;
  double get averageLeadTimeDays => throw _privateConstructorUsedError;
  double get cancellationRate => throw _privateConstructorUsedError;

  /// Serializes this DeliveryPerformance to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DeliveryPerformance
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DeliveryPerformanceCopyWith<DeliveryPerformance> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DeliveryPerformanceCopyWith<$Res> {
  factory $DeliveryPerformanceCopyWith(
          DeliveryPerformance value, $Res Function(DeliveryPerformance) then) =
      _$DeliveryPerformanceCopyWithImpl<$Res, DeliveryPerformance>;
  @useResult
  $Res call(
      {double onTimeDeliveryRate,
      double averageLeadTimeDays,
      double cancellationRate});
}

/// @nodoc
class _$DeliveryPerformanceCopyWithImpl<$Res, $Val extends DeliveryPerformance>
    implements $DeliveryPerformanceCopyWith<$Res> {
  _$DeliveryPerformanceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DeliveryPerformance
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? onTimeDeliveryRate = null,
    Object? averageLeadTimeDays = null,
    Object? cancellationRate = null,
  }) {
    return _then(_value.copyWith(
      onTimeDeliveryRate: null == onTimeDeliveryRate
          ? _value.onTimeDeliveryRate
          : onTimeDeliveryRate // ignore: cast_nullable_to_non_nullable
              as double,
      averageLeadTimeDays: null == averageLeadTimeDays
          ? _value.averageLeadTimeDays
          : averageLeadTimeDays // ignore: cast_nullable_to_non_nullable
              as double,
      cancellationRate: null == cancellationRate
          ? _value.cancellationRate
          : cancellationRate // ignore: cast_nullable_to_non_nullable
              as double,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DeliveryPerformanceImplCopyWith<$Res>
    implements $DeliveryPerformanceCopyWith<$Res> {
  factory _$$DeliveryPerformanceImplCopyWith(_$DeliveryPerformanceImpl value,
          $Res Function(_$DeliveryPerformanceImpl) then) =
      __$$DeliveryPerformanceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {double onTimeDeliveryRate,
      double averageLeadTimeDays,
      double cancellationRate});
}

/// @nodoc
class __$$DeliveryPerformanceImplCopyWithImpl<$Res>
    extends _$DeliveryPerformanceCopyWithImpl<$Res, _$DeliveryPerformanceImpl>
    implements _$$DeliveryPerformanceImplCopyWith<$Res> {
  __$$DeliveryPerformanceImplCopyWithImpl(_$DeliveryPerformanceImpl _value,
      $Res Function(_$DeliveryPerformanceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DeliveryPerformance
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? onTimeDeliveryRate = null,
    Object? averageLeadTimeDays = null,
    Object? cancellationRate = null,
  }) {
    return _then(_$DeliveryPerformanceImpl(
      onTimeDeliveryRate: null == onTimeDeliveryRate
          ? _value.onTimeDeliveryRate
          : onTimeDeliveryRate // ignore: cast_nullable_to_non_nullable
              as double,
      averageLeadTimeDays: null == averageLeadTimeDays
          ? _value.averageLeadTimeDays
          : averageLeadTimeDays // ignore: cast_nullable_to_non_nullable
              as double,
      cancellationRate: null == cancellationRate
          ? _value.cancellationRate
          : cancellationRate // ignore: cast_nullable_to_non_nullable
              as double,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DeliveryPerformanceImpl implements _DeliveryPerformance {
  const _$DeliveryPerformanceImpl(
      {required this.onTimeDeliveryRate,
      required this.averageLeadTimeDays,
      required this.cancellationRate});

  factory _$DeliveryPerformanceImpl.fromJson(Map<String, dynamic> json) =>
      _$$DeliveryPerformanceImplFromJson(json);

  @override
  final double onTimeDeliveryRate;
  @override
  final double averageLeadTimeDays;
  @override
  final double cancellationRate;

  @override
  String toString() {
    return 'DeliveryPerformance(onTimeDeliveryRate: $onTimeDeliveryRate, averageLeadTimeDays: $averageLeadTimeDays, cancellationRate: $cancellationRate)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DeliveryPerformanceImpl &&
            (identical(other.onTimeDeliveryRate, onTimeDeliveryRate) ||
                other.onTimeDeliveryRate == onTimeDeliveryRate) &&
            (identical(other.averageLeadTimeDays, averageLeadTimeDays) ||
                other.averageLeadTimeDays == averageLeadTimeDays) &&
            (identical(other.cancellationRate, cancellationRate) ||
                other.cancellationRate == cancellationRate));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, onTimeDeliveryRate, averageLeadTimeDays, cancellationRate);

  /// Create a copy of DeliveryPerformance
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DeliveryPerformanceImplCopyWith<_$DeliveryPerformanceImpl> get copyWith =>
      __$$DeliveryPerformanceImplCopyWithImpl<_$DeliveryPerformanceImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DeliveryPerformanceImplToJson(
      this,
    );
  }
}

abstract class _DeliveryPerformance implements DeliveryPerformance {
  const factory _DeliveryPerformance(
      {required final double onTimeDeliveryRate,
      required final double averageLeadTimeDays,
      required final double cancellationRate}) = _$DeliveryPerformanceImpl;

  factory _DeliveryPerformance.fromJson(Map<String, dynamic> json) =
      _$DeliveryPerformanceImpl.fromJson;

  @override
  double get onTimeDeliveryRate;
  @override
  double get averageLeadTimeDays;
  @override
  double get cancellationRate;

  /// Create a copy of DeliveryPerformance
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DeliveryPerformanceImplCopyWith<_$DeliveryPerformanceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

ReturnPerformance _$ReturnPerformanceFromJson(Map<String, dynamic> json) {
  return _ReturnPerformance.fromJson(json);
}

/// @nodoc
mixin _$ReturnPerformance {
  double get amountReturnRate => throw _privateConstructorUsedError;
  double get quantityReturnRate => throw _privateConstructorUsedError;
  int get returnCount => throw _privateConstructorUsedError;

  /// Serializes this ReturnPerformance to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of ReturnPerformance
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $ReturnPerformanceCopyWith<ReturnPerformance> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $ReturnPerformanceCopyWith<$Res> {
  factory $ReturnPerformanceCopyWith(
          ReturnPerformance value, $Res Function(ReturnPerformance) then) =
      _$ReturnPerformanceCopyWithImpl<$Res, ReturnPerformance>;
  @useResult
  $Res call(
      {double amountReturnRate, double quantityReturnRate, int returnCount});
}

/// @nodoc
class _$ReturnPerformanceCopyWithImpl<$Res, $Val extends ReturnPerformance>
    implements $ReturnPerformanceCopyWith<$Res> {
  _$ReturnPerformanceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of ReturnPerformance
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? amountReturnRate = null,
    Object? quantityReturnRate = null,
    Object? returnCount = null,
  }) {
    return _then(_value.copyWith(
      amountReturnRate: null == amountReturnRate
          ? _value.amountReturnRate
          : amountReturnRate // ignore: cast_nullable_to_non_nullable
              as double,
      quantityReturnRate: null == quantityReturnRate
          ? _value.quantityReturnRate
          : quantityReturnRate // ignore: cast_nullable_to_non_nullable
              as double,
      returnCount: null == returnCount
          ? _value.returnCount
          : returnCount // ignore: cast_nullable_to_non_nullable
              as int,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$ReturnPerformanceImplCopyWith<$Res>
    implements $ReturnPerformanceCopyWith<$Res> {
  factory _$$ReturnPerformanceImplCopyWith(_$ReturnPerformanceImpl value,
          $Res Function(_$ReturnPerformanceImpl) then) =
      __$$ReturnPerformanceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {double amountReturnRate, double quantityReturnRate, int returnCount});
}

/// @nodoc
class __$$ReturnPerformanceImplCopyWithImpl<$Res>
    extends _$ReturnPerformanceCopyWithImpl<$Res, _$ReturnPerformanceImpl>
    implements _$$ReturnPerformanceImplCopyWith<$Res> {
  __$$ReturnPerformanceImplCopyWithImpl(_$ReturnPerformanceImpl _value,
      $Res Function(_$ReturnPerformanceImpl) _then)
      : super(_value, _then);

  /// Create a copy of ReturnPerformance
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? amountReturnRate = null,
    Object? quantityReturnRate = null,
    Object? returnCount = null,
  }) {
    return _then(_$ReturnPerformanceImpl(
      amountReturnRate: null == amountReturnRate
          ? _value.amountReturnRate
          : amountReturnRate // ignore: cast_nullable_to_non_nullable
              as double,
      quantityReturnRate: null == quantityReturnRate
          ? _value.quantityReturnRate
          : quantityReturnRate // ignore: cast_nullable_to_non_nullable
              as double,
      returnCount: null == returnCount
          ? _value.returnCount
          : returnCount // ignore: cast_nullable_to_non_nullable
              as int,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$ReturnPerformanceImpl implements _ReturnPerformance {
  const _$ReturnPerformanceImpl(
      {required this.amountReturnRate,
      required this.quantityReturnRate,
      required this.returnCount});

  factory _$ReturnPerformanceImpl.fromJson(Map<String, dynamic> json) =>
      _$$ReturnPerformanceImplFromJson(json);

  @override
  final double amountReturnRate;
  @override
  final double quantityReturnRate;
  @override
  final int returnCount;

  @override
  String toString() {
    return 'ReturnPerformance(amountReturnRate: $amountReturnRate, quantityReturnRate: $quantityReturnRate, returnCount: $returnCount)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$ReturnPerformanceImpl &&
            (identical(other.amountReturnRate, amountReturnRate) ||
                other.amountReturnRate == amountReturnRate) &&
            (identical(other.quantityReturnRate, quantityReturnRate) ||
                other.quantityReturnRate == quantityReturnRate) &&
            (identical(other.returnCount, returnCount) ||
                other.returnCount == returnCount));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType, amountReturnRate, quantityReturnRate, returnCount);

  /// Create a copy of ReturnPerformance
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$ReturnPerformanceImplCopyWith<_$ReturnPerformanceImpl> get copyWith =>
      __$$ReturnPerformanceImplCopyWithImpl<_$ReturnPerformanceImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$ReturnPerformanceImplToJson(
      this,
    );
  }
}

abstract class _ReturnPerformance implements ReturnPerformance {
  const factory _ReturnPerformance(
      {required final double amountReturnRate,
      required final double quantityReturnRate,
      required final int returnCount}) = _$ReturnPerformanceImpl;

  factory _ReturnPerformance.fromJson(Map<String, dynamic> json) =
      _$ReturnPerformanceImpl.fromJson;

  @override
  double get amountReturnRate;
  @override
  double get quantityReturnRate;
  @override
  int get returnCount;

  /// Create a copy of ReturnPerformance
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$ReturnPerformanceImplCopyWith<_$ReturnPerformanceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

FinancialRisk _$FinancialRiskFromJson(Map<String, dynamic> json) {
  return _FinancialRisk.fromJson(json);
}

/// @nodoc
mixin _$FinancialRisk {
  String get totalOutstanding => throw _privateConstructorUsedError;
  int get overdueCount => throw _privateConstructorUsedError;
  String get overdue90plus => throw _privateConstructorUsedError;

  /// Serializes this FinancialRisk to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of FinancialRisk
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $FinancialRiskCopyWith<FinancialRisk> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $FinancialRiskCopyWith<$Res> {
  factory $FinancialRiskCopyWith(
          FinancialRisk value, $Res Function(FinancialRisk) then) =
      _$FinancialRiskCopyWithImpl<$Res, FinancialRisk>;
  @useResult
  $Res call({String totalOutstanding, int overdueCount, String overdue90plus});
}

/// @nodoc
class _$FinancialRiskCopyWithImpl<$Res, $Val extends FinancialRisk>
    implements $FinancialRiskCopyWith<$Res> {
  _$FinancialRiskCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of FinancialRisk
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? totalOutstanding = null,
    Object? overdueCount = null,
    Object? overdue90plus = null,
  }) {
    return _then(_value.copyWith(
      totalOutstanding: null == totalOutstanding
          ? _value.totalOutstanding
          : totalOutstanding // ignore: cast_nullable_to_non_nullable
              as String,
      overdueCount: null == overdueCount
          ? _value.overdueCount
          : overdueCount // ignore: cast_nullable_to_non_nullable
              as int,
      overdue90plus: null == overdue90plus
          ? _value.overdue90plus
          : overdue90plus // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$FinancialRiskImplCopyWith<$Res>
    implements $FinancialRiskCopyWith<$Res> {
  factory _$$FinancialRiskImplCopyWith(
          _$FinancialRiskImpl value, $Res Function(_$FinancialRiskImpl) then) =
      __$$FinancialRiskImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String totalOutstanding, int overdueCount, String overdue90plus});
}

/// @nodoc
class __$$FinancialRiskImplCopyWithImpl<$Res>
    extends _$FinancialRiskCopyWithImpl<$Res, _$FinancialRiskImpl>
    implements _$$FinancialRiskImplCopyWith<$Res> {
  __$$FinancialRiskImplCopyWithImpl(
      _$FinancialRiskImpl _value, $Res Function(_$FinancialRiskImpl) _then)
      : super(_value, _then);

  /// Create a copy of FinancialRisk
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? totalOutstanding = null,
    Object? overdueCount = null,
    Object? overdue90plus = null,
  }) {
    return _then(_$FinancialRiskImpl(
      totalOutstanding: null == totalOutstanding
          ? _value.totalOutstanding
          : totalOutstanding // ignore: cast_nullable_to_non_nullable
              as String,
      overdueCount: null == overdueCount
          ? _value.overdueCount
          : overdueCount // ignore: cast_nullable_to_non_nullable
              as int,
      overdue90plus: null == overdue90plus
          ? _value.overdue90plus
          : overdue90plus // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$FinancialRiskImpl implements _FinancialRisk {
  const _$FinancialRiskImpl(
      {required this.totalOutstanding,
      required this.overdueCount,
      required this.overdue90plus});

  factory _$FinancialRiskImpl.fromJson(Map<String, dynamic> json) =>
      _$$FinancialRiskImplFromJson(json);

  @override
  final String totalOutstanding;
  @override
  final int overdueCount;
  @override
  final String overdue90plus;

  @override
  String toString() {
    return 'FinancialRisk(totalOutstanding: $totalOutstanding, overdueCount: $overdueCount, overdue90plus: $overdue90plus)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$FinancialRiskImpl &&
            (identical(other.totalOutstanding, totalOutstanding) ||
                other.totalOutstanding == totalOutstanding) &&
            (identical(other.overdueCount, overdueCount) ||
                other.overdueCount == overdueCount) &&
            (identical(other.overdue90plus, overdue90plus) ||
                other.overdue90plus == overdue90plus));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, totalOutstanding, overdueCount, overdue90plus);

  /// Create a copy of FinancialRisk
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$FinancialRiskImplCopyWith<_$FinancialRiskImpl> get copyWith =>
      __$$FinancialRiskImplCopyWithImpl<_$FinancialRiskImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$FinancialRiskImplToJson(
      this,
    );
  }
}

abstract class _FinancialRisk implements FinancialRisk {
  const factory _FinancialRisk(
      {required final String totalOutstanding,
      required final int overdueCount,
      required final String overdue90plus}) = _$FinancialRiskImpl;

  factory _FinancialRisk.fromJson(Map<String, dynamic> json) =
      _$FinancialRiskImpl.fromJson;

  @override
  String get totalOutstanding;
  @override
  int get overdueCount;
  @override
  String get overdue90plus;

  /// Create a copy of FinancialRisk
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$FinancialRiskImplCopyWith<_$FinancialRiskImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

SupplierPerformance _$SupplierPerformanceFromJson(Map<String, dynamic> json) {
  return _SupplierPerformance.fromJson(json);
}

/// @nodoc
mixin _$SupplierPerformance {
  String get dateFrom => throw _privateConstructorUsedError;
  String get dateTo => throw _privateConstructorUsedError;
  PurchasePerformance get purchase => throw _privateConstructorUsedError;
  DeliveryPerformance get delivery => throw _privateConstructorUsedError;
  ReturnPerformance get returns => throw _privateConstructorUsedError;
  FinancialRisk get financialRisk => throw _privateConstructorUsedError;

  /// Serializes this SupplierPerformance to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of SupplierPerformance
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $SupplierPerformanceCopyWith<SupplierPerformance> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $SupplierPerformanceCopyWith<$Res> {
  factory $SupplierPerformanceCopyWith(
          SupplierPerformance value, $Res Function(SupplierPerformance) then) =
      _$SupplierPerformanceCopyWithImpl<$Res, SupplierPerformance>;
  @useResult
  $Res call(
      {String dateFrom,
      String dateTo,
      PurchasePerformance purchase,
      DeliveryPerformance delivery,
      ReturnPerformance returns,
      FinancialRisk financialRisk});

  $PurchasePerformanceCopyWith<$Res> get purchase;
  $DeliveryPerformanceCopyWith<$Res> get delivery;
  $ReturnPerformanceCopyWith<$Res> get returns;
  $FinancialRiskCopyWith<$Res> get financialRisk;
}

/// @nodoc
class _$SupplierPerformanceCopyWithImpl<$Res, $Val extends SupplierPerformance>
    implements $SupplierPerformanceCopyWith<$Res> {
  _$SupplierPerformanceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of SupplierPerformance
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dateFrom = null,
    Object? dateTo = null,
    Object? purchase = null,
    Object? delivery = null,
    Object? returns = null,
    Object? financialRisk = null,
  }) {
    return _then(_value.copyWith(
      dateFrom: null == dateFrom
          ? _value.dateFrom
          : dateFrom // ignore: cast_nullable_to_non_nullable
              as String,
      dateTo: null == dateTo
          ? _value.dateTo
          : dateTo // ignore: cast_nullable_to_non_nullable
              as String,
      purchase: null == purchase
          ? _value.purchase
          : purchase // ignore: cast_nullable_to_non_nullable
              as PurchasePerformance,
      delivery: null == delivery
          ? _value.delivery
          : delivery // ignore: cast_nullable_to_non_nullable
              as DeliveryPerformance,
      returns: null == returns
          ? _value.returns
          : returns // ignore: cast_nullable_to_non_nullable
              as ReturnPerformance,
      financialRisk: null == financialRisk
          ? _value.financialRisk
          : financialRisk // ignore: cast_nullable_to_non_nullable
              as FinancialRisk,
    ) as $Val);
  }

  /// Create a copy of SupplierPerformance
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $PurchasePerformanceCopyWith<$Res> get purchase {
    return $PurchasePerformanceCopyWith<$Res>(_value.purchase, (value) {
      return _then(_value.copyWith(purchase: value) as $Val);
    });
  }

  /// Create a copy of SupplierPerformance
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DeliveryPerformanceCopyWith<$Res> get delivery {
    return $DeliveryPerformanceCopyWith<$Res>(_value.delivery, (value) {
      return _then(_value.copyWith(delivery: value) as $Val);
    });
  }

  /// Create a copy of SupplierPerformance
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $ReturnPerformanceCopyWith<$Res> get returns {
    return $ReturnPerformanceCopyWith<$Res>(_value.returns, (value) {
      return _then(_value.copyWith(returns: value) as $Val);
    });
  }

  /// Create a copy of SupplierPerformance
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $FinancialRiskCopyWith<$Res> get financialRisk {
    return $FinancialRiskCopyWith<$Res>(_value.financialRisk, (value) {
      return _then(_value.copyWith(financialRisk: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$SupplierPerformanceImplCopyWith<$Res>
    implements $SupplierPerformanceCopyWith<$Res> {
  factory _$$SupplierPerformanceImplCopyWith(_$SupplierPerformanceImpl value,
          $Res Function(_$SupplierPerformanceImpl) then) =
      __$$SupplierPerformanceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String dateFrom,
      String dateTo,
      PurchasePerformance purchase,
      DeliveryPerformance delivery,
      ReturnPerformance returns,
      FinancialRisk financialRisk});

  @override
  $PurchasePerformanceCopyWith<$Res> get purchase;
  @override
  $DeliveryPerformanceCopyWith<$Res> get delivery;
  @override
  $ReturnPerformanceCopyWith<$Res> get returns;
  @override
  $FinancialRiskCopyWith<$Res> get financialRisk;
}

/// @nodoc
class __$$SupplierPerformanceImplCopyWithImpl<$Res>
    extends _$SupplierPerformanceCopyWithImpl<$Res, _$SupplierPerformanceImpl>
    implements _$$SupplierPerformanceImplCopyWith<$Res> {
  __$$SupplierPerformanceImplCopyWithImpl(_$SupplierPerformanceImpl _value,
      $Res Function(_$SupplierPerformanceImpl) _then)
      : super(_value, _then);

  /// Create a copy of SupplierPerformance
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? dateFrom = null,
    Object? dateTo = null,
    Object? purchase = null,
    Object? delivery = null,
    Object? returns = null,
    Object? financialRisk = null,
  }) {
    return _then(_$SupplierPerformanceImpl(
      dateFrom: null == dateFrom
          ? _value.dateFrom
          : dateFrom // ignore: cast_nullable_to_non_nullable
              as String,
      dateTo: null == dateTo
          ? _value.dateTo
          : dateTo // ignore: cast_nullable_to_non_nullable
              as String,
      purchase: null == purchase
          ? _value.purchase
          : purchase // ignore: cast_nullable_to_non_nullable
              as PurchasePerformance,
      delivery: null == delivery
          ? _value.delivery
          : delivery // ignore: cast_nullable_to_non_nullable
              as DeliveryPerformance,
      returns: null == returns
          ? _value.returns
          : returns // ignore: cast_nullable_to_non_nullable
              as ReturnPerformance,
      financialRisk: null == financialRisk
          ? _value.financialRisk
          : financialRisk // ignore: cast_nullable_to_non_nullable
              as FinancialRisk,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$SupplierPerformanceImpl implements _SupplierPerformance {
  const _$SupplierPerformanceImpl(
      {required this.dateFrom,
      required this.dateTo,
      required this.purchase,
      required this.delivery,
      required this.returns,
      required this.financialRisk});

  factory _$SupplierPerformanceImpl.fromJson(Map<String, dynamic> json) =>
      _$$SupplierPerformanceImplFromJson(json);

  @override
  final String dateFrom;
  @override
  final String dateTo;
  @override
  final PurchasePerformance purchase;
  @override
  final DeliveryPerformance delivery;
  @override
  final ReturnPerformance returns;
  @override
  final FinancialRisk financialRisk;

  @override
  String toString() {
    return 'SupplierPerformance(dateFrom: $dateFrom, dateTo: $dateTo, purchase: $purchase, delivery: $delivery, returns: $returns, financialRisk: $financialRisk)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$SupplierPerformanceImpl &&
            (identical(other.dateFrom, dateFrom) ||
                other.dateFrom == dateFrom) &&
            (identical(other.dateTo, dateTo) || other.dateTo == dateTo) &&
            (identical(other.purchase, purchase) ||
                other.purchase == purchase) &&
            (identical(other.delivery, delivery) ||
                other.delivery == delivery) &&
            (identical(other.returns, returns) || other.returns == returns) &&
            (identical(other.financialRisk, financialRisk) ||
                other.financialRisk == financialRisk));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, dateFrom, dateTo, purchase,
      delivery, returns, financialRisk);

  /// Create a copy of SupplierPerformance
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$SupplierPerformanceImplCopyWith<_$SupplierPerformanceImpl> get copyWith =>
      __$$SupplierPerformanceImplCopyWithImpl<_$SupplierPerformanceImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$SupplierPerformanceImplToJson(
      this,
    );
  }
}

abstract class _SupplierPerformance implements SupplierPerformance {
  const factory _SupplierPerformance(
      {required final String dateFrom,
      required final String dateTo,
      required final PurchasePerformance purchase,
      required final DeliveryPerformance delivery,
      required final ReturnPerformance returns,
      required final FinancialRisk financialRisk}) = _$SupplierPerformanceImpl;

  factory _SupplierPerformance.fromJson(Map<String, dynamic> json) =
      _$SupplierPerformanceImpl.fromJson;

  @override
  String get dateFrom;
  @override
  String get dateTo;
  @override
  PurchasePerformance get purchase;
  @override
  DeliveryPerformance get delivery;
  @override
  ReturnPerformance get returns;
  @override
  FinancialRisk get financialRisk;

  /// Create a copy of SupplierPerformance
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$SupplierPerformanceImplCopyWith<_$SupplierPerformanceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
