import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { JobRunStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { MetricsService } from '../../common/observability/metrics.service';
import { JobRunService } from '../../common/observability/job-run.service';

const LOCK_PREFIX = 'cron:lock:';
const LOCK_KEY = 'idempotency-cleanup';
// Runs daily at 04:00, so a TTL well below the 24h interval is safe. This job
// loops 5000-row DELETE batches until the table is drained, making it the
// longest-running cron in the system; 7200s (2h) covers that while still
// leaving the next daily run free to acquire the lock.
const LOCK_TTL_SEC = 7200;
const BATCH_SIZE = 5000;

@Injectable()
export class MaintenanceCronService {
  private readonly logger = new Logger(MaintenanceCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
    private readonly jobRunService: JobRunService,
  ) {}

  @Cron('0 4 * * *')
  async cleanupIdempotencyRecords(): Promise<number> {
    const lockKey = LOCK_PREFIX + LOCK_KEY;
    // G16-L-2C-3: discriminated lock result. A synthetic token (Redis disabled
    // in dev / explicit fail-open) means the job RUNS, never SKIPPED.
    const lock = await this.redis.acquireLock(lockKey, LOCK_TTL_SEC);

    if (!lock.acquired) {
      // Best-effort terminal SKIPPED row; JobRunService.skip never throws, so
      // observability cannot break the cron.
      await this.jobRunService.skip(
        'maintenance.cleanup-idempotency',
        lock.reason,
      );
      this.logger.debug(
        'Idempotency cleanup lock not acquired, skipping this run',
      );
      return 0;
    }
    const ownerToken = lock.token;

    const startTime = Date.now();
    let totalDeleted = 0;
    let hasErrors = false;
    // Cleanup is best-effort: the existing catch below logs and swallows, so the
    // job is recorded as FAILED without changing that behaviour.
    const runId = await this.jobRunService.start(
      'maintenance.cleanup-idempotency',
    );

    try {
      this.logger.log('Starting idempotency cleanup');

      while (true) {
        const deleted = await this.deleteExpiredBatch(BATCH_SIZE);
        totalDeleted += deleted;

        if (deleted === 0) {
          break;
        }

        this.logger.debug(
          `Idempotency cleanup batch: deleted ${deleted} records`,
        );
      }

      this.logger.log(
        `Idempotency cleanup completed: ${totalDeleted} records deleted`,
      );
      await this.jobRunService.finish(runId, JobRunStatus.SUCCEEDED, {
        processed: totalDeleted,
      });
    } catch (error) {
      hasErrors = true;
      await this.jobRunService.finish(runId, JobRunStatus.FAILED, {
        error,
        processed: totalDeleted,
      });
      this.logger.error(
        `Idempotency cleanup failed: ${(error as Error).message}`,
      );
      this.metrics.errorTotal.inc({ type: 'cleanup', module: 'maintenance' });
    } finally {
      const durationMs = Date.now() - startTime;
      this.metrics.eventDuration.observe(
        { event_name: 'idempotency_cleanup', handler: 'batch' },
        durationMs,
      );

      await this.redis.releaseLock(lockKey, ownerToken);
      this.logger.debug(`Idempotency cleanup lock released`);
    }

    return totalDeleted;
  }

  private async deleteExpiredBatch(batchSize: number): Promise<number> {
    const result = await this.prisma.$executeRawUnsafe(
      `DELETE FROM "IdempotencyRecord"
       WHERE "id" IN (
         SELECT "id"
         FROM "IdempotencyRecord"
         WHERE "expiresAt" < NOW()
         LIMIT ${batchSize}
       )`,
    );

    return Number(result);
  }
}
