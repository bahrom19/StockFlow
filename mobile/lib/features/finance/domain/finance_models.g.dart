// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'finance_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$TrialBalanceRowImpl _$$TrialBalanceRowImplFromJson(
        Map<String, dynamic> json) =>
    _$TrialBalanceRowImpl(
      accountId: json['accountId'] as String,
      accountCode: json['accountCode'] as String,
      accountName: json['accountName'] as String,
      accountType: json['accountType'] as String,
      level: (json['level'] as num?)?.toInt() ?? 0,
      debit: json['debit'] as String? ?? '0.0000',
      credit: json['credit'] as String? ?? '0.0000',
    );

Map<String, dynamic> _$$TrialBalanceRowImplToJson(
        _$TrialBalanceRowImpl instance) =>
    <String, dynamic>{
      'accountId': instance.accountId,
      'accountCode': instance.accountCode,
      'accountName': instance.accountName,
      'accountType': instance.accountType,
      'level': instance.level,
      'debit': instance.debit,
      'credit': instance.credit,
    };

_$TrialBalanceResponseImpl _$$TrialBalanceResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$TrialBalanceResponseImpl(
      rows: (json['rows'] as List<dynamic>?)
              ?.map((e) => TrialBalanceRow.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      totalDebit: json['totalDebit'] as String? ?? '0.0000',
      totalCredit: json['totalCredit'] as String? ?? '0.0000',
    );

Map<String, dynamic> _$$TrialBalanceResponseImplToJson(
        _$TrialBalanceResponseImpl instance) =>
    <String, dynamic>{
      'rows': instance.rows,
      'totalDebit': instance.totalDebit,
      'totalCredit': instance.totalCredit,
    };
