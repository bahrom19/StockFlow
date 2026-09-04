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

_$RecentDeliveryImpl _$$RecentDeliveryImplFromJson(Map<String, dynamic> json) =>
    _$RecentDeliveryImpl(
      orderNumber: json['orderNumber'] as String,
      orderDate: json['orderDate'] as String,
      expectedDate: json['expectedDate'] as String?,
      receiptDate: json['receiptDate'] as String?,
      leadTimeDays: (json['leadTimeDays'] as num?)?.toInt(),
      onTime: json['onTime'] as bool?,
      status: json['status'] as String,
      grandTotal: json['grandTotal'] as String,
    );

Map<String, dynamic> _$$RecentDeliveryImplToJson(
        _$RecentDeliveryImpl instance) =>
    <String, dynamic>{
      'orderNumber': instance.orderNumber,
      'orderDate': instance.orderDate,
      'expectedDate': instance.expectedDate,
      'receiptDate': instance.receiptDate,
      'leadTimeDays': instance.leadTimeDays,
      'onTime': instance.onTime,
      'status': instance.status,
      'grandTotal': instance.grandTotal,
    };

_$SupplierReliabilityImpl _$$SupplierReliabilityImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierReliabilityImpl(
      dateFrom: json['dateFrom'] as String,
      dateTo: json['dateTo'] as String,
      totalOrders: (json['totalOrders'] as num).toInt(),
      totalReceipts: (json['totalReceipts'] as num).toInt(),
      onTimeDeliveryRate: (json['onTimeDeliveryRate'] as num).toDouble(),
      averageLeadTimeDays: (json['averageLeadTimeDays'] as num).toDouble(),
      minLeadTimeDays: (json['minLeadTimeDays'] as num?)?.toInt(),
      maxLeadTimeDays: (json['maxLeadTimeDays'] as num?)?.toInt(),
      ordersReceived: (json['ordersReceived'] as num).toInt(),
      ordersPartiallyReceived: (json['ordersPartiallyReceived'] as num).toInt(),
      ordersCancelled: (json['ordersCancelled'] as num).toInt(),
      cancellationRate: (json['cancellationRate'] as num).toDouble(),
      recentDeliveries: (json['recentDeliveries'] as List<dynamic>?)
              ?.map((e) => RecentDelivery.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$$SupplierReliabilityImplToJson(
        _$SupplierReliabilityImpl instance) =>
    <String, dynamic>{
      'dateFrom': instance.dateFrom,
      'dateTo': instance.dateTo,
      'totalOrders': instance.totalOrders,
      'totalReceipts': instance.totalReceipts,
      'onTimeDeliveryRate': instance.onTimeDeliveryRate,
      'averageLeadTimeDays': instance.averageLeadTimeDays,
      'minLeadTimeDays': instance.minLeadTimeDays,
      'maxLeadTimeDays': instance.maxLeadTimeDays,
      'ordersReceived': instance.ordersReceived,
      'ordersPartiallyReceived': instance.ordersPartiallyReceived,
      'ordersCancelled': instance.ordersCancelled,
      'cancellationRate': instance.cancellationRate,
      'recentDeliveries': instance.recentDeliveries,
    };
