import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class SubscriptionPlanRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(
    data: Prisma.SubscriptionPlanCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SubscriptionPlan> {
    return this.getClient(tx).subscriptionPlan.create({ data });
  }

  async findById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SubscriptionPlan | null> {
    return this.getClient(tx).subscriptionPlan.findFirst({
      where: { id, deletedAt: null },
    });
  }

  async findByCode(
    code: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SubscriptionPlan | null> {
    return this.getClient(tx).subscriptionPlan.findFirst({
      where: { code, deletedAt: null },
    });
  }

  async findAll(params: {
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: SubscriptionPlan[]; total: number }> {
    const {
      search,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'sortOrder',
      sortOrder = 'asc',
    } = params;

    const where: Prisma.SubscriptionPlanWhereInput = { deletedAt: null };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (isActive !== undefined) where.isActive = isActive;

    const orderBy = {} as Record<string, 'asc' | 'desc'>;
    orderBy[sortBy] = sortOrder;

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.subscriptionPlan.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.subscriptionPlan.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.SubscriptionPlanUpdateInput,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<SubscriptionPlan> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.subscriptionPlan.updateMany({
        where: { id, rowVersion },
        data: { ...data, rowVersion: { increment: 1 } },
      });
      if (result.count === 0) {
        const existing = await client.subscriptionPlan.findFirst({
          where: { id },
        });
        if (!existing)
          throw new NotFoundException(`SubscriptionPlan ${id} not found`);
        throw new ConflictException(
          `SubscriptionPlan ${id} was modified by another user`,
        );
      }
      return client.subscriptionPlan.findUnique({
        where: { id },
      }) as unknown as SubscriptionPlan;
    }

    const existing = await this.findById(id, tx);
    if (!existing)
      throw new NotFoundException(`SubscriptionPlan ${id} not found`);
    return client.subscriptionPlan.update({ where: { id }, data });
  }

  async softDelete(
    id: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<SubscriptionPlan> {
    return this.update(id, { deletedAt: new Date() }, rowVersion, tx);
  }

  async upsertByCode(
    code: string,
    data: Prisma.SubscriptionPlanCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SubscriptionPlan> {
    return this.getClient(tx).subscriptionPlan.upsert({
      where: { code },
      create: data,
      update: data,
    });
  }
}
