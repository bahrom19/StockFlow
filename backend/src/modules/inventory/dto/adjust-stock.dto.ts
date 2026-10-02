import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdjustStockDto {
  @ApiProperty() @IsString() @IsNotEmpty() productId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() warehouseId!: string;
  @ApiProperty({ example: 10 }) @Type(() => Number) @IsInt() quantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() referenceType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() referenceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() comment?: string;
  // G16-N-3 P2-B-2: durable business-operation identity. Client-generated
  // UUID minted once per logical operation; retried attempts reuse it, and
  // the @@unique([companyId, clientOperationId, type]) constraint on
  // StockMovement rejects a second execution permanently (independent of the
  // 24h IdempotencyRecord TTL). Optional so old clients keep working.
  @ApiPropertyOptional() @IsOptional() @IsString() clientOperationId?: string;
}
