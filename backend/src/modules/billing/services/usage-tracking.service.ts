import { Injectable, NotFoundException } from '@nestjs/common';
import { UsageRecordRepository } from '../repositories/usage-record.repository';
import { CompanySubscriptionRepository } from '../repositories/company-subscription.repository';
import { SubscriptionPlanRepository } from '../repositories/subscription-plan.repository';
import { UsageRecordEntity } from '../entities/usage-record.entity';

@Injectable()
export class UsageTrackingService {
  constructor(
    private readonly usageRepository: UsageRecordRepository,
    private readonly subscriptionRepository: CompanySubscriptionRepository,
    private readonly planRepository: SubscriptionPlanRepository,
  ) {}

  async checkQuota(
    companyId: string,
    metric: string,
    increment: number = 1,
  ): Promise<void> {
    const sub = await this.subscriptionRepository.findByCompany(companyId);
    if (!sub) throw new NotFoundException('Subscription not found');

    const plan = await this.planRepository.findById(sub.planId);
    if (!plan) throw new NotFoundException('Plan not found');

    const limit = (plan.featureFlags as Record<string, unknown>)?.[metric] as number | undefined;
    if (limit === undefined) return; // No limit configured
    if (limit === -1) return; // Unlimited
    if (limit === 0) throw new Error(`Feature ${metric} not available on your plan`);

    const periodStart = sub.currentPeriodStart;
    const current = await this.usageRepository.getCurrentUsage(
      companyId,
      sub.id,
      metric,
      periodStart,
    );

    if (current + increment > limit) {
      throw new Error(`Monthly ${metric} limit (${limit}) exceeded. Upgrade your plan.`);
    }
  }

  async increment(
    companyId: string,
    metric: string,
    increment: number = 1,
  ): Promise<void> {
    const sub = await this.subscriptionRepository.findByCompany(companyId);
    if (!sub) throw new NotFoundException('Subscription not found');

    await this.usageRepository.upsert(
      companyId,
      sub.id,
      metric,
      sub.currentPeriodStart,
      sub.currentPeriodEnd,
      increment,
    );
  }

  async getUsage(companyId: string): Promise<UsageRecordEntity[]> {
    const sub = await this.subscriptionRepository.findByCompany(companyId);
    if (!sub) throw new NotFoundException('Subscription not found');

    const records = await this.usageRepository.findByCompany(companyId);
    return records.map((r) => ({
      id: r.id,
      companyId: r.companyId,
      subscriptionId: r.subscriptionId,
      metric: r.metric,
      value: r.value,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      rowVersion: r.rowVersion ?? 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }
}
