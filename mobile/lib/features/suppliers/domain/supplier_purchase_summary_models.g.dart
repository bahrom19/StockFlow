// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'supplier_purchase_summary_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$MonthlySpendImpl _$$MonthlySpendImplFromJson(Map<String, dynamic> json) =>
    _$MonthlySpendImpl(
      month: json['month'] as String,
      amount: json['amount'] as String,
    );

Map<String, dynamic> _$$MonthlySpendImplToJson(_$MonthlySpendImpl instance) =>
    <String, dynamic>{
      'month': instance.month,
      'amount': instance.amount,
    };

_$SupplierPurchaseSummaryImpl _$$SupplierPurchaseSummaryImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierPurchaseSummaryImpl(
      dateFrom: json['dateFrom'] as String,
      dateTo: json['dateTo'] as String,
      totalInvoiced: json['totalInvoiced'] as String,
      totalReturned: json['totalReturned'] as String,
      netPurchaseSpend: json['netPurchaseSpend'] as String,
      totalPurchasedQuantity: (json['totalPurchasedQuantity'] as num).toInt(),
      weightedAverageUnitCost: json['weightedAverageUnitCost'] as String,
      invoiceCount: (json['invoiceCount'] as num).toInt(),
      returnCount: (json['returnCount'] as num).toInt(),
      firstPurchaseDate: json['firstPurchaseDate'] as String?,
      lastPurchaseDate: json['lastPurchaseDate'] as String?,
      monthlySpend: (json['monthlySpend'] as List<dynamic>?)
              ?.map((e) => MonthlySpend.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      currentTotalPaid: json['currentTotalPaid'] as String,
      currentOutstanding: json['currentOutstanding'] as String,
    );

Map<String, dynamic> _$$SupplierPurchaseSummaryImplToJson(
        _$SupplierPurchaseSummaryImpl instance) =>
    <String, dynamic>{
      'dateFrom': instance.dateFrom,
      'dateTo': instance.dateTo,
      'totalInvoiced': instance.totalInvoiced,
      'totalReturned': instance.totalReturned,
      'netPurchaseSpend': instance.netPurchaseSpend,
      'totalPurchasedQuantity': instance.totalPurchasedQuantity,
      'weightedAverageUnitCost': instance.weightedAverageUnitCost,
      'invoiceCount': instance.invoiceCount,
      'returnCount': instance.returnCount,
      'firstPurchaseDate': instance.firstPurchaseDate,
      'lastPurchaseDate': instance.lastPurchaseDate,
      'monthlySpend': instance.monthlySpend,
      'currentTotalPaid': instance.currentTotalPaid,
      'currentOutstanding': instance.currentOutstanding,
    };
