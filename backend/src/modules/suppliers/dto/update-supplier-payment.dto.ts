import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Only notes and reference can be updated directly.
 * Accounting-relevant fields (amount, date, invoice, method, account)
 * require void (DELETE) + create (POST).
 */
export class UpdateSupplierPaymentDto {
  @ApiProperty({ example: 0, description: 'Current payment rowVersion for optimistic locking (G3-4)' })
  @IsInt()
  @Min(0)
  rowVersion!: number;

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
