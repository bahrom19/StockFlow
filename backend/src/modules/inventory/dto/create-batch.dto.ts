import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBatchDto {
  @ApiProperty() @IsString() @IsNotEmpty() productId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() batchNumber!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) quantity!: number;
  @ApiProperty() unitCost!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() manufactureDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}
