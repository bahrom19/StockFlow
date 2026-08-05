import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SaleQueryDto {
  @ApiPropertyOptional({ description: 'Search by sale number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by warehouse ID' })
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional({ description: 'Filter by cashier ID' })
  @IsOptional()
  @IsString()
  cashierId?: string;

  @ApiPropertyOptional({ description: 'Filter by customer ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: [
      'DRAFT',
      'PENDING',
      'COMPLETED',
      'REFUNDED',
      'CANCELLED',
      'PARTIALLY_REFUNDED',
    ],
  })
  @IsOptional()
  @IsEnum([
    'DRAFT',
    'PENDING',
    'COMPLETED',
    'REFUNDED',
    'CANCELLED',
    'PARTIALLY_REFUNDED',
  ])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment method',
    enum: [
      'CASH',
      'CARD',
      'QR',
      'BANK_TRANSFER',
      'MOBILE_WALLET',
      'GIFT_CARD',
      'STORE_CREDIT',
    ],
  })
  @IsOptional()
  @IsEnum([
    'CASH',
    'CARD',
    'QR',
    'BANK_TRANSFER',
    'MOBILE_WALLET',
    'GIFT_CARD',
    'STORE_CREDIT',
  ])
  paymentMethod?: string;

  @ApiPropertyOptional({ description: 'Filter by date from' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by date to' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Sort by field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Include items', default: false })
  @IsOptional()
  @Type(() => Boolean)
  includeItems?: boolean;
}
