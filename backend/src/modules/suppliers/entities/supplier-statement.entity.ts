import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '@prisma/client';

export type SupplierStatementEntryType = 'INVOICE' | 'PAYMENT' | 'RETURN';

export class SupplierStatementAllocationDetailEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  purchaseInvoiceId!: string;

  @ApiProperty({ example: '60000.0000' })
  allocatedAmount!: string;
}

export class SupplierStatementEntryEntity {
  @ApiProperty({ enum: ['INVOICE', 'PAYMENT', 'RETURN'] })
  entryType!: SupplierStatementEntryType;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  date!: string;

  @ApiProperty({ example: 'INV-00042' })
  reference!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  sourceEntityId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  supplierId!: string;

  @ApiProperty({ enum: Currency, example: Currency.KZT })
  currency!: Currency;

  @ApiProperty({ example: '100000.0000' })
  debit!: string;

  @ApiProperty({ example: '0.0000' })
  credit!: string;

  @ApiProperty({ example: '100000.0000' })
  amount!: string;

  @ApiProperty({ example: '100000.0000' })
  runningBalance!: string;

  @ApiProperty({ example: 'APPROVED' })
  status!: string;

  @ApiPropertyOptional({ type: [SupplierStatementAllocationDetailEntity] })
  allocations?: SupplierStatementAllocationDetailEntity[];

  @ApiPropertyOptional({ example: '60000.0000' })
  allocatedAmount?: string;

  @ApiPropertyOptional({ example: '40000.0000' })
  unallocatedAmount?: string;
}

export class SupplierStatementTotalsEntity {
  @ApiProperty({ example: '100000.0000' })
  debit!: string;

  @ApiProperty({ example: '60000.0000' })
  credit!: string;

  @ApiProperty({ example: '40000.0000' })
  net!: string;
}

export class SupplierStatementCurrencyGroupEntity {
  @ApiProperty({ enum: Currency, example: Currency.KZT })
  currency!: Currency;

  @ApiProperty({ example: '0.0000' })
  openingBalance!: string;

  @ApiProperty({ type: [SupplierStatementEntryEntity] })
  entries!: SupplierStatementEntryEntity[];

  @ApiProperty({ example: '40000.0000' })
  closingBalance!: string;

  @ApiProperty({ type: SupplierStatementTotalsEntity })
  totals!: SupplierStatementTotalsEntity;
}

/**
 * Operational Supplier AP Statement (subledger).
 *
 * Semantics (AP increase = debit, AP decrease = credit):
 *   INVOICE → debit (AP increase), amount = grandTotal
 *   PAYMENT → credit (AP decrease), amount = payment.amount (full amount)
 *   RETURN  → credit (AP decrease), amount = grandTotal
 *
 * runningBalance = openingBalance + Σ debit − Σ credit, per currency.
 * The statement is strictly per-currency — currencies are never summed.
 */
export class SupplierStatementEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  supplierId!: string;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-30T00:00:00.000Z' })
  dateTo?: string;

  @ApiProperty({ type: [SupplierStatementCurrencyGroupEntity] })
  currencies!: SupplierStatementCurrencyGroupEntity[];

  // Convenience single-currency projection (present when a currency filter is supplied).
  @ApiPropertyOptional({ enum: Currency })
  currency?: Currency;

  @ApiPropertyOptional({ example: '0.0000' })
  openingBalance?: string;

  @ApiPropertyOptional({ type: [SupplierStatementEntryEntity] })
  entries?: SupplierStatementEntryEntity[];

  @ApiPropertyOptional({ example: '40000.0000' })
  closingBalance?: string;

  @ApiPropertyOptional({ type: SupplierStatementTotalsEntity })
  totals?: SupplierStatementTotalsEntity;
}
