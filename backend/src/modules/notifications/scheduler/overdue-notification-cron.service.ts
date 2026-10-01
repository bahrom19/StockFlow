import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CompanyStatus, JobRunStatus } from '@prisma/client';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { PrismaService } from '../../../common/prisma';
import { JobRunService } from '../../../common/observability/job-run.service';
import { OverdueInvoiceRepository } from '../repositories/overdue-invoice.repository';
import { NotificationsService } from '../notifications.service';

const LOCK_PREFIX = 'cron:lock:';
// One run per day; the lock only needs to cover a single scan duration.
// The scan iterates EVERY active company and issues per-invoice notification
// writes, so it scales with tenant count (243 companies today). TTL raised
// from 300s to 1800s (30 min) — still far below the 24h daily interval, so the
// next day's run is never suppressed.
const LOCK_TTL_SEC = 1800;

/**
 * Daily SUPPLIER_PAYMENT_OVERDUE scan (N3).
 *
 * Mirrors the BillingCronService pattern (@Cron + Redis distributed lock +
 * per-item try/catch so one failing company/invoice never stops the scan).
 *
 * Date convention: the project has no timezone helper —
 * SupplierAnalyticsService.getPaymentAging uses server-local
 * `new Date(); setHours(0, 0, 0, 0)` as "today"; the same convention is used
 * here (and the cron fires at server-local midnight, CronExpression
 * EVERY_DAY_AT_MIDNIGHT). daysOverdue = floor((startOfToday - dueDate) / 1 day),
 * identical to the analytics formula. No timezone package is introduced.
 */
@Injectable()
export class OverdueNotificationCronService {
  private readonly logger = new Logger(OverdueNotificationCronService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly prismaService: PrismaService,
    private readonly overdueInvoiceRepository: OverdueInvoiceRepository,
    private readonly notificationsService: NotificationsService,
    private readonly jobRunService: JobRunService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async scanOverdueInvoices(): Promise<void> {
    const lockKey = 'overdue-notifications';
    // G16-L-2C-3: discriminated lock result — a synthetic token (Redis
    // disabled in dev / explicit fail-open) means RUN, never SKIPPED.
    const lock = await this.redisService.acquireLock(LOCK_PREFIX + lockKey, LOCK_TTL_SEC);
    if (!lock.acquired) {
      // Best-effort terminal SKIPPED row; JobRunService.skip never throws.
      await this.jobRunService.skip('notifications.scan-overdue', lock.reason);
      return;
    }
    const ownerToken = lock.token;

    const runId = await this.jobRunService.start('notifications.scan-overdue');
    try {
      const startOfToday = this.getScanStart();
      const dayBucket = this.formatDayBucket(startOfToday);
      const companies = await this.prismaService.company.findMany({
        where: { deletedAt: null, isActive: true, status: CompanyStatus.ACTIVE },
        select: { id: true },
      });

      let notified = 0;
      for (const company of companies) {
        try {
          const invoices =
            await this.overdueInvoiceRepository.findOverdueInvoices(
              company.id,
              startOfToday,
            );
          for (const invoice of invoices) {
            try {
              notified += await this.notificationsService.notifyOverdueInvoice(
                invoice,
                dayBucket,
              );
            } catch (error) {
              this.logger.warn(
                `Overdue notification failed for invoice ${invoice.invoiceId} (company ${company.id}): ${
                  (error as Error).message
                }`,
              );
            }
          }
        } catch (error) {
          // One broken company never stops the rest of the daily scan.
          this.logger.warn(
            `Overdue scan failed for company ${company.id}: ${
              (error as Error).message
            }`,
          );
        }
      }
      if (notified > 0) {
        this.logger.log(
          `Overdue scan: ${notified} notification(s) created (${dayBucket})`,
        );
      }
      await this.jobRunService.finish(runId, JobRunStatus.SUCCEEDED, {
        processed: companies.length,
        succeeded: notified,
      });
    } catch (error) {
      // Scan-level failure (e.g. company listing) — never propagate to the
      // scheduler; the next daily run retries.
      await this.jobRunService.finish(runId, JobRunStatus.FAILED, { error });
      this.logger.error(`Overdue scan failed: ${(error as Error).message}`);
    } finally {
      await this.redisService.releaseLock(LOCK_PREFIX + lockKey, ownerToken);
    }
  }

  /** Server-local start of "today" — mirrors SupplierAnalyticsService. */
  protected getScanStart(): Date {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return startOfToday;
  }

  /** Server-local yyyy-mm-dd bucket for the daily dedupe key. */
  private formatDayBucket(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
}
