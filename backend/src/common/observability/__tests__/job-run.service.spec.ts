import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { JobRunService } from '../job-run.service';
import { PrismaService } from '../../prisma';
import { JobRunStatus } from '@prisma/client';

/**
 * Unit tests for JobRunService.
 *
 * Prisma is fully mocked, so these tests never touch a database and do NOT
 * require the JobRun migration to be applied. They pin the two guarantees the
 * rest of the system relies on:
 *   1. the RUNNING -> SUCCEEDED/FAILED lifecycle is persisted correctly;
 *   2. observability never throws (a persistence failure degrades to a log line).
 */
describe('JobRunService', () => {
  let service: JobRunService;
  let mockPrisma: {
    jobRun: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };

  const STARTED_AT = new Date('2026-09-29T10:00:00.000Z');

  beforeEach(async () => {
    mockPrisma = {
      jobRun: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobRunService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<JobRunService>(JobRunService);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('start()', () => {
    it('creates a RUNNING JobRun and returns its id', async () => {
      mockPrisma.jobRun.create.mockResolvedValue({ id: 'run-1' });

      const id = await service.start('billing.cleanup');

      expect(id).toBe('run-1');
      expect(mockPrisma.jobRun.create).toHaveBeenCalledWith({
        data: { jobName: 'billing.cleanup', status: JobRunStatus.RUNNING },
        select: { id: true },
      });
    });

    it('returns null and does not throw when persistence fails (isolation guarantee)', async () => {
      mockPrisma.jobRun.create.mockRejectedValue(new Error('JobRun table missing'));

      await expect(service.start('billing.cleanup')).resolves.toBeNull();
    });
  });

  // ---- G16-L-2C-3: terminal SKIPPED rows for executions that never ran ----
  describe('skip()', () => {
    it('creates a terminal SKIPPED row: startedAt=finishedAt=now, durationMs=0, no error', async () => {
      mockPrisma.jobRun.create.mockResolvedValue({ id: 'skip-1' });
      const now = new Date('2026-09-30T12:00:00.000Z');
      jest.useFakeTimers().setSystemTime(now);

      await service.skip('billing.cleanup', 'LOCK_CONTENDED');

      expect(mockPrisma.jobRun.create).toHaveBeenCalledWith({
        data: {
          jobName: 'billing.cleanup',
          status: JobRunStatus.SKIPPED,
          startedAt: now,
          finishedAt: now,
          durationMs: 0,
          errorMessage: null,
          skipReason: 'LOCK_CONTENDED',
        },
        select: { id: true },
      });

      jest.useRealTimers();
    });

    it('persists each closed-vocabulary skip reason verbatim', async () => {
      mockPrisma.jobRun.create.mockResolvedValue({ id: 'skip-2' });

      await service.skip('billing.retry-payments', 'REDIS_UNAVAILABLE');
      await service.skip('billing.retry-payments', 'REDIS_ERROR');

      const reasons = mockPrisma.jobRun.create.mock.calls.map(
        (c) => c[0].data.skipReason,
      );
      expect(reasons).toEqual(['REDIS_UNAVAILABLE', 'REDIS_ERROR']);
    });

    it('never throws when persistence fails — cron/business operation must not break', async () => {
      mockPrisma.jobRun.create.mockRejectedValue(new Error('JobRun table missing'));

      await expect(
        service.skip('billing.cleanup', 'LOCK_CONTENDED'),
      ).resolves.toBeUndefined();
    });
  });

  describe('finish()', () => {
    it('marks the run SUCCEEDED with finishedAt, durationMs and clears errorMessage', async () => {
      mockPrisma.jobRun.findUnique.mockResolvedValue({ startedAt: STARTED_AT });
      mockPrisma.jobRun.update.mockResolvedValue({});

      const finishedAt = new Date('2026-09-29T10:00:05.000Z');
      jest.useFakeTimers().setSystemTime(finishedAt);

      await service.finish('run-1', JobRunStatus.SUCCEEDED, { processed: 7, succeeded: 7 });

      expect(mockPrisma.jobRun.update).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          status: JobRunStatus.SUCCEEDED,
          finishedAt,
          durationMs: 5000,
          errorMessage: null,
          processed: 7,
          succeeded: 7,
        }),
      });

      jest.useRealTimers();
    });

    it('marks the run FAILED and stores a concise, truncated errorMessage', async () => {
      mockPrisma.jobRun.findUnique.mockResolvedValue({ startedAt: STARTED_AT });
      mockPrisma.jobRun.update.mockResolvedValue({});

      await service.finish('run-1', JobRunStatus.FAILED, {
        error: new Error('x'.repeat(900)),
      });

      const data = mockPrisma.jobRun.update.mock.calls[0][0].data;
      expect(data.status).toBe(JobRunStatus.FAILED);
      expect(data.finishedAt).toBeInstanceOf(Date);
      expect(data.errorMessage).toHaveLength(500);
      expect(data.errorMessage.endsWith('...')).toBe(true);
    });

    it('leaves durationMs null when the run row cannot be read', async () => {
      mockPrisma.jobRun.findUnique.mockResolvedValue(null);
      mockPrisma.jobRun.update.mockResolvedValue({});

      await service.finish('run-1', JobRunStatus.SUCCEEDED);

      expect(mockPrisma.jobRun.update.mock.calls[0][0].data.durationMs).toBeNull();
    });

    it('is a no-op when runId is null (start failed) and does not touch Prisma', async () => {
      await service.finish(null, JobRunStatus.SUCCEEDED);

      expect(mockPrisma.jobRun.update).not.toHaveBeenCalled();
      expect(mockPrisma.jobRun.findUnique).not.toHaveBeenCalled();
    });

    it('does not throw when the update itself fails (isolation guarantee)', async () => {
      mockPrisma.jobRun.findUnique.mockResolvedValue({ startedAt: STARTED_AT });
      mockPrisma.jobRun.update.mockRejectedValue(new Error('connection lost'));

      await expect(service.finish('run-1', JobRunStatus.FAILED)).resolves.toBeUndefined();
    });
  });
});
