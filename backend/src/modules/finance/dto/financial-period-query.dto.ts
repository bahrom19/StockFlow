import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FinancialPeriodQueryDto {
  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  year?: number;

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  month?: number;

  @ApiPropertyOptional({ enum: ['OPEN', 'CLOSING', 'CLOSED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 'createdAt' })
  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'year', 'startDate', 'endDate', 'status'])
  sortBy?: string;

  @ApiPropertyOptional({ example: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: string;
}
