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
