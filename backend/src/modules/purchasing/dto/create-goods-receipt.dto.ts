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

export class CreateGoodsReceiptItemDto {
  @ApiProperty({ description: 'Purchase order item ID' })
  @IsString()
  @IsNotEmpty()
  purchaseOrderItemId!: string;

  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Quantity received' })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Unit cost per item' })
  @IsNumber()
  @Min(0)
  unitCost!: number;

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateGoodsReceiptDto {
  @ApiProperty({ description: 'Purchase order ID' })
  @IsString()
  @IsNotEmpty()
  purchaseOrderId!: string;

  @ApiProperty({
    description: 'Receipt number (auto-generated if not provided)',
    required: false,
  })
  @IsOptional()
  @IsString()
  receiptNumber?: string;

  @ApiProperty({ description: 'Receipt date', required: false })
  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  @ApiProperty({ description: 'Warehouse ID' })
  @IsString()
  @IsNotEmpty()
  warehouseId!: string;

  @ApiProperty({
    description: 'Status',
    enum: ['DRAFT', 'COMPLETED', 'CANCELLED'],
    default: 'DRAFT',
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'COMPLETED', 'CANCELLED'])
  status?: string;

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Goods receipt items',
    type: [CreateGoodsReceiptItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptItemDto)
  items!: CreateGoodsReceiptItemDto[];
}
