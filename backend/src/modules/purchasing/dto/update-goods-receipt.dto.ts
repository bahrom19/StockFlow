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

export class UpdateGoodsReceiptItemDto {
  @ApiProperty({ description: 'Purchase order item ID', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  purchaseOrderItemId?: string;

  @ApiProperty({ description: 'Product ID', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productId?: string;

  @ApiProperty({ description: 'Quantity received', required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  quantity?: number;

  @ApiProperty({ description: 'Unit cost per item', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateGoodsReceiptDto {
  @ApiProperty({ description: 'Receipt date', required: false })
  @IsOptional()
  @IsDateString()
  receiptDate?: string;

  @ApiProperty({ description: 'Warehouse ID', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  warehouseId?: string;

  @ApiProperty({
    description: 'Status',
    enum: ['DRAFT', 'COMPLETED', 'CANCELLED'],
    required: false,
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
    required: false,
    type: [UpdateGoodsReceiptItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateGoodsReceiptItemDto)
  items?: UpdateGoodsReceiptItemDto[];
}
