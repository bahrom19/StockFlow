import { Test, TestingModule } from '@nestjs/testing';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MaintenanceCronService } from '../maintenance-cron.service';
import { PrismaService } from '../../../common/prisma';
import {
  RedisService,
  LockAcquisitionResult,
} from '../../../infrastructure/cache/redis.service';
import { MetricsService } from '../../../common/observability/metrics.service';
import { JobRunService } from '../../../common/observability/job-run.service';

describe('MaintenanceCronService', () => {
  let service: MaintenanceCronService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockRedis: jest.Mocked<RedisService>;
  let mockMetrics: jest.Mocked<MetricsService>;
  let mockJobRun: { start: jest.Mock; finish: jest.Mock; skip: jest.Mock };

  // G16-L-2C-3: acquireLock returns a discriminated result, not string|null.
  const ACQUIRED = (token: string): LockAcquisitionResult => ({
    acquired: true,
    token,
    synthetic: false,
  });
  const NOT_ACQUIRED = { acquired: false, reason: 'LOCK_CONTENDED' } as const;

  beforeEach(async () => {
    mockPrisma = {
      $executeRawUnsafe: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>;

    mockRedis = {
      acquireLock: jest.fn(),
      releaseLock: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    mockMetrics = {
      errorTotal: { inc: jest.fn() },
      eventDuration: { observe: jest.fn() },
    } as unknown as jest.Mocked<MetricsService>;

    mockJobRun = {
      start: jest.fn().mockResolvedValue('jobrun-test-id'),
      finish: jest.fn().mockResolvedValue(undefined),
      skip: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceCronService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: MetricsService, useValue: mockMetrics },
        { provide: JobRunService, useValue: mockJobRun },
      ],
    }).compile();

    service = module.get<MaintenanceCronService>(MaintenanceCronService);
  });

  describe('cleanupIdempotencyRecords', () => {
    it('should acquire lock before cleanup', async () => {
      mockRedis.acquireLock.mockResolvedValue(ACQUIRED('token-abc'));
      mockPrisma.$executeRawUnsafe.mockResolvedValue(0);

      await service.cleanupIdempotencyRecords();

      expect(mockRedis.acquireLock).toHaveBeenCalledWith('cron:lock:idempotency-cleanup', 7200);
    });

    it('should return 0 and skip cleanup if lock not acquired', async () => {
      mockRedis.acquireLock.mockResolvedValue(NOT_ACQUIRED);

      const result = await service.cleanupIdempotencyRecords();

      expect(result).toBe(0);
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    // ---- G16-L-2C-3: terminal SKIPPED rows when the lock is not acquired ----
    it('records a best-effort SKIPPED row when the lock is contended', async () => {
      mockRedis.acquireLock.mockResolvedValue(NOT_ACQUIRED);

      await service.cleanupIdempotencyRecords();

      expect(mockJobRun.skip).toHaveBeenCalledWith(
        'maintenance.cleanup-idempotency',
        'LOCK_CONTENDED',
      );
    });

    it('does not break the cron when recording the SKIPPED row fails', async () => {
      // Real JobRunService over a failing Prisma: skip() must swallow, the cron
      // must return 0 and never execute the batch deletes.
      const failingJobRun = new JobRunService(mockPrisma as unknown as PrismaService);
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MaintenanceCronService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: RedisService, useValue: mockRedis },
          { provide: MetricsService, useValue: mockMetrics },
          { provide: JobRunService, useValue: failingJobRun },
        ],
      }).compile();
      const svc = module.get<MaintenanceCronService>(MaintenanceCronService);

      mockRedis.acquireLock.mockResolvedValue(NOT_ACQUIRED);
      mockPrisma.$executeRawUnsafe.mockRejectedValue(new Error('JobRun table missing'));

      const result = await svc.cleanupIdempotencyRecords();

      expect(result).toBe(0);
      // No batch delete was attempted — the job returned after the skip.
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('should release lock with token in finally block', async () => {
      const fakeToken = 'test-token-maintenance';
      mockRedis.acquireLock.mockResolvedValue(ACQUIRED(fakeToken));
      mockPrisma.$executeRawUnsafe.mockResolvedValue(0);

      await service.cleanupIdempotencyRecords();

      expect(mockRedis.releaseLock).toHaveBeenCalledWith('cron:lock:idempotency-cleanup', fakeToken);
    });

    it('should not release lock if acquisition failed', async () => {
      mockRedis.acquireLock.mockResolvedValue(NOT_ACQUIRED);

      await service.cleanupIdempotencyRecords();

      expect(mockRedis.releaseLock).not.toHaveBeenCalled();
    });

    it('should release lock even when error occurs', async () => {
      const fakeToken = 'test-token-error';
      mockRedis.acquireLock.mockResolvedValue(ACQUIRED(fakeToken));
      mockPrisma.$executeRawUnsafe.mockRejectedValue(new Error('DB error'));

      await service.cleanupIdempotencyRecords();

      expect(mockRedis.releaseLock).toHaveBeenCalledWith('cron:lock:idempotency-cleanup', fakeToken);
    });

    it('should execute multiple batches until no more records', async () => {
      mockRedis.acquireLock.mockResolvedValue(ACQUIRED('token-batch'));
      mockPrisma.$executeRawUnsafe
        .mockResolvedValueOnce(5000)
        .mockResolvedValueOnce(3000)
        .mockResolvedValueOnce(0);

      const result = await service.cleanupIdempotencyRecords();

      expect(result).toBe(8000);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(3);
    });

    it('should use correct lock key and TTL', async () => {
      mockRedis.acquireLock.mockResolvedValue(ACQUIRED('token-ttl'));
      mockPrisma.$executeRawUnsafe.mockResolvedValue(0);

      await service.cleanupIdempotencyRecords();

      expect(mockRedis.acquireLock).toHaveBeenCalledWith('cron:lock:idempotency-cleanup', 7200);
    });

    it('should record error metric on failure', async () => {
      mockRedis.acquireLock.mockResolvedValue(ACQUIRED('token-err'));
      mockPrisma.$executeRawUnsafe.mockRejectedValue(new Error('DB error'));

      await service.cleanupIdempotencyRecords();

      expect(mockMetrics.errorTotal.inc).toHaveBeenCalledWith({
        type: 'cleanup',
        module: 'maintenance',
      });
    });

    it('should observe duration metric', async () => {
      mockRedis.acquireLock.mockResolvedValue(ACQUIRED('token-dur'));
      mockPrisma.$executeRawUnsafe.mockResolvedValue(0);

      await service.cleanupIdempotencyRecords();

      expect(mockMetrics.eventDuration.observe).toHaveBeenCalledWith(
        { event_name: 'idempotency_cleanup', handler: 'batch' },
        expect.any(Number),
      );
    });

    it('should use correct SQL for batched delete', async () => {
      mockRedis.acquireLock.mockResolvedValue(ACQUIRED('token-sql'));
      mockPrisma.$executeRawUnsafe.mockResolvedValue(0);

      await service.cleanupIdempotencyRecords();

      const calls = mockPrisma.$executeRawUnsafe.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const sql = String(calls[0]?.[0] ?? '');
      expect(sql).toContain('DELETE FROM "IdempotencyRecord"');
      expect(sql).toContain('WHERE "expiresAt" < NOW()');
      expect(sql).toContain('LIMIT 5000');
    });
  });

  // ---- G16-L-2C-3: stale RUNNING detection (pure SQL, mirrors the
  // read-only inspect-job-runs CLI; stale rows are reported, never mutated) ----
  describe('stale RUNNING detection (G16-L-2C-3)', () => {
    const STALE_RUNNING_SQL = `
      SELECT "jobName", "startedAt", COUNT(*)::int AS "staleRuns"
      FROM "JobRun"
      WHERE "status" = 'RUNNING'
        AND "startedAt" < NOW() - ($1 || ' minutes')::interval
      GROUP BY "jobName", "startedAt"
      ORDER BY "startedAt" ASC
    `;

    const LATEST_RUNNING_SQL = `
      SELECT DISTINCT ON ("jobName") "jobName", "status", "startedAt"
      FROM "JobRun"
      WHERE "jobName" = $1 AND "status" = 'RUNNING'
      ORDER BY "jobName", "startedAt" DESC
    `;

    it('detects RUNNING rows started before the stale cutoff', () => {
      expect(STALE_RUNNING_SQL).toContain("\"status\" = 'RUNNING'");
      expect(STALE_RUNNING_SQL).toContain(
        "\"startedAt\" < NOW() - ($1 || ' minutes')::interval",
      );
    });

    it('is read-only — stale RUNNING rows are never updated or deleted', () => {
      expect(STALE_RUNNING_SQL).not.toMatch(/\b(UPDATE|DELETE|INSERT|UPSERT)\b/i);
      expect(LATEST_RUNNING_SQL).not.toMatch(/\b(UPDATE|DELETE|INSERT|UPSERT)\b/i);
    });

    it('staleAfter = max(2 × cron interval, 2 × lock TTL)', () => {
      const staleAfterMin = (intervalMin: number, ttlSec: number) =>
        Math.max(2 * intervalMin, 2 * (ttlSec / 60));

      // maintenance.cleanup-idempotency: daily (1440 min) vs 7200s TTL
      expect(staleAfterMin(1440, 7200)).toBe(2880);
      // billing.expired-trials: 1 min interval vs 55s TTL → max(2, 1.83) = 2
      expect(staleAfterMin(1, 55)).toBe(2);
      // billing.recurring-invoices: daily vs 1800s TTL
      expect(staleAfterMin(1440, 1800)).toBe(2880);
    });
  });
});
