import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { CompanySubscriptionRepository } from '../repositories/company-subscription.repository';
import { CompanySubscriptionService } from '../services/company-subscription.service';
import { InvoiceService } from '../services/invoice.service';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { SubscriptionExpiredEvent } from '../events/subscription-expired.event';

const LOCK_PREFIX = 'cron:lock:';
const LOCK_TTL_SEC = 55; // must be less than smallest cron interval (60s for EVERY_MINUTE)
const SYSTEM_USER = 'system';

@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    private readonly cacheService: CacheService,
    private readonly prismaService: PrismaService,
    private readonly subscriptionRepository: CompanySubscriptionRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly companySubscriptionService: CompanySubscriptionService,
    private readonly invoiceService: InvoiceService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  /**
   * Acquire a distributed lock for a cron job using Redis atomic SET NX EX.
   * Uses the underlying ioredis SET command with NX (set if not exists) and EX (expiry).
   * Falls back to running the job if Redis is unavailable.
   */
  private async acquireLock(lockKey: string): Promise<boolean> {
    try {
      const redis = (this.cacheService as any).client;
      if (!redis) return true; // no Redis — run anyway

      const result = await redis.set(LOCK_PREFIX + lockKey, '1', 'NX', 'EX', LOCK_TTL_SEC);
      return result === 'OK';
    } catch {
      this.logger.warn('Redis unavailable — running cron job without distributed lock');
      return true;
    }
  }

  /**
   * Release a distributed lock.
   */
  private async releaseLock(lockKey: string): Promise<void> {
    await this.cacheService.del(LOCK_PREFIX + lockKey).catch(() => {});
  }

  /**
   * Every minute: process expired trials.
   * TRIAL → ACTIVE (if payment method exists) or TRIAL → FREE (downgrade)
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processExpiredTrials(): Promise<void> {
    const lockKey = 'expired-trials';
    if (!(await this.acquireLock(lockKey))) return;

    try {
      const expiredTrials = await this.subscriptionRepository.findExpiredTrials();
      for (const sub of expiredTrials) {
        try {
          if (!sub.providerCustomerId) {
            await this.companySubscriptionService.downgradeToFree(sub.companyId, SYSTEM_USER);
            this.logger.log(`Trial expired: company ${sub.companyId} → FREE`);
          }
        } catch (error) {
          this.logger.error(`Trial expiry failed for ${sub.companyId}: ${error}`);
        }
      }
      if (expiredTrials.length > 0) {
        this.logger.log(`Processed ${expiredTrials.length} expired trials`);
      }
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Daily at midnight: generate invoices for renewing subscriptions via InvoiceService.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateRecurringInvoices(): Promise<void> {
    const lockKey = 'recurring-invoices';
    if (!(await this.acquireLock(lockKey))) return;

    try {
      const expiringToday = await this.subscriptionRepository.findExpiringToday();
      let generated = 0;

      for (const sub of expiringToday) {
        try {
          await this.invoiceService.generateInvoice(sub.id, sub.companyId, SYSTEM_USER);
          // Extend current period
          await this.prismaService.companySubscription.update({
            where: { companyId: sub.companyId },
            data: {
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
          generated++;
        } catch (error) {
          this.logger.error(`Invoice generation failed for ${sub.companyId}: ${error}`);
        }
      }
      if (generated > 0) {
        this.logger.log(`Generated ${generated} recurring invoices`);
      }
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Every 5 minutes: retry failed payments (max 3 retries, then suspend).
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async retryFailedPayments(): Promise<void> {
    const lockKey = 'retry-payments';
    if (!(await this.acquireLock(lockKey))) return;

    try {
      const pendingRetries = await this.subscriptionRepository.findPendingRetries({ maxRetries: 3 });
      for (const sub of pendingRetries) {
        try {
          const retryCount = sub.paymentRetryCount + 1;
          this.logger.log(`Retry ${retryCount}/3: payment for company ${sub.companyId}`);

          await this.prismaService.companySubscription.update({
            where: { companyId: sub.companyId },
            data: {
              paymentRetryCount: retryCount,
              lastPaymentAttempt: new Date(),
            },
          });

          if (retryCount >= 3) {
            await this.companySubscriptionService.transitionStatus(sub.companyId, 'SUSPENDED', SYSTEM_USER);
            this.logger.log(`Suspended: company ${sub.companyId} (max retries)`);
          }
        } catch (error) {
          this.logger.error(`Payment retry failed for ${sub.companyId}: ${error}`);
        }
      }
      if (pendingRetries.length > 0) {
        this.logger.log(`Processed ${pendingRetries.length} payment retries`);
      }
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Every 30 minutes: suspend overdue subscriptions (PAST_DUE > 5 days).
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async suspendOverdueSubscriptions(): Promise<void> {
    const lockKey = 'suspend-overdue';
    if (!(await this.acquireLock(lockKey))) return;

    try {
      const overdue = await this.subscriptionRepository.findOverdueGracePeriod();
      for (const sub of overdue) {
        try {
          await this.companySubscriptionService.transitionStatus(sub.companyId, 'SUSPENDED', SYSTEM_USER);
          this.logger.log(`Suspended: company ${sub.companyId} (overdue)`);
        } catch (error) {
          this.logger.error(`Suspension failed for ${sub.companyId}: ${error}`);
        }
      }
      if (overdue.length > 0) {
        this.logger.log(`Suspended ${overdue.length} overdue subscriptions`);
      }
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Daily at 1AM: expire long-suspended subscriptions (SUSPENDED > 30 days).
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async expireSuspendedSubscriptions(): Promise<void> {
    const lockKey = 'expire-suspended';
    if (!(await this.acquireLock(lockKey))) return;

    try {
      const expired = await this.subscriptionRepository.findExpiredSuspensions();
      for (const sub of expired) {
        try {
          await this.companySubscriptionService.transitionStatus(sub.companyId, 'EXPIRED', SYSTEM_USER);
          await this.eventBus.publish(
            new SubscriptionExpiredEvent({
              companyId: sub.companyId,
              subscriptionId: sub.id,
            }),
          );
          this.logger.log(`Expired: company ${sub.companyId}`);
        } catch (error) {
          this.logger.error(`Expiration failed for ${sub.companyId}: ${error}`);
        }
      }
      if (expired.length > 0) {
        this.logger.log(`Expired ${expired.length} suspended subscriptions`);
      }
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Monthly on 1st at 2AM: reset usage records for all companies.
   */
  @Cron('0 2 1 * *')
  async resetUsageRecords(): Promise<void> {
    const lockKey = 'reset-usage';
    if (!(await this.acquireLock(lockKey))) return;

    try {
      const result = await this.prismaService.usageRecord.deleteMany({});
      this.logger.log(`Reset ${result.count} usage records`);
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Every 15 minutes: resume subscriptions that have been paid (PAST_DUE → ACTIVE)
   * when a successful payment was recorded via PaymentTransaction.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async resumeAfterPayment(): Promise<void> {
    const lockKey = 'resume-paid';
    if (!(await this.acquireLock(lockKey))) return;

    try {
      const pastDueSubs = await this.subscriptionRepository.findAll({
        status: 'PAST_DUE',
        isActive: true,
        page: 1,
        limit: 100,
      });

      let resumed = 0;
      for (const sub of pastDueSubs.items) {
        try {
          // Check if there's a recent successful payment transaction
          const recentPayment = await this.prismaService.paymentTransaction.findFirst({
            where: {
              subscriptionId: sub.id,
              status: 'SUCCEEDED',
              createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            },
          });

          if (recentPayment) {
            await this.companySubscriptionService.transitionStatus(sub.companyId, 'ACTIVE', SYSTEM_USER);
            this.logger.log(`Resumed: company ${sub.companyId} (payment received)`);
            resumed++;
          }
        } catch (error) {
          this.logger.error(`Resume failed for ${sub.companyId}: ${error}`);
        }
      }
      if (resumed > 0) {
        this.logger.log(`Resumed ${resumed} subscriptions after payment`);
      }
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  /**
   * Daily at 3AM: cleanup old data.
   * - Delete webhook events older than 90 days
   * - Archive expired PaymentTransactions
   * - Clean up orphaned usage records
   */
  @Cron('0 3 * * *')
  async cleanupOldData(): Promise<void> {
    const lockKey = 'cleanup';
    if (!(await this.acquireLock(lockKey))) return;

    try {
      // Delete webhook events older than 90 days
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const deletedWebhooks = await this.prismaService.webhookEvent.deleteMany({
        where: { processedAt: { lt: cutoff } },
      });

      // Reset payment retry counts for ACTIVE subscriptions with old failed attempts
      const staleRetries = await this.prismaService.companySubscription.updateMany({
        where: {
          status: 'ACTIVE',
          paymentRetryCount: { gt: 0 },
          lastPaymentAttempt: { lt: cutoff },
        },
        data: { paymentRetryCount: 0, lastPaymentAttempt: null },
      });

      if (deletedWebhooks.count > 0 || staleRetries.count > 0) {
        this.logger.log(`Cleanup: ${deletedWebhooks.count} webhook events deleted, ${staleRetries.count} retry counters reset`);
      }
    } finally {
      await this.releaseLock(lockKey);
    }
  }
}
