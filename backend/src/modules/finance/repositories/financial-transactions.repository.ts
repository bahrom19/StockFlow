import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, FinancialTransaction } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { toDecimal } from '../../../common/utils/decimal.util';

@Injectable()
export class FinancialTransactionsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private prisma(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prismaService;
  }

  private normalizeMoney<T>(data: T): T {
    const result = { ...(data as Record<string, unknown>) };
    for (const field of ['amount', 'fee', 'netAmount'] as const) {
      if (result[field] !== undefined) {
        result[field] = toDecimal(result[field]) ?? new Decimal(0);
      }
    }
    return result as T;
  }

  async create(
    data: Prisma.FinancialTransactionCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<FinancialTransaction> {
    return this.prisma(tx).financialTransaction.create({
      data: this.normalizeMoney<Prisma.FinancialTransactionCreateInput>(data),
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<FinancialTransaction | null> {
    return this.prisma(tx).financialTransaction.findFirst({
      where: { id, companyId },
    });
  }

  async findAll(params: {
    companyId: string;
    dateFrom?: Date;
    dateTo?: Date;
    type?: string;
    direction?: string;
    cashAccountId?: string;
    bankAccountId?: string;
    isReconciled?: boolean;
    postingStatus?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ items: FinancialTransaction[]; total: number }> {
    const {
      companyId,
      dateFrom,
      dateTo,
      type,
      direction,
      cashAccountId,
      bankAccountId,
      isReconciled,
      postingStatus,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.FinancialTransactionWhereInput = {
      companyId,
      ...(type
        ? { type: type as Prisma.EnumFinancialTransactionTypeFilter['equals'] }
        : {}),
      ...(direction
        ? {
            direction:
              direction as Prisma.EnumTransactionDirectionFilter['equals'],
          }
        : {}),
      ...(cashAccountId ? { cashAccountId } : {}),
      ...(bankAccountId ? { bankAccountId } : {}),
      ...(isReconciled !== undefined ? { isReconciled } : {}),
      ...(postingStatus
        ? {
            postingStatus:
              postingStatus as Prisma.EnumFinancialTransactionPostingStatusFilter['equals'],
          }
        : {}),
      ...(dateFrom || dateTo
        ? {
            transactionDate: {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            },
          }
        : {}),
      ...(search
        ? { description: { contains: search, mode: 'insensitive' } }
        : {}),
    };

    const orderBy: Record<string, string> = {};
    orderBy[sortBy || 'createdAt'] = sortOrder || 'desc';

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.financialTransaction.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.financialTransaction.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.FinancialTransactionUpdateInput,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<FinancialTransaction> {
    const prisma = this.prisma(tx);
    const result = await prisma.financialTransaction.updateMany({
      where: { id, companyId, rowVersion },
      data: {
        ...this.normalizeMoney<Prisma.FinancialTransactionUpdateInput>(data),
        rowVersion: { increment: 1 },
      },
    });

    if (result.count === 0) {
      const existing = await prisma.financialTransaction.findFirst({
        where: { id, companyId },
      });
      if (!existing)
        throw new NotFoundException('Financial transaction not found');
      throw new ConflictException(
        'Financial transaction was modified by another user',
      );
    }

    return prisma.financialTransaction.findFirst({
      where: { id },
    }) as unknown as FinancialTransaction;
  }

  /**
   * G15-07-C3-A — CAS-claim a posting lifecycle transition.
   *
   * The conditional update (id + companyId + postingStatus + rowVersion) is
   * the single linearization point: exactly one concurrent post/reverse can
   * win; losers get count = 0 and must post nothing. Runs inside the caller's
   * transaction so a later failure rolls the claim back together with
   * everything else (the row returns to its previous status and stays
   * retryable).
   */
  async claimPostingStatus(
    id: string,
    companyId: string,
    from: Prisma.EnumFinancialTransactionPostingStatusFilter['equals'],
    to: Prisma.EnumFinancialTransactionPostingStatusFilter['equals'],
    rowVersion: number,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await tx.financialTransaction.updateMany({
      where: { id, companyId, postingStatus: from, rowVersion },
      data: { postingStatus: to, rowVersion: { increment: 1 } },
    });
    return result.count;
  }

  /**
   * G15-07-C3-A — persist the FinancialTransaction → JournalEntry linkage
   * after GlEngineService.post() succeeds inside the same transaction.
   */
  async linkJournalEntry(
    id: string,
    companyId: string,
    journalEntryId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.financialTransaction.updateMany({
      where: { id, companyId },
      data: { journalEntryId, rowVersion: { increment: 1 } },
    });
  }

  /**
   * G15-07-C3-C — bulk type lookup for cash-flow classification of
   * FINANCIAL_TRANSACTION journal entries. Single bounded query (no N+1);
   * company-scoped like every other repository read.
   */
  async findTypesByIds(
    companyId: string,
    ids: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string; type: string }[]> {
    if (ids.length === 0) return [];
    return this.prisma(tx).financialTransaction.findMany({
      where: { companyId, id: { in: ids } },
      select: { id: true, type: true },
    });
  }
}
