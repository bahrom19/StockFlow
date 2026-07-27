import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { CustomerType } from '@prisma/client';

export class CustomerQueryDto {
  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: CustomerType.PERSON })
  @IsOptional()
  @IsString()
  @IsIn(['PERSON', 'COMPANY'])
  type?: CustomerType;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 'createdAt' })
  @IsOptional()
  @IsString()
  @IsIn([
    'createdAt',
    'updatedAt',
    'firstName',
    'lastName',
    'companyName',
    'email',
  ])
  sortBy?:
    | 'createdAt'
    | 'updatedAt'
    | 'firstName'
    | 'lastName'
    | 'companyName'
    | 'email';

  @ApiPropertyOptional({ example: 'desc' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
