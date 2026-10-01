import { BillingCronService } from '../billing-cron.service';
import type { LockAcquisitionResult } from '../../../../infrastructure/cache/redis.service';

// Observability stub: JobRun persistence is non-authoritative infrastructure and
// must never influence billing behaviour under test.
const jobRunStub = () =>
  ({
    start: jest.fn().mockResolvedValue('jobrun-test-id'),
    finish: jest.fn().mockResolvedValue(undefined),
    skip: jest.fn().mockResolvedValue(undefined),
  }) as any;

// G16-L-2C-3: acquireLock returns a discriminated result, not string|null.
const ACQUIRED = (token: string): LockAcquisitionResult => ({
  acquired: true,
  token,
  synthetic: false,
});
const NOT_ACQUIRED = { acquired: false, reason: 'LOCK_CONTENDED' } as const;

describe('BillingCronService - stable JobRun jobName mapping', () => {
  // Source-level pin: the 10 registered jobs must keep exactly these names.
  // Reads the real files so a rename cannot pass unnoticed.
  const { readFileSync } = require('fs');
  const { join } = require('path');

  const BILLING = join(__dirname, '..', 'billing-cron.service.ts');
  const MAINTENANCE = join(
    __dirname,
    '..',
    '..',
    '..',
    'maintenance',
    'maintenance-cron.service.ts',
  );
  const NOTIFICATIONS = join(
    __dirname,
    '..',
    '..',
    '..',
    'notifications',
    'scheduler',
    'overdue-notification-cron.service.ts',
  );

  const EXPECTED: Record<string, string> = {
    'billing.expired-trials': BILLING,
    'billing.recurring-invoices': BILLING,
    'billing.retry-payments': BILLING,
    'billing.suspend-overdue': BILLING,
    'billing.expire-suspended': BILLING,
    'billing.reset-usage': BILLING,
    'billing.resume-paid': BILLING,
    'billing.cleanup': BILLING,
    'maintenance.cleanup-idempotency': MAINTENANCE,
    'notifications.scan-overdue': NOTIFICATIONS,
  };

  it('registers exactly the 10 approved job names and no others', () => {
    const sources = [BILLING, MAINTENANCE, NOTIFICATIONS].map((f) => readFileSync(f, 'utf8'));
    const found = sources
      .join('\n')
      .match(/jobRunService\.start\('([^']+)'\)/g)!
      .map((m) => m.replace(/jobRunService\.start\('|'\)/g, ''));

    expect(found.sort()).toEqual(Object.keys(EXPECTED).sort());
    expect(found).toHaveLength(10);
  });
});

