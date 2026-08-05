import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../common/prisma';
import { EVENT_BUS } from '../../../common/events';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import { ConfigService } from '@nestjs/config';
import { CompanySubscriptionService } from '../services/company-subscription.service';
import { InvoiceService } from '../services/invoice.service';
import { SubscriptionPlanService } from '../services/subscription-plan.service';
import { StripeProvider } from '../providers/stripe.provider';
import { WebhookEngineService } from '../webhooks/webhook-engine.service';
import { SubscriptionPlanRepository } from '../repositories/subscription-plan.repository';
import { CompanySubscriptionRepository } from '../repositories/company-subscription.repository';
import { InvoiceRepository } from '../repositories/invoice.repository';
import { PaymentTransactionRepository } from '../repositories/payment-transaction.repository';
import { UsageRecordRepository } from '../repositories/usage-record.repository';

describe('Billing Commercial Integration', () => {
  let planService: SubscriptionPlanService;
  let subscriptionService: CompanySubscriptionService;
  let invoiceService: InvoiceService;
  let stripeProvider: StripeProvider;
  let webhookEngine: WebhookEngineService;

  // Shared mock references — set up in beforeEach, mutated per test
  let planRepo: jest.Mocked<SubscriptionPlanRepository>;
  let subRepo: jest.Mocked<CompanySubscriptionRepository>;
  let invRepo: jest.Mocked<InvoiceRepository>;
  let pmtRepo: jest.Mocked<PaymentTransactionRepository>;
  let usageRepo: jest.Mocked<UsageRecordRepository>;
  let mockTx: any;
  let mockEventBus: { publish: jest.Mock };
  let mockCache: { get: jest.Mock; set: jest.Mock; del: jest.Mock };
  let mockPrisma: any;

  const mockPlan = {
    id: 'plan-1',
    code: 'starter',
    name: 'Starter',
    priceMonthly: 29.99,
    priceYearly: 290.0,
    currency: 'USD',
    trialDays: 14,
    maxUsers: 3,
    maxWarehouses: 1,
    maxProducts: 500,
    featureFlags: {},
    isActive: true,
    sortOrder: 1,
    rowVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
  const mockSubscription: any = {
    id: 'sub-1',
    companyId: 'comp-1',
    planId: 'plan-1',
    status: 'TRIAL',
    trialStartsAt: new Date(),
    trialEndsAt: new Date(Date.now() + 14 * 86400000),
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 14 * 86400000),
    cancelledAt: null,
    cancelReason: null,
    cancelAtPeriodEnd: false,
    pastDueAt: null,
    suspendedAt: null,
    willExpireAt: null,
    paymentRetryCount: 0,
    lastPaymentAttempt: null,
    providerCustomerId: null,
    providerSubscriptionId: null,
    isActive: true,
    rowVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    plan: mockPlan,
  };
  const mockInvoice: any = {
    id: 'inv-1',
    companyId: 'comp-1',
    subscriptionId: 'sub-1',
    invoiceNumber: 'INV-TEST-0001',
    status: 'PENDING',
    subtotal: 29.99,
    discountAmount: 0,
    taxAmount: 0,
    totalAmount: 29.99,
    paidAmount: 0,
    currency: 'USD',
    dueDate: new Date(Date.now() + 30 * 86400000),
    paidAt: null,
    providerInvoiceId: null,
    notes: null,
    rowVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const activeSub = () => ({ ...mockSubscription, status: 'ACTIVE' });
  const cancelledSub = () => ({ ...mockSubscription, status: 'CANCELLED' });

  beforeEach(async () => {
    mockTx = { auditLog: { create: jest.fn() } };
    mockEventBus = { publish: jest.fn() };
    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      del: jest.fn(),
    };

    planRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      upsertByCode: jest.fn(),
    } as any;

    subRepo = {
      create: jest.fn(),
      findByCompany: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      updateByCompany: jest.fn(),
      updateStatus: jest.fn(),
      findExpiredTrials: jest.fn(),
      findExpiringToday: jest.fn(),
      findOverdueGracePeriod: jest.fn(),
      findExpiredSuspensions: jest.fn(),
      findPendingRetries: jest.fn(),
    } as any;

    invRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findBySubscription: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      getNextInvoiceNumber: jest.fn(),
    } as any;

    pmtRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByInvoice: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    } as any;
    usageRepo = {
      upsert: jest.fn(),
      getCurrentUsage: jest.fn(),
      findByCompany: jest.fn(),
      resetMetric: jest.fn(),
    } as any;

    mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockTx)),
      invoice: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      companySubscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      paymentTransaction: { findFirst: jest.fn().mockResolvedValue(null) },
      webhookEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionPlanService,
        CompanySubscriptionService,
        InvoiceService,
        StripeProvider,
        WebhookEngineService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EVENT_BUS, useValue: mockEventBus },
        { provide: CacheService, useValue: mockCache },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('') },
        },
        { provide: SubscriptionPlanRepository, useValue: planRepo },
        { provide: CompanySubscriptionRepository, useValue: subRepo },
        { provide: InvoiceRepository, useValue: invRepo },
        { provide: PaymentTransactionRepository, useValue: pmtRepo },
        { provide: UsageRecordRepository, useValue: usageRepo },
      ],
    }).compile();

    planService = module.get(SubscriptionPlanService);
    subscriptionService = module.get(CompanySubscriptionService);
    invoiceService = module.get(InvoiceService);
    stripeProvider = module.get(StripeProvider);
    webhookEngine = module.get(WebhookEngineService);
  });

  // ─── 1. Trial → Checkout → Active flow ──────────────────────────

  describe('Trial → Checkout → Active', () => {
    it('1a. creates trial subscription', async () => {
      planRepo.findByCode.mockResolvedValue(mockPlan as any);
      subRepo.findByCompany.mockResolvedValue(null);
      subRepo.create.mockResolvedValue(mockSubscription as any);
      const sub = await subscriptionService.create(
        'comp-1',
        { planCode: 'starter' },
        'user-1',
      );
      expect(sub.status).toBe('TRIAL');
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('1b. creates checkout session via StripeProvider', async () => {
      const session = await stripeProvider.createCheckoutSession({
        companyId: 'comp-1',
        customerId: 'cus_1',
        customerEmail: 't@t.com',
        customerName: 'T',
        planCode: 'starter',
        planName: 'Starter',
        priceAmount: '29.99',
        currency: 'USD',
        trialDays: 14,
        successUrl: 'https://x.com/success',
        cancelUrl: 'https://x.com/cancel',
      });
      expect(session.id).toContain('cs_sim_');
      expect(session.status).toBe('open');
    });

    it('1c. handles checkout.session.completed webhook', async () => {
      subRepo.findByCompany.mockResolvedValue(activeSub() as any);
      subRepo.updateByCompany.mockResolvedValue(activeSub() as any);
      const result = await webhookEngine.handleWebhook({
        id: 'evt_1',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_1',
            customer: 'cus_1',
            subscription: 'sub_1',
            metadata: { companyId: 'comp-1', planCode: 'starter' },
          },
        },
        created: Date.now(),
      } as any);
      expect(result.handled).toBe(true);
    });
  });

  // ─── 2. Invoice Generation and Payment ──────────────────────────

  describe('Invoice → Payment → Receipt', () => {
    it('2a. generates invoice for subscription', async () => {
      subRepo.findById.mockResolvedValue({
        ...mockSubscription,
        plan: mockPlan,
      } as any);
      invRepo.getNextInvoiceNumber.mockResolvedValue('INV-TEST-0001');
      invRepo.create.mockResolvedValue({ ...mockInvoice, lines: [] } as any);
      const inv = await invoiceService.generateInvoice(
        'sub-1',
        'comp-1',
        'user-1',
      );
      expect(inv.invoiceNumber).toBeTruthy();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('2b. marks invoice as paid + creates PaymentTransaction + AuditLog', async () => {
      invRepo.findById.mockResolvedValue(mockInvoice as any);
      invRepo.update.mockResolvedValue({
        ...mockInvoice,
        status: 'PAID',
      } as any);
      pmtRepo.create.mockResolvedValue({ id: 'pmt-1' } as any);
      const inv = await invoiceService.markPaid('inv-1', 'comp-1', '29.99');
      expect(inv.status).toBe('PAID');
      expect(pmtRepo.create).toHaveBeenCalled();
      expect(mockTx.auditLog.create).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });
  });

  // ─── 3. Payment Failure → Retry ─────────────────────────────────

  describe('Payment Failure → Retry', () => {
    it('3a. creates refund via StripeProvider', async () => {
      const refund = await stripeProvider.createRefund({
        paymentIntentId: 'pi_1',
        amount: '29.99',
        reason: 'request',
      });
      expect(refund.status).toBe('succeeded');
    });

    it('3b. handles charge.refunded webhook', async () => {
      const result = await webhookEngine.handleWebhook({
        id: 'evt_4',
        type: 'charge.refunded',
        data: {
          object: {
            payment_intent: 'pi_1',
            amount_refunded: 2999,
            currency: 'usd',
          },
        },
        created: Date.now(),
      } as any);
      expect(result.handled).toBe(true);
    });
  });

  // ─── 4. Subscription Lifecycle ──────────────────────────────────

  describe('Subscription Lifecycle', () => {
    it('4a. cancels active subscription', async () => {
      subRepo.findByCompany.mockResolvedValue(activeSub() as any);
      subRepo.updateByCompany.mockResolvedValue({
        ...activeSub(),
        status: 'CANCELLED',
      } as any);
      const sub = await subscriptionService.cancel('comp-1', 'Not needed');
      expect(sub.status).toBe('CANCELLED');
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('4b. resumes cancelled subscription', async () => {
      subRepo.findByCompany.mockResolvedValue(cancelledSub() as any);
      subRepo.updateByCompany.mockResolvedValue({
        ...cancelledSub(),
        status: 'ACTIVE',
      } as any);
      const sub = await subscriptionService.resume('comp-1', 'user-1');
      expect(sub.status).toBe('ACTIVE');
    });
  });

  // ─── 5. Webhook Idempotency ─────────────────────────────────────

  describe('Webhook Idempotency', () => {
    it('5a. skips duplicate webhook events', async () => {
      const payload: any = {
        id: 'evt_dup',
        type: 'checkout.session.completed',
        data: {
          object: {
            id: 'cs_dup',
            metadata: { companyId: 'comp-1', planCode: 'starter' },
          },
        },
        created: Date.now(),
      };
      const first = await webhookEngine.handleWebhook(payload);
      expect(first.handled).toBe(true);
      // Second call — should be idempotent (no error, marked handled)
      mockCache.get.mockResolvedValue('processed');
      const second = await webhookEngine.handleWebhook(payload);
      expect(second.handled).toBe(true);
    });
  });

  // ─── 6. Billing Portal ─────────────────────────────────────────

  describe('Billing Portal', () => {
    it('6a. creates billing portal session', async () => {
      const portal = await stripeProvider.createBillingPortalSession({
        customerId: 'cus_1',
        returnUrl: 'https://x.com/billing',
      });
      expect(portal.id).toContain('ps_sim_');
      expect(portal.url).toBeTruthy();
    });
  });

  // ─── 7. Unsupported Events ──────────────────────────────────────

  describe('Unsupported Events', () => {
    it('7a. skips unknown event types', async () => {
      const result = await webhookEngine.handleWebhook({
        id: 'evt_x',
        type: 'unknown.event',
        data: { object: {} },
        created: Date.now(),
      } as any);
      expect(result.handled).toBe(false);
    });
  });

  // ─── 8. Signature Verification ──────────────────────────────────

  describe('Signature Verification', () => {
    it('8a. returns true in development mode (no signature configured)', () => {
      expect(webhookEngine.verifySignature('{}', '')).toBe(true);
    });
  });
});
