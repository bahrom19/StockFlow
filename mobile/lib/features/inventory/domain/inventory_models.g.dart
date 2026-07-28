// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'inventory_models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WarehouseImpl _$$WarehouseImplFromJson(Map<String, dynamic> json) =>
    _$WarehouseImpl(
      id: json['id'] as String,
      companyId: json['companyId'] as String,
      name: json['name'] as String,
      code: json['code'] as String,
      address: json['address'] as String?,
      phone: json['phone'] as String?,
      managerName: json['managerName'] as String?,
      isDefault: json['isDefault'] as bool? ?? false,
      isActive: json['isActive'] as bool? ?? true,
      rowVersion: (json['rowVersion'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
      deletedAt: json['deletedAt'] as String?,
    );

Map<String, dynamic> _$$WarehouseImplToJson(_$WarehouseImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'companyId': instance.companyId,
      'name': instance.name,
      'code': instance.code,
      'address': instance.address,
      'phone': instance.phone,
      'managerName': instance.managerName,
      'isDefault': instance.isDefault,
      'isActive': instance.isActive,
      'rowVersion': instance.rowVersion,
      'createdAt': instance.createdAt,
      'updatedAt': instance.updatedAt,
      'deletedAt': instance.deletedAt,
    };

_$StockItemImpl _$$StockItemImplFromJson(Map<String, dynamic> json) =>
    _$StockItemImpl(
      id: json['id'] as String,
      companyId: json['companyId'] as String,
      productId: json['productId'] as String,
      warehouseId: json['warehouseId'] as String,
      productName: json['productName'] as String? ?? '',
      productSku: json['productSku'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 0,
      reservedQuantity: (json['reservedQuantity'] as num?)?.toInt() ?? 0,
      availableQuantity: (json['availableQuantity'] as num?)?.toInt() ?? 0,
      minQuantity: (json['minQuantity'] as num?)?.toInt() ?? 5,
      maxQuantity: (json['maxQuantity'] as num?)?.toInt() ?? 200,
      rowVersion: (json['rowVersion'] as num?)?.toInt() ?? 0,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
      warehouse: json['warehouse'] == null
          ? null
          : Warehouse.fromJson(json['warehouse'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$StockItemImplToJson(_$StockItemImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'companyId': instance.companyId,
      'productId': instance.productId,
      'warehouseId': instance.warehouseId,
      'productName': instance.productName,
      'productSku': instance.productSku,
      'quantity': instance.quantity,
      'reservedQuantity': instance.reservedQuantity,
      'availableQuantity': instance.availableQuantity,
      'minQuantity': instance.minQuantity,
      'maxQuantity': instance.maxQuantity,
      'rowVersion': instance.rowVersion,
      'createdAt': instance.createdAt,
      'updatedAt': instance.updatedAt,
      'warehouse': instance.warehouse,
    };

_$StockListResponseImpl _$$StockListResponseImplFromJson(
        Map<String, dynamic> json) =>
    _$StockListResponseImpl(
      items: (json['items'] as List<dynamic>)
          .map((e) => StockItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      total: (json['total'] as num).toInt(),
    );

Map<String, dynamic> _$$StockListResponseImplToJson(
        _$StockListResponseImpl instance) =>
    <String, dynamic>{
      'items': instance.items,
      'total': instance.total,
    };

_$StockMovementImpl _$$StockMovementImplFromJson(Map<String, dynamic> json) =>
    _$StockMovementImpl(
      id: json['id'] as String,
      companyId: json['companyId'] as String,
      productId: json['productId'] as String,
      warehouseId: json['warehouseId'] as String,
      type: json['type'] as String,
      quantity: (json['quantity'] as num).toInt(),
      beforeQuantity: (json['beforeQuantity'] as num).toInt(),
      afterQuantity: (json['afterQuantity'] as num).toInt(),
      referenceType: json['referenceType'] as String?,
      referenceId: json['referenceId'] as String?,
      comment: json['comment'] as String?,
      createdBy: json['createdBy'] as String?,
      createdAt: json['createdAt'] as String,
    );

Map<String, dynamic> _$$StockMovementImplToJson(_$StockMovementImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'companyId': instance.companyId,
      'productId': instance.productId,
      'warehouseId': instance.warehouseId,
      'type': instance.type,
      'quantity': instance.quantity,
      'beforeQuantity': instance.beforeQuantity,
      'afterQuantity': instance.afterQuantity,
      'referenceType': instance.referenceType,
      'referenceId': instance.referenceId,
      'comment': instance.comment,
      'createdBy': instance.createdBy,
      'createdAt': instance.createdAt,
    };

_$AdjustStockDtoImpl _$$AdjustStockDtoImplFromJson(Map<String, dynamic> json) =>
    _$AdjustStockDtoImpl(
      productId: json['productId'] as String,
      warehouseId: json['warehouseId'] as String,
      quantity: (json['quantity'] as num).toInt(),
      reason: json['reason'] as String?,
      referenceType: json['referenceType'] as String?,
      referenceId: json['referenceId'] as String?,
      comment: json['comment'] as String?,
    );

Map<String, dynamic> _$$AdjustStockDtoImplToJson(
        _$AdjustStockDtoImpl instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'warehouseId': instance.warehouseId,
      'quantity': instance.quantity,
      'reason': instance.reason,
      'referenceType': instance.referenceType,
      'referenceId': instance.referenceId,
      'comment': instance.comment,
    };

_$TransferStockDtoImpl _$$TransferStockDtoImplFromJson(
        Map<String, dynamic> json) =>
    _$TransferStockDtoImpl(
      productId: json['productId'] as String,
      fromWarehouseId: json['fromWarehouseId'] as String,
      toWarehouseId: json['toWarehouseId'] as String,
      quantity: (json['quantity'] as num).toInt(),
      comment: json['comment'] as String?,
    );

Map<String, dynamic> _$$TransferStockDtoImplToJson(
        _$TransferStockDtoImpl instance) =>
    <String, dynamic>{
      'productId': instance.productId,
      'fromWarehouseId': instance.fromWarehouseId,
      'toWarehouseId': instance.toWarehouseId,
      'quantity': instance.quantity,
      'comment': instance.comment,
    };
