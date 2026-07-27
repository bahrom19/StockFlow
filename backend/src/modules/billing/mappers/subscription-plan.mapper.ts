import { SubscriptionPlan } from '@prisma/client';
import { SubscriptionPlanEntity } from '../entities/subscription-plan.entity';

type DecimalValue = { toString(): string } | string | number | null | undefined;

function toMoney(value: DecimalValue): string {
  if (value == null) return '0.0000';
  return typeof value === 'string' ? value : value.toString();
}

export class SubscriptionPlanMapper {
  static toEntity(plan: SubscriptionPlan): SubscriptionPlanEntity {
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      priceMonthly: toMoney(plan.priceMonthly),
      priceYearly: toMoney(plan.priceYearly),
      currency: plan.currency,
      trialDays: plan.trialDays,
      maxUsers: plan.maxUsers,
      maxWarehouses: plan.maxWarehouses,
      maxProducts: plan.maxProducts,
      featureFlags: plan.featureFlags as Record<string, unknown>,
      isActive: plan.isActive,
      sortOrder: plan.sortOrder,
      rowVersion: plan.rowVersion ?? 0,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
      deletedAt: plan.deletedAt,
    };
  }

  static toEntityList(plans: SubscriptionPlan[]): SubscriptionPlanEntity[] {
    return plans.map((p) => SubscriptionPlanMapper.toEntity(p));
  }
}
