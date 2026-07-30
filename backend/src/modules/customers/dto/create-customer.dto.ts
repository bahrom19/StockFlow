import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { CustomerType } from '@prisma/client';

export class CreateCustomerDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiProperty({ enum: CustomerType, example: CustomerType.PERSON })
  @IsEnum(CustomerType)
  type!: CustomerType;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ example: '010203040506' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  iin?: string;

  @ApiPropertyOptional({ example: '123456789012' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bin?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '+77001234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '+77009876543' })
  @IsOptional()
  @IsString()
  mobile?: string;

  @ApiPropertyOptional({ example: '10.0000' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discount?: number | string;

  @ApiPropertyOptional({ example: '10000.0000' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  creditLimit?: number | string;

  @ApiPropertyOptional({ example: '500.0000' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  currentDebt?: number | string;

  @ApiPropertyOptional({ example: 125 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  bonusPoints?: number;

  @ApiPropertyOptional({ example: 'Preferred client' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
