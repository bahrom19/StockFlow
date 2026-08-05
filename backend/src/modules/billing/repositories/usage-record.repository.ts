import { Injectable } from '@nestjs/common';
import { Prisma, UsageRecord } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class UsageRecordRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async upsert(
    companyId: string,
    subscriptionId: string,
    metric: string,
    periodStart: Date,
    periodEnd: Date | null,
    increment: number = 1,
    tx?: Prisma.TransactionClient,
  ): Promise<UsageRecord> {
    const existing = await this.getClient(tx).usageRecord.findFirst({
      where: { companyId, subscriptionId, metric, periodStart },
    });

    if (existing) {
      return this.getClient(tx).usageRecord.update({
        where: { id: existing.id },
        data: { value: { increment } },
      });
    }

    return this.getClient(tx).usageRecord.create({
      data: {
        companyId,
        subscriptionId,
        metric,
        value: increment,
        periodStart,
        periodEnd,
      },
    });
  }

  async getCurrentUsage(
    companyId: string,
    subscriptionId: string,
    metric: string,
    periodStart: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const record = await this.getClient(tx).usageRecord.findFirst({
      where: { companyId, subscriptionId, metric, periodStart },
    });
    return record?.value ?? 0;
  }

  async findByCompany(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<UsageRecord[]> {
    return this.getClient(tx).usageRecord.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async resetMetric(
    companyId: string,
    subscriptionId: string,
    metric: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).usageRecord.deleteMany({
      where: { companyId, subscriptionId, metric },
    });
  }
}
