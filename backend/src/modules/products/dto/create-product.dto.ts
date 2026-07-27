import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsNotEmpty()
  companyId!: string;

  @ApiProperty({ example: 'Wireless Mouse' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({ example: 'Ergonomic wireless mouse' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'SKU-1001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string;

  @ApiPropertyOptional({ example: '1234567890123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @ApiProperty({ example: 49.99 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  price!: number | string;

  @ApiPropertyOptional({ example: 35.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  costPrice?: number | string;

  @ApiPropertyOptional({ example: 'pcs' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({ example: 'Electronics' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional({ example: 'Logitech' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @ApiProperty({ example: 25 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockQuantity!: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
