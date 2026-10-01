import { OverdueNotificationCronService } from '../scheduler/overdue-notification-cron.service';
import { NotificationsService } from '../notifications.service';
import { OverdueInvoiceRepository } from '../repositories/overdue-invoice.repository';
import {
  RedisService,
  LockAcquisitionResult,
} from '../../../infrastructure/cache/redis.service';
import { PrismaService } from '../../../common/prisma';

describe('OverdueNotificationCronService — daily scan, dedupe bucket, error isolation', () => {
  // G16-L-2C-3: acquireLock returns a discriminated result, not string|null.
  const ACQUIRED = (token: string): LockAcquisitionResult => ({
    acquired: true,
    token,
    synthetic: false,
  });
  const NOT_ACQUIRED = { acquired: false, reason: 'LOCK_CONTENDED' } as const;

  let cron: OverdueNotificationCronService;
  let redis: { acquireLock: jest.Mock; releaseLock: jest.Mock };
  let prisma: { company: { findMany: jest.Mock } };
  let overdueRepo: { findOverdueInvoices: jest.Mock };
  let service: { notifyOverdueInvoice: jest.Mock };

  const invoice = (id: string, companyId: string) => ({
    companyId,
    invoiceId: id,
    invoiceNumber: `PI-${id}`,
    supplierId: 'sup-1',
    supplierName: 'Acme',
    dueDate: new Date('2026-09-01'),
    currency: 'KZT',
    outstanding: '5000.0000',
    daysOverdue: 5,
  });

  beforeEach(() => {
    jest
      .spyOn(
        OverdueNotificationCronService.prototype as unknown as Record<
          string,
          () => Date
        >,
        'getScanStart',
      )
      .mockReturnValue(new Date(2026, 8, 6, 0, 0, 0)); // 2026-09-06 local
    redis = {
      acquireLock: jest.fn().mockResolvedValue(ACQUIRED('token-notifications')),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    prisma = {
      company: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'comp-1' }, { id: 'comp-2' }]),
      },
    };
    overdueRepo = { findOverdueInvoices: jest.fn().mockResolvedValue([]) };
    service = { notifyOverdueInvoice: jest.fn().mockResolvedValue(2) };
    cron = new OverdueNotificationCronService(
      redis as unknown as RedisService,
      prisma as unknown as PrismaService,
      overdueRepo as unknown as OverdueInvoiceRepository,
      service as unknown as NotificationsService,
      // Observability stub: JobRun persistence is non-authoritative and must
      // never influence notification behaviour under test.
      {
        start: jest.fn().mockResolvedValue('jobrun-test-id'),
        finish: jest.fn().mockResolvedValue(undefined),
        skip: jest.fn().mockResolvedValue(undefined),
      } as any,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('scans active companies and notifies overdue invoices with the day bucket', async () => {
    overdueRepo.findOverdueInvoices.mockResolvedValueOnce([invoice('inv-1', 'comp-1')]);

    await cron.scanOverdueInvoices();

    expect(overdueRepo.findOverdueInvoices).toHaveBeenCalledWith(
      'comp-1',
      new Date(2026, 8, 6, 0, 0, 0),
    );
    expect(service.notifyOverdueInvoice).toHaveBeenCalledWith(
      invoice('inv-1', 'comp-1'),
      '2026-09-06',
    );
  });

  it('same-day repeat → identical dedupe keys (DB constraint prevents duplicates)', async () => {
    prisma.company.findMany.mockResolvedValue([{ id: 'comp-1' }]);
    overdueRepo.findOverdueInvoices
      .mockResolvedValueOnce([invoice('inv-1', 'comp-1')])
      .mockResolvedValueOnce([invoice('inv-1', 'comp-1')]);

    await cron.scanOverdueInvoices();
    await cron.scanOverdueInvoices();

    const [first, second] = service.notifyOverdueInvoice.mock.calls;
    expect(first).toEqual(second); // same invoice + same bucket → same key
  });

  it('next day → new day bucket (legitimate re-alert)', async () => {
    prisma.company.findMany.mockResolvedValue([{ id: 'comp-1' }]);
    overdueRepo.findOverdueInvoices.mockResolvedValue([
      invoice('inv-1', 'comp-1'),
    ]);

    await cron.scanOverdueInvoices();
    jest
      .spyOn(
        OverdueNotificationCronService.prototype as unknown as Record<
          string,
          () => Date
        >,
        'getScanStart',
      )
      .mockReturnValue(new Date(2026, 8, 7, 0, 0, 0));
    await cron.scanOverdueInvoices();

    const buckets = service.notifyOverdueInvoice.mock.calls.map((c) => c[1]);
    expect(buckets).toEqual(['2026-09-06', '2026-09-07']);
  });

  it('one failing company does not stop the scan (per-company error isolation)', async () => {
    overdueRepo.findOverdueInvoices
      .mockRejectedValueOnce(new Error('comp-1 db timeout'))
      .mockResolvedValueOnce([invoice('inv-2', 'comp-2')]);

    await expect(cron.scanOverdueInvoices()).resolves.toBeUndefined();
    expect(service.notifyOverdueInvoice).toHaveBeenCalledTimes(1);
    expect(service.notifyOverdueInvoice).toHaveBeenCalledWith(
      invoice('inv-2', 'comp-2'),
      '2026-09-06',
    );
  });

  it('one failing invoice does not stop the remaining invoices', async () => {
    prisma.company.findMany.mockResolvedValue([{ id: 'comp-1' }]);
    overdueRepo.findOverdueInvoices.mockResolvedValue([
      invoice('inv-1', 'comp-1'),
      invoice('inv-3', 'comp-1'),
    ]);
    service.notifyOverdueInvoice
      .mockRejectedValueOnce(new Error('fan-out failed'))
      .mockResolvedValueOnce(2);

    await expect(cron.scanOverdueInvoices()).resolves.toBeUndefined();
    expect(service.notifyOverdueInvoice).toHaveBeenCalledTimes(2);
  });

  it('lock not acquired → scan skipped; lock released even on failure', async () => {
    redis.acquireLock.mockResolvedValue(NOT_ACQUIRED);
    await cron.scanOverdueInvoices();
    expect(prisma.company.findMany).not.toHaveBeenCalled();

    redis.acquireLock.mockResolvedValue(ACQUIRED('token-after-failure'));
    prisma.company.findMany.mockRejectedValue(new Error('boom'));
    await cron.scanOverdueInvoices();
    expect(redis.releaseLock).toHaveBeenCalled();
  });

  it('should release lock with owner token', async () => {
    const fakeToken = 'token-release-check';
    redis.acquireLock.mockResolvedValue(ACQUIRED(fakeToken));

    await cron.scanOverdueInvoices();

    expect(redis.releaseLock).toHaveBeenCalledWith('cron:lock:overdue-notifications', fakeToken);
  });

  // G16-L-2A-R3: the scan iterates every active company, so its TTL must be
  // large enough to cover a full tenant sweep while staying below the daily
  // interval. This pins the value so a future edit cannot silently regress it.
  it('should acquire lock with TTL 1800 (tenant sweep, below daily interval)', async () => {
    redis.acquireLock.mockResolvedValue(ACQUIRED('token-ttl-check'));

    await cron.scanOverdueInvoices();

    expect(redis.acquireLock).toHaveBeenCalledWith(
      'cron:lock:overdue-notifications',
      1800,
    );
  });

  // ---- G16-L-2A-R4: JobRun observability isolation ----

  describe('JobRun observability', () => {
    it('records a RUNNING run with the stable job name, then SUCCEEDED', async () => {
      const jobRun = (cron as any).jobRunService;

      await cron.scanOverdueInvoices();

      expect(jobRun.start).toHaveBeenCalledWith('notifications.scan-overdue');
      expect(jobRun.finish).toHaveBeenCalledWith(
        'jobrun-test-id',
        'SUCCEEDED',
        expect.objectContaining({ processed: 2, succeeded: 0 }),
      );
    });

    // Contention: no lock -> no business work, no RUNNING row, but (G16-L-2C-3)
    // a terminal SKIPPED row IS recorded via jobRunService.skip().
    it('does not execute business logic; contention records a SKIPPED row, not a run', async () => {
      redis.acquireLock.mockResolvedValue(NOT_ACQUIRED);
      const jobRun = (cron as any).jobRunService;

      await cron.scanOverdueInvoices();

      expect(prisma.company.findMany).not.toHaveBeenCalled();
      expect(jobRun.start).not.toHaveBeenCalled();
      expect(jobRun.finish).not.toHaveBeenCalled();
      expect(jobRun.skip).toHaveBeenCalledWith(
        'notifications.scan-overdue',
        'LOCK_CONTENDED',
      );
      expect(redis.releaseLock).not.toHaveBeenCalled();
    });

    it('releases the lock with the owner token after a successful run', async () => {
      redis.acquireLock.mockResolvedValue(ACQUIRED('token-success'));

      await cron.scanOverdueInvoices();

      expect(redis.releaseLock).toHaveBeenCalledWith(
        'cron:lock:overdue-notifications',
        'token-success',
      );
    });

    it('records FAILED but still releases the lock when the scan throws', async () => {
      const jobRun = (cron as any).jobRunService;
      prisma.company.findMany.mockRejectedValue(new Error('db down'));

      await cron.scanOverdueInvoices();

      expect(jobRun.finish).toHaveBeenCalledWith(
        'jobrun-test-id',
        'FAILED',
        expect.objectContaining({ error: expect.any(Error) }),
      );
      // The original best-effort behaviour is preserved: the error is still
      // swallowed and never propagated to the scheduler.
      expect(redis.releaseLock).toHaveBeenCalledWith(
        'cron:lock:overdue-notifications',
        'token-notifications',
      );
    });

    // The core isolation guarantee: observability failure must never stop work.
    // NOTE: JobRunService.start() never rejects — it catches internally and
    // returns null. That is the real failure mode being asserted here, so the
    // mock mirrors production rather than inventing a rejecting stub.
    it('completes normally when JobRun.start() returns null (service swallows internally)', async () => {
      const jobRun = (cron as any).jobRunService;
      jobRun.start.mockResolvedValue(null);

      await cron.scanOverdueInvoices();

      expect(prisma.company.findMany).toHaveBeenCalled();
      expect(jobRun.finish).toHaveBeenCalledWith(null, 'SUCCEEDED', expect.anything());
      expect(redis.releaseLock).toHaveBeenCalled();
    });
  });
});
