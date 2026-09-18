import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LoyaltyService } from '../services/loyalty.service';
import { LoyaltyRepository } from '../repositories/loyalty.repository';
import { LoyaltyMapper } from '../mappers/loyalty.mapper';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EVENT_BUS } from '../../../common/events';

/**
 * G12-R1 — service-level tenant isolation tests for LoyaltyService.
 *
 * Loyalty is the highest-risk CRM child-entity path: earn/redeem mutate
 * financial points. Foreign customer access must yield 404 BEFORE any
 * mutation, and same-tenant flows must remain unchanged.
 */
describe('G12-R1 — LoyaltyService tenant isolation', () => {
  const companyId = 'comp-1';
  const userId = 'user-1';
  const customerId = 'cust-1';

  let service: LoyaltyService;
  let repo: {
    findByCustomerId: jest.Mock;
    findByCustomerIdOrThrow: jest.Mock;
    findCustomerCompany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  let auditLog: { log: jest.Mock };

  beforeEach(async () => {
    repo = {
      findByCustomerId: jest.fn(),
      findByCustomerIdOrThrow: jest.fn(),
      findCustomerCompany: jest.fn().mockResolvedValue({ id: customerId }),
      create: jest.fn(),
      update: jest.fn(),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        { provide: LoyaltyRepository, useValue: repo },
        {
          provide: LoyaltyMapper,
          useValue: { toEntity: jest.fn((v) => v) },
        },
        {
          provide: PrismaService,
          useValue: { $transaction: jest.fn(async (fn: any) => fn({})) },
        },
        { provide: AuditLogService, useValue: auditLog },
        { provide: EVENT_BUS, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get(LoyaltyService);
  });

  const account = {
    id: 'loy-1',
    customerId,
    points: 100,
    lifetimePoints: 150,
  };

  describe('getAccount', () => {
    it('same tenant → returns account', async () => {
      repo.findByCustomerIdOrThrow.mockResolvedValue(account);

      const result = await service.getAccount(customerId, companyId);

      expect(result).toBeDefined();
      expect(repo.findByCustomerIdOrThrow).toHaveBeenCalledWith(
        customerId,
        companyId,
      );
    });

    it('foreign customer → 404', async () => {
      repo.findByCustomerIdOrThrow.mockRejectedValue(
        new NotFoundException('Loyalty account not found for customer'),
      );

      await expect(service.getAccount(customerId, companyId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('earnPoints', () => {
    it('same tenant → updates points', async () => {
      repo.findByCustomerIdOrThrow.mockResolvedValue(account);
      repo.update.mockResolvedValue({ ...account, points: 150 });

      const result = await service.earnPoints(
        { customerId, points: 50 } as any,
        companyId,
        userId,
      );

      expect(result.points).toBe(150);
      expect(repo.findByCustomerIdOrThrow).toHaveBeenCalledWith(
        customerId,
        companyId,
      );
    });

    it('foreign customer → 404, no mutation, no audit', async () => {
      repo.findByCustomerIdOrThrow.mockRejectedValue(new NotFoundException());

      await expect(
        service.earnPoints({ customerId, points: 50 } as any, companyId, userId),
      ).rejects.toThrow(NotFoundException);

      expect(repo.update).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });
  });

  describe('redeemPoints', () => {
    it('same tenant → redeems points', async () => {
      repo.findByCustomerIdOrThrow.mockResolvedValue(account);
      repo.update.mockResolvedValue({ ...account, points: 40 });

      const result = await service.redeemPoints(
        { customerId, points: 60 } as any,
        companyId,
        userId,
      );

      expect(result.points).toBe(40);
      expect(repo.findByCustomerIdOrThrow).toHaveBeenCalledWith(
        customerId,
        companyId,
      );
    });

    it('foreign customer → 404, no mutation', async () => {
      repo.findByCustomerIdOrThrow.mockRejectedValue(new NotFoundException());

      await expect(
        service.redeemPoints({ customerId, points: 10 } as any, companyId, userId),
      ).rejects.toThrow(NotFoundException);

      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('getOrCreateAccount', () => {
    it('foreign customer → 404 before any create/audit', async () => {
      repo.findCustomerCompany.mockResolvedValue(null);

      await expect(
        service.getOrCreateAccount(customerId, companyId, userId),
      ).rejects.toThrow(NotFoundException);

      expect(repo.create).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('same tenant, existing account → no create', async () => {
      repo.findByCustomerId.mockResolvedValue(account);

      const result = await service.getOrCreateAccount(customerId, companyId, userId);

      expect(result).toBeDefined();
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('same tenant, no account → creates with ownership-verified customer', async () => {
      repo.findByCustomerId.mockResolvedValue(null);
      repo.create.mockResolvedValue({
        ...account,
        points: 0,
        lifetimePoints: 0,
      });

      const result = await service.getOrCreateAccount(customerId, companyId, userId);

      expect(result).toBeDefined();
      expect(repo.findCustomerCompany).toHaveBeenCalledWith(customerId, companyId);
      expect(repo.create).toHaveBeenCalled();
    });
  });
});
