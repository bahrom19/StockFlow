import { ApiProperty } from '@nestjs/swagger';
import { Currency } from '@prisma/client';

export class CompanyCurrencyResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiProperty({ enum: Currency, example: 'KZT' })
  currency!: Currency;

  @ApiProperty({ example: 'StockFlow Ltd' })
  companyName!: string;
}
