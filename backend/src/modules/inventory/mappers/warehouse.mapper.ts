import { Warehouse } from '@prisma/client';
import { WarehouseEntity } from '../entities/warehouse.entity';

export class WarehouseMapper {
  static toEntity(model: Warehouse): WarehouseEntity {
    return {
      id: model.id,
      companyId: model.companyId,
      name: model.name,
      code: model.code,
      address: model.address,
      phone: model.phone,
      managerName: model.managerName,
      isDefault: model.isDefault,
      isActive: model.isActive,
      rowVersion: (model as Record<string, any>).rowVersion ?? 0,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      deletedAt: model.deletedAt,
    };
  }

  static toEntityList(models: Warehouse[]): WarehouseEntity[] {
    return models.map(WarehouseMapper.toEntity);
  }
}
