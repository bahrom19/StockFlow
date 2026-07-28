// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'purchasing_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$PurchaseOrderImpl _$$PurchaseOrderImplFromJson(Map<String, dynamic> json) =>
    _$PurchaseOrderImpl(
      id: json['id'] as String,
      companyId: json['companyId'] as String,
      supplierId: json['supplierId'] as String,
      orderNumber: json['orderNumber'] as String,
      orderDate: DateTime.parse(json['orderDate'] as String),
      expectedDate: json['expectedDate'] == null
          ? null
          : DateTime.parse(json['expectedDate'] as String),
      status: json['status'] as String,
      subtotal: json['subtotal'] as String,
      discountAmount: json['discountAmount'] as String,
      taxAmount: json['taxAmount'] as String,
      grandTotal: json['grandTotal'] as String,
      paidAmount: json['paidAmount'] as String,
      notes: json['notes'] as String?,
      approvedBy: json['approvedBy'] as String?,
      approvedAt: json['approvedAt'] == null
          ? null
          : DateTime.parse(json['approvedAt'] as String),
      cancelledBy: json['cancelledBy'] as String?,
      cancelledAt: json['cancelledAt'] == null
          ? null
          : DateTime.parse(json['cancelledAt'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      deletedAt: json['deletedAt'] == null
          ? null
          : DateTime.parse(json['deletedAt'] as String),
      items: (json['items'] as List<dynamic>?)
              ?.map(
                  (e) => PurchaseOrderItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$$PurchaseOrderImplToJson(_$PurchaseOrderImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'companyId': instance.companyId,
      'supplierId': instance.supplierId,
      'orderNumber': instance.orderNumber,
      'orderDate': instance.orderDate.toIso8601String(),
      'expectedDate': instance.expectedDate?.toIso8601String(),
      'status': instance.status,
      'subtotal': instance.subtotal,
      'discountAmount': instance.discountAmount,
      'taxAmount': instance.taxAmount,
      'grandTotal': instance.grandTotal,
      'paidAmount': instance.paidAmount,
      'notes': instance.notes,
      'approvedBy': instance.approvedBy,
      'approvedAt': instance.approvedAt?.toIso8601String(),
      'cancelledBy': instance.cancelledBy,
      'cancelledAt': instance.cancelledAt?.toIso8601String(),
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
      'deletedAt': instance.deletedAt?.toIso8601String(),
      'items': instance.items,
    };

_$PurchaseOrderItemImpl _$$PurchaseOrderItemImplFromJson(
        Map<String, dynamic> json) =>
    _$PurchaseOrderItemImpl(
      id: json['id'] as String,
      purchaseOrderId: json['purchaseOrderId'] as String,
      productId: json['productId'] as String,
      quantity: (json['quantity'] as num).toInt(),
      receivedQuantity: (json['receivedQuantity'] as num?)?.toInt() ?? 0,
      unitCost: json['unitCost'] as String,
      discountPercent: json['discountPercent'] as String?,
      discountAmount: json['discountAmount'] as String,
      taxPercent: json['taxPercent'] as String?,
      taxAmount: json['taxAmount'] as String,
      subtotal: json['subtotal'] as String,
      total: json['total'] as String,
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$$PurchaseOrderItemImplToJson(
        _$PurchaseOrderItemImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'purchaseOrderId': instance.purchaseOrderId,
      'productId': instance.productId,
      'quantity': instance.quantity,
      'receivedQuantity': instance.receivedQuantity,
      'unitCost': instance.unitCost,
      'discountPercent': instance.discountPercent,
      'discountAmount': instance.discountAmount,
      'taxPercent': instance.taxPercent,
      'taxAmount': instance.taxAmount,
      'subtotal': instance.subtotal,
      'total': instance.total,
      'notes': instance.notes,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

_$PurchaseOrderListResponseImpl _$$PurchaseOrderListResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$PurchaseOrderListResponseImpl(
      items: (json['items'] as List<dynamic>)
          .map((e) => PurchaseOrder.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
    );

Map<String, dynamic> _$$PurchaseOrderListResponseImplToJson(
        _$PurchaseOrderListResponseImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'total': instance.total,
      'page': instance.page,
      'limit': instance.limit,
    };

_$CreatePurchaseOrderRequestImpl _$$CreatePurchaseOrderRequestImplFromJson(
        Map<String, dynamic> json) =>
    _$CreatePurchaseOrderRequestImpl(
      supplierId: json['supplierId'] as String,
      orderNumber: json['orderNumber'] as String?,
      orderDate: json['orderDate'] as String?,
      expectedDate: json['expectedDate'] as String?,
      notes: json['notes'] as String?,
      items: (json['items'] as List<dynamic>)
          .map((e) =>
              CreatePurchaseOrderItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$$CreatePurchaseOrderRequestImplToJson(
        _$CreatePurchaseOrderRequestImpl instance) =>
    <String, dynamic>{
      'supplierId': instance.supplierId,
      'orderNumber': instance.orderNumber,
      'orderDate': instance.orderDate,
      'expectedDate': instance.expectedDate,
      'notes': instance.notes,
      'items': instance.items,
    };

_$CreatePurchaseOrderItemImpl _$$CreatePurchaseOrderItemImplFromJson(
        Map<String, dynamic> json) =>
    _$CreatePurchaseOrderItemImpl(
      productId: json['productId'] as String,
      quantity: (json['quantity'] as num).toInt(),
      unitCost: (json['unitCost'] as num).toDouble(),
      discountPercent: (json['discountPercent'] as num?)?.toDouble() ?? 0,
      taxPercent: (json['taxPercent'] as num?)?.toDouble() ?? 0,
      notes: json['notes'] as String?,
    );

Map<String, dynamic> _$$CreatePurchaseOrderItemImplToJson(
        _$CreatePurchaseOrderItemImpl instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'quantity': instance.quantity,
      'unitCost': instance.unitCost,
      'discountPercent': instance.discountPercent,
      'taxPercent': instance.taxPercent,
      'notes': instance.notes,
    };

_$GoodsReceiptImpl _$$GoodsReceiptImplFromJson(Map<String, dynamic> json) =>
    _$GoodsReceiptImpl(
      id: json['id'] as String,
      companyId: json['companyId'] as String,
      purchaseOrderId: json['purchaseOrderId'] as String,
      receiptNumber: json['receiptNumber'] as String,
      receiptDate: DateTime.parse(json['receiptDate'] as String),
      warehouseId: json['warehouseId'] as String,
      status: json['status'] as String,
      notes: json['notes'] as String?,
      receivedBy: json['receivedBy'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      deletedAt: json['deletedAt'] == null
          ? null
          : DateTime.parse(json['deletedAt'] as String),
      items: (json['items'] as List<dynamic>?)
              ?.map((e) => GoodsReceiptItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$$GoodsReceiptImplToJson(_$GoodsReceiptImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'companyId': instance.companyId,
      'purchaseOrderId': instance.purchaseOrderId,
      'receiptNumber': instance.receiptNumber,
      'receiptDate': instance.receiptDate.toIso8601String(),
      'warehouseId': instance.warehouseId,
      'status': instance.status,
      'notes': instance.notes,
      'receivedBy': instance.receivedBy,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
      'deletedAt': instance.deletedAt?.toIso8601String(),
      'items': instance.items,
    };

_$GoodsReceiptItemImpl _$$GoodsReceiptItemImplFromJson(
        Map<String, dynamic> json) =>
    _$GoodsReceiptItemImpl(
      id: json['id'] as String,
      goodsReceiptId: json['goodsReceiptId'] as String,
      purchaseOrderItemId: json['purchaseOrderItemId'] as String,
      productId: json['productId'] as String,
      quantity: (json['quantity'] as num).toInt(),
      unitCost: json['unitCost'] as String,
      subtotal: json['subtotal'] as String,
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$$GoodsReceiptItemImplToJson(
        _$GoodsReceiptItemImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'goodsReceiptId': instance.goodsReceiptId,
      'purchaseOrderItemId': instance.purchaseOrderItemId,
      'productId': instance.productId,
      'quantity': instance.quantity,
      'unitCost': instance.unitCost,
      'subtotal': instance.subtotal,
      'notes': instance.notes,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

_$CreateGoodsReceiptRequestImpl _$$CreateGoodsReceiptRequestImplFromJson(
        Map<String, dynamic> json) =>
    _$CreateGoodsReceiptRequestImpl(
      purchaseOrderId: json['purchaseOrderId'] as String,
      warehouseId: json['warehouseId'] as String,
      notes: json['notes'] as String?,
      items: (json['items'] as List<dynamic>)
          .map(
              (e) => CreateGoodsReceiptItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$$CreateGoodsReceiptRequestImplToJson(
        _$CreateGoodsReceiptRequestImpl instance) =>
    <String, dynamic>{
      'purchaseOrderId': instance.purchaseOrderId,
      'warehouseId': instance.warehouseId,
      'notes': instance.notes,
      'items': instance.items,
    };

_$CreateGoodsReceiptItemImpl _$$CreateGoodsReceiptItemImplFromJson(
        Map<String, dynamic> json) =>
    _$CreateGoodsReceiptItemImpl(
      purchaseOrderItemId: json['purchaseOrderItemId'] as String,
      productId: json['productId'] as String,
      quantity: (json['quantity'] as num).toInt(),
      unitCost: (json['unitCost'] as num).toDouble(),
      notes: json['notes'] as String?,
    );

Map<String, dynamic> _$$CreateGoodsReceiptItemImplToJson(
        _$CreateGoodsReceiptItemImpl instance) =>
    <String, dynamic>{
      'purchaseOrderItemId': instance.purchaseOrderItemId,
      'productId': instance.productId,
      'quantity': instance.quantity,
      'unitCost': instance.unitCost,
      'notes': instance.notes,
    };

_$PurchaseReturnImpl _$$PurchaseReturnImplFromJson(Map<String, dynamic> json) =>
    _$PurchaseReturnImpl(
      id: json['id'] as String,
      companyId: json['companyId'] as String,
      supplierId: json['supplierId'] as String,
      returnNumber: json['returnNumber'] as String,
      returnDate: DateTime.parse(json['returnDate'] as String),
      warehouseId: json['warehouseId'] as String,
      status: json['status'] as String,
      subtotal: json['subtotal'] as String,
      discountAmount: json['discountAmount'] as String,
      taxAmount: json['taxAmount'] as String,
      grandTotal: json['grandTotal'] as String,
      notes: json['notes'] as String?,
      approvedBy: json['approvedBy'] as String?,
      approvedAt: json['approvedAt'] == null
          ? null
          : DateTime.parse(json['approvedAt'] as String),
      cancelledBy: json['cancelledBy'] as String?,
      cancelledAt: json['cancelledAt'] == null
          ? null
          : DateTime.parse(json['cancelledAt'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
      deletedAt: json['deletedAt'] == null
          ? null
          : DateTime.parse(json['deletedAt'] as String),
      items: (json['items'] as List<dynamic>?)
              ?.map(
                  (e) => PurchaseReturnItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$$PurchaseReturnImplToJson(
        _$PurchaseReturnImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'companyId': instance.companyId,
      'supplierId': instance.supplierId,
      'returnNumber': instance.returnNumber,
      'returnDate': instance.returnDate.toIso8601String(),
      'warehouseId': instance.warehouseId,
      'status': instance.status,
      'subtotal': instance.subtotal,
      'discountAmount': instance.discountAmount,
      'taxAmount': instance.taxAmount,
      'grandTotal': instance.grandTotal,
      'notes': instance.notes,
      'approvedBy': instance.approvedBy,
      'approvedAt': instance.approvedAt?.toIso8601String(),
      'cancelledBy': instance.cancelledBy,
      'cancelledAt': instance.cancelledAt?.toIso8601String(),
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
      'deletedAt': instance.deletedAt?.toIso8601String(),
      'items': instance.items,
    };

_$PurchaseReturnItemImpl _$$PurchaseReturnItemImplFromJson(
        Map<String, dynamic> json) =>
    _$PurchaseReturnItemImpl(
      id: json['id'] as String,
      purchaseReturnId: json['purchaseReturnId'] as String,
      productId: json['productId'] as String,
      quantity: (json['quantity'] as num).toInt(),
      unitCost: json['unitCost'] as String,
      discountPercent: json['discountPercent'] as String?,
      discountAmount: json['discountAmount'] as String,
      taxPercent: json['taxPercent'] as String?,
      taxAmount: json['taxAmount'] as String,
      subtotal: json['subtotal'] as String,
      total: json['total'] as String,
      notes: json['notes'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );

Map<String, dynamic> _$$PurchaseReturnItemImplToJson(
        _$PurchaseReturnItemImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'purchaseReturnId': instance.purchaseReturnId,
      'productId': instance.productId,
      'quantity': instance.quantity,
      'unitCost': instance.unitCost,
      'discountPercent': instance.discountPercent,
      'discountAmount': instance.discountAmount,
      'taxPercent': instance.taxPercent,
      'taxAmount': instance.taxAmount,
      'subtotal': instance.subtotal,
      'total': instance.total,
      'notes': instance.notes,
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
    };

_$PurchaseReturnListResponseImpl _$$PurchaseReturnListResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$PurchaseReturnListResponseImpl(
      items: (json['items'] as List<dynamic>)
          .map((e) => PurchaseReturn.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
      page: (json['page'] as num).toInt(),
      limit: (json['limit'] as num).toInt(),
    );

Map<String, dynamic> _$$PurchaseReturnListResponseImplToJson(
        _$PurchaseReturnListResponseImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'total': instance.total,
      'page': instance.page,
      'limit': instance.limit,
    };
