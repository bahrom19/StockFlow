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

export class CreatePurchaseOrderItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Quantity ordered' })
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

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'Supplier ID' })
  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  @ApiProperty({
    description: 'Order number (auto-generated if not provided)',
    required: false,
  })
  @IsOptional()
  @IsString()
  orderNumber?: string;

  @ApiProperty({ description: 'Order date', required: false })
  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @ApiProperty({ description: 'Expected delivery date', required: false })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiProperty({
    description: 'Status',
    enum: [
      'DRAFT',
      'PENDING',
      'APPROVED',
      'ORDERED',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'CANCELLED',
    ],
    default: 'DRAFT',
  })
  @IsOptional()
  @IsEnum([
    'DRAFT',
    'PENDING',
    'APPROVED',
    'ORDERED',
    'PARTIALLY_RECEIVED',
    'RECEIVED',
    'CANCELLED',
  ])
  status?: string;

  @ApiPropertyOptional({ enum: Currency, default: 'KZT', description: 'Currency for this purchase order' })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Purchase order items',
    type: [CreatePurchaseOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items!: CreatePurchaseOrderItemDto[];
}
