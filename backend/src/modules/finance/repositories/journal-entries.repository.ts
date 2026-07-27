import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, JournalEntry, JournalLine } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { toDecimal } from '../../../common/utils/decimal.util';

type JournalEntryWithLines = JournalEntry & { lines?: JournalLine[] };

@Injectable()
export class JournalEntriesRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private prisma(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prismaService;
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    data: {
      entryNumber: number;
      entryDate: Date;
      description: string | null;
      status: string;
      totalDebit: Decimal | string;
      totalCredit: Decimal | string;
      referenceType: string | null;
      referenceId: string | null;
      companyId: string;
      financialPeriodId: string;
      createdBy: string;
      lines: Array<{
        accountId: string;
        debit: string;
        credit: string;
        description: string | null;
      }>;
    },
  ): Promise<JournalEntryWithLines> {
    return tx.journalEntry.create({
      data: {
        entryNumber: data.entryNumber,
        entryDate: data.entryDate,
        description: data.description,
        status: data.status as Prisma.EnumJournalEntryStatusFilter['equals'],
        totalDebit: toDecimal(data.totalDebit) ?? new Decimal(0),
        totalCredit: toDecimal(data.totalCredit) ?? new Decimal(0),
        referenceType: data.referenceType,
        referenceId: data.referenceId,
        company: { connect: { id: data.companyId } },
        financialPeriod: { connect: { id: data.financialPeriodId } },
        createdByUser: { connect: { id: data.createdBy } },
        lines: {
          create: data.lines.map((l) => ({
            account: { connect: { id: l.accountId } },
            debit: toDecimal(l.debit) ?? new Decimal(0),
            credit: toDecimal(l.credit) ?? new Decimal(0),
            description: l.description,
          })),
        },
      },
      include: { lines: true },
    });
  }

  async getNextEntryNumberInTransaction(
    tx: Prisma.TransactionClient,
    companyId: string,
    financialPeriodId: string,
  ): Promise<number> {
    const result = await tx.journalEntry.aggregate({
      where: { companyId, financialPeriodId },
      _max: { entryNumber: true },
    });
    return (result._max.entryNumber || 0) + 1;
  }

  async create(
    data: Prisma.JournalEntryCreateInput & {
      lines: Array<{
        account: { connect: { id: string } };
        debit: string;
        credit: string;
        description: string | null;
      }>;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<JournalEntryWithLines> {
    const { lines, ...entryData } = data;
    return this.prisma(tx).journalEntry.create({
      data: {
        ...entryData,
        totalDebit:
          toDecimal(entryData.totalDebit as unknown as string) ??
          new Decimal(0),
        totalCredit:
          toDecimal(entryData.totalCredit as unknown as string) ??
          new Decimal(0),
        lines: {
          create: lines.map((line) => ({
            ...line,
            debit: toDecimal(line.debit) ?? new Decimal(0),
            credit: toDecimal(line.credit) ?? new Decimal(0),
          })),
        },
      },
      include: { lines: true },
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<JournalEntryWithLines | null> {
    return this.prisma(tx).journalEntry.findFirst({
      where: { id, companyId },
      include: { lines: true },
    });
  }

  async findAll(params: {
    companyId: string;
    financialPeriodId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ items: JournalEntryWithLines[]; total: number }> {
    const {
      companyId,
      financialPeriodId,
      dateFrom,
      dateTo,
      status,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.JournalEntryWhereInput = {
      companyId,
      ...(financialPeriodId ? { financialPeriodId } : {}),
      ...(status
        ? { status: status as Prisma.EnumJournalEntryStatusFilter['equals'] }
        : {}),
      ...(dateFrom || dateTo
        ? {
            entryDate: {
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
      this.prismaService.journalEntry.findMany({
        where,
        include: { lines: true },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.journalEntry.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.JournalEntryUpdateInput,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<JournalEntryWithLines> {
    const prisma = this.prisma(tx);
    const result = await prisma.journalEntry.updateMany({
      where: { id, companyId, rowVersion },
      data: { ...data, rowVersion: { increment: 1 } },
    });

    if (result.count === 0) {
      const existing = await prisma.journalEntry.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Journal entry not found');
      throw new ConflictException('Journal entry was modified by another user');
    }

    return prisma.journalEntry.findFirst({
      where: { id },
      include: { lines: true },
    }) as unknown as JournalEntryWithLines;
  }

  async getNextEntryNumber(
    companyId: string,
    financialPeriodId: string,
  ): Promise<number> {
    const result = await this.prismaService.journalEntry.aggregate({
      where: { companyId, financialPeriodId },
      _max: { entryNumber: true },
    });
    return (result._max.entryNumber || 0) + 1;
  }
}
