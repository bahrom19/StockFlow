import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Currency, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { CompanySubscriptionRepository } from '../repositories/company-subscription.repository';
import { SubscriptionPlanRepository } from '../repositories/subscription-plan.repository';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';
import { SubscriptionQueryDto } from '../dto/subscription-query.dto';
import { CompanySubscriptionEntity } from '../entities/company-subscription.entity';
import { CompanySubscriptionMapper } from '../mappers/company-subscription.mapper';
import { SubscriptionPlanMapper } from '../mappers/subscription-plan.mapper';
import { SubscriptionCreatedEvent } from '../events/subscription-created.event';
import { SubscriptionChangedEvent } from '../events/subscription-changed.event';
import { SubscriptionCancelledEvent } from '../events/subscription-cancelled.event';
import { SubscriptionExpiredEvent } from '../events/subscription-expired.event';

const VALID_TRANSITIONS: Record<string, string[]> = {
  NEW: ['TRIAL', 'FREE'],
  TRIAL: ['ACTIVE', 'FREE'],
  ACTIVE: ['PAST_DUE', 'CANCELLED', 'FREE'],
  PAST_DUE: ['ACTIVE', 'SUSPENDED'],
  SUSPENDED: ['ACTIVE', 'EXPIRED'],
  CANCELLED: ['ACTIVE', 'EXPIRED'],
  EXPIRED: ['ACTIVE', 'FREE'],
  FREE: ['ACTIVE'],
};

@Injectable()
export class CompanySubscriptionService {
  constructor(
    private readonly subscriptionRepository: CompanySubscriptionRepository,
    private readonly planRepository: SubscriptionPlanRepository,
    private readonly prismaService: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(
    companyId: string,
    dto: CreateSubscriptionDto,
    userId: string,
  ): Promise<CompanySubscriptionEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const existing = await this.subscriptionRepository.findByCompany(
        companyId,
        tx,
      );
      if (existing) {
        throw new ConflictException('Company already has a subscription');
      }

      const planRecord = await this.planRepository.findByCode(dto.planCode);
      if (!planRecord)
        throw new NotFoundException(`Plan ${dto.planCode} not found`);

      const trialDays = dto.trialDays ?? planRecord.trialDays;
      const now = new Date();
      const trialEndsAt =
        trialDays > 0
          ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)
          : null;

      const sub = await this.subscriptionRepository.create(
        {
          company: { connect: { id: companyId } },
          plan: { connect: { id: planRecord.id } },
          status: 'TRIAL',
          trialStartsAt: trialDays > 0 ? now : null,
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
          isActive: true,
          notes: dto.notes,
        },
        tx,
      );

