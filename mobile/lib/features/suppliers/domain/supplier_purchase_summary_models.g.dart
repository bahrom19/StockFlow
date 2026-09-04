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

_$ProductPurchaseDetailImpl _$$ProductPurchaseDetailImplFromJson(
        Map<String, dynamic> json) =>
    _$ProductPurchaseDetailImpl(
      productId: json['productId'] as String,
      productName: json['productName'] as String,
      sku: json['sku'] as String?,
      totalPurchasedQuantity: (json['totalPurchasedQuantity'] as num).toInt(),
      totalPurchaseSpend: json['totalPurchaseSpend'] as String,
      weightedAverageUnitCost: json['weightedAverageUnitCost'] as String,
      minUnitCost: json['minUnitCost'] as String,
      maxUnitCost: json['maxUnitCost'] as String,
      totalReturnedQuantity: (json['totalReturnedQuantity'] as num).toInt(),
      totalReturnedSpend: json['totalReturnedSpend'] as String,
      netPurchasedQuantity: (json['netPurchasedQuantity'] as num).toInt(),
      netPurchaseSpend: json['netPurchaseSpend'] as String,
      invoiceCount: (json['invoiceCount'] as num).toInt(),
      firstPurchaseDate: json['firstPurchaseDate'] as String?,
      lastPurchaseDate: json['lastPurchaseDate'] as String?,
    );

Map<String, dynamic> _$$ProductPurchaseDetailImplToJson(
        _$ProductPurchaseDetailImpl instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'productName': instance.productName,
      'sku': instance.sku,
      'totalPurchasedQuantity': instance.totalPurchasedQuantity,
      'totalPurchaseSpend': instance.totalPurchaseSpend,
      'weightedAverageUnitCost': instance.weightedAverageUnitCost,
      'minUnitCost': instance.minUnitCost,
      'maxUnitCost': instance.maxUnitCost,
      'totalReturnedQuantity': instance.totalReturnedQuantity,
      'totalReturnedSpend': instance.totalReturnedSpend,
      'netPurchasedQuantity': instance.netPurchasedQuantity,
      'netPurchaseSpend': instance.netPurchaseSpend,
      'invoiceCount': instance.invoiceCount,
      'firstPurchaseDate': instance.firstPurchaseDate,
      'lastPurchaseDate': instance.lastPurchaseDate,
    };

_$ProductPurchaseListResponseImpl _$$ProductPurchaseListResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$ProductPurchaseListResponseImpl(
      items: (json['items'] as List<dynamic>)
          .map((e) => ProductPurchaseDetail.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
    );

Map<String, dynamic> _$$ProductPurchaseListResponseImplToJson(
        _$ProductPurchaseListResponseImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'total': instance.total,
      'page': instance.page,
      'limit': instance.limit,
    };
