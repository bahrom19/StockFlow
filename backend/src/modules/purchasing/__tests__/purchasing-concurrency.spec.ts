import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PurchaseOrderRepository } from '../repositories/purchase-order.repository';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EVENT_BUS } from '../../../common/events';
import { DocumentSequenceService } from '../../shared/services/document-sequence.service';

const companyId = 'comp-1';
const poId = 'po-1';
const supplierId = 'supplier-1';

const basePo = {
  id: poId,
  companyId,
  supplierId,
  orderNumber: 'PO-TEST-0001',
  orderDate: new Date(),
  expectedDate: null,
  status: 'ORDERED' as const,
  subtotal: new Prisma.Decimal('100.00'),
  discountAmount: new Prisma.Decimal('0'),
  taxAmount: new Prisma.Decimal('12.00'),
  grandTotal: new Prisma.Decimal('112.00'),
  paidAmount: new Prisma.Decimal('0'),
  notes: null,
  approvedBy: null,
  approvedAt: null,
  cancelledBy: null,
  cancelledAt: null,
  rowVersion: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  items: [
    {
      id: 'po-item-1',
      purchaseOrderId: poId,
      productId: 'prod-1',
      quantity: 10,
      unitCost: new Prisma.Decimal('10.00'),
      discountPercent: null,
      discountAmount: new Prisma.Decimal('0'),
      taxPercent: new Prisma.Decimal('12.00'),
      taxAmount: new Prisma.Decimal('12.00'),
      receivedQuantity: 0,
      subtotal: new Prisma.Decimal('100.00'),
      total: new Prisma.Decimal('112.00'),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  supplier: { id: supplierId, companyId, companyName: 'Test Supplier' },
};

// ═══════════════════════════════════════════════
// REPOSITORY LAYER — Optimistic locking unit
// ═══════════════════════════════════════════════

describe('PurchaseOrderRepository — Optimistic Locking', () => {
  let repository: PurchaseOrderRepository;
  let mockPrisma: Record<string, any>;

  beforeEach(async () => {
    mockPrisma = {
      purchaseOrder: {
        updateMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
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
        PurchaseOrderRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repository = module.get<PurchaseOrderRepository>(PurchaseOrderRepository);
  });

  // ─────────────────────────────────────────────
  // 1. Happy path — first update succeeds
  // ─────────────────────────────────────────────
  it('should update purchase order when rowVersion matches', async () => {
    mockPrisma.purchaseOrder.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
      ...basePo,
      rowVersion: 1,
      status: PurchaseOrderStatus.RECEIVED,
    });

    const result = await repository.update(
      poId,
      { status: PurchaseOrderStatus.RECEIVED },
      companyId,
      0,
    );

    expect(mockPrisma.purchaseOrder.updateMany).toHaveBeenCalledWith({
      where: { id: poId, companyId, rowVersion: 0 },
      data: {
        status: PurchaseOrderStatus.RECEIVED,
        rowVersion: { increment: 1 },
      },
    });
    expect(result.rowVersion).toBe(1);
    expect(result.status).toBe(PurchaseOrderStatus.RECEIVED);
  });

  // ─────────────────────────────────────────────
  // 2. Concurrent conflict — stale rowVersion
  // ─────────────────────────────────────────────
  it('should throw ConflictException when rowVersion is stale', async () => {
    // First request succeeds (rowVersion 0 → 1)
    mockPrisma.purchaseOrder.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce({
      ...basePo,
      rowVersion: 1,
      status: PurchaseOrderStatus.RECEIVED,
    });
    await repository.update(
      poId,
      { status: PurchaseOrderStatus.RECEIVED },
      companyId,
      0,
    );

    // Second request with SAME rowVersion fails
    mockPrisma.purchaseOrder.updateMany.mockResolvedValueOnce({ count: 0 });
    mockPrisma.purchaseOrder.findFirst.mockResolvedValueOnce({
      ...basePo,
      rowVersion: 1,
    });
    await expect(
      repository.update(
        poId,
        { status: PurchaseOrderStatus.RECEIVED },
        companyId,
        0,
      ),
    ).rejects.toThrow(ConflictException);
  });

  // ─────────────────────────────────────────────
  // 3. Deleted PO — NotFoundException
  // ─────────────────────────────────────────────
  it('should throw NotFoundException when PO is deleted', async () => {
    mockPrisma.purchaseOrder.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.purchaseOrder.findFirst.mockResolvedValue(null);

    await expect(
      repository.update(
        poId,
        { status: PurchaseOrderStatus.RECEIVED },
        companyId,
        0,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  // ─────────────────────────────────────────────
  // 4. Legacy path — no rowVersion works
  // ─────────────────────────────────────────────
  it('should update PO without rowVersion (backward compatibility)', async () => {
    mockPrisma.purchaseOrder.findFirst = jest.fn().mockResolvedValue(basePo);
    mockPrisma.purchaseOrder.update = jest
      .fn()
      .mockResolvedValue({ ...basePo, status: PurchaseOrderStatus.RECEIVED });

    const result = await repository.update(
      poId,
      { status: PurchaseOrderStatus.RECEIVED },
      companyId,
    );
    expect(mockPrisma.purchaseOrder.findFirst).toHaveBeenCalled();
    expect(result.status).toBe(PurchaseOrderStatus.RECEIVED);
  });

  // ─────────────────────────────────────────────
  // 5. Concurrent softDelete — stale rowVersion
  // ─────────────────────────────────────────────
  it('should throw ConflictException on concurrent softDelete', async () => {
    mockPrisma.purchaseOrder.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.purchaseOrder.findFirst.mockResolvedValue({
      ...basePo,
      rowVersion: 2,
    });

    await expect(repository.softDelete(poId, companyId, 0)).rejects.toThrow(
      ConflictException,
    );
  });

  // ─────────────────────────────────────────────
  // 6. updateStatus delegates to update with rowVersion
  // ─────────────────────────────────────────────
  it('updateStatus should pass rowVersion to update', async () => {
    mockPrisma.purchaseOrder.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.purchaseOrder.findUnique.mockResolvedValue({
      ...basePo,
      rowVersion: 1,
      status: PurchaseOrderStatus.CANCELLED,
    });

    const result = await repository.updateStatus(
      poId,
      PurchaseOrderStatus.CANCELLED,
      companyId,
      0,
    );
    expect(mockPrisma.purchaseOrder.updateMany).toHaveBeenCalledWith({
      where: { id: poId, companyId, rowVersion: 0 },
      data: {
        status: PurchaseOrderStatus.CANCELLED,
        rowVersion: { increment: 1 },
      },
    });
    expect(result.status).toBe(PurchaseOrderStatus.CANCELLED);
  });

  // ═════════════════════════════════════════════
  // SIMULATED CONCURRENT ACCESS (through repo)
  // ═════════════════════════════════════════════
  it('simulated race: two concurrent updates — only one succeeds', async () => {
    // Both start with rowVersion 0
    const rowVersion = 0;

    // First request: updateMany returns count 1 (success)
    mockPrisma.purchaseOrder.updateMany.mockResolvedValueOnce({ count: 1 });
    mockPrisma.purchaseOrder.findUnique.mockResolvedValueOnce({
      ...basePo,
      rowVersion: 1,
      status: PurchaseOrderStatus.RECEIVED,
    });

    // Second request: updateMany returns count 0 (stale version)
    mockPrisma.purchaseOrder.updateMany.mockResolvedValueOnce({ count: 0 });
    mockPrisma.purchaseOrder.findFirst.mockResolvedValueOnce({
      ...basePo,
      rowVersion: 1,
    });

    // Fire both concurrently
    const [first, second] = await Promise.allSettled([
      repository.update(
        poId,
        { status: PurchaseOrderStatus.RECEIVED },
        companyId,
        rowVersion,
      ),
      repository.update(
        poId,
        { status: PurchaseOrderStatus.RECEIVED },
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
// SERVICE LAYER — updateStatusAfterReceipt concurrency
// ═══════════════════════════════════════════════

describe('PurchaseOrderService — updateStatusAfterReceipt (Blocker B1 fix)', () => {
  let service: PurchaseOrderService;
  let mockRepo: jest.Mocked<PurchaseOrderRepository>;
  let mockPrisma: Record<string, any>;
  let mockAuditLog: { log: jest.Mock };
  let mockEventBus: { publish: jest.Mock };

  beforeEach(async () => {
    mockRepo = {
      findById: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn() as any,
      findByOrderNumber: jest.fn(),
      softDelete: jest.fn(),
      updateStatus: jest.fn(),
      countByCompany: jest.fn(),
    } as unknown as jest.Mocked<PurchaseOrderRepository>;

    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) };
    mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    const mockTx = {
      purchaseOrderItem: { findMany: jest.fn() },
    };

    mockPrisma = {
      $transaction: jest
        .fn()
        .mockImplementation((cb: (tx: any) => any) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderService,
        { provide: PurchaseOrderRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: DocumentSequenceService, useValue: { nextNumber: jest.fn() } },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<PurchaseOrderService>(PurchaseOrderService);
  });

  // ─────────────────────────────────────────────
  // 7. updateStatusAfterReceipt propagates rowVersion
  // ─────────────────────────────────────────────
  it('should pass order.rowVersion to repository.update() — fix B1 verification', async () => {
    // PO has rowVersion 3
    const poWithVersion = { ...basePo, rowVersion: 3 };
    mockRepo.findById.mockResolvedValue(poWithVersion as any);

    // Items: all received → should set RECEIVED status
    const mockTx = {
      purchaseOrderItem: {
        findMany: jest.fn().mockResolvedValue([
          { quantity: 10, receivedQuantity: 10 }, // fully received
        ]),
      },
    };
    mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

    mockRepo.update.mockResolvedValue({
      ...basePo,
      rowVersion: 4,
      status: PurchaseOrderStatus.RECEIVED,
    } as any);

    await service.updateStatusAfterReceipt(poId, companyId, mockTx as any);

    // Verify rowVersion 3 was passed (NOT undefined)
    expect(mockRepo.update).toHaveBeenCalledWith(
      poId,
      expect.objectContaining({ status: PurchaseOrderStatus.RECEIVED }),
      companyId,
      3, // rowVersion from the PO entity — proves the fix!
      mockTx,
    );
  });

  // ─────────────────────────────────────────────
  // 8. updateStatusAfterReceipt — PARTIALLY_RECEIVED
  // ─────────────────────────────────────────────
  it('should pass rowVersion also for PARTIALLY_RECEIVED status', async () => {
    const poWithVersion = { ...basePo, rowVersion: 5 };
    mockRepo.findById.mockResolvedValue(poWithVersion as any);

    const mockTx = {
      purchaseOrderItem: {
        findMany: jest.fn().mockResolvedValue([
          { quantity: 10, receivedQuantity: 3 }, // partially received
        ]),
      },
    };
    mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

    mockRepo.update.mockResolvedValue({
      ...basePo,
      rowVersion: 6,
      status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
    } as any);

    await service.updateStatusAfterReceipt(poId, companyId, mockTx as any);

    expect(mockRepo.update).toHaveBeenCalledWith(
      poId,
      expect.objectContaining({
        status: PurchaseOrderStatus.PARTIALLY_RECEIVED,
      }),
      companyId,
      5, // rowVersion preserved
      mockTx,
    );
  });

  // ─────────────────────────────────────────────
  // 9. rowVersion NOT passed if order not found
  // ─────────────────────────────────────────────
  it('should return early if purchase order is not found (no update)', async () => {
    mockRepo.findById.mockResolvedValue(null);

    const mockTx = {
      purchaseOrderItem: { findMany: jest.fn() },
    };
    mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

    await service.updateStatusAfterReceipt(poId, companyId, mockTx as any);

    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────
  // 10. rowVersion NOT passed if no items
  // ─────────────────────────────────────────────
  it('should return early if PO has no items (no update)', async () => {
    mockRepo.findById.mockResolvedValue(basePo as any);

    const mockTx = {
      purchaseOrderItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockTx));

    await service.updateStatusAfterReceipt(poId, companyId, mockTx as any);

    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  // ═════════════════════════════════════════════
  // SIMULATED CONCURRENT updateStatusAfterReceipt
  // ═════════════════════════════════════════════
  it('simulated race: concurrent updateStatusAfterReceipt — only one succeeds', async () => {
    // Both see the same PO with rowVersion 0
    const poPristine = { ...basePo, rowVersion: 0 };
    mockRepo.findById.mockResolvedValue(poPristine as any);

    // Items: all received → both would try RECEIVED status
    const mockTx = {
      purchaseOrderItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ quantity: 10, receivedQuantity: 10 }]),
      },
    };

    // First update succeeds
    mockRepo.update
      .mockResolvedValueOnce({
        ...poPristine,
        rowVersion: 1,
        status: PurchaseOrderStatus.RECEIVED,
      } as any)
      // Second update throws ConflictException
      .mockRejectedValueOnce(
        new ConflictException(
          `Purchase order ${poId} was modified by another user. Please refresh and retry.`,
        ),
      );

    // Fire both concurrently — same PO, same rowVersion, same transaction
    const tx1 = { ...mockTx };
    const tx2 = { ...mockTx };
    tx1.purchaseOrderItem.findMany = jest
      .fn()
      .mockResolvedValue([{ quantity: 10, receivedQuantity: 10 }]);
    tx2.purchaseOrderItem.findMany = jest
      .fn()
      .mockResolvedValue([{ quantity: 10, receivedQuantity: 10 }]);

    // Use the same mockPrisma $transaction for both
    const [first, second] = await Promise.allSettled([
      service.updateStatusAfterReceipt(poId, companyId, tx1 as any),
      service.updateStatusAfterReceipt(poId, companyId, tx2 as any),
    ]);

    // First should succeed
    expect(first.status).toBe('fulfilled');

    // Second should fail with ConflictException
    expect(second.status).toBe('rejected');
    if (second.status === 'rejected') {
      expect(second.reason).toBeInstanceOf(ConflictException);
    }

    // Both called findById (each does its own lookup)
    expect(mockRepo.findById).toHaveBeenCalledTimes(2);
    // update called twice — first succeeds, second fails
    expect(mockRepo.update).toHaveBeenCalledTimes(2);

    // Both calls passed rowVersion=0 (not undefined!)
    expect(mockRepo.update).toHaveBeenNthCalledWith(
      1,
      poId,
      expect.objectContaining({ status: PurchaseOrderStatus.RECEIVED }),
      companyId,
      0,
      tx1,
    );
    expect(mockRepo.update).toHaveBeenNthCalledWith(
      2,
      poId,
      expect.objectContaining({ status: PurchaseOrderStatus.RECEIVED }),
      companyId,
      0,
      tx2,
    );
  });
});
