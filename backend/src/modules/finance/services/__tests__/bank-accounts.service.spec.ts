import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { BankAccountsService } from '../bank-accounts.service';

const companyId = 'comp-1';
const currentUser = {
  userId: 'user-1',
  companyId,
  roles: ['Admin'],
  email: 'admin@example.com',
} as any;

const account = (over: Record<string, any> = {}) => ({
  id: 'bank-1',
  companyId,
  bankName: 'Bank',
  accountNumber: '123',
  rowVersion: 0,
  ...over,
});

/**
 * G16-B-02 PH1 (B02-05) — referenced chart account must belong to the
 * caller's company (active, non-deleted). Foreign/missing/inactive/deleted →
 * 404 (no tenant-existence oracle).
 */
describe('BankAccountsService — reference ownership (G16-B-02 PH1)', () => {
  let service: BankAccountsService;
  let repository: any;
  let mockTx: any;
  let companiesService: any;

  beforeEach(() => {
    mockTx = {
      chartOfAccount: { findFirst: jest.fn() },
    };
    repository = {
      create: jest.fn().mockImplementation(async (data: any) => ({
        id: 'bank-1',
        companyId,
        bankName: 'Bank',
        accountNumber: '123',
        accountName: null,
        iban: null,
        bic: null,
        currency: 'KZT',
        openingBalance: new Decimal('0'),
        currentBalance: new Decimal('0'),
        isDefault: false,
        isActive: true,
        description: null,
        rowVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...data,
      })),
      findById: jest.fn(),
      update: jest.fn().mockImplementation(async (_id: any, data: any) => ({
        id: 'bank-1',
        companyId,
        bankName: 'Bank',
        accountNumber: '123',
        accountName: null,
        iban: null,
        bic: null,
        currency: 'KZT',
        openingBalance: new Decimal('0'),
        currentBalance: new Decimal('0'),
        isDefault: false,
        isActive: true,
        description: null,
        rowVersion: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        ...data,
      })),
      softDelete: jest.fn(),
    };
    companiesService = {
      getBaseCurrency: jest.fn().mockResolvedValue('KZT'),
    };
    const prisma = {
      $transaction: jest.fn((cb: (tx: any) => any) => cb(mockTx)),
    };
    const auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    service = new BankAccountsService(
      repository,
      prisma as any,
      auditLog as any,
      companiesService as any,
    );
  });

  const dto = (over: Record<string, any> = {}) => ({
    bankName: 'Bank',
    accountNumber: '123',
    chartOfAccountId: 'acc-1020',
    ...over,
  });

  describe('create', () => {
    beforeEach(() => {
      mockTx.chartOfAccount.findFirst.mockResolvedValue({ id: 'acc-1020' });
    });

    it('should reject a foreign chart account with 404 and persist nothing', async () => {
      mockTx.chartOfAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.create(dto() as any, currentUser),
      ).rejects.toThrow(NotFoundException);

      expect(mockTx.chartOfAccount.findFirst).toHaveBeenCalledWith({
        where: { id: 'acc-1020', companyId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should reject an inactive/deleted chart account with 404', async () => {
      mockTx.chartOfAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.create(dto({ chartOfAccountId: 'acc-old' }) as any, currentUser),
      ).rejects.toThrow(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should accept a same-company live chart account', async () => {
      await service.create(dto() as any, currentUser);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          chartOfAccount: { connect: { id: 'acc-1020' } },
        }),
        expect.anything(),
      );
    });

    it('should skip the lookup when no chart account is supplied', async () => {
      await service.create(
        { bankName: 'Bank', accountNumber: '123' } as any,
        currentUser,
      );

      expect(mockTx.chartOfAccount.findFirst).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      repository.findById.mockResolvedValue(account());
      mockTx.chartOfAccount.findFirst.mockResolvedValue({ id: 'acc-1030' });
    });

    it('should reject a foreign chart account on update with 404', async () => {
      mockTx.chartOfAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.update(
          'bank-1',
          { chartOfAccountId: 'acc-evil' } as any,
          currentUser,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should allow explicit disconnect without a lookup', async () => {
      await service.update(
        'bank-1',
        { chartOfAccountId: null } as any,
        currentUser,
      );

      expect(mockTx.chartOfAccount.findFirst).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalled();
    });
  });
});
