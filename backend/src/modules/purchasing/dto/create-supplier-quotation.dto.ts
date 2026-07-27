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

export class CreateSupplierQuotationItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

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

export class CreateSupplierQuotationDto {
  @ApiProperty({ description: 'RFQ ID' })
  @IsString()
  @IsNotEmpty()
  rfqId!: string;

  @ApiProperty({ description: 'Supplier ID' })
  @IsString()
  @IsNotEmpty()
  supplierId!: string;

  @ApiProperty({
    description: 'Quotation number (auto-generated if empty)',
    required: false,
  })
  @IsOptional()
  @IsString()
  quotationNumber?: string;

  @ApiProperty({ description: 'Quotation date', required: false })
  @IsOptional()
  @IsDateString()
  quotationDate?: string;

  @ApiProperty({ description: 'Valid until date', required: false })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({
    description: 'Status',
    enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'],
    default: 'DRAFT',
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'])
  status?: string;

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    description: 'Quotation items',
    type: [CreateSupplierQuotationItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSupplierQuotationItemDto)
  items!: CreateSupplierQuotationItemDto[];
}
