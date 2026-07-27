import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';

export class StockMovementEntity {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() warehouseId!: string;
  @ApiProperty({ enum: StockMovementType }) type!: StockMovementType;
  @ApiProperty() quantity!: number;
  @ApiProperty() beforeQuantity!: number;
  @ApiProperty() afterQuantity!: number;
  @ApiPropertyOptional() referenceType!: string | null;
  @ApiPropertyOptional() referenceId!: string | null;
  @ApiPropertyOptional() comment!: string | null;
  @ApiPropertyOptional() createdBy!: string | null;
  @ApiProperty() createdAt!: Date;
}
