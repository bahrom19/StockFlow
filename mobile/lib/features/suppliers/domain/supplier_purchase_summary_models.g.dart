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

_$PricePointImpl _$$PricePointImplFromJson(Map<String, dynamic> json) =>
    _$PricePointImpl(
      invoiceDate: json['invoiceDate'] as String,
      invoiceNumber: json['invoiceNumber'] as String,
      unitCost: json['unitCost'] as String,
      quantity: (json['quantity'] as num).toInt(),
      total: json['total'] as String,
    );

Map<String, dynamic> _$$PricePointImplToJson(_$PricePointImpl instance) =>
    <String, dynamic>{
      'invoiceDate': instance.invoiceDate,
      'invoiceNumber': instance.invoiceNumber,
      'unitCost': instance.unitCost,
      'quantity': instance.quantity,
      'total': instance.total,
    };

_$SupplierPriceHistoryImpl _$$SupplierPriceHistoryImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierPriceHistoryImpl(
      productId: json['productId'] as String,
      productName: json['productName'] as String,
      sku: json['sku'] as String?,
      dateFrom: json['dateFrom'] as String,
      dateTo: json['dateTo'] as String,
      currentQuotedPrice: json['currentQuotedPrice'] as String?,
      averageUnitCost: json['averageUnitCost'] as String,
      minUnitCost: json['minUnitCost'] as String,
      maxUnitCost: json['maxUnitCost'] as String,
      pricePoints: (json['pricePoints'] as List<dynamic>?)
              ?.map((e) => PricePoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$$SupplierPriceHistoryImplToJson(
        _$SupplierPriceHistoryImpl instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'productName': instance.productName,
      'sku': instance.sku,
      'dateFrom': instance.dateFrom,
      'dateTo': instance.dateTo,
      'currentQuotedPrice': instance.currentQuotedPrice,
      'averageUnitCost': instance.averageUnitCost,
      'minUnitCost': instance.minUnitCost,
      'maxUnitCost': instance.maxUnitCost,
      'pricePoints': instance.pricePoints,
    };

_$OverdueSupplierInvoiceImpl _$$OverdueSupplierInvoiceImplFromJson(
        Map<String, dynamic> json) =>
    _$OverdueSupplierInvoiceImpl(
      invoiceId: json['invoiceId'] as String,
      invoiceNumber: json['invoiceNumber'] as String,
      invoiceDate: json['invoiceDate'] as String,
      dueDate: json['dueDate'] as String?,
      grandTotal: json['grandTotal'] as String,
      paidAmount: json['paidAmount'] as String,
      outstanding: json['outstanding'] as String,
      daysOverdue: (json['daysOverdue'] as num).toInt(),
    );

Map<String, dynamic> _$$OverdueSupplierInvoiceImplToJson(
        _$OverdueSupplierInvoiceImpl instance) =>
    <String, dynamic>{
      'invoiceId': instance.invoiceId,
      'invoiceNumber': instance.invoiceNumber,
      'invoiceDate': instance.invoiceDate,
      'dueDate': instance.dueDate,
      'grandTotal': instance.grandTotal,
      'paidAmount': instance.paidAmount,
      'outstanding': instance.outstanding,
      'daysOverdue': instance.daysOverdue,
    };

_$PaymentAgingBucketsImpl _$$PaymentAgingBucketsImplFromJson(
        Map<String, dynamic> json) =>
    _$PaymentAgingBucketsImpl(
      current: json['current'] as String,
      days1To30: json['days1To30'] as String,
      days31To60: json['days31To60'] as String,
      days61To90: json['days61To90'] as String,
      overdue90Plus: json['overdue90Plus'] as String,
    );

Map<String, dynamic> _$$PaymentAgingBucketsImplToJson(
        _$PaymentAgingBucketsImpl instance) =>
    <String, dynamic>{
      'current': instance.current,
      'days1To30': instance.days1To30,
      'days31To60': instance.days31To60,
      'days61To90': instance.days61To90,
      'overdue90Plus': instance.overdue90Plus,
    };

_$SupplierPaymentAgingImpl _$$SupplierPaymentAgingImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierPaymentAgingImpl(
      totalOutstanding: json['totalOutstanding'] as String,
      aging:
          PaymentAgingBuckets.fromJson(json['aging'] as Map<String, dynamic>),
      overdueInvoices: (json['overdueInvoices'] as List<dynamic>?)
              ?.map((e) =>
                  OverdueSupplierInvoice.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      invoiceCount: (json['invoiceCount'] as num).toInt(),
      overdueCount: (json['overdueCount'] as num).toInt(),
    );

Map<String, dynamic> _$$SupplierPaymentAgingImplToJson(
        _$SupplierPaymentAgingImpl instance) =>
    <String, dynamic>{
      'totalOutstanding': instance.totalOutstanding,
      'aging': instance.aging,
      'overdueInvoices': instance.overdueInvoices,
      'invoiceCount': instance.invoiceCount,
      'overdueCount': instance.overdueCount,
    };

_$TopReturnedProductImpl _$$TopReturnedProductImplFromJson(
        Map<String, dynamic> json) =>
    _$TopReturnedProductImpl(
      productId: json['productId'] as String,
      productName: json['productName'] as String,
      sku: json['sku'] as String?,
      returnedQuantity: (json['returnedQuantity'] as num).toInt(),
      returnedAmount: json['returnedAmount'] as String,
      returnCount: (json['returnCount'] as num).toInt(),
    );

Map<String, dynamic> _$$TopReturnedProductImplToJson(
        _$TopReturnedProductImpl instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'productName': instance.productName,
      'sku': instance.sku,
      'returnedQuantity': instance.returnedQuantity,
      'returnedAmount': instance.returnedAmount,
      'returnCount': instance.returnCount,
    };

_$SupplierReturnSummaryImpl _$$SupplierReturnSummaryImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierReturnSummaryImpl(
      dateFrom: json['dateFrom'] as String,
      dateTo: json['dateTo'] as String,
      totalReturnedAmount: json['totalReturnedAmount'] as String,
      totalReturnedQuantity: (json['totalReturnedQuantity'] as num).toInt(),
      returnCount: (json['returnCount'] as num).toInt(),
      totalPurchaseSpend: json['totalPurchaseSpend'] as String,
      totalPurchasedQuantity: (json['totalPurchasedQuantity'] as num).toInt(),
      amountReturnRate: (json['amountReturnRate'] as num).toDouble(),
      quantityReturnRate: (json['quantityReturnRate'] as num).toDouble(),
      topReturnedProducts: (json['topReturnedProducts'] as List<dynamic>?)
              ?.map(
                  (e) => TopReturnedProduct.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$$SupplierReturnSummaryImplToJson(
        _$SupplierReturnSummaryImpl instance) =>
    <String, dynamic>{
      'dateFrom': instance.dateFrom,
      'dateTo': instance.dateTo,
      'totalReturnedAmount': instance.totalReturnedAmount,
      'totalReturnedQuantity': instance.totalReturnedQuantity,
      'returnCount': instance.returnCount,
      'totalPurchaseSpend': instance.totalPurchaseSpend,
      'totalPurchasedQuantity': instance.totalPurchasedQuantity,
      'amountReturnRate': instance.amountReturnRate,
      'quantityReturnRate': instance.quantityReturnRate,
      'topReturnedProducts': instance.topReturnedProducts,
    };
