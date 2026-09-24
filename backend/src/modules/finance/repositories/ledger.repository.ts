import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class LedgerRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private prisma(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prismaService;
  }

  /**
   * Find journal lines filtered by account and company with journal entry details.
   * Used by getLedger() for running balance queries.
   */
  async findJournalLinesWithEntry(
    where: Record<string, unknown>,
    pagination: { skip: number; take: number },
    tx?: Prisma.TransactionClient,
  ): Promise<any[]> {
    return this.prisma(tx).journalLine.findMany({
      where,
      include: {
        journalEntry: {
          select: {
            entryDate: true,
            entryNumber: true,
            description: true,
            referenceType: true,
            referenceId: true,
          },
        },
      },
      orderBy: { journalEntry: { entryDate: 'asc' as const } },
      skip: pagination.skip,
      take: pagination.take,
    });
  }

  /**
   * Count journal lines matching the filter.
   */
  async countJournalLines(
    where: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return this.prisma(tx).journalLine.count({ where });
  }

  /**
   * Find account balances with account code/name/type included.
   */
  async findAccountBalances(
    where: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ): Promise<any[]> {
    return this.prisma(tx).accountBalance.findMany({
      where,
      include: {
        account: { select: { code: true, name: true, accountType: true } },
      },
      orderBy: { year: 'asc', month: 'asc' },
    });
  }

  /**
   * Find account balances without includes (bulk).
   */
  async findAccountBalancesBulk(
    where: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ): Promise<any[]> {
    return this.prisma(tx).accountBalance.findMany({
      where,
    });
  }

  /**
   * Find a single account balance record.
   */
  async findFirstAccountBalance(
    where: Record<string, unknown>,
    orderBy?: Record<string, string>,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    return this.prisma(tx).accountBalance.findFirst({
      where,
      orderBy: orderBy as Record<string, 'asc' | 'desc'> | undefined,
    });
  }

  /**
   * Find all active Chart of Accounts for a company.
   */
  async findChartOfAccounts(
    where: Record<string, unknown>,
    tx?: Prisma.TransactionClient,
  ): Promise<any[]> {
    return this.prisma(tx).chartOfAccount.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Aggregate JournalLine debit/credit grouped by accountId.
   * Used by Trial Balance and P&L to compute cumulative GL positions
   * directly from posted journal entries without AccountBalance snapshots.
   */
  async aggregatedJournalLines(
    companyId: string,
    opts: {
      asOfDate?: Date;
      dateFrom?: Date;
      dateTo?: Date;
      accountType?: string;
      onlyPosted?: boolean;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<
    {
      accountId: string;
      totalDebit: Decimal;
      totalCredit: Decimal;
    }[]
  > {
    const entryWhere: Record<string, any> = { companyId };
    if (opts.onlyPosted !== false) entryWhere.status = 'POSTED';
    if (opts.asOfDate) entryWhere.entryDate = { lte: opts.asOfDate };
    if (opts.dateFrom || opts.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (opts.dateFrom) dateFilter.gte = opts.dateFrom;
      if (opts.dateTo) dateFilter.lte = opts.dateTo;
      entryWhere.entryDate = dateFilter;
    }

    const lineWhere: Record<string, any> = { journalEntry: entryWhere };
    if (opts.accountType) {
      lineWhere.account = { accountType: opts.accountType };
    }

    const grouped = await this.prisma(tx).journalLine.groupBy({
      by: ['accountId'],
      where: lineWhere,
      _sum: { debit: true, credit: true },
    });

    return grouped.map((g) => ({
      accountId: g.accountId,
      totalDebit: new Decimal(g._sum.debit?.toString() ?? '0'),
      totalCredit: new Decimal(g._sum.credit?.toString() ?? '0'),
    }));
  }

  /**
   * Find a financial period by company and date range.
   */
  async findFinancialPeriodByDate(
    where: Record<string, unknown>,
    orderBy?: Record<string, string>,
    select?: Record<string, boolean>,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    return this.prisma(tx).financialPeriod.findFirst({
      where,
      orderBy: orderBy as Record<string, 'asc' | 'desc'> | undefined,
      select: select as Prisma.FinancialPeriodSelect | undefined,
    });
  }
}
