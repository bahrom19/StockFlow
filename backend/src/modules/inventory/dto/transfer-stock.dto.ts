import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TransferStockDto {
  @ApiProperty() @IsString() @IsNotEmpty() productId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() fromWarehouseId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() toWarehouseId!: string;
  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
  // G16-N-3 P2-B-2: durable business-operation identity — same contract as
  // AdjustStockDto. Both transfer legs (TRANSFER_OUT + TRANSFER_IN) carry the
  // SAME value; the composite unique includes movement type so the two legs
  // coexist while a retried leg collides.
  @ApiPropertyOptional() @IsOptional() @IsString() clientOperationId?: string;
}
