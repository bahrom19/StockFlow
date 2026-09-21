import { BillingCronService } from '../billing-cron.service';

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
    );

    const fakeToken = 'test-token-expired-trials';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(fakeToken),
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

  it('should call acquireLock with TTL 300 for generateRecurringInvoices', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    const fakeToken = 'test-token-recurring-invoices';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(fakeToken),
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
    expect(redisService.acquireLock).toHaveBeenCalledWith('cron:lock:recurring-invoices', 300);
    expect(redisService.releaseLock).toHaveBeenCalledWith('cron:lock:recurring-invoices', fakeToken);
  });

  it('should call acquireLock with TTL 300 for retryFailedPayments', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    const fakeToken = 'test-token-retry-payments';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(fakeToken),
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

  it('should call acquireLock with TTL 55 for suspendOverdueSubscriptions', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    const fakeToken = 'test-token-suspend-overdue';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(fakeToken),
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
    expect(redisService.acquireLock).toHaveBeenCalledWith('cron:lock:suspend-overdue', 55);
    expect(redisService.releaseLock).toHaveBeenCalledWith('cron:lock:suspend-overdue', fakeToken);
  });

  it('should call acquireLock with TTL 55 for expireSuspendedSubscriptions', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    const fakeToken = 'test-token-expire-suspended';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(fakeToken),
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
    expect(redisService.acquireLock).toHaveBeenCalledWith('cron:lock:expire-suspended', 55);
    expect(redisService.releaseLock).toHaveBeenCalledWith('cron:lock:expire-suspended', fakeToken);
  });

  it('should call acquireLock with TTL 300 for resetUsageRecords', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    const fakeToken = 'test-token-reset-usage';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(fakeToken),
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
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    const fakeToken = 'test-token-resume-paid';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(fakeToken),
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
    expect(redisService.acquireLock).toHaveBeenCalledWith('cron:lock:resume-paid', 55);
    expect(redisService.releaseLock).toHaveBeenCalledWith('cron:lock:resume-paid', fakeToken);
  });

  it('should call acquireLock with TTL 300 for cleanupOldData', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    const fakeToken = 'test-token-cleanup';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(fakeToken),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    (service as any).prismaService = {
      webhookEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      companySubscription: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };

    await service.cleanupOldData();

    const redisService = (service as any).redisService;
    expect(redisService.acquireLock).toHaveBeenCalledWith('cron:lock:cleanup', 300);
    expect(redisService.releaseLock).toHaveBeenCalledWith('cron:lock:cleanup', fakeToken);
  });

  it('should not release lock when acquire returns null', async () => {
    const service = new BillingCronService(
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(null),
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
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    const fakeToken = 'test-token-atomic-recurring';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(fakeToken),
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
      {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    );

    const fakeToken = 'test-token-recurring-partial';
    (service as any).redisService = {
      acquireLock: jest.fn().mockResolvedValue(fakeToken),
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
});
