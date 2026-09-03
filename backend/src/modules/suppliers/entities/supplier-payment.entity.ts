import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency, PaymentMethod } from '@prisma/client';

export class SupplierPaymentEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  supplierId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  purchaseInvoiceId!: string;

  @ApiProperty({ example: 'PAY-000001' })
  paymentNumber!: string;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  paymentDate!: Date;

  @ApiProperty({ example: '50000.0000' })
  amount!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.CASH })
  method!: PaymentMethod;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  cashAccountId!: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  bankAccountId!: string | null;

  @ApiProperty({ enum: Currency, example: Currency.KZT })
  currency!: Currency;

  @ApiPropertyOptional({ example: 'REF-001' })
  reference!: string | null;

  @ApiPropertyOptional({ example: 'Monthly payment' })
  notes!: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  createdBy!: string | null;

  @ApiProperty({ example: 0 })
  rowVersion!: number;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ example: null })
  deletedAt!: Date | null;
}
