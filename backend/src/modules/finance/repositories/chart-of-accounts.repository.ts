import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ChartOfAccount } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

// Scalar field names of the ChartOfAccount model — used to separate scalar
// updates from relation writes in update() because updateMany accepts only
// scalar fields (ChartOfAccountUpdateManyMutationInput).
const CHART_OF_ACCOUNT_SCALAR_KEYS = new Set<string>(
  Object.values(Prisma.ChartOfAccountScalarFieldEnum),
);

@Injectable()
export class ChartOfAccountsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private prisma(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prismaService;
  }

  async create(
    data: Prisma.ChartOfAccountCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ChartOfAccount> {
    return this.prisma(tx).chartOfAccount.create({ data });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ChartOfAccount | null> {
    return this.prisma(tx).chartOfAccount.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    accountType?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ items: ChartOfAccount[]; total: number }> {
    const {
      companyId,
      search,
      accountType,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.ChartOfAccountWhereInput = {
      companyId,
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(accountType
        ? { accountType: accountType as Prisma.EnumAccountTypeFilter['equals'] }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Record<string, string> = {};
    orderBy[sortBy || 'createdAt'] = sortOrder || 'desc';

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.chartOfAccount.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.chartOfAccount.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.ChartOfAccountUpdateInput,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<ChartOfAccount> {
    const prisma = this.prisma(tx);

    // updateMany only accepts scalar fields
    // (ChartOfAccountUpdateManyMutationInput). Relation writes (e.g.
    // parent: { connect }) must be applied via chartOfAccount.update after the
    // optimistic-lock check succeeds, otherwise Prisma throws
    // "Unknown argument `parent`" (Blocker B1 pattern).
    const scalarData: Record<string, unknown> = {};
    const relationData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (CHART_OF_ACCOUNT_SCALAR_KEYS.has(key)) {
        scalarData[key] = value;
      } else {
        relationData[key] = value;
      }
    }

    const result = await prisma.chartOfAccount.updateMany({
      where: { id, companyId, rowVersion, deletedAt: null },
      data: { ...scalarData, rowVersion: { increment: 1 } },
    });

    if (result.count === 0) {
      const existing = await prisma.chartOfAccount.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Chart of account not found');
      throw new ConflictException(
        'Chart of account was modified by another user',
      );
    }

    // Apply relation writes (updateMany cannot touch relations)
    if (Object.keys(relationData).length > 0) {
      await prisma.chartOfAccount.update({ where: { id }, data: relationData });
    }

    return prisma.chartOfAccount.findFirst({
      where: { id },
    }) as unknown as ChartOfAccount;
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<ChartOfAccount> {
    const prisma = this.prisma(tx);
    const result = await prisma.chartOfAccount.updateMany({
      where: { id, companyId, rowVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        isActive: false,
        rowVersion: { increment: 1 },
      },
    });

    if (result.count === 0) {
      const existing = await prisma.chartOfAccount.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Chart of account not found');
      throw new ConflictException(
        'Chart of account was modified by another user',
      );
    }

    return prisma.chartOfAccount.findFirst({
      where: { id },
    }) as unknown as ChartOfAccount;
  }
}
