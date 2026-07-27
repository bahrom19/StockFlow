import { ApiProperty } from '@nestjs/swagger';
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
import { Type } from 'class-transformer';

export class UpdatePurchaseOrderItemDto {
  @ApiProperty({ description: 'Product ID', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productId?: string;

  @ApiProperty({ description: 'Quantity ordered', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiProperty({ description: 'Unit cost per item', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

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

export class UpdatePurchaseOrderDto {
  @ApiProperty({ description: 'Supplier ID', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  supplierId?: string;

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
    required: false,
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

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Purchase order items',
    required: false,
    type: [UpdatePurchaseOrderItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseOrderItemDto)
  items?: UpdatePurchaseOrderItemDto[];
}
