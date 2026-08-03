// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'finance_models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

TrialBalanceRow _$TrialBalanceRowFromJson(Map<String, dynamic> json) {
  return _TrialBalanceRow.fromJson(json);
}

/// @nodoc
mixin _$TrialBalanceRow {
  String get accountId => throw _privateConstructorUsedError;
  String get accountCode => throw _privateConstructorUsedError;
  String get accountName => throw _privateConstructorUsedError;
  String get accountType => throw _privateConstructorUsedError;
  int get level => throw _privateConstructorUsedError;
  String get debit => throw _privateConstructorUsedError;
  String get credit => throw _privateConstructorUsedError;

  /// Serializes this TrialBalanceRow to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of TrialBalanceRow
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $TrialBalanceRowCopyWith<TrialBalanceRow> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $TrialBalanceRowCopyWith<$Res> {
  factory $TrialBalanceRowCopyWith(
          TrialBalanceRow value, $Res Function(TrialBalanceRow) then) =
      _$TrialBalanceRowCopyWithImpl<$Res, TrialBalanceRow>;
  @useResult
  $Res call(
      {String accountId,
      String accountCode,
      String accountName,
      String accountType,
      int level,
      String debit,
      String credit});
}

/// @nodoc
class _$TrialBalanceRowCopyWithImpl<$Res, $Val extends TrialBalanceRow>
    implements $TrialBalanceRowCopyWith<$Res> {
  _$TrialBalanceRowCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of TrialBalanceRow
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? accountId = null,
    Object? accountCode = null,
    Object? accountName = null,
    Object? accountType = null,
    Object? level = null,
    Object? debit = null,
    Object? credit = null,
  }) {
    return _then(_value.copyWith(
      accountId: null == accountId
          ? _value.accountId
          : accountId // ignore: cast_nullable_to_non_nullable
              as String,
      accountCode: null == accountCode
          ? _value.accountCode
          : accountCode // ignore: cast_nullable_to_non_nullable
              as String,
      accountName: null == accountName
          ? _value.accountName
          : accountName // ignore: cast_nullable_to_non_nullable
              as String,
      accountType: null == accountType
          ? _value.accountType
          : accountType // ignore: cast_nullable_to_non_nullable
              as String,
      level: null == level
          ? _value.level
          : level // ignore: cast_nullable_to_non_nullable
              as int,
      debit: null == debit
          ? _value.debit
          : debit // ignore: cast_nullable_to_non_nullable
              as String,
      credit: null == credit
          ? _value.credit
          : credit // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$TrialBalanceRowImplCopyWith<$Res>
    implements $TrialBalanceRowCopyWith<$Res> {
  factory _$$TrialBalanceRowImplCopyWith(_$TrialBalanceRowImpl value,
          $Res Function(_$TrialBalanceRowImpl) then) =
      __$$TrialBalanceRowImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String accountId,
      String accountCode,
      String accountName,
      String accountType,
      int level,
      String debit,
      String credit});
}

/// @nodoc
class __$$TrialBalanceRowImplCopyWithImpl<$Res>
    extends _$TrialBalanceRowCopyWithImpl<$Res, _$TrialBalanceRowImpl>
    implements _$$TrialBalanceRowImplCopyWith<$Res> {
  __$$TrialBalanceRowImplCopyWithImpl(
      _$TrialBalanceRowImpl _value, $Res Function(_$TrialBalanceRowImpl) _then)
      : super(_value, _then);

  /// Create a copy of TrialBalanceRow
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? accountId = null,
    Object? accountCode = null,
    Object? accountName = null,
    Object? accountType = null,
    Object? level = null,
    Object? debit = null,
    Object? credit = null,
  }) {
    return _then(_$TrialBalanceRowImpl(
      accountId: null == accountId
          ? _value.accountId
          : accountId // ignore: cast_nullable_to_non_nullable
              as String,
      accountCode: null == accountCode
          ? _value.accountCode
          : accountCode // ignore: cast_nullable_to_non_nullable
              as String,
      accountName: null == accountName
          ? _value.accountName
          : accountName // ignore: cast_nullable_to_non_nullable
              as String,
      accountType: null == accountType
          ? _value.accountType
          : accountType // ignore: cast_nullable_to_non_nullable
              as String,
      level: null == level
          ? _value.level
          : level // ignore: cast_nullable_to_non_nullable
              as int,
      debit: null == debit
          ? _value.debit
          : debit // ignore: cast_nullable_to_non_nullable
              as String,
      credit: null == credit
          ? _value.credit
          : credit // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$TrialBalanceRowImpl implements _TrialBalanceRow {
  const _$TrialBalanceRowImpl(
      {required this.accountId,
      required this.accountCode,
      required this.accountName,
      required this.accountType,
      this.level = 0,
      this.debit = '0.0000',
      this.credit = '0.0000'});

  factory _$TrialBalanceRowImpl.fromJson(Map<String, dynamic> json) =>
      _$$TrialBalanceRowImplFromJson(json);

  @override
  final String accountId;
  @override
  final String accountCode;
  @override
  final String accountName;
  @override
  final String accountType;
  @override
  @JsonKey()
  final int level;
  @override
  @JsonKey()
  final String debit;
  @override
  @JsonKey()
  final String credit;

  @override
  String toString() {
    return 'TrialBalanceRow(accountId: $accountId, accountCode: $accountCode, accountName: $accountName, accountType: $accountType, level: $level, debit: $debit, credit: $credit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$TrialBalanceRowImpl &&
            (identical(other.accountId, accountId) ||
                other.accountId == accountId) &&
            (identical(other.accountCode, accountCode) ||
                other.accountCode == accountCode) &&
            (identical(other.accountName, accountName) ||
                other.accountName == accountName) &&
            (identical(other.accountType, accountType) ||
                other.accountType == accountType) &&
            (identical(other.level, level) || other.level == level) &&
            (identical(other.debit, debit) || other.debit == debit) &&
            (identical(other.credit, credit) || other.credit == credit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, accountId, accountCode,
      accountName, accountType, level, debit, credit);

  /// Create a copy of TrialBalanceRow
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$TrialBalanceRowImplCopyWith<_$TrialBalanceRowImpl> get copyWith =>
      __$$TrialBalanceRowImplCopyWithImpl<_$TrialBalanceRowImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$TrialBalanceRowImplToJson(
      this,
    );
  }
}

abstract class _TrialBalanceRow implements TrialBalanceRow {
  const factory _TrialBalanceRow(
      {required final String accountId,
      required final String accountCode,
      required final String accountName,
      required final String accountType,
      final int level,
      final String debit,
      final String credit}) = _$TrialBalanceRowImpl;

  factory _TrialBalanceRow.fromJson(Map<String, dynamic> json) =
      _$TrialBalanceRowImpl.fromJson;

  @override
  String get accountId;
  @override
  String get accountCode;
  @override
  String get accountName;
  @override
  String get accountType;
  @override
  int get level;
  @override
  String get debit;
  @override
  String get credit;

  /// Create a copy of TrialBalanceRow
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$TrialBalanceRowImplCopyWith<_$TrialBalanceRowImpl> get copyWith =>
      throw _privateConstructorUsedError;
}

TrialBalanceResponse _$TrialBalanceResponseFromJson(Map<String, dynamic> json) {
  return _TrialBalanceResponse.fromJson(json);
}

/// @nodoc
mixin _$TrialBalanceResponse {
  List<TrialBalanceRow> get rows => throw _privateConstructorUsedError;
  String get totalDebit => throw _privateConstructorUsedError;
  String get totalCredit => throw _privateConstructorUsedError;

  /// Serializes this TrialBalanceResponse to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of TrialBalanceResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $TrialBalanceResponseCopyWith<TrialBalanceResponse> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $TrialBalanceResponseCopyWith<$Res> {
  factory $TrialBalanceResponseCopyWith(TrialBalanceResponse value,
          $Res Function(TrialBalanceResponse) then) =
      _$TrialBalanceResponseCopyWithImpl<$Res, TrialBalanceResponse>;
  @useResult
  $Res call(
      {List<TrialBalanceRow> rows, String totalDebit, String totalCredit});
}

/// @nodoc
class _$TrialBalanceResponseCopyWithImpl<$Res,
        $Val extends TrialBalanceResponse>
    implements $TrialBalanceResponseCopyWith<$Res> {
  _$TrialBalanceResponseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of TrialBalanceResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? rows = null,
    Object? totalDebit = null,
    Object? totalCredit = null,
  }) {
    return _then(_value.copyWith(
      rows: null == rows
          ? _value.rows
          : rows // ignore: cast_nullable_to_non_nullable
              as List<TrialBalanceRow>,
      totalDebit: null == totalDebit
          ? _value.totalDebit
          : totalDebit // ignore: cast_nullable_to_non_nullable
              as String,
      totalCredit: null == totalCredit
          ? _value.totalCredit
          : totalCredit // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$TrialBalanceResponseImplCopyWith<$Res>
    implements $TrialBalanceResponseCopyWith<$Res> {
  factory _$$TrialBalanceResponseImplCopyWith(_$TrialBalanceResponseImpl value,
          $Res Function(_$TrialBalanceResponseImpl) then) =
      __$$TrialBalanceResponseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {List<TrialBalanceRow> rows, String totalDebit, String totalCredit});
}

/// @nodoc
class __$$TrialBalanceResponseImplCopyWithImpl<$Res>
    extends _$TrialBalanceResponseCopyWithImpl<$Res, _$TrialBalanceResponseImpl>
    implements _$$TrialBalanceResponseImplCopyWith<$Res> {
  __$$TrialBalanceResponseImplCopyWithImpl(_$TrialBalanceResponseImpl _value,
      $Res Function(_$TrialBalanceResponseImpl) _then)
      : super(_value, _then);

  /// Create a copy of TrialBalanceResponse
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? rows = null,
    Object? totalDebit = null,
    Object? totalCredit = null,
  }) {
    return _then(_$TrialBalanceResponseImpl(
      rows: null == rows
          ? _value._rows
          : rows // ignore: cast_nullable_to_non_nullable
              as List<TrialBalanceRow>,
      totalDebit: null == totalDebit
          ? _value.totalDebit
          : totalDebit // ignore: cast_nullable_to_non_nullable
              as String,
      totalCredit: null == totalCredit
          ? _value.totalCredit
          : totalCredit // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$TrialBalanceResponseImpl implements _TrialBalanceResponse {
  const _$TrialBalanceResponseImpl(
      {final List<TrialBalanceRow> rows = const [],
      this.totalDebit = '0.0000',
      this.totalCredit = '0.0000'})
      : _rows = rows;

  factory _$TrialBalanceResponseImpl.fromJson(Map<String, dynamic> json) =>
      _$$TrialBalanceResponseImplFromJson(json);

  final List<TrialBalanceRow> _rows;
  @override
  @JsonKey()
  List<TrialBalanceRow> get rows {
    if (_rows is EqualUnmodifiableListView) return _rows;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_rows);
  }

  @override
  @JsonKey()
  final String totalDebit;
  @override
  @JsonKey()
  final String totalCredit;

  @override
  String toString() {
    return 'TrialBalanceResponse(rows: $rows, totalDebit: $totalDebit, totalCredit: $totalCredit)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$TrialBalanceResponseImpl &&
            const DeepCollectionEquality().equals(other._rows, _rows) &&
            (identical(other.totalDebit, totalDebit) ||
                other.totalDebit == totalDebit) &&
            (identical(other.totalCredit, totalCredit) ||
                other.totalCredit == totalCredit));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType,
      const DeepCollectionEquality().hash(_rows), totalDebit, totalCredit);

  /// Create a copy of TrialBalanceResponse
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$TrialBalanceResponseImplCopyWith<_$TrialBalanceResponseImpl>
      get copyWith =>
          __$$TrialBalanceResponseImplCopyWithImpl<_$TrialBalanceResponseImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$TrialBalanceResponseImplToJson(
      this,
    );
  }
}

abstract class _TrialBalanceResponse implements TrialBalanceResponse {
  const factory _TrialBalanceResponse(
      {final List<TrialBalanceRow> rows,
      final String totalDebit,
      final String totalCredit}) = _$TrialBalanceResponseImpl;

  factory _TrialBalanceResponse.fromJson(Map<String, dynamic> json) =
      _$TrialBalanceResponseImpl.fromJson;

  @override
  List<TrialBalanceRow> get rows;
  @override
  String get totalDebit;
  @override
  String get totalCredit;

  /// Create a copy of TrialBalanceResponse
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$TrialBalanceResponseImplCopyWith<_$TrialBalanceResponseImpl>
      get copyWith => throw _privateConstructorUsedError;
}
