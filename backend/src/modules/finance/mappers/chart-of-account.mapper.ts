import { ChartOfAccount } from '@prisma/client';
import { ChartOfAccountEntity } from '../entities/chart-of-account.entity';

export class ChartOfAccountMapper {
  static toEntity(account: ChartOfAccount): ChartOfAccountEntity {
    return {
      id: account.id,
      companyId: account.companyId,
      code: account.code,
      name: account.name,
      description: account.description,
      accountType: account.accountType,
      normalBalance: account.normalBalance,
      isActive: account.isActive,
      isSystem: account.isSystem,
      isCashOrBank: account.isCashOrBank,
      parentId: account.parentId,
      level: account.level,
      sortOrder: account.sortOrder,
      rowVersion: account.rowVersion,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      deletedAt: account.deletedAt,
    };
  }

  static toEntityList(accounts: ChartOfAccount[]): ChartOfAccountEntity[] {
    return accounts.map((a) => this.toEntity(a));
  }
}
