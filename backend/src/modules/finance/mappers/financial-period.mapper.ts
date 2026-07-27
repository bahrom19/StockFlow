import { FinancialPeriod } from '@prisma/client';
import { FinancialPeriodEntity } from '../entities/financial-period.entity';

export class FinancialPeriodMapper {
  static toEntity(period: FinancialPeriod): FinancialPeriodEntity {
    return {
      id: period.id,
      companyId: period.companyId,
      name: period.name,
      year: period.year,
      month: period.month,
      startDate: period.startDate,
      endDate: period.endDate,
      status: period.status,
      openedBy: period.openedBy,
      openedAt: period.openedAt,
      closedBy: period.closedBy,
      closedAt: period.closedAt,
      notes: period.notes,
      rowVersion: period.rowVersion,
      createdAt: period.createdAt,
      updatedAt: period.updatedAt,
    };
  }

  static toEntityList(periods: FinancialPeriod[]): FinancialPeriodEntity[] {
    return periods.map((p) => this.toEntity(p));
  }
}
