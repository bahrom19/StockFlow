import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, FinancialPeriod } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class FinancialPeriodsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private prisma(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prismaService;
  }

  async create(
    data: Prisma.FinancialPeriodCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<FinancialPeriod> {
    return this.prisma(tx).financialPeriod.create({ data });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<FinancialPeriod | null> {
    return this.prisma(tx).financialPeriod.findFirst({
      where: { id, companyId },
    });
  }

  async findByYearMonth(
    companyId: string,
    year: number,
    month: number,
    tx?: Prisma.TransactionClient,
  ): Promise<FinancialPeriod | null> {
    return this.prisma(tx).financialPeriod.findFirst({
      where: { companyId, year, month },
    });
  }

  async findCurrent(companyId: string): Promise<FinancialPeriod | null> {
    return this.prismaService.financialPeriod.findFirst({
      where: { companyId, status: 'OPEN' },
      orderBy: { startDate: 'desc' },
    });
  }

  async findAll(params: {
    companyId: string;
    year?: number;
    month?: number;
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ items: FinancialPeriod[]; total: number }> {
    const {
      companyId,
      year,
      month,
      status,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.FinancialPeriodWhereInput = {
      companyId,
      ...(year ? { year } : {}),
      ...(month ? { month } : {}),
      ...(status
        ? { status: status as Prisma.EnumFinancialPeriodStatusFilter['equals'] }
        : {}),
    };

    const orderBy: Record<string, string> = {};
    orderBy[sortBy || 'createdAt'] = sortOrder || 'desc';

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.financialPeriod.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.financialPeriod.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.FinancialPeriodUpdateInput,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<FinancialPeriod> {
    const prisma = this.prisma(tx);
    const result = await prisma.financialPeriod.updateMany({
      where: { id, companyId, rowVersion },
      data: { ...data, rowVersion: { increment: 1 } },
    });

    if (result.count === 0) {
      const existing = await prisma.financialPeriod.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Financial period not found');
      throw new ConflictException(
        'Financial period was modified by another user',
      );
    }

    return prisma.financialPeriod.findFirst({
      where: { id },
    }) as unknown as FinancialPeriod;
  }
}
