import { InventoryCount, InventoryCountItem } from '@prisma/client';
import {
  InventoryCountEntity,
  InventoryCountItemEntity,
} from '../entities/inventory-count.entity';

export class InventoryCountMapper {
  static toEntity(model: any): InventoryCountEntity {
    return {
      id: model.id,
      companyId: model.companyId,
      warehouseId: model.warehouseId,
      countNumber: model.countNumber,
      status: model.status,
      countedBy: model.countedBy,
      approvedBy: model.approvedBy,
      notes: model.notes,
      rowVersion: model.rowVersion ?? 0,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      items: model.items?.map(InventoryCountMapper.toItemEntity) ?? [],
    };
  }

  static toItemEntity(model: InventoryCountItem): InventoryCountItemEntity {
    return {
      id: model.id,
      inventoryCountId: model.inventoryCountId,
      productId: model.productId,
      expectedQuantity: model.expectedQuantity,
      actualQuantity: model.actualQuantity,
      difference: model.difference,
      notes: model.notes,
      rowVersion: (model as Record<string, any>).rowVersion ?? 0,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  static toEntityList(models: any[]): InventoryCountEntity[] {
    return models.map(InventoryCountMapper.toEntity);
  }
}
