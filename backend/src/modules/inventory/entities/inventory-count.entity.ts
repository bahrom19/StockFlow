import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryCountStatus } from '@prisma/client';

export class InventoryCountEntity {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() warehouseId!: string;
  @ApiProperty() countNumber!: string;
  @ApiProperty({ enum: InventoryCountStatus }) status!: InventoryCountStatus;
  @ApiPropertyOptional() countedBy!: string | null;
  @ApiPropertyOptional() approvedBy!: string | null;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() rowVersion!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional({ type: () => InventoryCountItemEntity, isArray: true })
  items?: InventoryCountItemEntity[];
}

export class InventoryCountItemEntity {
  @ApiProperty() id!: string;
  @ApiProperty() inventoryCountId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() expectedQuantity!: number;
  @ApiProperty() actualQuantity!: number;
  @ApiProperty() difference!: number;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() rowVersion!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
