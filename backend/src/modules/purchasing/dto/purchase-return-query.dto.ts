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

export class PurchaseReturnQueryDto {
  @ApiProperty({
    description: 'Search by return number or supplier name',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ description: 'Filter by supplier ID', required: false })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiProperty({ description: 'Filter by warehouse ID', required: false })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiProperty({
    description: 'Filter by status',
    enum: ['DRAFT', 'APPROVED', 'COMPLETED', 'CANCELLED'],
    required: false,
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'APPROVED', 'COMPLETED', 'CANCELLED'])
  status?: string;

  @ApiProperty({ description: 'Filter by return date from', required: false })
  @IsOptional()
  @IsDateString()
  returnDateFrom?: string;

  @ApiProperty({ description: 'Filter by return date to', required: false })
  @IsOptional()
  @IsDateString()
  returnDateTo?: string;

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
