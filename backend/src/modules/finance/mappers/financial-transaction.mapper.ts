import { FinancialTransaction } from '@prisma/client';
import { FinancialTransactionEntity } from '../entities/financial-transaction.entity';

export class FinancialTransactionMapper {
  static toEntity(tx: FinancialTransaction): FinancialTransactionEntity {
    return {
      id: tx.id,
      companyId: tx.companyId,
      type: tx.type,
      direction: tx.direction,
      amount: tx.amount.toString(),
      fee: tx.fee.toString(),
      netAmount: tx.netAmount.toString(),
      currency: tx.currency,
      exchangeRate: tx.exchangeRate.toString(),
      transactionDate: tx.transactionDate,
      description: tx.description,
      referenceNumber: tx.referenceNumber,
      isReconciled: tx.isReconciled,
      reconciledAt: tx.reconciledAt,
      cashAccountId: tx.cashAccountId,
      bankAccountId: tx.bankAccountId,
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
      createdBy: tx.createdBy,
      rowVersion: tx.rowVersion,
      createdAt: tx.createdAt,
      updatedAt: tx.updatedAt,
    };
  }

  static toEntityList(
    transactions: FinancialTransaction[],
  ): FinancialTransactionEntity[] {
    return transactions.map((t) => this.toEntity(t));
  }
}
