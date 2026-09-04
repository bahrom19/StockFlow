import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OverdueInvoiceEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  invoiceId!: string;

  @ApiProperty({ example: 'INV-00042' })
  invoiceNumber!: string;

  @ApiProperty({ example: '2026-06-15T00:00:00.000Z' })
  invoiceDate!: string;

  @ApiPropertyOptional({ example: '2026-07-15T00:00:00.000Z' })
  dueDate!: string | null;

  @ApiProperty({ example: '500000.0000' })
  grandTotal!: string;

  @ApiProperty({ example: '0.0000' })
  paidAmount!: string;

  @ApiProperty({ example: '500000.0000' })
  outstanding!: string;

  @ApiProperty({ example: 51 })
  daysOverdue!: number;
}

export class PaymentAgingBucketsEntity {
  @ApiProperty({ example: '1200000.0000' })
  current!: string;

  @ApiProperty({ example: '800000.0000' })
  days1_30!: string;

  @ApiProperty({ example: '350000.0000' })
  days31_60!: string;

  @ApiProperty({ example: '100000.0000' })
  days61_90!: string;

  @ApiProperty({ example: '50000.0000' })
  overdue90plus!: string;
}

export class SupplierPaymentAgingEntity {
  @ApiProperty({ example: '2500000.0000' })
  totalOutstanding!: string;

  @ApiProperty({ type: PaymentAgingBucketsEntity })
  aging!: PaymentAgingBucketsEntity;

  @ApiProperty({ type: [OverdueInvoiceEntity] })
  overdueInvoices!: OverdueInvoiceEntity[];

  @ApiProperty({ example: 8 })
  invoiceCount!: number;

  @ApiProperty({ example: 3 })
  overdueCount!: number;
}
