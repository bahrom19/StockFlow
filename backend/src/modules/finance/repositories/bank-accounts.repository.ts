import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, BankAccount } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { toDecimal } from '../../../common/utils/decimal.util';

@Injectable()
export class BankAccountsRepository {
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
    data: Prisma.BankAccountCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<BankAccount> {
    return this.prisma(tx).bankAccount.create({
      data: this.normalizeMoney<Prisma.BankAccountCreateInput>(data),
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<BankAccount | null> {
    return this.prisma(tx).bankAccount.findFirst({
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
  }): Promise<{ items: BankAccount[]; total: number }> {
    const {
      companyId,
      search,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.BankAccountWhereInput = {
      companyId,
      deletedAt: null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { bankName: { contains: search, mode: 'insensitive' } },
              { accountNumber: { contains: search, mode: 'insensitive' } },
              { accountName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const orderBy: Record<string, string> = {};
    orderBy[sortBy || 'createdAt'] = sortOrder || 'desc';

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.bankAccount.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.bankAccount.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.BankAccountUpdateInput,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<BankAccount> {
    const prisma = this.prisma(tx);
    const result = await prisma.bankAccount.updateMany({
      where: { id, companyId, rowVersion, deletedAt: null },
      data: {
        ...this.normalizeMoney<Prisma.BankAccountUpdateInput>(data),
        rowVersion: { increment: 1 },
      },
    });

    if (result.count === 0) {
      const existing = await prisma.bankAccount.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Bank account not found');
      throw new ConflictException('Bank account was modified by another user');
    }

    return prisma.bankAccount.findFirst({
      where: { id },
    }) as unknown as BankAccount;
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<BankAccount> {
    const prisma = this.prisma(tx);
    const result = await prisma.bankAccount.updateMany({
      where: { id, companyId, rowVersion, deletedAt: null },
      data: {
        deletedAt: new Date(),
        isActive: false,
        rowVersion: { increment: 1 },
      },
    });

    if (result.count === 0) {
      const existing = await prisma.bankAccount.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Bank account not found');
      throw new ConflictException('Bank account was modified by another user');
    }

    return prisma.bankAccount.findFirst({
      where: { id },
    }) as unknown as BankAccount;
  }
}
