import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCashAccountDto {
  @ApiProperty({ example: 'Main Register' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: ['PETTY_CASH', 'MAIN_CASH', 'REGISTER', 'SAFE'] })
  @IsOptional()
  @IsString()
  @IsIn(['PETTY_CASH', 'MAIN_CASH', 'REGISTER', 'SAFE'])
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chartOfAccountId?: string;
}
