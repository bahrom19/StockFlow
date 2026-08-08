// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardSummaryImpl _$$DashboardSummaryImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardSummaryImpl(
      todaySales: DaySales.fromJson(json['todaySales'] as Map<String, dynamic>),
      yesterdaySales:
          DaySales.fromJson(json['yesterdaySales'] as Map<String, dynamic>),
      monthSales: DaySales.fromJson(json['monthSales'] as Map<String, dynamic>),
      ordersCount: (json['ordersCount'] as num).toInt(),
      grossRevenue: json['grossRevenue'] as String,
      grossProfit: json['grossProfit'] as String,
      inventoryValue: json['inventoryValue'] as String,
      lowStockProducts: (json['lowStockProducts'] as num).toInt(),
      outOfStockProducts: (json['outOfStockProducts'] as num).toInt(),
      customerCount: (json['customerCount'] as num).toInt(),
      supplierCount: (json['supplierCount'] as num).toInt(),
      purchaseTotal: json['purchaseTotal'] as String,
    );

Map<String, dynamic> _$$DashboardSummaryImplToJson(
        _$DashboardSummaryImpl instance) =>
    <String, dynamic>{
      'todaySales': instance.todaySales,
      'yesterdaySales': instance.yesterdaySales,
      'monthSales': instance.monthSales,
      'ordersCount': instance.ordersCount,
      'grossRevenue': instance.grossRevenue,
      'grossProfit': instance.grossProfit,
      'inventoryValue': instance.inventoryValue,
      'lowStockProducts': instance.lowStockProducts,
      'outOfStockProducts': instance.outOfStockProducts,
      'customerCount': instance.customerCount,
      'supplierCount': instance.supplierCount,
      'purchaseTotal': instance.purchaseTotal,
    };

_$DaySalesImpl _$$DaySalesImplFromJson(Map<String, dynamic> json) =>
    _$DaySalesImpl(
      revenue: json['revenue'] as String,
      count: (json['count'] as num).toInt(),
      averageReceipt: json['averageReceipt'] as String?,
    );

Map<String, dynamic> _$$DaySalesImplToJson(_$DaySalesImpl instance) =>
    <String, dynamic>{
      'revenue': instance.revenue,
      'count': instance.count,
      'averageReceipt': instance.averageReceipt,
    };

_$PurchasingSummaryImpl _$$PurchasingSummaryImplFromJson(
        Map<String, dynamic> json) =>
    _$PurchasingSummaryImpl(
      totalOrders: (json['totalOrders'] as num).toInt(),
      totalValue: json['totalValue'] as String,
      byStatus: (json['byStatus'] as Map<String, dynamic>?)?.map(
            (k, e) => MapEntry(k, (e as num).toInt()),
          ) ??
          const {},
    );

Map<String, dynamic> _$$PurchasingSummaryImplToJson(
        _$PurchasingSummaryImpl instance) =>
    <String, dynamic>{
      'totalOrders': instance.totalOrders,
      'totalValue': instance.totalValue,
      'byStatus': instance.byStatus,
    };

_$LowStockItemImpl _$$LowStockItemImplFromJson(Map<String, dynamic> json) =>
    _$LowStockItemImpl(
      productId: json['productId'] as String,
      productName: json['productName'] as String,
      sku: json['sku'] as String,
      currentStock: (json['currentStock'] as num).toInt(),
      minQuantity: (json['minQuantity'] as num).toInt(),
      warehouseId: json['warehouseId'] as String,
      warehouseName: json['warehouseName'] as String,
      status: json['status'] as String,
    );

Map<String, dynamic> _$$LowStockItemImplToJson(_$LowStockItemImpl instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'productName': instance.productName,
      'sku': instance.sku,
      'currentStock': instance.currentStock,
      'minQuantity': instance.minQuantity,
      'warehouseId': instance.warehouseId,
      'warehouseName': instance.warehouseName,
      'status': instance.status,
    };

_$RecentSaleImpl _$$RecentSaleImplFromJson(Map<String, dynamic> json) =>
    _$RecentSaleImpl(
      id: json['id'] as String,
      saleNumber: json['saleNumber'] as String,
      createdAt: json['createdAt'] as String,
      status: json['status'] as String,
      total: json['total'] as String,
      paidAmount: json['paidAmount'] as String,
    );

Map<String, dynamic> _$$RecentSaleImplToJson(_$RecentSaleImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'saleNumber': instance.saleNumber,
      'createdAt': instance.createdAt,
      'status': instance.status,
      'total': instance.total,
      'paidAmount': instance.paidAmount,
    };

_$SalesReportImpl _$$SalesReportImplFromJson(Map<String, dynamic> json) =>
    _$SalesReportImpl(
      sales: (json['sales'] as List<dynamic>)
          .map((e) => RecentSale.fromJson(e as Map<String, dynamic>))
          .toList(),
      summary: SalesSummary.fromJson(json['summary'] as Map<String, dynamic>),
      total: (json['total'] as num).toInt(),
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
    );

Map<String, dynamic> _$$SalesReportImplToJson(_$SalesReportImpl instance) =>
    <String, dynamic>{
      'sales': instance.sales,
      'summary': instance.summary,
      'total': instance.total,
      'page': instance.page,
      'limit': instance.limit,
    };

