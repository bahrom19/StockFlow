import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StockStatus } from '@prisma/client';

export class BatchEntity {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty() batchNumber!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() availableQuantity!: number;
  @ApiProperty() unitCost!: string;
  @ApiPropertyOptional() manufactureDate!: Date | null;
  @ApiPropertyOptional() expiryDate!: Date | null;
  @ApiProperty() receivedDate!: Date;
  @ApiProperty({ enum: StockStatus }) status!: StockStatus;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() rowVersion!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
