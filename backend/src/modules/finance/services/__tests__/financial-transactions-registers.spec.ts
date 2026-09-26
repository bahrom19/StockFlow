import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { FinancialTransactionsService } from '../financial-transactions.service';
import { FinancialTransactionsRepository } from '../../repositories/financial-transactions.repository';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditLogService } from '../../../shared/services/audit-log.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { GlEngineService } from '../gl-engine.service';
import { FiscalCalendarService } from '../fiscal-calendar.service';
import { IdempotencyService } from '../../../../infrastructure/idempotency/idempotency.service';

/**
 * G16-B-02 PH1 (B02-03) — DRAFT-time ownership of referenced cash/bank
 * registers. Prisma `connect` enforces existence only, never tenant
 * ownership, so create/update must prove {id, companyId, live} inside the
 * transaction. Foreign/missing/inactive/deleted → 404 (no oracle).
 * Post-time fail-closed behavior is covered by financial-transactions-posting.
 */
describe('FinancialTransactionsService — register ownership (G16-B-02 PH1)', () => {
  const companyId = 'comp-1';
  const userId = 'user-1';
  const currentUser = { companyId, userId } as any;

  let service: FinancialTransactionsService;
  let mockRepo: Record<string, jest.Mock>;
  let tx: {
    cashAccount: { findFirst: jest.Mock };
    bankAccount: { findFirst: jest.Mock };
  };

  const liveRegister = (over: Record<string, unknown> = {}) => ({
    id: 'reg-1',
    ...over,
  });

  const ftRow = {
    id: 'ft-1',
    companyId,
    type: 'INCOME',
    direction: 'DEBIT',
    amount: new Decimal('1000'),
    fee: new Decimal('0'),
    netAmount: new Decimal('1000'),
    currency: 'KZT',
    exchangeRate: new Decimal('1'),
    transactionDate: new Date(),
    description: null,
    referenceNumber: null,
    isReconciled: false,
    cashAccountId: null,
    bankAccountId: null,
    referenceType: null,
    referenceId: null,
    createdBy: userId,
    rowVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    tx = {
      cashAccount: { findFirst: jest.fn() },
      bankAccount: { findFirst: jest.fn() },
    };
    // Default: every referenced register belongs to the company and is live.
    tx.cashAccount.findFirst.mockResolvedValue(liveRegister());
    tx.bankAccount.findFirst.mockResolvedValue(liveRegister());

    mockRepo = {
      create: jest.fn().mockImplementation(async (data: any) => ({
        ...ftRow,
        ...data,
      })),
      findById: jest.fn().mockResolvedValue({
        ...ftRow,
        postingStatus: 'DRAFT',
      }),
      update: jest.fn().mockImplementation(async (_id: any, data: any) => ({
        ...ftRow,
        ...data,
      })),
      findAll: jest.fn(),
    };

    const mockPrisma = { $transaction: jest.fn(async (fn: any) => fn(tx)) };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialTransactionsService,
        { provide: FinancialTransactionsRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: AuditLogService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: CompaniesService,
          useValue: { getBaseCurrency: jest.fn().mockResolvedValue('KZT') },
        },
        { provide: GlEngineService, useValue: { post: jest.fn() } },
        {
          provide: FiscalCalendarService,
          useValue: { ensureCurrentCalendar: jest.fn() },
        },
        { provide: IdempotencyService, useValue: {} },
      ],
    }).compile();

    service = mod.get(FinancialTransactionsService);
  });

  const baseDto = (over: Record<string, unknown> = {}) => ({
    amount: '1000',
    type: 'INCOME',
    direction: 'DEBIT',
    ...over,
  });

  describe('create', () => {
    it('should reject a foreign cash account with 404 and persist nothing', async () => {
      tx.cashAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          baseDto({ cashAccountId: 'cash-evil' }) as any,
          currentUser,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(tx.cashAccount.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'cash-evil',
          companyId,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should reject a foreign bank account with 404', async () => {
      tx.bankAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.create(baseDto({ bankAccountId: 'bank-evil' }) as any, currentUser),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should reject a foreign destination bank account with 404', async () => {
      tx.bankAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          baseDto({ destinationBankAccountId: 'bank-evil' }) as any,
          currentUser,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should reject inactive/deleted registers (filtered by predicate)', async () => {
      tx.cashAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.create(baseDto({ cashAccountId: 'cash-old' }) as any, currentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should accept same-company live registers', async () => {
      await service.create(
        baseDto({ cashAccountId: 'cash-1', bankAccountId: 'bank-1' }) as any,
        currentUser,
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cashAccount: { connect: { id: 'cash-1' } },
          bankAccount: { connect: { id: 'bank-1' } },
        }),
        expect.anything(),
      );
    });

    it('should skip validation when no registers are supplied', async () => {
      await service.create(baseDto() as any, currentUser);

      expect(tx.cashAccount.findFirst).not.toHaveBeenCalled();
      expect(tx.bankAccount.findFirst).not.toHaveBeenCalled();
      expect(mockRepo.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should reject a foreign cash account on update with 404', async () => {
      tx.cashAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.update('ft-1', { cashAccountId: 'cash-evil' } as any, currentUser),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should reject a foreign bank account on update with 404', async () => {
      tx.bankAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.update('ft-1', { bankAccountId: 'bank-evil' } as any, currentUser),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('should allow explicit disconnect without a register lookup', async () => {
      await service.update('ft-1', { cashAccountId: null } as any, currentUser);

      expect(tx.cashAccount.findFirst).not.toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('should accept a same-company register on update', async () => {
      await service.update('ft-1', { cashAccountId: 'cash-1' } as any, currentUser);

      expect(mockRepo.update).toHaveBeenCalledWith(
        'ft-1',
        expect.objectContaining({
          cashAccount: { connect: { id: 'cash-1' } },
        }),
        companyId,
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
