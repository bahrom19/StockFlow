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

export class UpdatePurchaseReturnItemDto {
  @ApiProperty({ description: 'Product ID', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productId?: string;

  @ApiProperty({ description: 'Quantity returned', required: false })
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

export class UpdatePurchaseReturnDto {
  @ApiProperty({ description: 'Return date', required: false })
  @IsOptional()
  @IsDateString()
  returnDate?: string;

  @ApiProperty({ description: 'Warehouse ID', required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  warehouseId?: string;

  @ApiProperty({
    description: 'Status',
    enum: ['DRAFT', 'APPROVED', 'COMPLETED', 'CANCELLED'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'APPROVED', 'COMPLETED', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional({ enum: Currency, description: 'Currency (only changeable while DRAFT)' })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Purchase return items',
    required: false,
    type: [UpdatePurchaseReturnItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseReturnItemDto)
  items?: UpdatePurchaseReturnItemDto[];
}
