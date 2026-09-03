import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierFinanceSummaryEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  supplierId!: string;

  @ApiProperty({ example: '250000.0000' })
  totalInvoiced!: string;

  @ApiProperty({ example: '100000.0000' })
  totalPaid!: string;

  @ApiProperty({ example: '20000.0000' })
  totalReturned!: string;

  @ApiProperty({ example: '130000.0000' })
  outstanding!: string;

  @ApiProperty({ example: 5 })
  invoiceCount!: number;

  @ApiProperty({ example: 3 })
  paymentCount!: number;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  lastPaymentDate!: Date | null;

  @ApiPropertyOptional({ example: '50000.0000' })
  lastPaymentAmount!: string | null;
}
