import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateSupplierDto {
  /**
   * Optional for backward compatibility: the tenant is always derived from
   * the authenticated JWT. If provided, it must match the JWT companyId
   * (enforced in SuppliersService.create).
   */
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Company ID (optional - derived from JWT when omitted)',
  })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiProperty({ example: 'Acme Supplies' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName!: string;

  @ApiPropertyOptional({ example: '123456789012' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  bin?: string;

  @ApiPropertyOptional({ example: 'supplier@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '+77001234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'https://acme.example.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ example: 'Preferred supplier' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
