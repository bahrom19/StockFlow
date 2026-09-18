import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreditLimitService } from '../services/credit-limit.service';
import { CreditLimitRepository } from '../repositories/credit-limit.repository';
import { CreditLimitMapper } from '../mappers/credit-limit.mapper';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EVENT_BUS } from '../../../common/events';
import { CompaniesService } from '../../companies/services/companies.service';

/**
 * G12-R1 — service-level tenant isolation tests for CreditLimitService
 * (G12-7 + create ownership): foreign customer → 404 on by-customer read
 * and create; same-tenant behavior unchanged.
 */
describe('G12-R1 — CreditLimitService tenant isolation', () => {
  const companyId = 'comp-1';
  const userId = 'user-1';
  const customerId = 'cust-1';

  let service: CreditLimitService;
  let repo: {
    findByCustomerId: jest.Mock;
    findCustomerCompany: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findByCustomerId: jest.fn(),
      findCustomerCompany: jest.fn().mockResolvedValue({ id: customerId }),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditLimitService,
        { provide: CreditLimitRepository, useValue: repo },
        {
          provide: CreditLimitMapper,
          useValue: { toEntity: jest.fn((v) => v) },
        },
        {
          provide: PrismaService,
          useValue: { $transaction: jest.fn(async (fn: any) => fn({})) },
        },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
        { provide: EVENT_BUS, useValue: { publish: jest.fn() } },
        {
          provide: CompaniesService,
          useValue: { getBaseCurrency: jest.fn().mockResolvedValue('KZT') },
        },
      ],
    }).compile();

    service = module.get(CreditLimitService);
  });

  describe('findByCustomer', () => {
    it('same tenant → returns credit limit', async () => {
      repo.findByCustomerId.mockResolvedValue({
        id: 'cl-1',
        amount: new Prisma.Decimal('1000'),
      });

      const result = await service.findByCustomer(customerId, companyId);

      expect(result).toBeDefined();
      expect(repo.findByCustomerId).toHaveBeenCalledWith(customerId, companyId);
    });

    it('foreign customer → 404 (no existence leak)', async () => {
      repo.findByCustomerId.mockResolvedValue(null);

      await expect(
        service.findByCustomer(customerId, companyId),
      ).rejects.toThrow(NotFoundException);
      expect(repo.findByCustomerId).toHaveBeenCalledWith(customerId, companyId);
    });
  });

  describe('create', () => {
    it('same tenant → creates with ownership check inside transaction', async () => {
      repo.create.mockResolvedValue({
        id: 'cl-1',
        currency: 'KZT',
        amount: new Prisma.Decimal('50000'),
      });

      const result = await service.create(
        { customerId, amount: 50000 } as any,
        companyId,
        userId,
      );

      expect(result).toBeDefined();
      expect(repo.findCustomerCompany).toHaveBeenCalledWith(
        customerId,
        companyId,
        expect.anything(),
      );
    });

    it('foreign customer → 404, no create, no audit', async () => {
      repo.findCustomerCompany.mockResolvedValue(null);

      await expect(
        service.create({ customerId, amount: 50000 } as any, companyId, userId),
      ).rejects.toThrow(NotFoundException);

      expect(repo.create).not.toHaveBeenCalled();
    });
  });
});
