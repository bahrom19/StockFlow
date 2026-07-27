import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, CashAccount } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { toDecimal } from '../../../common/utils/decimal.util';

@Injectable()
export class CashAccountsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private prisma(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return tx ?? this.prismaService;
  }

  private normalizeMoney<T>(data: T): T {
    const result = { ...(data as Record<string, unknown>) };
    for (const field of ['openingBalance', 'currentBalance'] as const) {
      if (result[field] !== undefined) {
        result[field] = toDecimal(result[field]) ?? new Decimal(0);
      }
    }
    return result as T;
  }

  async create(
    data: Prisma.CashAccountCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CashAccount> {
    return this.prisma(tx).cashAccount.create({
      data: this.normalizeMoney<Prisma.CashAccountCreateInput>(data),
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CashAccount | null> {
    return this.prisma(tx).cashAccount.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<{ items: CashAccount[]; total: number }> {
    const {
      companyId,
      search,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.CashAccountWhereInput = {
      companyId,
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const orderBy: Record<string, string> = {};
    orderBy[sortBy || 'createdAt'] = sortOrder || 'desc';

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.cashAccount.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.cashAccount.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.CashAccountUpdateInput,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CashAccount> {
    const prisma = this.prisma(tx);
    const result = await prisma.cashAccount.updateMany({
      where: { id, companyId, rowVersion, deletedAt: null },
      data: {
        ...this.normalizeMoney<Prisma.CashAccountUpdateInput>(data),
        rowVersion: { increment: 1 },
      },
    });

    if (result.count === 0) {
      const existing = await prisma.cashAccount.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Cash account not found');
      throw new ConflictException('Cash account was modified by another user');
    }

    return prisma.cashAccount.findFirst({
      where: { id },
    }) as unknown as CashAccount;
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CashAccount> {
    const prisma = this.prisma(tx);
    const result = await prisma.cashAccount.updateMany({
      where: { id, companyId, rowVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        isActive: false,
        rowVersion: { increment: 1 },
      },
    });

    if (result.count === 0) {
      const existing = await prisma.cashAccount.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Cash account not found');
      throw new ConflictException('Cash account was modified by another user');
    }

    return prisma.cashAccount.findFirst({
      where: { id },
    }) as unknown as CashAccount;
  }
}
