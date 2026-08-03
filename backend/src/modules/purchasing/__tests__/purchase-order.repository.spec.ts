import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PurchaseOrderRepository } from '../repositories/purchase-order.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Regression tests for the Blocker B1 pattern in PurchaseOrderRepository.update:
 * relation writes (e.g. `supplier: { connect }` from
 * PurchaseOrderService.update) must NOT be passed into `purchaseOrder.updateMany`,
 * which only accepts scalar fields (PurchaseOrderUpdateManyMutationInput).
 */
describe('PurchaseOrderRepository — update with relation writes + optimistic locking (B1 regression)', () => {
  let repo: PurchaseOrderRepository;
  let mockPrisma: Record<string, any>;

  const basePo = {
    id: 'po-1',
    companyId: 'comp-1',
    supplierId: 'sup-1',
    orderNumber: 'PO-001',
    status: PurchaseOrderStatus.DRAFT,
    subtotal: new Prisma.Decimal('100'),
    discountAmount: new Prisma.Decimal('0'),
    taxAmount: new Prisma.Decimal('12'),
    grandTotal: new Prisma.Decimal('112'),
    paidAmount: new Prisma.Decimal('0'),
    rowVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    items: [],
    supplier: { id: 'sup-1', companyName: 'TS' },
  };

  beforeEach(async () => {
    mockPrisma = {
      purchaseOrder: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<PurchaseOrderRepository>(PurchaseOrderRepository);
  });

  it('should NOT pass relation writes (supplier connect) to updateMany — B1 fix', async () => {
    mockPrisma.purchaseOrder.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.purchaseOrder.findUnique.mockResolvedValue(basePo as any);

    const data: Prisma.PurchaseOrderUpdateInput = {
      notes: 'Updated',
      supplier: { connect: { id: 'sup-2' } },
    };

    const result = await repo.update('po-1', data, 'comp-1', 0);

    expect(mockPrisma.purchaseOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'po-1', companyId: 'comp-1', rowVersion: 0 },
      data: { notes: 'Updated', rowVersion: { increment: 1 } },
    });
    // supplier connect goes through a follow-up update
    expect(mockPrisma.purchaseOrder.update).toHaveBeenCalledWith({
      where: { id: 'po-1' },
      data: { supplier: { connect: { id: 'sup-2' } } },
    });
    expect(result.id).toBe('po-1');
  });

  it('should apply scalar-only updates via updateMany without a follow-up update', async () => {
    mockPrisma.purchaseOrder.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.purchaseOrder.findUnique.mockResolvedValue(basePo as any);

    await repo.update('po-1', { notes: 'X' }, 'comp-1', 0);

    expect(mockPrisma.purchaseOrder.updateMany).toHaveBeenCalledWith({
      where: { id: 'po-1', companyId: 'comp-1', rowVersion: 0 },
      data: { notes: 'X', rowVersion: { increment: 1 } },
    });
    expect(mockPrisma.purchaseOrder.update).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when rowVersion is stale', async () => {
    mockPrisma.purchaseOrder.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
      ...basePo,
      rowVersion: 5,
    });

    await expect(
      repo.update('po-1', { notes: 'X' }, 'comp-1', 0),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when PO does not exist', async () => {
    mockPrisma.purchaseOrder.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.purchaseOrder.findFirst.mockResolvedValue(null);

    await expect(
      repo.update('po-1', { notes: 'X' }, 'comp-1', 0),
    ).rejects.toThrow(NotFoundException);
  });

  it('should support legacy path (no rowVersion) with relation writes', async () => {
    mockPrisma.purchaseOrder.findFirst.mockResolvedValue(basePo as any);
    mockPrisma.purchaseOrder.update.mockResolvedValue({
      ...basePo,
      notes: 'X',
    } as any);

    const result = await repo.update(
      'po-1',
      { notes: 'X', supplier: { connect: { id: 'sup-2' } } },
      'comp-1',
      undefined,
    );

    expect(mockPrisma.purchaseOrder.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.purchaseOrder.update).toHaveBeenCalled();
    expect(result.id).toBe('po-1');
  });
});