_$SalesSummaryImpl _$$SalesSummaryImplFromJson(Map<String, dynamic> json) =>
    _$SalesSummaryImpl(
      revenue: json['revenue'] as String,
      profit: json['profit'] as String,
      margin: json['margin'] as String,
      averageReceipt: json['averageReceipt'] as String,
      productsSold: (json['productsSold'] as num).toInt(),
      count: (json['count'] as num).toInt(),
      payments:
          PaymentBreakdown.fromJson(json['payments'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$SalesSummaryImplToJson(_$SalesSummaryImpl instance) =>
    <String, dynamic>{
      'revenue': instance.revenue,
      'profit': instance.profit,
      'margin': instance.margin,
      'averageReceipt': instance.averageReceipt,
      'productsSold': instance.productsSold,
      'count': instance.count,
      'payments': instance.payments,
    };

_$PaymentBreakdownImpl _$$PaymentBreakdownImplFromJson(
        Map<String, dynamic> json) =>
    _$PaymentBreakdownImpl(
      cash: json['cash'] as String,
      card: json['card'] as String,
      qr: json['qr'] as String,
      bankTransfer: json['bankTransfer'] as String? ?? '0.0000',
      mobileWallet: json['mobileWallet'] as String? ?? '0.0000',
      other: json['other'] as String? ?? '0.0000',
    );

Map<String, dynamic> _$$PaymentBreakdownImplToJson(
        _$PaymentBreakdownImpl instance) =>
    <String, dynamic>{
      'cash': instance.cash,
      'card': instance.card,
      'qr': instance.qr,
      'bankTransfer': instance.bankTransfer,
      'mobileWallet': instance.mobileWallet,
      'other': instance.other,
    };

_$ProfitReportImpl _$$ProfitReportImplFromJson(Map<String, dynamic> json) =>
    _$ProfitReportImpl(
      summary: ProfitSummary.fromJson(json['summary'] as Map<String, dynamic>),
      daily: (json['daily'] as List<dynamic>)
          .map((e) => DailyProfit.fromJson(e as Map<String, dynamic>))
          .toList(),
      weekly: (json['weekly'] as List<dynamic>)
          .map((e) => WeeklyProfit.fromJson(e as Map<String, dynamic>))
          .toList(),
      monthly: (json['monthly'] as List<dynamic>)
          .map((e) => MonthlyProfit.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$$ProfitReportImplToJson(_$ProfitReportImpl instance) =>
    <String, dynamic>{
      'summary': instance.summary,
      'daily': instance.daily,
      'weekly': instance.weekly,
      'monthly': instance.monthly,
    };

_$ProfitSummaryImpl _$$ProfitSummaryImplFromJson(Map<String, dynamic> json) =>
    _$ProfitSummaryImpl(
      revenue: json['revenue'] as String,
      cost: json['cost'] as String,
      profit: json['profit'] as String,
      margin: json['margin'] as String,
    );

Map<String, dynamic> _$$ProfitSummaryImplToJson(_$ProfitSummaryImpl instance) =>
    <String, dynamic>{
      'revenue': instance.revenue,
      'cost': instance.cost,
      'profit': instance.profit,
      'margin': instance.margin,
    };

_$DailyProfitImpl _$$DailyProfitImplFromJson(Map<String, dynamic> json) =>
    _$DailyProfitImpl(
      date: json['date'] as String,
      revenue: json['revenue'] as String,
      cost: json['cost'] as String,
      profit: json['profit'] as String,
      margin: json['margin'] as String,
    );

Map<String, dynamic> _$$DailyProfitImplToJson(_$DailyProfitImpl instance) =>
    <String, dynamic>{
      'date': instance.date,
      'revenue': instance.revenue,
      'cost': instance.cost,
      'profit': instance.profit,
      'margin': instance.margin,
    };

_$WeeklyProfitImpl _$$WeeklyProfitImplFromJson(Map<String, dynamic> json) =>
    _$WeeklyProfitImpl(
      week: json['week'] as String,
      revenue: json['revenue'] as String,
      cost: json['cost'] as String,
      profit: json['profit'] as String,
      margin: json['margin'] as String,
    );

Map<String, dynamic> _$$WeeklyProfitImplToJson(_$WeeklyProfitImpl instance) =>
    <String, dynamic>{
      'week': instance.week,
      'revenue': instance.revenue,
      'cost': instance.cost,
      'profit': instance.profit,
      'margin': instance.margin,
    };

_$MonthlyProfitImpl _$$MonthlyProfitImplFromJson(Map<String, dynamic> json) =>
    _$MonthlyProfitImpl(
      month: json['month'] as String,
      revenue: json['revenue'] as String,
      cost: json['cost'] as String,
      profit: json['profit'] as String,
      margin: json['margin'] as String,
    );

Map<String, dynamic> _$$MonthlyProfitImplToJson(_$MonthlyProfitImpl instance) =>
    <String, dynamic>{
      'month': instance.month,
      'revenue': instance.revenue,
      'cost': instance.cost,
      'profit': instance.profit,
      'margin': instance.margin,
    };
