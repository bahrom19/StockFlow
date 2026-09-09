import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreditLimitService } from '../services/credit-limit.service';
import { CreditLimitRepository } from '../repositories/credit-limit.repository';
import { CreditLimitMapper } from '../mappers/credit-limit.mapper';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { CompaniesService } from '../../companies/services/companies.service';

const companyId = 'comp-1';
const userId = 'user-1';
const customerId = 'cust-1';

function makeCompaniesService(currency = 'KZT') {
  return { getBaseCurrency: jest.fn().mockResolvedValue(currency) };
}

describe('CreditLimitService — currency enforcement', () => {
  let service: CreditLimitService;

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  async function setup(currency = 'KZT') {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        CreditLimitService,
        { provide: CreditLimitRepository, useValue: { create: jest.fn().mockResolvedValue({ id: 'cl-1', currency, amount: new Prisma.Decimal('50000'), customerId }) } },
        { provide: CreditLimitMapper, useValue: { toEntity: jest.fn().mockReturnValue({ id: 'cl-1', currency }) } },
        { provide: PrismaService, useValue: { $transaction: jest.fn(async (fn: any) => fn({})) } },
        { provide: AuditLogService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
        { provide: EVENT_BUS, useValue: { publish: jest.fn() } },
        { provide: CompaniesService, useValue: makeCompaniesService(currency) },
      ],
    }).compile();
    service = mod.get(CreditLimitService);
  }

  it('should default to KZT when currency omitted', async () => {
    await setup('KZT');
    const result = await service.create({ customerId, amount: 50000 } as any, companyId, userId);
    expect(result).toBeDefined();
  });

  it('should reject USD when company currency is KZT', async () => {
    await setup('KZT');
    await expect(
      service.create({ customerId, amount: 50000, currency: 'USD' } as any, companyId, userId),
    ).rejects.toThrow(BadRequestException);
  });

  it('should allow KZT when company currency is KZT', async () => {
    await setup('KZT');
    await expect(
      service.create({ customerId, amount: 50000, currency: 'KZT' } as any, companyId, userId),
    ).resolves.toBeDefined();
  });

  it('should default to USD when company currency is USD', async () => {
    await setup('USD');
    const result = await service.create({ customerId, amount: 5000 } as any, companyId, userId);
    expect(result).toBeDefined();
  });

  it('should allow explicit USD when company currency is USD', async () => {
    await setup('USD');
    await expect(
      service.create({ customerId, amount: 5000, currency: 'USD' } as any, companyId, userId),
    ).resolves.toBeDefined();
  });

  it('should reject KZT when company currency is USD', async () => {
    await setup('USD');
    await expect(
      service.create({ customerId, amount: 5000, currency: 'KZT' } as any, companyId, userId),
    ).rejects.toThrow(BadRequestException);
  });
});
