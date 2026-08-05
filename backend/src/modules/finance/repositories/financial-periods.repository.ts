import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, FinancialPeriod } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

// Scalar field names of the FinancialPeriod model — used to separate scalar
// updates from relation writes in update() because updateMany accepts only
// scalar fields (FinancialPeriodUpdateManyMutationInput).
const FINANCIAL_PERIOD_SCALAR_KEYS = new Set<string>(
  Object.values(Prisma.FinancialPeriodScalarFieldEnum),
);

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

    // updateMany only accepts scalar fields
    // (FinancialPeriodUpdateManyMutationInput). Relation writes (e.g.
    // closedByUser: { connect }) must be applied via financialPeriod.update
    // after the optimistic-lock check succeeds, otherwise Prisma throws
    // "Unknown argument `closedByUser`" (Blocker B1 pattern).
    const scalarData: Record<string, unknown> = {};
    const relationData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (FINANCIAL_PERIOD_SCALAR_KEYS.has(key)) {
        scalarData[key] = value;
      } else {
        relationData[key] = value;
      }
    }

    const result = await prisma.financialPeriod.updateMany({
      where: { id, companyId, rowVersion },
      data: { ...scalarData, rowVersion: { increment: 1 } },
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

    // Apply relation writes (updateMany cannot touch relations)
    if (Object.keys(relationData).length > 0) {
      await prisma.financialPeriod.update({
        where: { id },
        data: relationData,
      });
    }

    return prisma.financialPeriod.findFirst({
      where: { id },
    }) as unknown as FinancialPeriod;
  }
}
