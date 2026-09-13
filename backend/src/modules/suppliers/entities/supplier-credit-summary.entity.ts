import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * G9-D1: Supplier Credit Summary (read-only, observability only).
 *
 * All monetary values are in the COMPANY BASE CURRENCY. Non-base-currency
 * invoices/returns are excluded from the utilization math (no FX conversion).
 *
 * All values are DERIVED from the canonical AP model at read time — nothing
 * here is persisted. `creditLimit` is the only persisted value (Supplier
 * column, introduced in G9-C).
 */
export class SupplierCreditSummaryEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  supplierId!: string;

  /**
   * Configured credit limit in company base currency.
   * null = credit limit is not configured (NOT the same as 0).
   */
  @ApiPropertyOptional({ example: '1000000', nullable: true })
  creditLimit!: string | null;

  /**
   * Canonical supplier AP outstanding in company base currency:
   * Σ approved/paid invoice grandTotal
   * − Σ active payment-allocation amounts
   * − Σ approved/completed return grandTotal
   */
  @ApiProperty({ example: '250000' })
  outstandingAP!: string;

  /**
   * creditLimit − outstandingAP. null when no credit limit is configured.
   * May be negative when the supplier is over its limit — that is not an
   * error and does not block anything (G9-D1 is read-only).
   */
  @ApiPropertyOptional({ example: '750000', nullable: true })
  availableCredit!: string | null;

  /**
   * (outstandingAP / creditLimit) * 100, rounded to 2 decimals via Decimal
   * arithmetic. null when no credit limit is configured or the configured
   * limit is 0 (percentage is mathematically undefined — never divide by
   * zero).
   */
  @ApiPropertyOptional({ example: '25.00', nullable: true })
  utilizationPercent!: string | null;

  /** Company base currency — the only currency used in this summary. */
  @ApiProperty({ example: 'KZT' })
  currency!: string;
}