      await this.eventBus.publish(
        new SubscriptionCreatedEvent({
          companyId,
          subscriptionId: sub.id,
          planCode: planRecord.code,
          status: 'TRIAL',
          trialEndsAt: trialEndsAt?.toISOString() ?? null,
        }),
        { context: { transactionClient: tx } },
      );

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'SUBSCRIPTION_CREATED',
          entity: 'CompanySubscription',
          entityId: sub.id,
          newValues: {
            planCode: planRecord.code,
            status: 'TRIAL',
            trialDays,
            trialEndsAt: trialEndsAt?.toISOString(),
          },
          companyId,
          userId,
        },
      });

      return CompanySubscriptionMapper.toEntity(sub);
    });
  }

  async findByCompany(companyId: string): Promise<CompanySubscriptionEntity> {
    const sub = await this.subscriptionRepository.findByCompany(companyId);
    if (!sub) throw new NotFoundException('Subscription not found');
    return CompanySubscriptionMapper.toEntity(sub);
  }

  async findById(
    id: string,
    companyId: string,
  ): Promise<CompanySubscriptionEntity> {
    const sub = await this.subscriptionRepository.findById(id, companyId);
    if (!sub) throw new NotFoundException(`Subscription ${id} not found`);
    return CompanySubscriptionMapper.toEntity(sub);
  }

  async findAll(
    query: SubscriptionQueryDto,
    companyId?: string,
  ): Promise<{
    items: CompanySubscriptionEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const result = await this.subscriptionRepository.findAll({
      companyId,
      status: query.status,
      isActive: query.isActive,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: CompanySubscriptionMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async changePlan(
    companyId: string,
    newPlanCode: string,
    userId: string,
  ): Promise<CompanySubscriptionEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const companySub = await this.subscriptionRepository.findByCompany(
        companyId,
        tx,
      );
      if (!companySub) throw new NotFoundException('Subscription not found');
      const oldPlan = (companySub as unknown as { plan: { code: string } })
        .plan;

      const newPlan = await this.planRepository.findByCode(newPlanCode);
      if (!newPlan)
        throw new NotFoundException(`Plan ${newPlanCode} not found`);

      const rowVer = companySub.rowVersion ?? 0;
      const updated = await this.subscriptionRepository.updateByCompany(
        companyId,
        {
          plan: { connect: { id: newPlan.id } },
        } as Prisma.CompanySubscriptionUpdateInput,
        rowVer,
        tx,
      );

      await this.eventBus.publish(
        new SubscriptionChangedEvent({
          companyId,
          subscriptionId: companySub.id,
          oldPlan: oldPlan.code,
          newPlan: newPlanCode,
          reason: 'plan_change',
        }),
        { context: { transactionClient: tx } },
      );

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'SUBSCRIPTION_PLAN_CHANGED',
          entity: 'CompanySubscription',
          entityId: companySub.id,
          oldValues: { planCode: oldPlan.code },
          newValues: { planCode: newPlanCode },
          companyId,
          userId,
        },
      });

      return CompanySubscriptionMapper.toEntity(updated);
    });
  }

  async cancel(
    companyId: string,
    reason?: string,
    userId?: string,
  ): Promise<CompanySubscriptionEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const sub = await this.subscriptionRepository.findByCompany(
        companyId,
        tx,
      );
      if (!sub) throw new NotFoundException('Subscription not found');
      if (sub.status === 'CANCELLED' || sub.status === 'EXPIRED') {
        throw new BadRequestException(`Subscription is already ${sub.status}`);
      }

      const rowVer = sub.rowVersion ?? 0;
      const updated = await this.subscriptionRepository.updateByCompany(
        companyId,
        {
          status: SubscriptionStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: reason ?? null,
          cancelAtPeriodEnd: true,
          isActive: true,
        },
        rowVer,
        tx,
      );

      await this.eventBus.publish(
        new SubscriptionCancelledEvent({
          companyId,
          subscriptionId: sub.id,
          reason: reason ?? null,
        }),
        { context: { transactionClient: tx } },
      );

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'SUBSCRIPTION_CANCELLED',
          entity: 'CompanySubscription',
          entityId: sub.id,
          oldValues: { status: sub.status },
          newValues: { status: 'CANCELLED', cancelReason: reason },
          companyId,
          userId: userId ?? null,
        },
      });

      return CompanySubscriptionMapper.toEntity(updated);
    });
  }

  async resume(
    companyId: string,
    userId?: string,
  ): Promise<CompanySubscriptionEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const sub = await this.subscriptionRepository.findByCompany(
        companyId,
        tx,
      );
      if (!sub) throw new NotFoundException('Subscription not found');
      if (sub.status !== 'CANCELLED') {
        throw new BadRequestException(
          'Only cancelled subscriptions can be resumed',
        );
      }

      const rowVer = sub.rowVersion ?? 0;
      const updated = await this.subscriptionRepository.updateByCompany(
        companyId,
        {
          status: SubscriptionStatus.ACTIVE,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          cancelReason: null,
        } as Prisma.CompanySubscriptionUpdateInput,
        rowVer,
        tx,
      );

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'SUBSCRIPTION_RESUMED',
          entity: 'CompanySubscription',
          entityId: sub.id,
          oldValues: { status: sub.status },
          newValues: { status: 'ACTIVE' },
          companyId,
          userId: userId ?? null,
        },
      });

      return CompanySubscriptionMapper.toEntity(updated);
    });
  }

  async transitionStatus(
    companyId: string,
    targetStatus: string,
    userId: string,
  ): Promise<CompanySubscriptionEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const sub = await this.subscriptionRepository.findByCompany(
        companyId,
        tx,
      );
      if (!sub) throw new NotFoundException('Subscription not found');

      const allowed = VALID_TRANSITIONS[sub.status];
      if (!allowed || !allowed.includes(targetStatus)) {
        throw new BadRequestException(
          `Cannot transition from ${sub.status} to ${targetStatus}`,
        );
      }

      const rowVer = sub.rowVersion ?? 0;
      const updated = await this.subscriptionRepository.updateByCompany(
        companyId,
        { status: targetStatus as SubscriptionStatus },
        rowVer,
        tx,
      );

      if (targetStatus === 'EXPIRED') {
        await this.eventBus.publish(
          new SubscriptionExpiredEvent({
            companyId,
            subscriptionId: sub.id,
          }),
          { context: { transactionClient: tx } },
        );
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'SUBSCRIPTION_STATUS_TRANSITIONED',
          entity: 'CompanySubscription',
          entityId: sub.id,
          oldValues: { status: sub.status },
          newValues: { status: targetStatus },
          companyId,
          userId,
        },
      });

      return CompanySubscriptionMapper.toEntity(updated);
    });
  }

  async downgradeToFree(
    companyId: string,
    userId?: string,
  ): Promise<CompanySubscriptionEntity> {
    const freePlan = await this.planRepository.findByCode('free');
    if (!freePlan) throw new NotFoundException('Free plan not found');

    return this.prismaService.$transaction(async (tx) => {
      const sub = await this.subscriptionRepository.findByCompany(
        companyId,
        tx,
      );
      if (!sub) throw new NotFoundException('Subscription not found');

      const rowVer = sub.rowVersion ?? 0;
      const updated = await this.subscriptionRepository.updateByCompany(
        companyId,
        {
          status: SubscriptionStatus.FREE,
          plan: { connect: { id: freePlan.id } },
          isActive: true,
          trialStartsAt: null,
          trialEndsAt: null,
        } as Prisma.CompanySubscriptionUpdateInput,
        rowVer,
        tx,
      );

      // Audit log
      await tx.auditLog.create({
        data: {
          action: 'SUBSCRIPTION_DOWNGRADED_TO_FREE',
          entity: 'CompanySubscription',
          entityId: sub.id,
          oldValues: { status: sub.status, planId: sub.planId },
          newValues: { status: 'FREE', planId: freePlan.id },
          companyId,
          userId: userId ?? null,
        },
      });

      return CompanySubscriptionMapper.toEntity(updated);
    });
  }
}
