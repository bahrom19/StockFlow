// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'report_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$TopProductsResponseImpl _$$TopProductsResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$TopProductsResponseImpl(
      items: (json['items'] as List<dynamic>)
          .map((e) => TopProductItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
    );

Map<String, dynamic> _$$TopProductsResponseImplToJson(
        _$TopProductsResponseImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'total': instance.total,
    };

_$TopProductItemImpl _$$TopProductItemImplFromJson(Map<String, dynamic> json) =>
    _$TopProductItemImpl(
      productId: json['productId'] as String,
      productName: json['productName'] as String,
      sku: json['sku'] as String? ?? '',
      quantitySold: (json['quantitySold'] as num?)?.toInt() ?? 0,
      revenue: json['revenue'] as String,
      profit: json['profit'] as String,
      margin: json['margin'] as String,
    );

Map<String, dynamic> _$$TopProductItemImplToJson(
        _$TopProductItemImpl instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'productName': instance.productName,
      'sku': instance.sku,
      'quantitySold': instance.quantitySold,
      'revenue': instance.revenue,
      'profit': instance.profit,
      'margin': instance.margin,
    };

_$InventoryValuationResponseImpl _$$InventoryValuationResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$InventoryValuationResponseImpl(
      items: (json['items'] as List<dynamic>)
          .map(
              (e) => InventoryValuationItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      totalValue: json['totalValue'] as String,
      total: (json['total'] as num).toInt(),
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
    );

Map<String, dynamic> _$$InventoryValuationResponseImplToJson(
        _$InventoryValuationResponseImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'totalValue': instance.totalValue,
      'total': instance.total,
      'page': instance.page,
      'limit': instance.limit,
    };

_$InventoryValuationItemImpl _$$InventoryValuationItemImplFromJson(
        Map<String, dynamic> json) =>
    _$InventoryValuationItemImpl(
      productId: json['productId'] as String,
      productName: json['productName'] as String,
      sku: json['sku'] as String? ?? '',
      quantity: (json['quantity'] as num).toInt(),
      averageCost: json['averageCost'] as String,
      inventoryValue: json['inventoryValue'] as String,
    );

Map<String, dynamic> _$$InventoryValuationItemImplToJson(
        _$InventoryValuationItemImpl instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'productName': instance.productName,
      'sku': instance.sku,
      'quantity': instance.quantity,
      'averageCost': instance.averageCost,
      'inventoryValue': instance.inventoryValue,
    };

_$CustomerReportResponseImpl _$$CustomerReportResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$CustomerReportResponseImpl(
      items: (json['items'] as List<dynamic>)
          .map((e) => CustomerReportItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
    );

Map<String, dynamic> _$$CustomerReportResponseImplToJson(
        _$CustomerReportResponseImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'total': instance.total,
      'page': instance.page,
      'limit': instance.limit,
    };

_$CustomerReportItemImpl _$$CustomerReportItemImplFromJson(
        Map<String, dynamic> json) =>
    _$CustomerReportItemImpl(
      customerId: json['customerId'] as String,
      name: json['name'] as String,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      orders: (json['orders'] as num?)?.toInt() ?? 0,
      revenue: json['revenue'] as String? ?? '0.0000',
      averageReceipt: json['averageReceipt'] as String? ?? '0.0000',
      lastPurchase: json['lastPurchase'] as String?,
    );

Map<String, dynamic> _$$CustomerReportItemImplToJson(
        _$CustomerReportItemImpl instance) =>
    <String, dynamic>{
      'customerId': instance.customerId,
      'name': instance.name,
      'email': instance.email,
      'phone': instance.phone,
      'orders': instance.orders,
      'revenue': instance.revenue,
      'averageReceipt': instance.averageReceipt,
      'lastPurchase': instance.lastPurchase,
    };

_$SupplierReportResponseImpl _$$SupplierReportResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierReportResponseImpl(
      items: (json['items'] as List<dynamic>)
          .map((e) => SupplierReportItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
    );

Map<String, dynamic> _$$SupplierReportResponseImplToJson(
        _$SupplierReportResponseImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'total': instance.total,
      'page': instance.page,
      'limit': instance.limit,
    };

_$SupplierReportItemImpl _$$SupplierReportItemImplFromJson(
        Map<String, dynamic> json) =>
    _$SupplierReportItemImpl(
      supplierId: json['supplierId'] as String,
      companyName: json['companyName'] as String? ?? '',
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      purchaseOrders: (json['purchaseOrders'] as num?)?.toInt() ?? 0,
      purchaseTotal: json['purchaseTotal'] as String? ?? '0.0000',
      lastPurchase: json['lastPurchase'] as String?,
    );

Map<String, dynamic> _$$SupplierReportItemImplToJson(
        _$SupplierReportItemImpl instance) =>
    <String, dynamic>{
      'supplierId': instance.supplierId,
      'companyName': instance.companyName,
      'email': instance.email,
      'phone': instance.phone,
      'purchaseOrders': instance.purchaseOrders,
      'purchaseTotal': instance.purchaseTotal,
      'lastPurchase': instance.lastPurchase,
    };

_$CashShiftReportResponseImpl _$$CashShiftReportResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$CashShiftReportResponseImpl(
      items: (json['items'] as List<dynamic>)
          .map((e) => CashShiftReportItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
    );

Map<String, dynamic> _$$CashShiftReportResponseImplToJson(
        _$CashShiftReportResponseImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'total': instance.total,
      'page': instance.page,
      'limit': instance.limit,
    };

_$CashShiftReportItemImpl _$$CashShiftReportItemImplFromJson(
        Map<String, dynamic> json) =>
    _$CashShiftReportItemImpl(
      id: json['id'] as String,
      status: json['status'] as String,
      openedAt: json['openedAt'] as String,
      closedAt: json['closedAt'] as String?,
      warehouseName: json['warehouseName'] as String? ?? '',
      cashierName: json['cashierName'] as String? ?? '',
      openingBalance: json['openingBalance'] as String,
      closingBalance: json['closingBalance'] as String,
      cashSales: json['cashSales'] as String? ?? '0.0000',
      cardSales: json['cardSales'] as String? ?? '0.0000',
      qrSales: json['qrSales'] as String? ?? '0.0000',
      bankTransferSales: json['bankTransferSales'] as String? ?? '0.0000',
      mobileWalletSales: json['mobileWalletSales'] as String? ?? '0.0000',
      totalSales: json['totalSales'] as String? ?? '0.0000',
      cashIn: json['cashIn'] as String? ?? '0.0000',
      cashOut: json['cashOut'] as String? ?? '0.0000',
      expectedClosing: json['expectedClosing'] as String? ?? '0.0000',
      difference: json['difference'] as String? ?? '0.0000',
      notes: json['notes'] as String?,
    );

Map<String, dynamic> _$$CashShiftReportItemImplToJson(
        _$CashShiftReportItemImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': instance.status,
      'openedAt': instance.openedAt,
      'closedAt': instance.closedAt,
      'warehouseName': instance.warehouseName,
      'cashierName': instance.cashierName,
      'openingBalance': instance.openingBalance,
      'closingBalance': instance.closingBalance,
      'cashSales': instance.cashSales,
      'cardSales': instance.cardSales,
      'qrSales': instance.qrSales,
      'bankTransferSales': instance.bankTransferSales,
      'mobileWalletSales': instance.mobileWalletSales,
      'totalSales': instance.totalSales,
      'cashIn': instance.cashIn,
      'cashOut': instance.cashOut,
      'expectedClosing': instance.expectedClosing,
      'difference': instance.difference,
      'notes': instance.notes,
    };
