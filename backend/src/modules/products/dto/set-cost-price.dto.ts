import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * G16-H-2 (B4): manual cost-price reconciliation for legacy unvalued stock.
 * Decimal(0) is a valid explicit zero-cost basis; negatives are rejected.
 */
export class SetCostPriceDto {
  @ApiProperty({
    example: 12.5,
    description:
      'Explicit cost basis for a currently unvalued product. Zero is allowed.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  costPrice!: number | string;

  @ApiProperty({
    example: 'Manual reconciliation of legacy unvalued stock (B4)',
    description: 'Free-text reason stored with the audit record.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason!: string;
}
