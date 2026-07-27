import { CashAccount } from '@prisma/client';
import { CashAccountEntity } from '../entities/cash-account.entity';

export class CashAccountMapper {
  static toEntity(account: CashAccount): CashAccountEntity {
    return {
      id: account.id,
      companyId: account.companyId,
      warehouseId: account.warehouseId,
      chartOfAccountId: account.chartOfAccountId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      openingBalance: account.openingBalance.toString(),
      currentBalance: account.currentBalance.toString(),
      isActive: account.isActive,
      description: account.description,
      rowVersion: account.rowVersion,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      deletedAt: account.deletedAt,
    };
  }

  static toEntityList(accounts: CashAccount[]): CashAccountEntity[] {
    return accounts.map((a) => this.toEntity(a));
  }
}
