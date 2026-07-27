import { BankAccount } from '@prisma/client';
import { BankAccountEntity } from '../entities/bank-account.entity';

export class BankAccountMapper {
  static toEntity(account: BankAccount): BankAccountEntity {
    return {
      id: account.id,
      companyId: account.companyId,
      chartOfAccountId: account.chartOfAccountId,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      iban: account.iban,
      bic: account.bic,
      currency: account.currency,
      openingBalance: account.openingBalance.toString(),
      currentBalance: account.currentBalance.toString(),
      isDefault: account.isDefault,
      isActive: account.isActive,
      lastReconciledAt: account.lastReconciledAt,
      description: account.description,
      rowVersion: account.rowVersion,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      deletedAt: account.deletedAt,
    };
  }

  static toEntityList(accounts: BankAccount[]): BankAccountEntity[] {
    return accounts.map((a) => this.toEntity(a));
  }
}
