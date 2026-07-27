import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CompanySubscription, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class CompanySubscriptionRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(data: Prisma.CompanySubscriptionCreateInput, tx?: Prisma.TransactionClient): Promise<CompanySubscription> {
    return this.getClient(tx).companySubscription.create({ data });
  }

  async findByCompany(companyId: string, tx?: Prisma.TransactionClient): Promise<CompanySubscription | null> {
    return this.getClient(tx).companySubscription.findUnique({
      where: { companyId },
      include: { plan: true },
    });
  }

  async findById(id: string, companyId: string, tx?: Prisma.TransactionClient): Promise<CompanySubscription | null> {
    return this.getClient(tx).companySubscription.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { plan: true },
    });
  }

  async findAll(params: {
    companyId?: string;
    planId?: string;
    status?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: CompanySubscription[]; total: number }> {
    const {
      companyId,
      planId,
      status,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.CompanySubscriptionWhereInput = { deletedAt: null };
    if (companyId) where.companyId = companyId;
    if (planId) where.planId = planId;
    if (status) where.status = status as SubscriptionStatus;
    if (isActive !== undefined) where.isActive = isActive;

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.companySubscription.findMany({
        where,
        include: { plan: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.companySubscription.count({ where }),
    ]);

    return { items, total };
  }

  async updateByCompany(
    companyId: string,
    data: Prisma.CompanySubscriptionUpdateInput,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CompanySubscription> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.companySubscription.updateMany({
        where: { companyId, rowVersion },
        data: { ...data, rowVersion: { increment: 1 } },
      });
      if (result.count === 0) {
        const existing = await client.companySubscription.findUnique({ where: { companyId } });
        if (!existing) throw new NotFoundException(`Subscription for company ${companyId} not found`);
        throw new ConflictException(`Subscription was modified by another user. Please refresh and retry.`);
      }
      return client.companySubscription.findUnique({
        where: { companyId },
        include: { plan: true },
      }) as unknown as CompanySubscription;
    }

    const existing = await this.findByCompany(companyId, tx);
    if (!existing) throw new NotFoundException(`Subscription for company ${companyId} not found`);
    return client.companySubscription.update({
      where: { companyId },
      data,
      include: { plan: true },
    });
  }

  async updateStatus(
    companyId: string,
    status: SubscriptionStatus,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<CompanySubscription> {
    return this.updateByCompany(companyId, { status }, rowVersion, tx);
  }

  async findExpiredTrials(tx?: Prisma.TransactionClient): Promise<CompanySubscription[]> {
    return this.getClient(tx).companySubscription.findMany({
      where: {
        status: 'TRIAL',
        trialEndsAt: { lte: new Date() },
        deletedAt: null,
      },
      include: { plan: true },
    });
  }

  async findExpiringToday(tx?: Prisma.TransactionClient): Promise<CompanySubscription[]> {
    const today = new Date();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    return this.getClient(tx).companySubscription.findMany({
      where: {
        status: 'ACTIVE',
        currentPeriodEnd: { lte: endOfDay, gte: new Date(0) },
        deletedAt: null,
        isActive: true,
      },
      include: { plan: true },
    });
  }

  async findOverdueGracePeriod(tx?: Prisma.TransactionClient): Promise<CompanySubscription[]> {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    return this.getClient(tx).companySubscription.findMany({
      where: {
        status: 'PAST_DUE',
        pastDueAt: { lte: fiveDaysAgo },
        deletedAt: null,
      },
      include: { plan: true },
    });
  }

  async findExpiredSuspensions(tx?: Prisma.TransactionClient): Promise<CompanySubscription[]> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return this.getClient(tx).companySubscription.findMany({
      where: {
        status: 'SUSPENDED',
        suspendedAt: { lte: thirtyDaysAgo },
        deletedAt: null,
      },
      include: { plan: true },
    });
  }

  async findPendingRetries(params: { maxRetries: number }, tx?: Prisma.TransactionClient): Promise<CompanySubscription[]> {
    return this.getClient(tx).companySubscription.findMany({
      where: {
        status: 'PAST_DUE',
        paymentRetryCount: { lt: params.maxRetries },
        deletedAt: null,
      },
      include: { plan: true },
    });
  }
}
