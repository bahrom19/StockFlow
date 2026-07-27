import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CountItemDto {
  @ApiProperty() @IsString() @IsNotEmpty() productId!: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) expectedQuantity!: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) actualQuantity!: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreateInventoryCountDto {
  @ApiProperty() @IsString() @IsNotEmpty() warehouseId!: string;
  @ApiProperty() @IsString() @IsNotEmpty() countNumber!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [CountItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CountItemDto)
  items!: CountItemDto[];
}

export class CompleteInventoryCountDto {
  @ApiProperty() @IsNotEmpty() rowVersion!: number;
}
