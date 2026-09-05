import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsEnum,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Currency } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreatePurchaseReturnItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Quantity returned' })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Unit cost per item' })
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiProperty({ description: 'Discount percent', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @ApiProperty({ description: 'Tax percent', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  taxPercent?: number;

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePurchaseReturnDto {
  @ApiProperty({ description: 'Supplier ID' })
  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  @ApiProperty({
    description: 'Return number (auto-generated if not provided)',
    required: false,
  })
  @IsOptional()
  @IsString()
  returnNumber?: string;

  @ApiProperty({ description: 'Return date', required: false })
  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @ApiProperty({ description: 'Warehouse ID' })
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiProperty({
    description: 'Status',
    enum: ['DRAFT', 'APPROVED', 'COMPLETED', 'CANCELLED'],
    default: 'DRAFT',
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'APPROVED', 'COMPLETED', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional({ enum: Currency, default: 'KZT', description: 'Currency for this return' })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Purchase return items',
    type: [CreatePurchaseReturnItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseReturnItemDto)
  items!: CreatePurchaseReturnItemDto[];
}
