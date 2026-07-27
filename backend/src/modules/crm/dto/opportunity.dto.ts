import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsUUID,
  Min,
  Max,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOpportunityDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 'NEW' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ default: 'MEDIUM' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiProperty({ default: '0' })
  @IsString()
  value!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  probability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateOpportunityDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  probability?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedCloseDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class OpportunityQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  @Type(() => String)
  customerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

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
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ default: 'asc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}
