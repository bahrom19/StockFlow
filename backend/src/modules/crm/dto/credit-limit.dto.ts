import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCreditLimitDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty()
  @IsString()
  amount!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;
}

export class UpdateCreditLimitDto {
  @ApiProperty()
  @IsString()
  amount!: string;
}

export class CreditLimitQueryDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ default: 'asc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}
