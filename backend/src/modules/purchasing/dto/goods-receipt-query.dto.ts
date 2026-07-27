import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GoodsReceiptQueryDto {
  @ApiProperty({ description: 'Search by receipt number', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: 'Filter by purchase order ID', required: false })
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @ApiProperty({ description: 'Filter by warehouse ID', required: false })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiProperty({
    description: 'Filter by status',
    enum: ['DRAFT', 'COMPLETED', 'CANCELLED'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'COMPLETED', 'CANCELLED'])
  status?: string;

  @ApiProperty({ description: 'Filter by receipt date from', required: false })
  @IsOptional()
  @IsDateString()
  receiptDateFrom?: string;

  @ApiProperty({ description: 'Filter by receipt date to', required: false })
  @IsOptional()
  @IsDateString()
  receiptDateTo?: string;

  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiProperty({ description: 'Items per page', required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiProperty({
    description: 'Sort by field',
    required: false,
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiProperty({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    required: false,
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
