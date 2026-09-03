import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Currency } from '@prisma/client';

export class CreateSupplierProductDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsNotEmpty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional({ example: 'SUP-SKU-001' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  supplierSku?: string;

  @ApiPropertyOptional({ example: '1500.0000' })
  @IsOptional()
  @Min(0.0001)
  purchasePrice?: number;

  @ApiPropertyOptional({ enum: Currency, default: Currency.KZT })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isPreferred?: boolean;

  @ApiPropertyOptional({ example: 'Main bread supplier' })
  @IsOptional()
  @IsString()
  notes?: string;
}
