import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SubscriptionQueryDto {
  @ApiPropertyOptional({ description: 'Filter by status' })
  @IsOptional()
  @IsEnum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED', 'FREE'])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by plan code' })
  @IsOptional()
  @IsString()
  planCode?: string;

  @ApiPropertyOptional({ description: 'Filter expired before date' })
  @IsOptional()
  @IsDateString()
  expiresBefore?: string;

  @ApiPropertyOptional({ description: 'Filter expired after date' })
  @IsOptional()
  @IsDateString()
  expiresAfter?: string;

  @ApiPropertyOptional({ description: 'Filter by active status', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Sort by field', default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';
}
