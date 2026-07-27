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
}
