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

export class SupplierQuotationQueryDto {
  @ApiPropertyOptional({ description: 'Search by quotation number' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by RFQ ID' })
  @IsOptional()
  @IsString()
  rfqId?: string;

  @ApiPropertyOptional({ description: 'Filter by supplier ID' })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsEnum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'])
  status?: string;

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

  @ApiPropertyOptional({ description: 'Sort order', default: 'desc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
