import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateWarehouseDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MinLength(1) name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() code!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() managerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateWarehouseDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() code?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() managerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiProperty() @IsNotEmpty() rowVersion!: number;
}
