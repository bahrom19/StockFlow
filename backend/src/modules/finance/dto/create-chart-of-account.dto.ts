import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateChartOfAccountDto {
  @ApiProperty({ example: '1010' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Cash' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
  accountType!: string;

  @ApiProperty({ enum: ['DEBIT', 'CREDIT'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['DEBIT', 'CREDIT'])
  normalBalance!: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isCashOrBank?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  level?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
