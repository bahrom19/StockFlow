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
