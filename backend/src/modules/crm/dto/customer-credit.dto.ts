import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * G11-F2 — manual credit adjustment. The API is sign-driven: a POSITIVE
 * amount creates an ISSUED top-up, a NEGATIVE amount creates an ADJUSTED
 * write-off. The row always persists a positive amount — the direction
 * carries the sign (locked design). Adjustment is LEDGER-ONLY in F2: no GL
 * journal is produced.
 */
export class CreateCreditAdjustmentDto {
  @ApiProperty({
    description:
      'Positive → ISSUED (top-up), negative → ADJUSTED (write-off). Never zero.',
    example: '-150.0000',
  })
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @ApiProperty({ enum: ['KZT', 'USD', 'EUR', 'RUB', 'CNY', 'AED', 'AUD', 'VND'] })
  @IsString()
  currency!: string;

  @ApiProperty({ minLength: 1, maxLength: 255 })
  @IsString()
  @Length(1, 255)
  reason!: string;
}

export class CustomerCreditTransactionQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: ['ISSUED', 'SPENT', 'ADJUSTED'] })
  @IsOptional()
  @IsEnum(['ISSUED', 'SPENT', 'ADJUSTED'])
  direction?: 'ISSUED' | 'SPENT' | 'ADJUSTED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
