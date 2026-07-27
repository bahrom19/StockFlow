import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'products:create' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  code!: string;

  @ApiProperty({ example: 'Create Products' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    example: 'Allows creating new products in the catalog',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 'products' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  module!: string;
}
