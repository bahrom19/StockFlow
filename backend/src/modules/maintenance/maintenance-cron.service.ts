import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma';
import { RedisService } from '../../infrastructure/cache/redis.service';
import { MetricsService } from '../../common/observability/metrics.service';

const LOCK_PREFIX = 'cron:lock:';
const LOCK_KEY = 'idempotency-cleanup';
const LOCK_TTL_SEC = 3300;
const BATCH_SIZE = 5000;

@Injectable()
export class MaintenanceCronService {
  private readonly logger = new Logger(MaintenanceCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {}

  @Cron('0 4 * * *')
  async cleanupIdempotencyRecords(): Promise<number> {
    const lockKey = LOCK_PREFIX + LOCK_KEY;
    const ownerToken = await this.redis.acquireLock(lockKey, LOCK_TTL_SEC);

    if (!ownerToken) {
      this.logger.debug('Idempotency cleanup lock not acquired, skipping this run');
      return 0;
    }

    const startTime = Date.now();
    let totalDeleted = 0;
    let hasErrors = false;

    try {
      this.logger.log('Starting idempotency cleanup');

      while (true) {
        const deleted = await this.deleteExpiredBatch(BATCH_SIZE);
        totalDeleted += deleted;

        if (deleted === 0) {
          break;
        }

        this.logger.debug(`Idempotency cleanup batch: deleted ${deleted} records`);
      }

      this.logger.log(`Idempotency cleanup completed: ${totalDeleted} records deleted`);
    } catch (error) {
      hasErrors = true;
      this.logger.error(`Idempotency cleanup failed: ${(error as Error).message}`);
      this.metrics.errorTotal.inc({ type: 'cleanup', module: 'maintenance' });
    } finally {
      const durationMs = Date.now() - startTime;
      this.metrics.eventDuration.observe({ event_name: 'idempotency_cleanup', handler: 'batch' }, durationMs);

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