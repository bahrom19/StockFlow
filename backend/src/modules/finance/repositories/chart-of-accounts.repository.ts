import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ChartOfAccount } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

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
    const result = await prisma.chartOfAccount.updateMany({
      where: { id, companyId, rowVersion, deletedAt: null },
      data: { ...data, rowVersion: { increment: 1 } },
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
