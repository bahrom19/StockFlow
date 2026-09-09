import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FinancialTransactionsService } from '../services/financial-transactions.service';
import { FinancialTransactionsRepository } from '../repositories/financial-transactions.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { CompaniesService } from '../../companies/services/companies.service';

const companyId = 'comp-1';
const userId = 'user-1';

const mockRepo = {
  create: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
};

const mockPrisma = {
  $transaction: jest.fn(async (fn: any) => fn({})),
};

const mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) };

function makeCompaniesService(currency = 'KZT') {
  return { getBaseCurrency: jest.fn().mockResolvedValue(currency) };
}

describe('FinancialTransactionsService — currency enforcement', () => {
  let service: FinancialTransactionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.create.mockResolvedValue({
      id: 'ft-1',
      companyId,
      currency: 'KZT',
      amount: new (require('@prisma/client/runtime/library').Decimal)('1000'),
      fee: new (require('@prisma/client/runtime/library').Decimal)('0'),
      netAmount: new (require('@prisma/client/runtime/library').Decimal)('1000'),
      exchangeRate: new (require('@prisma/client/runtime/library').Decimal)('1'),
      type: 'INCOME',
      direction: 'DEBIT',
      transactionDate: new Date(),
      description: null,
      referenceNumber: null,
      isReconciled: false,
      cashAccountId: null,
      bankAccountId: null,
      referenceType: null,
      referenceId: null,
      createdBy: null,
      rowVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as any);

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialTransactionsService,
        { provide: FinancialTransactionsRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: CompaniesService, useValue: makeCompaniesService('KZT') },
      ],
    }).compile();

    service = mod.get(FinancialTransactionsService);
  });

  it('should default to KZT when currency omitted', async () => {
    await service.create(
      { amount: '1000', type: 'INCOME', direction: 'DEBIT' } as any,
      { companyId, userId } as any,
    );
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'KZT' }),
      expect.anything(),
    );
  });

  it('should reject USD when company currency is KZT', async () => {
    await expect(
      service.create(
        { amount: '1000', type: 'INCOME', direction: 'DEBIT', currency: 'USD' } as any,
        { companyId, userId } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should allow KZT when company currency is KZT', async () => {
    await service.create(
      { amount: '1000', type: 'INCOME', direction: 'DEBIT', currency: 'KZT' } as any,
      { companyId, userId } as any,
    );
    expect(mockRepo.create).toHaveBeenCalled();
  });
});

describe('FinancialTransactionsService — company USD', () => {
  let service: FinancialTransactionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.create.mockResolvedValue({
      id: 'ft-1',
      companyId,
      currency: 'USD',
      amount: new (require('@prisma/client/runtime/library').Decimal)('1000'),
      fee: new (require('@prisma/client/runtime/library').Decimal)('0'),
      netAmount: new (require('@prisma/client/runtime/library').Decimal)('1000'),
      exchangeRate: new (require('@prisma/client/runtime/library').Decimal)('1'),
      type: 'INCOME',
      direction: 'DEBIT',
      transactionDate: new Date(),
      description: null,
      referenceNumber: null,
      isReconciled: false,
      cashAccountId: null,
      bankAccountId: null,
      referenceType: null,
      referenceId: null,
      createdBy: null,
      rowVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    } as any);

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialTransactionsService,
        { provide: FinancialTransactionsRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: CompaniesService, useValue: makeCompaniesService('USD') },
      ],
    }).compile();

    service = mod.get(FinancialTransactionsService);
  });

  it('should default to USD when currency omitted', async () => {
    await service.create(
      { amount: '1000', type: 'INCOME', direction: 'DEBIT' } as any,
      { companyId, userId } as any,
    );
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'USD' }),
      expect.anything(),
    );
  });

  it('should allow explicit USD', async () => {
    await service.create(
      { amount: '1000', type: 'INCOME', direction: 'DEBIT', currency: 'USD' } as any,
      { companyId, userId } as any,
    );
    expect(mockRepo.create).toHaveBeenCalled();
  });

  it('should reject KZT when company currency is USD', async () => {
    await expect(
      service.create(
        { amount: '1000', type: 'INCOME', direction: 'DEBIT', currency: 'KZT' } as any,
        { companyId, userId } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
