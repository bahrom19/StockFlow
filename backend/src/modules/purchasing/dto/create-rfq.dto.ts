import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateRFQItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ description: 'Quantity' })
  @IsNumber()
  @Min(1)
  quantity!: number;

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateRFQDto {
  @ApiProperty({
    description: 'RFQ number (auto-generated if empty)',
    required: false,
  })
  @IsOptional()
  @IsString()
  rfqNumber?: string;

  @ApiProperty({ description: 'RFQ date', required: false })
  @IsOptional()
  @IsDateString()
  rfqDate?: string;

  @ApiProperty({ description: 'Expected response date', required: false })
  @IsOptional()
  @IsDateString()
  expectedDate?: string;

  @ApiProperty({
    description: 'Status',
    enum: ['DRAFT', 'SENT', 'RECEIVED', 'CLOSED', 'CANCELLED'],
    default: 'DRAFT',
  })
  @IsOptional()
  @IsEnum(['DRAFT', 'SENT', 'RECEIVED', 'CLOSED', 'CANCELLED'])
  status?: string;

  @ApiProperty({ description: 'Notes', required: false })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ description: 'RFQ items', type: [CreateRFQItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRFQItemDto)
  items!: CreateRFQItemDto[];
}
