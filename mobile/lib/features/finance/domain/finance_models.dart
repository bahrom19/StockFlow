import 'package:freezed_annotation/freezed_annotation.dart';

part 'finance_models.freezed.dart';
part 'finance_models.g.dart';

// ──────────────────────────────────
// Trial Balance Row (matches TrialBalanceRow)
// ──────────────────────────────────
@freezed
class TrialBalanceRow with _$TrialBalanceRow {
  const factory TrialBalanceRow({
    required String accountId,
    required String accountCode,
    required String accountName,
    required String accountType,
    @Default(0) int level,
    @Default('0.0000') String debit,
    @Default('0.0000') String credit,
  }) = _TrialBalanceRow;

  factory TrialBalanceRow.fromJson(Map<String, dynamic> json) =>
      _$TrialBalanceRowFromJson(json);
}

// ──────────────────────────────────
// Trial Balance Response
// ──────────────────────────────────
@freezed
class TrialBalanceResponse with _$TrialBalanceResponse {
  const factory TrialBalanceResponse({
    @Default([]) List<TrialBalanceRow> rows,
    @Default('0.0000') String totalDebit,
    @Default('0.0000') String totalCredit,
  }) = _TrialBalanceResponse;

  factory TrialBalanceResponse.fromJson(Map<String, dynamic> json) =>
      _$TrialBalanceResponseFromJson(json);
}
