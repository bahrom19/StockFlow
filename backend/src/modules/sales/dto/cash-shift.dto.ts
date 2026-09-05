import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Currency } from '@prisma/client';

export class OpenShiftDto {
  @ApiProperty({ description: 'Warehouse ID' })
  @IsString()
  warehouseId!: string;

  @ApiProperty({ description: 'Opening balance' })
  @IsNumber()
  @Min(0)
  openingBalance!: number;

  @ApiPropertyOptional({ enum: Currency, default: 'KZT', description: 'Currency for this shift' })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CloseShiftDto {
  @ApiPropertyOptional({
    description: 'Actual closing balance (if different from calculated)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  actualClosingBalance?: number;

  @ApiPropertyOptional({ description: 'Notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CashInOutDto {
  @ApiProperty({ description: 'Amount' })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ description: 'Reason' })
  @IsOptional()
  @IsString()
  reason?: string;
}
