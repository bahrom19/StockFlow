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
}
