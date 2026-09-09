import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Currency } from '@prisma/client';

export class UpdateCompanyCurrencyDto {
  @ApiProperty({
    enum: Currency,
    example: 'USD',
    description: 'New company currency',
  })
  @IsEnum(Currency)
  currency!: Currency;
}
