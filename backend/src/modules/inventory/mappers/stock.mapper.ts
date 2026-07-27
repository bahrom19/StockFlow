import { Stock } from '@prisma/client';
import { StockEntity } from '../entities/stock.entity';

export class StockMapper {
  static toEntity(model: any): StockEntity {
    return {
      id: model.id,
      companyId: model.companyId,
      productId: model.productId,
      warehouseId: model.warehouseId,
      productName: model.product?.name ?? '',
      productSku: model.product?.sku ?? '',
      quantity: model.quantity,
      reservedQuantity: model.reservedQuantity,
      availableQuantity: model.availableQuantity,
      minQuantity: model.minQuantity,
      maxQuantity: model.maxQuantity,
      rowVersion: model.rowVersion ?? 0,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      warehouse: model.warehouse
        ? {
            id: model.warehouse.id,
            companyId: model.warehouse.companyId,
            name: model.warehouse.name,
            code: model.warehouse.code,
            address: model.warehouse.address,
            phone: model.warehouse.phone,
            managerName: model.warehouse.managerName,
            isDefault: model.warehouse.isDefault,
            isActive: model.warehouse.isActive,
            rowVersion: model.warehouse.rowVersion ?? 0,
            createdAt: model.warehouse.createdAt,
            updatedAt: model.warehouse.updatedAt,
            deletedAt: model.warehouse.deletedAt,
          }
        : undefined,
    };
  }

  static toEntityList(models: any[]): StockEntity[] {
    return models.map(StockMapper.toEntity);
  }
}
