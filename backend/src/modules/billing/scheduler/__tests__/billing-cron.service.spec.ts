import { BillingCronService } from '../billing-cron.service';

describe('BillingCronService - TTL verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

    it('should call acquireLock with TTL 55 for processExpiredTrials', async () => {
      const service = new BillingCronService(
        {} as any, // RedisService
        {} as any, // PrismaService
        {} as any, // CompanySubscriptionRepository
        {} as any, // InvoiceRepository
        {} as any, // CompanySubscriptionService
        {} as any, // InvoiceService
        {} as any, // EventBus
      );

      // Mock the redis service and the methods that would be called
      (service as any).redisService = {
        acquireLock: jest.fn().mockResolvedValue(true),
        releaseLock: jest.fn().mockResolvedValue(undefined),
      };

      // Mock the methods that would be called to avoid errors
      (service as any).subscriptionRepository = {
        findExpiredTrials: jest.fn().mockResolvedValue([]),
      };
      (service as any).companySubscriptionService = {
        downgradeToFree: jest.fn().mockResolvedValue(undefined),
      };

      await service.processExpiredTrials();

      const redisService = (service as any).redisService;
      expect(redisService.acquireLock).toHaveBeenCalledWith(
        'cron:lock:expired-trials',
        55
      );
    });

    it('should call acquireLock with TTL 300 for generateRecurringInvoices', async () => {
      const service = new BillingCronService(
        {} as any, // RedisService
        {} as any, // PrismaService
        {} as any, // CompanySubscriptionRepository
        {} as any, // InvoiceRepository
        {} as any, // CompanySubscriptionService
        {} as any, // InvoiceService
        {} as any, // EventBus
      );

      (service as any).redisService = {
        acquireLock: jest.fn().mockResolvedValue(true),
        releaseLock: jest.fn().mockResolvedValue(undefined),
      };

      (service as any).subscriptionRepository = {
        findExpiringToday: jest.fn().mockResolvedValue([]),
      };
      (service as any).prismaService = {
        companySubscription: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      (service as any).invoiceService = {
        generateInvoice: jest.fn().mockResolvedValue({}),
      };
      (service as any).companySubscriptionService = {
        transitionStatus: jest.fn().mockResolvedValue(undefined),
      };

      await service.generateRecurringInvoices();

      const redisService = (service as any).redisService;
      expect(redisService.acquireLock).toHaveBeenCalledWith(
        'cron:lock:recurring-invoices',
        300
      );
    });

    it('should call acquireLock with TTL 300 for retryFailedPayments', async () => {
      const service = new BillingCronService(
        {} as any, // RedisService
        {} as any, // PrismaService
        {} as any, // CompanySubscriptionRepository
        {} as any, // InvoiceRepository
        {} as any, // CompanySubscriptionService
        {} as any, // InvoiceService
        {} as any, // EventBus
      );

      (service as any).redisService = {
        acquireLock: jest.fn().mockResolvedValue(true),
        releaseLock: jest.fn().mockResolvedValue(undefined),
      };

      (service as any).subscriptionRepository = {
        findPendingRetries: jest.fn().mockResolvedValue([]),
      };
      (service as any).prismaService = {
        companySubscription: {
          update: jest.fn().mockResolvedValue({}),
        },
      };
      (service as any).companySubscriptionService = {
        transitionStatus: jest.fn().mockResolvedValue(undefined),
      };

      await service.retryFailedPayments();

      const redisService = (service as any).redisService;
      expect(redisService.acquireLock).toHaveBeenCalledWith(
        'cron:lock:retry-payments',
        300
      );
    });

    it('should call acquireLock with TTL 55 for suspendOverdueSubscriptions', async () => {
      const service = new BillingCronService(
        {} as any, // RedisService
        {} as any, // PrismaService
        {} as any, // CompanySubscriptionRepository
        {} as any, // InvoiceRepository
        {} as any, // CompanySubscriptionService
        {} as any, // InvoiceService
        {} as any, // EventBus
      );

      (service as any).redisService = {
        acquireLock: jest.fn().mockResolvedValue(true),
        releaseLock: jest.fn().mockResolvedValue(undefined),
      };

      (service as any).subscriptionRepository = {
        findOverdueGracePeriod: jest.fn().mockResolvedValue([]),
      };
      (service as any).companySubscriptionService = {
        transitionStatus: jest.fn().mockResolvedValue(undefined),
      };

      await service.suspendOverdueSubscriptions();

      const redisService = (service as any).redisService;
      expect(redisService.acquireLock).toHaveBeenCalledWith(
        'cron:lock:suspend-overdue',
        55
      );
    });

    it('should call acquireLock with TTL 55 for expireSuspendedSubscriptions', async () => {
      const service = new BillingCronService(
        {} as any, // RedisService
        {} as any, // PrismaService
        {} as any, // CompanySubscriptionRepository
        {} as any, // InvoiceRepository
        {} as any, // CompanySubscriptionService
        {} as any, // InvoiceService
        {} as any, // EventBus
      );

      (service as any).redisService = {
        acquireLock: jest.fn().mockResolvedValue(true),
        releaseLock: jest.fn().mockResolvedValue(undefined),
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
      expect(redisService.acquireLock).toHaveBeenCalledWith(
        'cron:lock:expire-suspended',
        55
      );
    });

    it('should call acquireLock with TTL 300 for resetUsageRecords', async () => {
      const service = new BillingCronService(
        {} as any, // RedisService
        {} as any, // PrismaService
        {} as any, // CompanySubscriptionRepository
        {} as any, // InvoiceRepository
        {} as any, // CompanySubscriptionService
        {} as any, // InvoiceService
        {} as any, // EventBus
      );

      (service as any).redisService = {
        acquireLock: jest.fn().mockResolvedValue(true),
        releaseLock: jest.fn().mockResolvedValue(undefined),
      };

      (service as any).prismaService = {
        usageRecord: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };

      await service.resetUsageRecords();

      const redisService = (service as any).redisService;
      expect(redisService.acquireLock).toHaveBeenCalledWith(
        'cron:lock:reset-usage',
        300
      );
    });

    it('should call acquireLock with TTL 55 for resumeAfterPayment', async () => {
      const service = new BillingCronService(
        {} as any, // RedisService
        {} as any, // PrismaService
        {} as any, // CompanySubscriptionRepository
        {} as any, // InvoiceRepository
        {} as any, // CompanySubscriptionService
        {} as any, // InvoiceService
        {} as any, // EventBus
      );

      (service as any).redisService = {
        acquireLock: jest.fn().mockResolvedValue(true),
        releaseLock: jest.fn().mockResolvedValue(undefined),
      };

      (service as any).subscriptionRepository = {
        findAll: jest.fn().mockResolvedValue({ items: [] }),
      };
      (service as any).prismaService = {
        paymentTransaction: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };
      (service as any).companySubscriptionService = {
        transitionStatus: jest.fn().mockResolvedValue(undefined),
      };

      await service.resumeAfterPayment();

      const redisService = (service as any).redisService;
      expect(redisService.acquireLock).toHaveBeenCalledWith(
        'cron:lock:resume-paid',
        55
      );
    });

    it('should call acquireLock with TTL 300 for cleanupOldData', async () => {
      const service = new BillingCronService(
        {} as any, // RedisService
        {} as any, // PrismaService
        {} as any, // CompanySubscriptionRepository
        {} as any, // InvoiceRepository
        {} as any, // CompanySubscriptionService
        {} as any, // InvoiceService
        {} as any, // EventBus
      );

      (service as any).redisService = {
        acquireLock: jest.fn().mockResolvedValue(true),
        releaseLock: jest.fn().mockResolvedValue(undefined),
      };

      (service as any).prismaService = {
        webhookEvent: {
          deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        companySubscription: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };

      await service.cleanupOldData();

      const redisService = (service as any).redisService;
      expect(redisService.acquireLock).toHaveBeenCalledWith(
        'cron:lock:cleanup',
        300
      );
    });
});