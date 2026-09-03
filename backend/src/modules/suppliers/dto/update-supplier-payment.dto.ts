import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Only notes and reference can be updated directly.
 * Accounting-relevant fields (amount, date, invoice, method, account)
 * require void (DELETE) + create (POST).
 */
export class UpdateSupplierPaymentDto {
  @ApiPropertyOptional({ example: 'REF-001' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reference?: string;

  @ApiPropertyOptional({ example: 'Monthly payment' })
  @IsOptional()
  @IsString()
  notes?: string;
}
