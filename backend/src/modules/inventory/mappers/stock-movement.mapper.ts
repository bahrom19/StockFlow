import { StockMovement } from '@prisma/client';
import { StockMovementEntity } from '../entities/stock-movement.entity';

export class StockMovementMapper {
  static toEntity(model: StockMovement): StockMovementEntity {
    return {
      id: model.id,
      companyId: model.companyId,
      productId: model.productId,
      warehouseId: model.warehouseId,
      type: model.type,
      quantity: model.quantity,
      beforeQuantity: model.beforeQuantity,
      afterQuantity: model.afterQuantity,
      referenceType: model.referenceType,
      referenceId: model.referenceId,
      comment: model.comment,
      createdBy: model.createdBy,
      createdAt: model.createdAt,
    };
  }

  static toEntityList(models: StockMovement[]): StockMovementEntity[] {
    return models.map(StockMovementMapper.toEntity);
  }
}
