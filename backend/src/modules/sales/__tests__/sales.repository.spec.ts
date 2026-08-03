import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, Sale, SaleStatus } from '@prisma/client';
import { SalesRepository } from '../repositories/sales.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { DocumentSequenceService } from '../../shared/services/document-sequence.service';

/**
 * Regression tests for Blocker B1 — `POST /sales/{id}/complete` returned
 * 400 "Invalid database query" (Prisma Validation Error) because
 * `SalesRepository.update` passed relation writes (e.g. `cashShift: { connect }`)
 * into `sale.updateMany`, which only accepts scalar fields
 * (`SaleUpdateManyMutationInput`).
 *
 * The fix splits `data` into scalar fields (applied via `updateMany` with the
 * optimistic-lock rowVersion check) and relation writes (applied via a
 * follow-up `sale.update`).
 */
describe('SalesRepository — update with relation writes + optimistic locking (B1 regression)', () => {
  let repo: SalesRepository;
  let mockPrisma: Record<string, any>;

  const baseSale = {
    id: 'sale-1',
    companyId: 'comp-1',
    warehouseId: 'wh-1',
    cashierId: 'user-1',
    customerId: null,
    saleNumber: 'SALE-0001',
    status: SaleStatus.COMPLETED,
    subtotal: new Prisma.Decimal('100'),
    discount: new Prisma.Decimal('0'),
    tax: new Prisma.Decimal('0'),
    total: new Prisma.Decimal('100'),
    paidAmount: new Prisma.Decimal('100'),
    changeAmount: new Prisma.Decimal('0'),
    currency: 'KZT',
    notes: null,
    cashShiftId: null,
    rowVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    items: [],
    payments: [],
    receipts: [],
  };

  let mockSeq: { nextNumber: jest.Mock };

  beforeEach(async () => {
    mockPrisma = {
      sale: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
    };
    mockSeq = { nextNumber: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesRepository,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DocumentSequenceService, useValue: mockSeq },
      ],
    }).compile();

    repo = module.get<SalesRepository>(SalesRepository);
  });

  it('should NOT pass relation writes (cashShift connect) to updateMany — B1 fix', async () => {
    mockPrisma.sale.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.sale.findUnique.mockResolvedValue(baseSale as Sale);

    const data: Prisma.SaleUpdateInput = {
      status: SaleStatus.COMPLETED,
      cashShift: { connect: { id: 'shift-1' } },
    };

    const result = await repo.update('sale-1', data, 'comp-1', 0);

    // updateMany must receive ONLY scalar fields + rowVersion increment —
    // passing cashShift here caused the Prisma Validation Error (B1).
    expect(mockPrisma.sale.updateMany).toHaveBeenCalledWith({
      where: { id: 'sale-1', companyId: 'comp-1', rowVersion: 0 },
      data: { status: SaleStatus.COMPLETED, rowVersion: { increment: 1 } },
    });
    // Relation write is applied via a follow-up sale.update.
    expect(mockPrisma.sale.update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: { cashShift: { connect: { id: 'shift-1' } } },
    });
    expect(result.id).toBe('sale-1');
  });

  it('should apply scalar-only updates via updateMany without a follow-up update', async () => {
    mockPrisma.sale.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.sale.findUnique.mockResolvedValue(baseSale as Sale);

    await repo.update('sale-1', { status: SaleStatus.COMPLETED }, 'comp-1', 0);

    expect(mockPrisma.sale.updateMany).toHaveBeenCalledWith({
      where: { id: 'sale-1', companyId: 'comp-1', rowVersion: 0 },
      data: { status: SaleStatus.COMPLETED, rowVersion: { increment: 1 } },
    });
    expect(mockPrisma.sale.update).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when rowVersion is stale', async () => {
    mockPrisma.sale.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.sale.findFirst.mockResolvedValue({
      ...baseSale,
      rowVersion: 5,
    });

    await expect(
      repo.update('sale-1', { status: SaleStatus.COMPLETED }, 'comp-1', 0),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when sale does not exist', async () => {
    mockPrisma.sale.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.sale.findFirst.mockResolvedValue(null);

    await expect(
      repo.update('sale-1', { status: SaleStatus.COMPLETED }, 'comp-1', 0),
    ).rejects.toThrow(NotFoundException);
  });

  it('should support legacy path (no rowVersion) with relation writes', async () => {
    mockPrisma.sale.findFirst.mockResolvedValue(baseSale as Sale);
    mockPrisma.sale.update.mockResolvedValue({
      ...baseSale,
      status: SaleStatus.COMPLETED,
    } as Sale);

    const result = await repo.update(
      'sale-1',
      {
        status: SaleStatus.COMPLETED,
        cashShift: { connect: { id: 'shift-1' } },
      },
      'comp-1',
      undefined,
    );

    expect(mockPrisma.sale.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.sale.update).toHaveBeenCalled();
    expect(result.id).toBe('sale-1');
  });

  // ── M2: getNextSaleNumber uses the atomic sequence, not count+1 ──
  it('should generate the next sale number from the atomic sequence (M2)', async () => {
    mockSeq.nextNumber.mockResolvedValue(5);

    const result = await repo.getNextSaleNumber('comp-1');

    expect(mockSeq.nextNumber).toHaveBeenCalledWith('comp-1', 'SALE');
    expect(mockPrisma.sale.count).not.toHaveBeenCalled();
    expect(result).toBe('SALE-COMP-1-0005');
  });

  it('should map a saleNumber unique violation (P2002) to ConflictException 409 (M2)', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique violation', {
      code: 'P2002',
      clientVersion: '6',
      meta: { target: ['saleNumber'] },
    });
    mockPrisma.sale.create.mockRejectedValue(p2002);

    await expect(
      repo.create({ saleNumber: 'SALE-COMP-0001' } as Prisma.SaleCreateInput),
    ).rejects.toThrow(ConflictException);
  });

  it('should NOT map non-saleNumber unique violations (P2002) to conflict (M2)', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique violation', {
      code: 'P2002',
      clientVersion: '6',
      meta: { target: ['otherField'] },
    });
    mockPrisma.sale.create.mockRejectedValue(p2002);

    await expect(
      repo.create({ saleNumber: 'SALE-COMP-0001' } as Prisma.SaleCreateInput),
    ).rejects.toBe(p2002);
  });
});
