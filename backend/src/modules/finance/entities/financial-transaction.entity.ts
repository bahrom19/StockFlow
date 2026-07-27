import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FinancialTransactionEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiProperty({
    enum: [
      'CASH_IN',
      'CASH_OUT',
      'BANK_DEPOSIT',
      'BANK_WITHDRAWAL',
      'BANK_TRANSFER',
      'CARD_DEPOSIT',
      'CARD_WITHDRAWAL',
      'INTERNAL_TRANSFER',
      'FEE',
      'INTEREST',
      'REFUND',
      'LOAN_DISBURSEMENT',
      'LOAN_REPAYMENT',
      'DIVIDEND',
      'TAX_PAYMENT',
    ],
  })
  type!: string;

  @ApiProperty({ enum: ['INFLOW', 'OUTFLOW'] })
  direction!: string;

  @ApiProperty({ example: '1000.0000' })
  amount!: string;

  @ApiProperty({ example: '0.0000' })
  fee!: string;

  @ApiProperty({ example: '1000.0000' })
  netAmount!: string;

  @ApiProperty({ example: 'KZT' })
  currency!: string;

  @ApiProperty({ example: '1.000000' })
  exchangeRate!: string;

  @ApiProperty()
  transactionDate!: Date;

  @ApiPropertyOptional()
  description!: string | null;

  @ApiPropertyOptional()
  referenceNumber!: string | null;

  @ApiProperty({ example: false })
  isReconciled!: boolean;

  @ApiPropertyOptional()
  reconciledAt!: Date | null;

  @ApiPropertyOptional()
  cashAccountId!: string | null;

  @ApiPropertyOptional()
  bankAccountId!: string | null;

  @ApiPropertyOptional()
  referenceType!: string | null;

  @ApiPropertyOptional()
  referenceId!: string | null;

  @ApiPropertyOptional()
  createdBy!: string | null;

  @ApiProperty({ example: 0 })
  rowVersion!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
