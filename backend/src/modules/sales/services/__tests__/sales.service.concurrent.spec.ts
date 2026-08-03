import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, SaleStatus } from '@prisma/client';
import { SalesRepository } from '../../repositories/sales.repository';
import { SalesService } from '../sales.service';
import { CashShiftRepository } from '../../repositories/cash-shift.repository';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { EVENT_BUS } from '../../../../common/events';
import { DocumentSequenceService } from '../../../shared/services/document-sequence.service';

const companyId = 'comp-1';
const saleId = 'sale-1';
const userId = 'user-1';
const warehouseId = 'wh-1';

const baseSale = {
  id: saleId,
  companyId,
  warehouseId,
  cashierId: userId,
  customerId: null,
  saleNumber: 'SALE-0001',
  status: 'PENDING' as const,
  subtotal: new Prisma.Decimal('100.00'),
  discount: new Prisma.Decimal('0'),
  tax: new Prisma.Decimal('0'),
  total: new Prisma.Decimal('100.00'),
  paidAmount: new Prisma.Decimal('100.00'),
  changeAmount: new Prisma.Decimal('0'),
  currency: 'KZT',
  notes: null,
  cashShiftId: null,
  rowVersion: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  items: [],
  payments: [
    {
      id: 'pay-1',
      saleId,
      method: 'CASH',
      amount: new Prisma.Decimal('100.00'),
      reference: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  receipts: [],
};

// ═══════════════════════════════════════════════
// REPOSITORY LAYER — Optimistic locking unit
// ═══════════════════════════════════════════════

describe('SalesRepository — Optimistic Locking', () => {
  let repository: SalesRepository;
  let mockPrisma: Record<string, any>;

  beforeEach(async () => {
    mockPrisma = {
      sale: {
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation((arg: any) =>
          Array.isArray(arg)
            ? Promise.all(arg)
            : arg instanceof Function
              ? arg(mockPrisma)
              : arg,
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesRepository,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DocumentSequenceService, useValue: { nextNumber: jest.fn() } },
      ],
    }).compile();

    repository = module.get<SalesRepository>(SalesRepository);
  });

  // ─────────────────────────────────────────────
  // 1. Happy path — first update succeeds
  // ─────────────────────────────────────────────
  it('should update sale when rowVersion matches', async () => {
    mockPrisma.sale.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.sale.findUnique.mockResolvedValue({
      ...baseSale,
      rowVersion: 1,
      status: 'COMPLETED',
    });

    const result = await repository.update(
      saleId,
      { status: SaleStatus.COMPLETED },
      companyId,
      0,
    );

    expect(mockPrisma.sale.updateMany).toHaveBeenCalledWith({
      where: { id: saleId, companyId, rowVersion: 0 },
      data: { status: SaleStatus.COMPLETED, rowVersion: { increment: 1 } },
    });
    expect(result.rowVersion).toBe(1);
    expect(result.status).toBe('COMPLETED');
  });

  // ─────────────────────────────────────────────
  // 2. Concurrent conflict — stale rowVersion
  // ─────────────────────────────────────────────
  it('should throw ConflictException when rowVersion is stale', async () => {
    // First request succeeds (rowVersion 0 → 1)
    mockPrisma.sale.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.sale.findUnique.mockResolvedValueOnce({
      ...baseSale,
      rowVersion: 1,
      status: 'COMPLETED',
    });
    await repository.update(
      saleId,
      { status: SaleStatus.COMPLETED },
      companyId,
      0,
    );

    // Second request with SAME rowVersion fails
    mockPrisma.sale.updateMany.mockResolvedValueOnce({ count: 0 });
    mockPrisma.sale.findFirst.mockResolvedValueOnce({
      ...baseSale,
      rowVersion: 1,
    });
    await expect(
      repository.update(saleId, { status: SaleStatus.COMPLETED }, companyId, 0),
    ).rejects.toThrow(ConflictException);
  });

  // ─────────────────────────────────────────────
  // 3. Deleted sale — NotFoundException
  // ─────────────────────────────────────────────
  it('should throw NotFoundException when sale is deleted', async () => {
    mockPrisma.sale.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.sale.findFirst.mockResolvedValue(null);

    await expect(
      repository.update(saleId, { status: SaleStatus.COMPLETED }, companyId, 0),
    ).rejects.toThrow(NotFoundException);
  });

  // ─────────────────────────────────────────────
  // 4. Legacy path — no rowVersion works
  // ─────────────────────────────────────────────
  it('should update sale without rowVersion (backward compatibility)', async () => {
    mockPrisma.sale.findFirst = jest.fn().mockResolvedValue(baseSale);
    mockPrisma.sale.update = jest
      .fn()
      .mockResolvedValue({ ...baseSale, notes: 'Updated' });

    const result = await repository.update(
      saleId,
      { notes: 'Updated' },
      companyId,
    );
    expect(mockPrisma.sale.findFirst).toHaveBeenCalled();
    expect(result.notes).toBe('Updated');
  });

  // ─────────────────────────────────────────────
  // 5. Concurrent softDelete — stale rowVersion
  // ─────────────────────────────────────────────
  it('should throw ConflictException on concurrent softDelete', async () => {
    mockPrisma.sale.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.sale.findFirst.mockResolvedValue({ ...baseSale, rowVersion: 2 });

    await expect(repository.softDelete(saleId, companyId, 0)).rejects.toThrow(
      ConflictException,
    );
  });

  // ─────────────────────────────────────────────
  // 6. updateStatus delegates to update with rowVersion
  // ─────────────────────────────────────────────
  it('updateStatus should pass rowVersion to update', async () => {
    mockPrisma.sale.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.sale.findUnique.mockResolvedValue({
      ...baseSale,
      rowVersion: 1,
      status: 'CANCELLED',
    });

    const result = await repository.updateStatus(
      saleId,
      SaleStatus.CANCELLED,
      companyId,
      0,
    );
    expect(mockPrisma.sale.updateMany).toHaveBeenCalledWith({
      where: { id: saleId, companyId, rowVersion: 0 },
      data: { status: SaleStatus.CANCELLED, rowVersion: { increment: 1 } },
    });
    expect(result.status).toBe('CANCELLED');
  });

  // ═════════════════════════════════════════════
  // SIMULATED CONCURRENT ACCESS (through repo)
  // ═════════════════════════════════════════════
  it('simulated race: two concurrent updates — only one succeeds', async () => {
    // Both start with rowVersion 0
    const rowVersion = 0;

    // First request: updateMany returns count 1 (success)
    mockPrisma.sale.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.sale.findUnique.mockResolvedValueOnce({
      ...baseSale,
      rowVersion: 1,
      status: 'COMPLETED',
    });

    // Second request: updateMany returns count 0 (stale version)
    mockPrisma.sale.updateMany.mockResolvedValueOnce({ count: 0 });
    mockPrisma.sale.findFirst.mockResolvedValueOnce({
      ...baseSale,
      rowVersion: 1,
    });

    // Fire both concurrently
    const [first, second] = await Promise.allSettled([
      repository.update(
        saleId,
        { status: SaleStatus.COMPLETED },
        companyId,
        rowVersion,
      ),
      repository.update(
        saleId,
        { status: SaleStatus.COMPLETED },
        companyId,
        rowVersion,
      ),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');
    if (second.status === 'rejected') {
      expect(second.reason).toBeInstanceOf(ConflictException);
    }

    // Verify the first incremented rowVersion
    if (first.status === 'fulfilled') {
      expect(first.value.rowVersion).toBe(1);
    }
  });
});

// ═══════════════════════════════════════════════
// SERVICE LAYER — Concurrent completion
// ═══════════════════════════════════════════════

describe('SalesService — Concurrent Completion (Optimistic Locking)', () => {
  let service: SalesService;
  let mockSalesRepo: jest.Mocked<SalesRepository>;
  let mockCashShiftRepo: jest.Mocked<CashShiftRepository>;
  let mockPrisma: Record<string, any>;
  let mockEventBus: { publish: jest.Mock };

  beforeEach(async () => {
    mockSalesRepo = {
      findById: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      getNextSaleNumber: jest.fn(),
      softDelete: jest.fn(),
      updateStatus: jest.fn(),
      findAll: jest.fn() as any,
      getReceiptBySaleId: jest.fn(),
      findBySaleNumber: jest.fn(),
    } as unknown as jest.Mocked<SalesRepository>;

    mockCashShiftRepo = {} as unknown as jest.Mocked<CashShiftRepository>;

    mockEventBus = { publish: jest.fn() };

    // Prisma $transaction executes the callback with a mock tx
    const mockTx = {
      saleItem: { findMany: jest.fn().mockResolvedValue([]) },
      receipt: { create: jest.fn().mockResolvedValue({ id: 'rcpt-1' }) },
      cashShift: {
        findFirst: jest.fn().mockResolvedValue(null), // No open shift — simpler test
      },
      payment: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      warehouse: { findFirst: jest.fn() },
      customer: { findFirst: jest.fn() },
      product: { findFirst: jest.fn() },
      sale: { findMany: jest.fn() },
    };

    mockPrisma = {
      $transaction: jest
        .fn()
        .mockImplementation((cb: (tx: any) => any) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: SalesRepository, useValue: mockSalesRepo },
        { provide: CashShiftRepository, useValue: mockCashShiftRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DocumentSequenceService, useValue: { nextNumber: jest.fn() } },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  // ─────────────────────────────────────────────
  // 7. rowVersion propagates from entity to repository
  // ─────────────────────────────────────────────
  it('should pass rowVersion from Sale entity to repository.update()', async () => {
    const saleWithVersion = { ...baseSale, rowVersion: 3, status: 'PENDING' };
    mockSalesRepo.findById.mockResolvedValue(saleWithVersion as any);
    mockSalesRepo.update.mockResolvedValue({
      ...baseSale,
      rowVersion: 4,
      status: 'COMPLETED',
      items: [],
      payments: [],
      receipts: [],
    } as any);

    await service.transitionStatus(
      saleId,
      SaleStatus.COMPLETED,
      userId,
      companyId,
    );

    expect(mockSalesRepo.findById).toHaveBeenCalledWith(
      saleId,
      companyId,
      expect.anything(),
    );
    expect(mockSalesRepo.update).toHaveBeenCalledWith(
      saleId,
      expect.objectContaining({ status: SaleStatus.COMPLETED }),
      companyId,
      3, // rowVersion from the Sale entity
      expect.anything(), // tx
    );
  });

  // ─────────────────────────────────────────────
  // 8. Concurrent transitionStatus: first succeeds, second fails
  // ─────────────────────────────────────────────
  it('concurrent transitionStatus: first completes, second throws ConflictException', async () => {
    // Both requests fetch the same sale with rowVersion 0
    const salePristine = { ...baseSale, status: 'PENDING', rowVersion: 0 };

    mockSalesRepo.findById.mockResolvedValue(salePristine as any); // Both see rowVersion 0

    // First update succeeds
    mockSalesRepo.update
      .mockResolvedValueOnce({
        ...salePristine,
        rowVersion: 1,
        status: 'COMPLETED',
        items: [],
        payments: [],
        receipts: [],
      } as any)
      // Second update throws ConflictException (stale rowVersion)
      .mockRejectedValueOnce(
        new ConflictException(
          `Sale ${saleId} was modified by another user. Please refresh and retry.`,
        ),
      );

    // Fire both concurrently — same sale, same rowVersion
    const [first, second] = await Promise.allSettled([
      service.transitionStatus(saleId, SaleStatus.COMPLETED, userId, companyId),
      service.transitionStatus(saleId, SaleStatus.COMPLETED, userId, companyId),
    ]);

    expect(first.status).toBe('fulfilled');
    expect(second.status).toBe('rejected');

    if (first.status === 'fulfilled') {
      expect(first.value.status).toBe('COMPLETED');
      expect(first.value.rowVersion).toBe(1);
    }
    if (second.status === 'rejected') {
      expect(second.reason).toBeInstanceOf(ConflictException);
    }

    // Both called findById (each transaction does its own lookup)
    expect(mockSalesRepo.findById).toHaveBeenCalledTimes(2);
    // update called twice — first succeeds, second fails
    expect(mockSalesRepo.update).toHaveBeenCalledTimes(2);
  });

  // ─────────────────────────────────────────────
  // 9. softDelete propagates rowVersion to repository
  // ─────────────────────────────────────────────
  it('should pass rowVersion from entity to repository.softDelete()', async () => {
    const draftSale = { ...baseSale, status: 'DRAFT' as const, rowVersion: 5 };
    mockSalesRepo.findById.mockResolvedValue(draftSale as any);
    mockSalesRepo.softDelete = jest.fn().mockResolvedValue(draftSale as any);

    await service.softDelete(saleId, companyId);
    expect(mockSalesRepo.softDelete).toHaveBeenCalledWith(saleId, companyId, 5);
  });
});
