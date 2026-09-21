import { Test, TestingModule } from '@nestjs/testing';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MaintenanceCronService } from '../maintenance-cron.service';
import { PrismaService } from '../../../common/prisma';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { MetricsService } from '../../../common/observability/metrics.service';

describe('MaintenanceCronService', () => {
  let service: MaintenanceCronService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockRedis: jest.Mocked<RedisService>;
  let mockMetrics: jest.Mocked<MetricsService>;

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceCronService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
        { provide: MetricsService, useValue: mockMetrics },
      ],
    }).compile();

    service = module.get<MaintenanceCronService>(MaintenanceCronService);
  });

  describe('cleanupIdempotencyRecords', () => {
    it('should acquire lock before cleanup', async () => {
      mockRedis.acquireLock.mockResolvedValue('token-abc');
      mockPrisma.$executeRawUnsafe.mockResolvedValue(0);

      await service.cleanupIdempotencyRecords();

      expect(mockRedis.acquireLock).toHaveBeenCalledWith('cron:lock:idempotency-cleanup', 3300);
    });

    it('should return 0 and skip cleanup if lock not acquired', async () => {
      mockRedis.acquireLock.mockResolvedValue(null);

      const result = await service.cleanupIdempotencyRecords();

      expect(result).toBe(0);
      expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
    });

    it('should release lock with token in finally block', async () => {
      const fakeToken = 'test-token-maintenance';
      mockRedis.acquireLock.mockResolvedValue(fakeToken);
      mockPrisma.$executeRawUnsafe.mockResolvedValue(0);

      await service.cleanupIdempotencyRecords();

      expect(mockRedis.releaseLock).toHaveBeenCalledWith('cron:lock:idempotency-cleanup', fakeToken);
    });

    it('should not release lock if acquisition failed', async () => {
      mockRedis.acquireLock.mockResolvedValue(null);

      await service.cleanupIdempotencyRecords();

      expect(mockRedis.releaseLock).not.toHaveBeenCalled();
    });

    it('should release lock even when error occurs', async () => {
      const fakeToken = 'test-token-error';
      mockRedis.acquireLock.mockResolvedValue(fakeToken);
      mockPrisma.$executeRawUnsafe.mockRejectedValue(new Error('DB error'));

      await service.cleanupIdempotencyRecords();

      expect(mockRedis.releaseLock).toHaveBeenCalledWith('cron:lock:idempotency-cleanup', fakeToken);
    });

    it('should execute multiple batches until no more records', async () => {
      mockRedis.acquireLock.mockResolvedValue('token-batch');
      mockPrisma.$executeRawUnsafe
        .mockResolvedValueOnce(5000)
        .mockResolvedValueOnce(3000)
        .mockResolvedValueOnce(0);

      const result = await service.cleanupIdempotencyRecords();

      expect(result).toBe(8000);
      expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(3);
    });

    it('should use correct lock key and TTL', async () => {
      mockRedis.acquireLock.mockResolvedValue('token-ttl');
      mockPrisma.$executeRawUnsafe.mockResolvedValue(0);

      await service.cleanupIdempotencyRecords();

      expect(mockRedis.acquireLock).toHaveBeenCalledWith('cron:lock:idempotency-cleanup', 3300);
    });

    it('should record error metric on failure', async () => {
      mockRedis.acquireLock.mockResolvedValue('token-err');
      mockPrisma.$executeRawUnsafe.mockRejectedValue(new Error('DB error'));

      await service.cleanupIdempotencyRecords();

      expect(mockMetrics.errorTotal.inc).toHaveBeenCalledWith({
        type: 'cleanup',
        module: 'maintenance',
      });
    });

    it('should observe duration metric', async () => {
      mockRedis.acquireLock.mockResolvedValue('token-dur');
      mockPrisma.$executeRawUnsafe.mockResolvedValue(0);

      await service.cleanupIdempotencyRecords();

      expect(mockMetrics.eventDuration.observe).toHaveBeenCalledWith(
        { event_name: 'idempotency_cleanup', handler: 'batch' },
        expect.any(Number),
      );
    });

    it('should use correct SQL for batched delete', async () => {
      mockRedis.acquireLock.mockResolvedValue('token-sql');
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
});
