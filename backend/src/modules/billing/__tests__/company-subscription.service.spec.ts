import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CompanySubscriptionService } from '../services/company-subscription.service';
import { CompanySubscriptionRepository } from '../repositories/company-subscription.repository';
import { SubscriptionPlanRepository } from '../repositories/subscription-plan.repository';
import { PrismaService } from '../../../common/prisma';
import { EVENT_BUS } from '../../../common/events';

describe('CompanySubscriptionService', () => {
  let service: CompanySubscriptionService;
  let mockSubRepo: jest.Mocked<CompanySubscriptionRepository>;
  let mockPlanRepo: jest.Mocked<SubscriptionPlanRepository>;
  let mockEventBus: { publish: jest.Mock };
  let mockTx: any;

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

  const mockSubscription = {
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
    notes: null,
    rowVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    plan: mockPlan,
  };

  beforeEach(async () => {
    mockTx = {
      auditLog: { create: jest.fn() },
    };

    mockSubRepo = {
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

    mockPlanRepo = {
      findByCode: jest.fn(),
      findById: jest.fn(),
    } as any;

    mockEventBus = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanySubscriptionService,
        { provide: CompanySubscriptionRepository, useValue: mockSubRepo },
        { provide: SubscriptionPlanRepository, useValue: mockPlanRepo },
        {
          provide: PrismaService,
          useValue: { $transaction: jest.fn((cb: any) => cb(mockTx)) },
        },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<CompanySubscriptionService>(
      CompanySubscriptionService,
    );
  });

  describe('create', () => {
    it('should create a trial subscription with audit log', async () => {
      mockSubRepo.findByCompany.mockResolvedValue(null);
      mockPlanRepo.findByCode.mockResolvedValue(mockPlan as any);
      mockSubRepo.create.mockResolvedValue(mockSubscription as any);

      const result = await service.create(
        'comp-1',
        { planCode: 'starter' },
        'user-1',
      );
      expect(result.status).toBe('TRIAL');
      expect(mockEventBus.publish).toHaveBeenCalled();
      expect(mockTx.auditLog.create).toHaveBeenCalled(); // Audit log created
    });

    it('should throw if company already has subscription', async () => {
      mockSubRepo.findByCompany.mockResolvedValue(mockSubscription as any);
      await expect(
        service.create('comp-1', { planCode: 'starter' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw if plan not found', async () => {
      mockSubRepo.findByCompany.mockResolvedValue(null);
      mockPlanRepo.findByCode.mockResolvedValue(null);
      await expect(
        service.create('comp-1', { planCode: 'invalid' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCompany', () => {
    it('should return subscription', async () => {
      mockSubRepo.findByCompany.mockResolvedValue(mockSubscription as any);
      const result = await service.findByCompany('comp-1');
      expect(result.status).toBe('TRIAL');
    });

    it('should throw if not found', async () => {
      mockSubRepo.findByCompany.mockResolvedValue(null);
      await expect(service.findByCompany('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel an active subscription with audit log', async () => {
      const activeSub = { ...mockSubscription, status: 'ACTIVE' };
      mockSubRepo.findByCompany.mockResolvedValue(activeSub as any);
      mockSubRepo.updateByCompany.mockResolvedValue({
        ...activeSub,
        status: 'CANCELLED',
      } as any);

      const result = await service.cancel('comp-1', 'Too expensive');
      expect(result.status).toBe('CANCELLED');
      expect(mockEventBus.publish).toHaveBeenCalled();
      expect(mockTx.auditLog.create).toHaveBeenCalled(); // Audit log created
    });

    it('should throw for already cancelled', async () => {
      const cancelledSub = { ...mockSubscription, status: 'CANCELLED' };
      mockSubRepo.findByCompany.mockResolvedValue(cancelledSub as any);
      await expect(service.cancel('comp-1')).rejects.toThrow();
    });
  });

  describe('resume', () => {
    it('should resume a cancelled subscription with audit log', async () => {
      const cancelledSub = { ...mockSubscription, status: 'CANCELLED' };
      mockSubRepo.findByCompany.mockResolvedValue(cancelledSub as any);
      mockSubRepo.updateByCompany.mockResolvedValue({
        ...cancelledSub,
        status: 'ACTIVE',
      } as any);

      const result = await service.resume('comp-1');
      expect(result.status).toBe('ACTIVE');
      expect(mockTx.auditLog.create).toHaveBeenCalled(); // Audit log created
    });

    it('should throw for non-cancelled', async () => {
      mockSubRepo.findByCompany.mockResolvedValue(mockSubscription as any);
      await expect(service.resume('comp-1')).rejects.toThrow();
    });
  });

  describe('changePlan', () => {
    it('should change plan with audit log', async () => {
      const activeSub = {
        ...mockSubscription,
        status: 'ACTIVE',
        plan: mockPlan,
      };
      mockSubRepo.findByCompany.mockResolvedValue(activeSub as any);
      mockPlanRepo.findByCode.mockResolvedValue(mockPlan as any);
      mockSubRepo.updateByCompany.mockResolvedValue(activeSub as any);

      const result = await service.changePlan('comp-1', 'starter', 'user-1');
      expect(result.status).toBe('ACTIVE');
      expect(mockEventBus.publish).toHaveBeenCalled();
      expect(mockTx.auditLog.create).toHaveBeenCalled();
    });

    it('should throw if subscription not found', async () => {
      mockSubRepo.findByCompany.mockResolvedValue(null);
      await expect(
        service.changePlan('comp-1', 'starter', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
