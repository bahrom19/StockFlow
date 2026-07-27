import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePurchaseInvoiceItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Purchase order item ID', required: false })
  @IsOptional()
  @IsString()
  purchaseOrderItemId?: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Unit cost' })
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

export class CreatePurchaseInvoiceDto {
  @ApiProperty({ description: 'Purchase Order ID' })
  @IsString()
  @IsNotEmpty()
  purchaseOrderId!: string;

  @ApiProperty({ description: 'Supplier ID' })
  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  @ApiProperty({
    description: 'Invoice number (auto-generated if empty)',
    required: false,
  })
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @ApiProperty({ description: 'Invoice date', required: false })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string;

  @ApiProperty({ description: 'Due date', required: false })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiProperty({
    description: 'Status',
    enum: ['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'],
    default: 'DRAFT',
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'])
  status?: string;

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Invoice items',
    type: [CreatePurchaseInvoiceItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseInvoiceItemDto)
  items!: CreatePurchaseInvoiceItemDto[];
}
