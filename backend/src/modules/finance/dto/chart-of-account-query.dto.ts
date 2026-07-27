import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ChartOfAccountQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
  accountType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

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
  @IsIn(['createdAt', 'updatedAt', 'code', 'name', 'accountType', 'level'])
  sortBy?: string;

  @ApiPropertyOptional({ example: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: string;
}
