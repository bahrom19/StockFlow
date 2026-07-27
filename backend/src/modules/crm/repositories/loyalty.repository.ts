import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { LoyaltyAccount as PrismaLoyaltyAccount, Prisma } from '@prisma/client';

@Injectable()
export class LoyaltyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCustomerId(
    customerId: string,
  ): Promise<PrismaLoyaltyAccount | null> {
    return this.prisma.loyaltyAccount.findUnique({
      where: { customerId },
    });
  }

  async findByCustomerIdOrThrow(
    customerId: string,
  ): Promise<PrismaLoyaltyAccount> {
    const entity = await this.findByCustomerId(customerId);
    if (!entity)
      throw new NotFoundException('Loyalty account not found for customer');
    return entity;
  }

  async findById(
    id: string,
    companyId: string,
  ): Promise<PrismaLoyaltyAccount | null> {
    return this.prisma.loyaltyAccount.findFirst({
      where: { id, customer: { companyId } },
    });
  }

  async create(
    data: Prisma.LoyaltyAccountCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PrismaLoyaltyAccount> {
    const prisma = tx ?? this.prisma;
    return prisma.loyaltyAccount.create({ data });
  }

  async update(params: {
    id: string;
    data: Prisma.LoyaltyAccountUpdateInput;
    tx?: Prisma.TransactionClient;
  }): Promise<PrismaLoyaltyAccount> {
    const { id, data, tx } = params;
    const prisma = tx ?? this.prisma;
    return prisma.loyaltyAccount.update({ where: { id }, data });
  }

  async getTransactions(loyaltyAccountId: string) {
    return [];
  }
}
