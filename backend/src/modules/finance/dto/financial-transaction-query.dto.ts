import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class FinancialTransactionQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  direction?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cashAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isReconciled?: boolean;

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
  @IsIn(['createdAt', 'updatedAt', 'transactionDate', 'type', 'amount'])
  sortBy?: string;

  @ApiPropertyOptional({ example: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: string;
}
