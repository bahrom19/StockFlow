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

export class PurchaseInvoiceQueryDto {
  @ApiPropertyOptional({ description: 'Search by invoice number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by purchase order ID' })
  @IsOptional()
  @IsString()
  purchaseOrderId?: string;

  @ApiPropertyOptional({ description: 'Filter by supplier ID' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsEnum(['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by date from' })
  @IsOptional()
  @IsDateString()
  invoiceDateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by date to' })
  @IsOptional()
  @IsDateString()
  invoiceDateTo?: string;

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

  @ApiPropertyOptional({ description: 'Sort order', default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
