import { CompanySubscription } from '@prisma/client';
import { CompanySubscriptionEntity } from '../entities/company-subscription.entity';

export class CompanySubscriptionMapper {
  static toEntity(sub: CompanySubscription): CompanySubscriptionEntity {
    return {
      id: sub.id,
      companyId: sub.companyId,
      planId: sub.planId,
      status: sub.status,
      trialStartsAt: sub.trialStartsAt,
      trialEndsAt: sub.trialEndsAt,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelledAt: sub.cancelledAt,
      cancelReason: sub.cancelReason,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      pastDueAt: sub.pastDueAt,
      suspendedAt: sub.suspendedAt,
      willExpireAt: sub.willExpireAt,
      paymentRetryCount: sub.paymentRetryCount,
      lastPaymentAttempt: sub.lastPaymentAttempt,
      providerCustomerId: sub.providerCustomerId,
      providerSubscriptionId: sub.providerSubscriptionId,
      isActive: sub.isActive,
      notes: sub.notes,
      rowVersion: sub.rowVersion ?? 0,
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
      deletedAt: sub.deletedAt,
    };
  }

  static toEntityList(subs: CompanySubscription[]): CompanySubscriptionEntity[] {
    return subs.map((s) => CompanySubscriptionMapper.toEntity(s));
  }
}
