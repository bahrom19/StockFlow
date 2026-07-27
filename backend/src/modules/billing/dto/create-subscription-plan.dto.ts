import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'starter' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Starter' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'For small businesses' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 29.99 })
  @IsNumber()
  @Min(0)
  priceMonthly!: number;

  @ApiProperty({ example: 290.00 })
  @IsNumber()
  @Min(0)
  priceYearly!: number;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 14 })
  @IsOptional()
  @IsInt()
  @Min(0)
  trialDays?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxWarehouses?: number;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxProducts?: number;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  featureFlags?: Record<string, unknown>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
