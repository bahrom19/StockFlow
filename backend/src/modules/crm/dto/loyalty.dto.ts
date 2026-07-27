import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EarnPointsDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  points!: number;

  @ApiProperty()
  @IsString()
  referenceType!: string;

  @ApiProperty()
  @IsString()
  referenceId!: string;
}

export class RedeemPointsDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  points!: number;

  @ApiProperty()
  @IsString()
  referenceType!: string;

  @ApiProperty()
  @IsString()
  referenceId!: string;
}

export class LoyaltyQueryDto {
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
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ default: 'asc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}
