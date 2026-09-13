import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

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

  /**
   * G9-C: default payment term (in whole days) used ONLY when creating a
   * NEW PurchaseInvoice without an explicit dueDate
   * (dueDate = invoiceDate + defaultDueDays). Never applied retroactively.
   */
  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultDueDays?: number;

  /**
   * G9-C: maximum outstanding AP exposure. Data-only in G9-C v1 —
   * stored and returned, but not enforced anywhere.
   */
  @ApiPropertyOptional({ example: '1000000.0000' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditLimit?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
