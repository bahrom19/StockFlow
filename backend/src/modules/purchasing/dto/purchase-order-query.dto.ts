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

export class PurchaseOrderQueryDto {
  @ApiProperty({
    description: 'Search by order number or supplier name',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: 'Filter by supplier ID', required: false })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({
    description: 'Filter by status',
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

  @ApiProperty({ description: 'Filter by order date from', required: false })
  @IsOptional()
  @IsDateString()
  orderDateFrom?: string;

  @ApiProperty({ description: 'Filter by order date to', required: false })
  @IsOptional()
  @IsDateString()
  orderDateTo?: string;

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
