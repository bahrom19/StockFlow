import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class JournalEntryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  financialPeriodId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;

  @ApiPropertyOptional({ enum: ['DRAFT', 'POSTED', 'REVERSED'] })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

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
  @IsIn(['createdAt', 'updatedAt', 'entryDate', 'entryNumber', 'status'])
  sortBy?: string;

  @ApiPropertyOptional({ example: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: string;
}
