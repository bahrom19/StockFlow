import { Injectable, Logger } from '@nestjs/common';
import { FinancialPeriodStatus, FiscalYear, FinancialPeriod, Prisma } from '@prisma/client';

export interface CalendarResult {
  fiscalYear: FiscalYear;
  financialPeriod: FinancialPeriod;
  isPostable: boolean;
}

/**
 * Internal service that atomically ensures the accounting calendar for the
 * current UTC date is usable. Called before every GL posting and during
 * company registration.
 *
 * Responsibilities:
 *  - upsert current-year FiscalYear (if absent)
 *  - upsert current-month OPEN FinancialPeriod (if absent)
 *  - NEVER reopen a CLOSED or CLOSING period
 *  - NEVER create its own transaction — always uses the caller's tx
 *
 * PostgreSQL unique constraints are the correctness authority:
 *  - FiscalYear: @@unique([companyId, year])
 *  - FinancialPeriod: @@unique([companyId, year, month])
 */
@Injectable()
export class FiscalCalendarService {
  private readonly logger = new Logger(FiscalCalendarService.name);

  /**
   * Ensure that the accounting calendar for the current UTC date exists and
   * is usable for GL posting.
   *
   * @param companyId  tenant scope
   * @param tx         Prisma transaction client from the calling transaction
   * @returns CalendarResult with the resolved FiscalYear, FinancialPeriod,
   *          and whether the period is postable (OPEN).
   */
  async ensureCurrentCalendar(
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<CalendarResult> {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    // ── FiscalYear upsert ────────────────────────────────────────
    // The update branch is intentionally empty: if the row already exists
    // we must NOT alter any field (especially isClosed).
    const fiscalYear = await tx.fiscalYear.upsert({
      where: {
        companyId_year: { companyId, year },
      },
      create: {
        companyId,
        year,
        name: `${year}`,
        startDate: new Date(Date.UTC(year, 0, 1)),
        endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
      },
      update: {},
    });

    // ── FinancialPeriod upsert ───────────────────────────────────
    // The update branch is intentionally empty: if the row already exists
    // we must NEVER change its status (CLOSED → OPEN is forbidden).
    const startDate = new Date(Date.UTC(year, month - 1, 1));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const financialPeriod = await tx.financialPeriod.upsert({
      where: {
        companyId_year_month: { companyId, year, month },
      },
      create: {
        companyId,
        name: `${year}-${String(month).padStart(2, '0')}`,
        year,
        month,
        startDate,
        endDate,
        status: FinancialPeriodStatus.OPEN,
        openedBy: null,
        notes: 'Auto-provisioned by FiscalCalendarService',
      },
      update: {},
    });

    const isPostable = financialPeriod.status === FinancialPeriodStatus.OPEN;

    return { fiscalYear, financialPeriod, isPostable };
  }
}
