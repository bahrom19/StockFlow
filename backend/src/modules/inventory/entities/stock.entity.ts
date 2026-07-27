import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WarehouseEntity } from './warehouse.entity';

export class StockEntity {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() warehouseId!: string;
  @ApiProperty() productName!: string;
  @ApiProperty() productSku!: string;
  @ApiProperty({ example: 100 }) quantity!: number;
  @ApiProperty({ example: 10 }) reservedQuantity!: number;
  @ApiProperty({ example: 90 }) availableQuantity!: number;
  @ApiProperty({ example: 5 }) minQuantity!: number;
  @ApiProperty({ example: 200 }) maxQuantity!: number;
  @ApiProperty() rowVersion!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;

  @ApiPropertyOptional({ type: WarehouseEntity })
  warehouse?: WarehouseEntity;
}
