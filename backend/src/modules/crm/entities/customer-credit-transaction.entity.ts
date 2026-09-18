import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** G11-F2 — ledger fact for spendable customer credit. Amounts are always
 * positive strings; the direction carries the sign. Decimal crosses the API
 * boundary as a string (project convention). */
export class CustomerCreditTransactionEntity {
  constructor(partial: Partial<CustomerCreditTransactionEntity> = {}) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty({ enum: ['ISSUED', 'SPENT', 'ADJUSTED'] })
  direction!: 'ISSUED' | 'SPENT' | 'ADJUSTED';

  @ApiProperty()
  amount!: string;

  @ApiProperty({ default: 'KZT' })
  currency!: string;

  @ApiProperty({ enum: ['REFUND_ALLOCATION', 'SALE_PAYMENT', 'MANUAL_ADJUSTMENT'] })
  referenceType!: 'REFUND_ALLOCATION' | 'SALE_PAYMENT' | 'MANUAL_ADJUSTMENT';

  @ApiProperty()
  referenceId!: string;

  @ApiProperty()
  createdBy!: string;

  @ApiPropertyOptional({ nullable: true })
  reason?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  deletedAt?: Date | null;
}

/** Spendable credit balance for one currency — pure ledger aggregation. */
export class CustomerCreditBalanceEntity {
  @ApiProperty()
  customerId!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ description: 'ISSUED − SPENT − ADJUSTED, Decimal(18,4) as string' })
  balance!: string;

  @ApiProperty()
  issuedTotal!: string;

  @ApiProperty()
  spentTotal!: string;

  @ApiProperty()
  adjustedTotal!: string;
}
