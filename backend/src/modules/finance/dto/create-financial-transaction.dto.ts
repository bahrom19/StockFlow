import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateFinancialTransactionDto {
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
  @IsString()
  @IsNotEmpty()
  @IsIn([
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
  ])
  type!: string;

  @ApiProperty({ enum: ['INFLOW', 'OUTFLOW'] })
  @IsString()
  @IsNotEmpty()
  @IsIn(['INFLOW', 'OUTFLOW'])
  direction!: string;

  @ApiProperty({ example: '1000.0000' })
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fee?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  transactionDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cashAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankAccountId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isReconciled?: boolean;
}
