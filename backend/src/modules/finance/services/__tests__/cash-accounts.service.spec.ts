import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { CashAccountsService } from '../cash-accounts.service';

const companyId = 'comp-1';
const currentUser = {
  userId: 'user-1',
  companyId,
  roles: ['Admin'],
  email: 'admin@example.com',
} as any;

const account = (over: Record<string, any> = {}) => ({
  id: 'cash-1',
  companyId,
  name: 'Main register',
  rowVersion: 0,
  ...over,
});

/**
 * G16-B-02 PH1 (B02-04) — referenced warehouse and chart account must belong
 * to the caller's company (active, non-deleted). Foreign/missing/inactive/
 * deleted → 404 (no tenant-existence oracle). Inactive warehouse rejection is
 * an intentional behavior tightening.
 */
describe('CashAccountsService — reference ownership (G16-B-02 PH1)', () => {
  let service: CashAccountsService;
  let repository: any;
  let mockTx: any;
  let companiesService: any;

  beforeEach(() => {
    mockTx = {
      warehouse: { findFirst: jest.fn() },
      chartOfAccount: { findFirst: jest.fn() },
    };
    repository = {
      create: jest.fn().mockImplementation(async (data: any) => ({
        id: 'cash-1',
        companyId,
        warehouseId: null,
        chartOfAccountId: null,
        type: 'REGISTER',
        currency: 'KZT',
        openingBalance: new Decimal('0'),
        currentBalance: new Decimal('0'),
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
        id: 'cash-1',
        companyId,
        warehouseId: null,
        chartOfAccountId: null,
        name: 'Main register',
        type: 'REGISTER',
        currency: 'KZT',
        openingBalance: new Decimal('0'),
        currentBalance: new Decimal('0'),
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
    service = new CashAccountsService(
      repository,
      prisma as any,
      auditLog as any,
      companiesService as any,
    );
  });

  const dto = (over: Record<string, any> = {}) => ({
    name: 'Main register',
    warehouseId: 'wh-1',
    chartOfAccountId: 'acc-1010',
    ...over,
  });

  describe('create', () => {
    beforeEach(() => {
      mockTx.warehouse.findFirst.mockResolvedValue({ id: 'wh-1' });
      mockTx.chartOfAccount.findFirst.mockResolvedValue({ id: 'acc-1010' });
    });

    it('should reject a foreign warehouse with 404 and persist nothing', async () => {
      mockTx.warehouse.findFirst.mockResolvedValue(null);

      await expect(
        service.create(dto() as any, currentUser),
      ).rejects.toThrow(NotFoundException);

      expect(mockTx.warehouse.findFirst).toHaveBeenCalledWith({
        where: { id: 'wh-1', companyId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should reject an inactive warehouse with 404', async () => {
      mockTx.warehouse.findFirst.mockResolvedValue(null);

      await expect(
        service.create(dto({ warehouseId: 'wh-old' }) as any, currentUser),
      ).rejects.toThrow(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should reject a foreign chart account with 404', async () => {
      mockTx.chartOfAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.create(dto() as any, currentUser),
      ).rejects.toThrow(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('should accept same-company live references', async () => {
      const result = await service.create(dto() as any, currentUser);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          warehouse: { connect: { id: 'wh-1' } },
          chartOfAccount: { connect: { id: 'acc-1010' } },
        }),
        expect.anything(),
      );
      expect(result.id).toBe('cash-1');
    });

    it('should skip lookups when no references are supplied', async () => {
      await service.create({ name: 'No links' } as any, currentUser);

      expect(mockTx.warehouse.findFirst).not.toHaveBeenCalled();
      expect(mockTx.chartOfAccount.findFirst).not.toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    beforeEach(() => {
      repository.findById.mockResolvedValue(account());
      mockTx.warehouse.findFirst.mockResolvedValue({ id: 'wh-2' });
      mockTx.chartOfAccount.findFirst.mockResolvedValue({ id: 'acc-1020' });
    });

    it('should reject a foreign warehouse on update with 404', async () => {
      mockTx.warehouse.findFirst.mockResolvedValue(null);

      await expect(
        service.update('cash-1', { warehouseId: 'wh-evil' } as any, currentUser),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should reject a foreign chart account on update with 404', async () => {
      mockTx.chartOfAccount.findFirst.mockResolvedValue(null);

      await expect(
        service.update(
          'cash-1',
          { chartOfAccountId: 'acc-evil' } as any,
          currentUser,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should allow explicit disconnect without a lookup', async () => {
      await service.update('cash-1', { warehouseId: null } as any, currentUser);

      expect(mockTx.warehouse.findFirst).not.toHaveBeenCalled();
      expect(repository.update).toHaveBeenCalled();
    });
  });
});