describe('BillingCronService - TTL verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call acquireLock with TTL 55 for processExpiredTrials', async () => {
    const service = new BillingCronService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      jobRunStub(),
    );

    const fakeToken = 'test-token-expired-trials';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(ACQUIRED(fakeToken)),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    (service as any).subscriptionRepository = {
      findExpiredTrials: jest.fn().mockResolvedValue([]),
    };
    (service as any).companySubscriptionService = {
      downgradeToFree: jest.fn().mockResolvedValue(undefined),
    };

    await service.processExpiredTrials();

    const redisService = (service as any).redisService;
    expect(redisService.acquireLock).toHaveBeenCalledWith('cron:lock:expired-trials', 55);
    expect(redisService.releaseLock).toHaveBeenCalledWith('cron:lock:expired-trials', fakeToken);
  });

  // ---- G16-L-2A-R4: JobRun observability isolation ----

  describe('JobRun observability', () => {
    const buildService = (jobRun: any, overrides: Record<string, any> = {}) => {
      const service = new BillingCronService(
        {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRun,
      );
      (service as any).redisService = {
        acquireLock: jest.fn().mockResolvedValue(ACQUIRED('token-x')),
        releaseLock: jest.fn().mockResolvedValue(true),
      };
      (service as any).subscriptionRepository = {
        findExpiredTrials: jest.fn().mockResolvedValue([]),
      };
      (service as any).companySubscriptionService = {
        downgradeToFree: jest.fn().mockResolvedValue(undefined),
      };
      Object.assign(service as any, overrides);
      return service;
    };

    it('records RUNNING with the stable job name, then SUCCEEDED', async () => {
      const jobRun = jobRunStub();
      const service = buildService(jobRun);

      await service.processExpiredTrials();

      expect(jobRun.start).toHaveBeenCalledWith('billing.expired-trials');
      expect(jobRun.finish).toHaveBeenCalledWith(
        'jobrun-test-id',
        'SUCCEEDED',
        expect.objectContaining({ processed: 0 }),
      );
    });

    it('does not execute business logic and does not start a JobRun on lock contention', async () => {
      const jobRun = jobRunStub();
      const service = buildService(jobRun);
      (service as any).redisService.acquireLock.mockResolvedValue(NOT_ACQUIRED);

      await service.processExpiredTrials();

      expect((service as any).subscriptionRepository.findExpiredTrials).not.toHaveBeenCalled();
      expect(jobRun.start).not.toHaveBeenCalled();
      expect(jobRun.finish).not.toHaveBeenCalled();
      // G16-L-2C-3: expired-trials is exempt from skip rows on contention
      // (fires every minute — a SKIPPED row per tick would be pure noise).
      expect(jobRun.skip).not.toHaveBeenCalled();
      expect((service as any).redisService.releaseLock).not.toHaveBeenCalled();
    });

    it('records FAILED, rethrows the original error, and still releases the lock', async () => {
      const jobRun = jobRunStub();
      const boom = new Error('subscription query failed');
      const service = buildService(jobRun, {
        subscriptionRepository: { findExpiredTrials: jest.fn().mockRejectedValue(boom) },
      });

      await expect(service.processExpiredTrials()).rejects.toThrow('subscription query failed');

      expect(jobRun.finish).toHaveBeenCalledWith(
        'jobrun-test-id',
        'FAILED',
        expect.objectContaining({ error: boom }),
      );
      expect((service as any).redisService.releaseLock).toHaveBeenCalledWith(
        'cron:lock:expired-trials',
        'token-x',
      );
    });

    it('runs the business job and releases the lock when JobRun.start() returns null', async () => {
      const jobRun = jobRunStub();
      jobRun.start.mockResolvedValue(null);
      const service = buildService(jobRun);

      await service.processExpiredTrials();

      expect((service as any).subscriptionRepository.findExpiredTrials).toHaveBeenCalled();
      expect(jobRun.finish).toHaveBeenCalledWith(null, 'SUCCEEDED', expect.anything());
      expect((service as any).redisService.releaseLock).toHaveBeenCalled();
    });
  });

  // ---- G16-L-2C-3: terminal SKIPPED rows when the lock is not acquired ----
  describe('G16-L-2C-3: skip recording', () => {
    const buildSkipService = (jobRun: any) => {
      const service = new BillingCronService(
        {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRun,
      );
      (service as any).redisService = {
        acquireLock: jest.fn(),
        releaseLock: jest.fn().mockResolvedValue(true),
      };
      (service as any).subscriptionRepository = {
        findExpiredTrials: jest.fn().mockResolvedValue([]),
      };
      (service as any).companySubscriptionService = {
        downgradeToFree: jest.fn().mockResolvedValue(undefined),
      };
      (service as any).prismaService = {
        webhookEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
        companySubscription: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      return service;
    };

    it('records SKIPPED/LOCK_CONTENDED for cleanupOldData and executes no business logic', async () => {
      const jobRun = jobRunStub();
      const service = buildSkipService(jobRun);
      (service as any).redisService.acquireLock.mockResolvedValue(NOT_ACQUIRED);

      await service.cleanupOldData();

      expect(jobRun.skip).toHaveBeenCalledWith('billing.cleanup', 'LOCK_CONTENDED');
      expect((service as any).prismaService.webhookEvent.deleteMany).not.toHaveBeenCalled();
      expect((service as any).prismaService.companySubscription.updateMany).not.toHaveBeenCalled();
      expect(jobRun.start).not.toHaveBeenCalled();
      expect(jobRun.finish).not.toHaveBeenCalled();
      expect((service as any).redisService.releaseLock).not.toHaveBeenCalled();
    });

    it('records SKIPPED/REDIS_UNAVAILABLE (fail-closed Redis down)', async () => {
      const jobRun = jobRunStub();
      const service = buildSkipService(jobRun);
      (service as any).redisService.acquireLock.mockResolvedValue({
        acquired: false,
        reason: 'REDIS_UNAVAILABLE',
      });

      await service.cleanupOldData();

      expect(jobRun.skip).toHaveBeenCalledWith('billing.cleanup', 'REDIS_UNAVAILABLE');
      expect((service as any).prismaService.webhookEvent.deleteMany).not.toHaveBeenCalled();
    });

    it('records SKIPPED/REDIS_ERROR (fail-closed transient Redis failure)', async () => {
      const jobRun = jobRunStub();
      const service = buildSkipService(jobRun);
      (service as any).redisService.acquireLock.mockResolvedValue({
        acquired: false,
        reason: 'REDIS_ERROR',
      });

      await service.cleanupOldData();

      expect(jobRun.skip).toHaveBeenCalledWith('billing.cleanup', 'REDIS_ERROR');
    });

    it('expired-trials contention records NO SKIPPED row, but a Redis failure does', async () => {
      const jobRun = jobRunStub();
      const service = buildSkipService(jobRun);

      (service as any).redisService.acquireLock.mockResolvedValue(NOT_ACQUIRED);
      await service.processExpiredTrials();
      expect(jobRun.skip).not.toHaveBeenCalled();

      jobRun.skip.mockClear();
      (service as any).redisService.acquireLock.mockResolvedValue({
        acquired: false,
        reason: 'REDIS_UNAVAILABLE',
      });
      await service.processExpiredTrials();
      // Only LOCK_CONTENDED is exempt for expired-trials; Redis down is a real
      // anomaly an operator must see even for a per-minute job.
      expect(jobRun.skip).toHaveBeenCalledWith('billing.expired-trials', 'REDIS_UNAVAILABLE');
    });

    it('a synthetic token (Redis disabled / explicit fail-open) means RUN, never SKIPPED', async () => {
      const jobRun = jobRunStub();
      const service = buildSkipService(jobRun);
      (service as any).redisService.acquireLock.mockResolvedValue({
        acquired: true,
        token: 'synthetic-dev-token',
        synthetic: true,
      });

      await service.processExpiredTrials();

      expect((service as any).subscriptionRepository.findExpiredTrials).toHaveBeenCalled();
      expect(jobRun.skip).not.toHaveBeenCalled();
      expect(jobRun.start).toHaveBeenCalledWith('billing.expired-trials');
    });
  });

  it('should call acquireLock with TTL 300 for generateRecurringInvoices', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRunStub(),
    );

    const fakeToken = 'test-token-recurring-invoices';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(ACQUIRED(fakeToken)),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    (service as any).subscriptionRepository = {
      findExpiringToday: jest.fn().mockResolvedValue([]),
    };
    (service as any).prismaService = {
      companySubscription: { update: jest.fn().mockResolvedValue({}) },
    };
    (service as any).invoiceService = {
      generateRecurringInvoice: jest
        .fn()
        .mockResolvedValue({ invoice: {}, created: true }),
    };
    (service as any).companySubscriptionService = {
      transitionStatus: jest.fn().mockResolvedValue(undefined),
    };

    await service.generateRecurringInvoices();

    const redisService = (service as any).redisService;
    expect(redisService.acquireLock).toHaveBeenCalledWith('cron:lock:recurring-invoices', 1800);
    expect(redisService.releaseLock).toHaveBeenCalledWith('cron:lock:recurring-invoices', fakeToken);
  });

  it('should call acquireLock with TTL 300 for retryFailedPayments', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRunStub(),
    );

    const fakeToken = 'test-token-retry-payments';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(ACQUIRED(fakeToken)),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    (service as any).subscriptionRepository = {
      findPendingRetries: jest.fn().mockResolvedValue([]),
    };
    (service as any).prismaService = {
      companySubscription: { update: jest.fn().mockResolvedValue({}) },
    };
    (service as any).companySubscriptionService = {
      transitionStatus: jest.fn().mockResolvedValue(undefined),
    };

    await service.retryFailedPayments();

    const redisService = (service as any).redisService;
    expect(redisService.acquireLock).toHaveBeenCalledWith('cron:lock:retry-payments', 300);
    expect(redisService.releaseLock).toHaveBeenCalledWith('cron:lock:retry-payments', fakeToken);
  });

  function setupRetryService(
    subs: Array<{ id: string; companyId: string; paymentRetryCount: number }>,
    persistedCounts: number[],
  ) {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRunStub(),
    );

    const fakeToken = 'test-token-retry-behavioral';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(ACQUIRED(fakeToken)),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    (service as any).subscriptionRepository = {
      findPendingRetries: jest.fn().mockResolvedValue(subs),
    };
    const update = jest.fn().mockImplementation(({ data }: any) => {
      const next = persistedCounts.shift();
      return Promise.resolve({ paymentRetryCount: next });
    });
    (service as any).prismaService = {
      companySubscription: { update },
    };
    const transitionStatus = jest.fn().mockResolvedValue(undefined);
    (service as any).companySubscriptionService = { transitionStatus };
    return { service, update, transitionStatus };
  }

  it('should atomically increment to 1 and not suspend when count was 0', async () => {
    const { service, update, transitionStatus } = setupRetryService(
      [{ id: 'sub-1', companyId: 'comp-1', paymentRetryCount: 0 }],
      [1],
    );

    await service.retryFailedPayments();

    expect(update).toHaveBeenCalledWith({
      where: { companyId: 'comp-1' },
      data: {
        paymentRetryCount: { increment: 1 },
        lastPaymentAttempt: expect.any(Date),
      },
    });
    expect(transitionStatus).not.toHaveBeenCalled();
  });

  it('should atomically increment to 2 and not suspend when count was 1', async () => {
    const { service, update, transitionStatus } = setupRetryService(
      [{ id: 'sub-1', companyId: 'comp-1', paymentRetryCount: 1 }],
      [2],
    );

    await service.retryFailedPayments();

    expect(update).toHaveBeenCalledWith({
      where: { companyId: 'comp-1' },
      data: {
        paymentRetryCount: { increment: 1 },
        lastPaymentAttempt: expect.any(Date),
      },
    });
    expect(transitionStatus).not.toHaveBeenCalled();
  });

  it('should suspend when the persisted count reaches 3', async () => {
    const { service, update, transitionStatus } = setupRetryService(
      [{ id: 'sub-1', companyId: 'comp-1', paymentRetryCount: 2 }],
      [3],
    );

    await service.retryFailedPayments();

    expect(update).toHaveBeenCalledTimes(1);
    expect(transitionStatus).toHaveBeenCalledWith('comp-1', 'SUSPENDED', 'system');
  });

  it('should decide the threshold from the persisted value, not the stale read', async () => {
    // Stale read says 0, but the database atomically advanced to 3
    // (e.g. overlapping runs each incremented once).
    const { service, transitionStatus } = setupRetryService(
      [{ id: 'sub-1', companyId: 'comp-1', paymentRetryCount: 0 }],
      [3],
    );

    await service.retryFailedPayments();

    expect(transitionStatus).toHaveBeenCalledWith('comp-1', 'SUSPENDED', 'system');
  });

  it('should call acquireLock with TTL 55 for suspendOverdueSubscriptions', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRunStub(),
    );

    const fakeToken = 'test-token-suspend-overdue';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(ACQUIRED(fakeToken)),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    (service as any).subscriptionRepository = {
      findOverdueGracePeriod: jest.fn().mockResolvedValue([]),
    };
    (service as any).companySubscriptionService = {
      transitionStatus: jest.fn().mockResolvedValue(undefined),
    };

    await service.suspendOverdueSubscriptions();

    const redisService = (service as any).redisService;
    expect(redisService.acquireLock).toHaveBeenCalledWith('cron:lock:suspend-overdue', 900);
    expect(redisService.releaseLock).toHaveBeenCalledWith('cron:lock:suspend-overdue', fakeToken);
  });

  it('should call acquireLock with TTL 55 for expireSuspendedSubscriptions', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRunStub(),
    );

    const fakeToken = 'test-token-expire-suspended';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(ACQUIRED(fakeToken)),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    (service as any).subscriptionRepository = {
      findExpiredSuspensions: jest.fn().mockResolvedValue([]),
    };
    (service as any).companySubscriptionService = {
      transitionStatus: jest.fn().mockResolvedValue(undefined),
    };
    (service as any).eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    await service.expireSuspendedSubscriptions();

    const redisService = (service as any).redisService;
    expect(redisService.acquireLock).toHaveBeenCalledWith('cron:lock:expire-suspended', 1800);
    expect(redisService.releaseLock).toHaveBeenCalledWith('cron:lock:expire-suspended', fakeToken);
  });

  it('should call acquireLock with TTL 300 for resetUsageRecords', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRunStub(),
    );

    const fakeToken = 'test-token-reset-usage';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(ACQUIRED(fakeToken)),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    (service as any).prismaService = {
      usageRecord: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };

    await service.resetUsageRecords();

    const redisService = (service as any).redisService;
    expect(redisService.acquireLock).toHaveBeenCalledWith('cron:lock:reset-usage', 300);
    expect(redisService.releaseLock).toHaveBeenCalledWith('cron:lock:reset-usage', fakeToken);
  });

  it('should call acquireLock with TTL 55 for resumeAfterPayment', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRunStub(),
    );

    const fakeToken = 'test-token-resume-paid';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(ACQUIRED(fakeToken)),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    (service as any).subscriptionRepository = {
      findAll: jest.fn().mockResolvedValue({ items: [] }),
    };
    (service as any).prismaService = {
      paymentTransaction: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    (service as any).companySubscriptionService = {
      transitionStatus: jest.fn().mockResolvedValue(undefined),
    };

    await service.resumeAfterPayment();

    const redisService = (service as any).redisService;
    expect(redisService.acquireLock).toHaveBeenCalledWith('cron:lock:resume-paid', 240);
    expect(redisService.releaseLock).toHaveBeenCalledWith('cron:lock:resume-paid', fakeToken);
  });

  it('should call acquireLock with TTL 300 for cleanupOldData', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRunStub(),
    );

    const fakeToken = 'test-token-cleanup';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(ACQUIRED(fakeToken)),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    (service as any).prismaService = {
      webhookEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      companySubscription: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };

    await service.cleanupOldData();

    const redisService = (service as any).redisService;
    expect(redisService.acquireLock).toHaveBeenCalledWith('cron:lock:cleanup', 1800);
    expect(redisService.releaseLock).toHaveBeenCalledWith('cron:lock:cleanup', fakeToken);
  });

  it('should not release lock when acquire returns null', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRunStub(),
    );

    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(NOT_ACQUIRED),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    (service as any).subscriptionRepository = {
      findExpiredTrials: jest.fn().mockResolvedValue([]),
    };
    (service as any).companySubscriptionService = {
      downgradeToFree: jest.fn().mockResolvedValue(undefined),
    };

    await service.processExpiredTrials();

    const redisService = (service as any).redisService;
    expect(redisService.releaseLock).not.toHaveBeenCalled();
  });

  it('should use the atomic recurring-invoice method and never update the period separately', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRunStub(),
    );

    const fakeToken = 'test-token-atomic-recurring';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(ACQUIRED(fakeToken)),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    const expiring = [
      { id: 'sub-1', companyId: 'comp-1' },
      { id: 'sub-2', companyId: 'comp-2' },
    ];
    (service as any).subscriptionRepository = {
      findExpiringToday: jest.fn().mockResolvedValue(expiring),
    };
    const companySubscriptionUpdate = jest.fn();
    (service as any).prismaService = {
      companySubscription: { update: companySubscriptionUpdate },
    };
    const generateRecurringInvoice = jest
      .fn()
      .mockResolvedValue({ invoice: { id: 'inv-1' }, created: true });
    (service as any).invoiceService = { generateRecurringInvoice };

    await service.generateRecurringInvoices();

    expect(generateRecurringInvoice).toHaveBeenCalledTimes(2);
    expect(generateRecurringInvoice).toHaveBeenCalledWith(
      'sub-1',
      'comp-1',
      'system',
    );
    expect(generateRecurringInvoice).toHaveBeenCalledWith(
      'sub-2',
      'comp-2',
      'system',
    );
    // Period advancement lives inside the service transaction — the cron must
    // not perform a separate period update (G13-03-05 atomicity).
    expect(companySubscriptionUpdate).not.toHaveBeenCalled();
    const redisService = (service as any).redisService;
    expect(redisService.releaseLock).toHaveBeenCalledWith(
      'cron:lock:recurring-invoices',
      fakeToken,
    );
  });

  it('should skip already-invoiced periods and continue after per-subscription failure', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRunStub(),
    );

    const fakeToken = 'test-token-recurring-partial';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(ACQUIRED(fakeToken)),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    (service as any).subscriptionRepository = {
      findExpiringToday: jest.fn().mockResolvedValue([
        { id: 'sub-1', companyId: 'comp-1' },
        { id: 'sub-2', companyId: 'comp-2' },
      ]),
    };
    (service as any).prismaService = {
      companySubscription: { update: jest.fn() },
    };
    const generateRecurringInvoice = jest
      .fn()
      .mockRejectedValueOnce(new Error('CAS conflict'))
      .mockResolvedValueOnce({ invoice: { id: 'inv-2' }, created: false });
    (service as any).invoiceService = { generateRecurringInvoice };

    await expect(service.generateRecurringInvoices()).resolves.toBeUndefined();
    expect(generateRecurringInvoice).toHaveBeenCalledTimes(2);
    const redisService = (service as any).redisService;
    expect(redisService.releaseLock).toHaveBeenCalledWith(
      'cron:lock:recurring-invoices',
      fakeToken,
    );
  });

  function setupResumeService(
    initialPool: Array<{ id: string; companyId: string }>,
    paidCompanyIds: Set<string>,
    failingCompanyIds: Set<string> = new Set(),
  ) {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, jobRunStub(),
    );

    const fakeToken = 'test-token-resume-drain';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(ACQUIRED(fakeToken)),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    // Stateful pool simulates the live PAST_DUE set: successfully resumed
    // rows leave it (as the real DB state change would), sticky rows stay.
    const pool = [...initialPool];
    const findAll = jest.fn().mockImplementation(({ page, limit }: any) => {
      const items = pool.slice((page - 1) * limit, page * limit);
      return Promise.resolve({ items, total: pool.length });
    });
    (service as any).subscriptionRepository = { findAll };
    (service as any).prismaService = {
      paymentTransaction: {
        findFirst: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(
            paidCompanyIds.has(
              initialPool.find((s) => s.id === where.subscriptionId)
                ?.companyId ?? '',
            )
              ? { id: 'pmt-1' }
              : null,
          ),
        ),
      },
    };
    const transitionStatus = jest
      .fn()
      .mockImplementation(async (companyId: string) => {
        if (failingCompanyIds.has(companyId)) {
          throw new Error('transition failed');
        }
        const index = pool.findIndex((s) => s.companyId === companyId);
        if (index >= 0) pool.splice(index, 1);
        return undefined;
      });
    (service as any).companySubscriptionService = { transitionStatus };
    return { service, findAll, transitionStatus, pool, fakeToken };
  }

  function makeSubs(
    n: number,
    prefix = 'drain',
  ): Array<{ id: string; companyId: string }> {
    return Array.from({ length: n }, (_, i) => ({
      id: `sub-${prefix}-${i}`,
      companyId: `comp-${prefix}-${i}`,
    }));
  }

  it('should resume a small batch and keep the existing selection semantics', async () => {
    const subs = makeSubs(2, 'small');
    const paid = new Set(subs.map((s) => s.companyId));
    const { service, findAll, transitionStatus } = setupResumeService(
      subs,
      paid,
    );

    await service.resumeAfterPayment();

    expect(findAll).toHaveBeenCalledWith({
      status: 'PAST_DUE',
      isActive: true,
      page: 1,
      limit: 100,
    });
    expect(transitionStatus).toHaveBeenCalledTimes(2);
    const redisService = (service as any).redisService;
    expect(redisService.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('should drain 205 subscriptions across pages without skipping rows', async () => {
    const subs = makeSubs(205, 'big');
    const paid = new Set(subs.map((s) => s.companyId));
    const { service, findAll, transitionStatus, pool } = setupResumeService(
      subs,
      paid,
    );

    await service.resumeAfterPayment();

    // All 205 processed despite the 100-row page size; a naive page++
    // over the mutating set would have skipped ~100 of them.
    expect(transitionStatus).toHaveBeenCalledTimes(205);
    expect(
      new Set(
        (transitionStatus.mock.calls as string[][]).map((c) => c[0]),
      ),
    ).toEqual(paid);
    expect(pool).toHaveLength(0);
    // 100 + 100 + 5, then short-page termination (no extra empty fetch).
    expect(findAll).toHaveBeenCalledTimes(3);
  });

  it('should terminate with a sticky non-payable row and still reach the tail', async () => {
    const payable = makeSubs(101, 'tail');
    const sticky = { id: 'sub-sticky', companyId: 'comp-sticky' };
    const paid = new Set(payable.map((s) => s.companyId));
    const { service, findAll, transitionStatus, pool } = setupResumeService(
      [...payable, sticky],
      paid,
    );

    await service.resumeAfterPayment();

    expect(transitionStatus).toHaveBeenCalledTimes(101);
    expect(transitionStatus).not.toHaveBeenCalledWith(
      'comp-sticky',
      expect.anything(),
      expect.anything(),
    );
    // Terminates instead of re-querying the sticky page forever.
    expect(findAll.mock.calls.length).toBeLessThanOrEqual(4);
    expect(pool).toEqual([sticky]);
  });

  it('should continue draining after a per-subscription failure', async () => {
    const subs = makeSubs(3, 'partial');
    const paid = new Set(subs.map((s) => s.companyId));
    const failing = new Set([subs[1]!.companyId]);
    const { service, transitionStatus, pool } = setupResumeService(
      subs,
      paid,
      failing,
    );

    await expect(service.resumeAfterPayment()).resolves.toBeUndefined();

    expect(transitionStatus).toHaveBeenCalledTimes(3);
    expect(pool.map((s) => s.companyId)).toEqual([subs[1]!.companyId]);
    const redisService = (service as any).redisService;
    expect(redisService.releaseLock).toHaveBeenCalledTimes(1);
  });

  it('should finish quietly when no PAST_DUE subscriptions exist', async () => {
    const { service, transitionStatus } = setupResumeService([], new Set());

    await expect(service.resumeAfterPayment()).resolves.toBeUndefined();

    expect(transitionStatus).not.toHaveBeenCalled();
    const redisService = (service as any).redisService;
    expect(redisService.releaseLock).toHaveBeenCalledTimes(1);
  });
});
