import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionPlanService } from '../services/subscription-plan.service';
import { SubscriptionPlanRepository } from '../repositories/subscription-plan.repository';
import { PrismaService } from '../../../common/prisma';

describe('SubscriptionPlanService', () => {
  let service: SubscriptionPlanService;
  let prisma: PrismaService;
  let mockRepo: jest.Mocked<SubscriptionPlanRepository>;

  const mockPlan = {
    id: 'plan-1',
    code: 'starter',
    name: 'Starter',
    description: 'For small businesses',
    priceMonthly: 29.99,
    priceYearly: 290.00,
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

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByCode: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      upsertByCode: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionPlanService,
        { provide: SubscriptionPlanRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: { $transaction: jest.fn((cb: any) => cb({})), auditLog: { create: jest.fn() } } },
      ],
    }).compile();

    service = module.get<SubscriptionPlanService>(SubscriptionPlanService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create a new plan', async () => {
      mockRepo.findByCode.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(mockPlan as any);

      const result = await service.create(
        {
          code: 'starter',
          name: 'Starter',
          priceMonthly: 29.99,
          priceYearly: 290.00,
        },
        'comp-1',
        'user-1',
      );

      expect(result.code).toBe('starter');
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('should write audit log with a real companyId (not empty string)', async () => {
      mockRepo.findByCode.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(mockPlan as any);

      await service.create(
        { code: 'starter', name: 'Starter', priceMonthly: 29.99, priceYearly: 290.0 },
        'comp-1',
        'user-1',
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PLAN_CREATED',
          entity: 'SubscriptionPlan',
          companyId: 'comp-1',
          userId: 'user-1',
        }),
      });
    });

    it('should throw ConflictException if code exists', async () => {
      mockRepo.findByCode.mockResolvedValue(mockPlan as any);
      await expect(service.create(
        {
          code: 'starter',
          name: 'Starter',
          priceMonthly: 29.99,
          priceYearly: 290.00,
        },
        'comp-1',
        'user-1',
      )).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return a plan by id', async () => {
      mockRepo.findById.mockResolvedValue(mockPlan as any);
      const result = await service.findById('plan-1');
      expect(result.id).toBe('plan-1');
    });

    it('should throw if plan not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCode', () => {
    it('should return a plan by code', async () => {
      mockRepo.findByCode.mockResolvedValue(mockPlan as any);
      const result = await service.findByCode('starter');
      expect(result.code).toBe('starter');
    });

    it('should throw if plan not found', async () => {
      mockRepo.findByCode.mockResolvedValue(null);
      await expect(service.findByCode('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a plan', async () => {
      mockRepo.findById.mockResolvedValue(mockPlan as any);
      mockRepo.update.mockResolvedValue({ ...mockPlan, name: 'Starter Plus' } as any);

      const result = await service.update('plan-1', { name: 'Starter Plus' }, 'comp-1', 'user-1');
      expect(result.name).toBe('Starter Plus');
    });

    it('should write audit log with a real companyId (not empty string)', async () => {
      mockRepo.findById.mockResolvedValue(mockPlan as any);
      mockRepo.update.mockResolvedValue({ ...mockPlan, name: 'Starter Plus' } as any);

      await service.update('plan-1', { name: 'Starter Plus' }, 'comp-1', 'user-1');

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PLAN_UPDATED',
          entity: 'SubscriptionPlan',
          companyId: 'comp-1',
          userId: 'user-1',
        }),
      });
    });

    it('should throw if plan not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'Test' }, 'comp-1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a plan', async () => {
      mockRepo.findById.mockResolvedValue(mockPlan as any);
      mockRepo.softDelete.mockResolvedValue({ ...mockPlan, deletedAt: new Date() } as any);
      await expect(service.softDelete('plan-1')).resolves.toBeUndefined();
    });

    it('should throw if plan not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.softDelete('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated plans', async () => {
      mockRepo.findAll.mockResolvedValue({ items: [mockPlan as any], total: 1 });
      const result = await service.findAll({});
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
