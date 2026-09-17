import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SalesRefundService } from '../sales-refund.service';
import { SalesRefundRepository } from '../../repositories/sales-refund.repository';
import { SalesRepository } from '../../../sales/repositories/sales.repository';
import { CashShiftRepository } from '../../../sales/repositories/cash-shift.repository';
import { AuditLogService } from '../../../shared/services/audit-log.service';
import { DocumentSequenceService } from '../../../shared/services/document-sequence.service';
import { PrismaService } from '../../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../../common/events';

/**
 * G11-E E2 — SalesRefundService.
 *
 * The service is exercised against an in-memory fake of the refund store, so
 * sequential refunds accumulate exactly like the durable SalesRefundItem rows
 * (the quantity/cost source of truth), and `$transaction` snapshots/restores the
 * store so rollback semantics are faithful.
 */

const COMPANY = 'company-1';

interface StoredItem {
  saleItemId: string;
  productId: string;
  quantity: number;
  unitPrice: Decimal;
  total: Decimal;
  fifoCost: Decimal;
}

interface StoredRefund {
  id: string;
  refundNumber: string;
  saleId: string;
  companyId: string;
  warehouseId: string;
  status: string;
  total: Decimal;
  currency: string;
  reason: string | null;
  reference: string | null;
  createdBy: string;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  items: StoredItem[];
}

const saleItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'item-1',
  saleId: 'sale-1',
  productId: 'prod-1',
  quantity: 5,
  unitPrice: new Decimal('100.0000'),
  costPrice: new Decimal('60.0000'),
  fifoCost: new Decimal('500.0000') as Decimal | null,
  discount: new Decimal('0.0000'),
  subtotal: new Decimal('500.0000'),
  total: new Decimal('500.0000'),
  margin: new Decimal('200.0000'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const sale = (overrides: Record<string, unknown> = {}) => ({
  id: 'sale-1',
  saleNumber: 'SALE-COMPANY1-0001',
  status: SaleStatus.COMPLETED as SaleStatus,
  companyId: COMPANY,
  warehouseId: 'wh-1',
  cashierId: 'user-1',
  customerId: null,
  currency: 'KZT',
  notes: null,
  subtotal: new Decimal('500.0000'),
  discount: new Decimal('0.0000'),
  tax: new Decimal('0.0000'),
  total: new Decimal('500.0000'),
  paidAmount: new Decimal('500.0000'),
  changeAmount: new Decimal('0.0000'),
  rowVersion: 0,
  cashShiftId: null as string | null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  deletedAt: null,
  items: [] as unknown[],
  payments: [] as unknown[],
  receipts: [] as unknown[],
  ...overrides,
});
describe('SalesRefundService — G11-E E2 refund lifecycle', () => {
  let service: SalesRefundService;
  let store: StoredRefund[];
  let saleRow: ReturnType<typeof sale>;
  let saleItems: ReturnType<typeof saleItem>[];
  let sequence: number;
  let payments: Array<{ method: string; amount: Decimal }>;
  let cashShift: unknown;

  let mockSalesRepository: any;
  let mockCashShiftRepository: any;
  let mockSalesRefundRepository: any;
  let mockDocumentSequence: any;
  let mockAuditLog: any;
  let mockEventBus: any;
  let mockTx: any;

  const buildAggregate = () => {
    const map = new Map<
      string,
      { quantity: number; fifoCost: Decimal; total: Decimal }
    >();
    for (const item of store.flatMap((r) => r.items)) {
      const current = map.get(item.saleItemId) ?? {
        quantity: 0,
        fifoCost: new Decimal(0),
        total: new Decimal(0),
      };
      map.set(item.saleItemId, {
        quantity: current.quantity + item.quantity,
        fifoCost: current.fifoCost.add(item.fifoCost),
        total: current.total.add(item.total),
      });
    }
    return map;
  };

  const snapshot = () =>
    store.map((r) => ({ ...r, items: r.items.map((i) => ({ ...i })) }));

  beforeEach(async () => {
    store = [];
    sequence = 0;
    payments = [];
    cashShift = null;
    saleItems = [saleItem()];
    saleRow = sale();

    mockSalesRepository = {
      findById: jest.fn(async () => ({ ...saleRow, items: saleItems })),
      updateStatus: jest.fn(
        async (
          _id: string,
          status: SaleStatus,
          _companyId: string,
          rowVersion: number,
        ) => {
          if (rowVersion !== saleRow.rowVersion) {
            throw new ConflictException(
              `Sale ${saleRow.id} was modified by another user. Please refresh and retry.`,
            );
          }
          saleRow = {
            ...saleRow,
            status,
            rowVersion: saleRow.rowVersion + 1,
          } as ReturnType<typeof sale>;
          return saleRow;
        },
      ),
    };

    mockCashShiftRepository = {
      update: jest.fn(async (_id: string, data: unknown) => ({
        id: 'shift-1',
        ...(data as object),
      })),
    };

    mockSalesRefundRepository = {
      create: jest.fn(async (data: any) => {
        const items: StoredItem[] = (data.items?.create ?? []).map(
          (i: any) => ({
            saleItemId: i.saleItemId,
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: new Decimal(i.unitPrice.toString()),
            total: new Decimal(i.total.toString()),
            fifoCost: new Decimal(i.fifoCost.toString()),
          }),
        );
        const refund: StoredRefund = {
          id: `refund-${store.length + 1}`,
          refundNumber: data.refundNumber,
          saleId: data.saleId,
          companyId: data.companyId,
          warehouseId: data.warehouseId,
          status: data.status,
          total: new Decimal(data.total.toString()),
          currency: data.currency,
          reason: data.reason ?? null,
          reference: data.reference ?? null,
          createdBy: data.createdBy,
          rowVersion: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          items,
        };
        store.push(refund);
        return refund;
      }),
      findById: jest.fn(async (id: string) =>
        store.find((r) => r.id === id) ?? null,
      ),
      findBySaleId: jest.fn(async () => store),
      aggregateCompletedBySaleItem: jest.fn(async () => buildAggregate()),
    };

    mockDocumentSequence = {
      nextNumber: jest.fn(async () => {
        sequence += 1;
        return sequence;
      }),
    };

    mockAuditLog = { log: jest.fn(async () => undefined) };
    mockEventBus = { publish: jest.fn(async () => undefined) };

    mockTx = {
      saleItem: { findMany: jest.fn(async () => saleItems) },
      cashShift: { findFirst: jest.fn(async () => cashShift) },
      payment: { findMany: jest.fn(async () => payments) },
    };

    const mockPrisma = {
      $transaction: jest.fn(async (fn: any) => {
        const before = snapshot();
        try {
          return await fn(mockTx);
        } catch (error) {
          store = before;
          throw error;
        }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesRefundService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SalesRepository, useValue: mockSalesRepository },
        { provide: CashShiftRepository, useValue: mockCashShiftRepository },
        { provide: SalesRefundRepository, useValue: mockSalesRefundRepository },
        { provide: DocumentSequenceService, useValue: mockDocumentSequence },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get(SalesRefundService);
  });
  const refund = (items?: Array<{ saleItemId: string; quantity: number }>) =>
    service.createRefund('sale-1', { items }, 'user-1', COMPANY);

  const persistedFifo = (saleItemId = 'item-1') =>
    store
      .flatMap((r) => r.items)
      .filter((i) => i.saleItemId === saleItemId)
      .reduce((acc, i) => acc.add(i.fifoCost), new Decimal(0));

  const persistedQty = (saleItemId = 'item-1') =>
    store
      .flatMap((r) => r.items)
      .filter((i) => i.saleItemId === saleItemId)
      .reduce((acc, i) => acc + i.quantity, 0);

  const fifoCosts = () =>
    store.flatMap((r) => r.items).map((i) => i.fifoCost.toString());

  // ── 1-2. Full refunds ────────────────────────────────────────
  it('full refunds a single SaleItem and sets status REFUNDED', async () => {
    const result = await refund([]);
    expect(new Decimal(result.total).equals('500')).toBe(true);
    expect(persistedQty()).toBe(5);
    expect(persistedFifo().equals('500')).toBe(true);
    expect(saleRow.status).toBe(SaleStatus.REFUNDED);
  });

  it('full refunds multiple SaleItems', async () => {
    saleItems = [
      saleItem({
        id: 'item-1',
        quantity: 2,
        fifoCost: new Decimal('200.0000'),
        total: new Decimal('200.0000'),
      }),
      saleItem({
        id: 'item-2',
        quantity: 3,
        fifoCost: new Decimal('300.0000'),
        total: new Decimal('300.0000'),
      }),
    ];
    await refund([]);
    expect(persistedQty('item-1')).toBe(2);
    expect(persistedQty('item-2')).toBe(3);
    expect(persistedFifo('item-1').equals('200')).toBe(true);
    expect(persistedFifo('item-2').equals('300')).toBe(true);
    expect(saleRow.status).toBe(SaleStatus.REFUNDED);
  });

  // ── 3-6. Partial refunds ─────────────────────────────────────
  it('partial refund (3 of 5) sets PARTIALLY_REFUNDED', async () => {
    await refund([{ saleItemId: 'item-1', quantity: 3 }]);
    expect(persistedQty()).toBe(3);
    expect(saleRow.status).toBe(SaleStatus.PARTIALLY_REFUNDED);
  });

  it('second partial refund keeps the sale PARTIALLY_REFUNDED', async () => {
    await refund([{ saleItemId: 'item-1', quantity: 2 }]);
    await refund([{ saleItemId: 'item-1', quantity: 1 }]);
    expect(persistedQty()).toBe(3);
    expect(saleRow.status).toBe(SaleStatus.PARTIALLY_REFUNDED);
  });

  it('final refund after a partial consumes the remainder and conserves FIFO', async () => {
    await refund([{ saleItemId: 'item-1', quantity: 3 }]);
    await refund([{ saleItemId: 'item-1', quantity: 2 }]);
    expect(persistedQty()).toBe(5);
    expect(persistedFifo().equals('500')).toBe(true);
    expect(saleRow.status).toBe(SaleStatus.REFUNDED);
  });

  it('five successive partial refunds of 1 conserve the total FIFO cost', async () => {
    for (let i = 0; i < 4; i += 1) {
      await refund([{ saleItemId: 'item-1', quantity: 1 }]);
    }
    expect(saleRow.status).toBe(SaleStatus.PARTIALLY_REFUNDED);
    await refund([{ saleItemId: 'item-1', quantity: 1 }]);
    expect(saleRow.status).toBe(SaleStatus.REFUNDED);
    expect(persistedQty()).toBe(5);
    expect(persistedFifo().equals('500')).toBe(true);
  });

  // ── 7-10. Quantity validation ────────────────────────────────
  it('rejects a zero refund quantity', async () => {
    await expect(
      refund([{ saleItemId: 'item-1', quantity: 0 }]),
    ).rejects.toThrow(BadRequestException);
    expect(store).toHaveLength(0);
  });

  it('rejects a negative refund quantity', async () => {
    await expect(
      refund([{ saleItemId: 'item-1', quantity: -2 }]),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a quantity greater than the remaining quantity', async () => {
    await expect(
      refund([{ saleItemId: 'item-1', quantity: 6 }]),
    ).rejects.toThrow(BadRequestException);
    expect(store).toHaveLength(0);
  });

  it('rejects refunding a SaleItem that has no remaining quantity', async () => {
    saleItems = [
      saleItem({ id: 'item-1', quantity: 1, total: new Decimal('100.0000') }),
      saleItem({ id: 'item-2', quantity: 5, total: new Decimal('500.0000') }),
    ];
    await refund([{ saleItemId: 'item-1', quantity: 1 }]);
    expect(saleRow.status).toBe(SaleStatus.PARTIALLY_REFUNDED);
    await expect(
      refund([{ saleItemId: 'item-1', quantity: 1 }]),
    ).rejects.toThrow(BadRequestException);
  });
  // ─ 11-14. FIFO cost ─────────────────────────────────────────
  it('rounding-sensitive 100/3: 33.3333 + 33.3333 + 33.3334 = 100 exactly', async () => {
    saleItems = [
      saleItem({
        id: 'item-1',
        quantity: 3,
        fifoCost: new Decimal('100.0000'),
        unitPrice: new Decimal('100.0000'),
        total: new Decimal('300.0000'),
      }),
    ];
    await refund([{ saleItemId: 'item-1', quantity: 1 }]);
    await refund([{ saleItemId: 'item-1', quantity: 1 }]);
    await refund([{ saleItemId: 'item-1', quantity: 1 }]);
    expect(fifoCosts()).toEqual(['33.3333', '33.3333', '33.3334']);
    expect(persistedFifo().equals('100')).toBe(true);
    expect(saleRow.status).toBe(SaleStatus.REFUNDED);
  });

  it('final refund uses the exact remainder (3 then 2 of a 5/500 item)', async () => {
    await refund([{ saleItemId: 'item-1', quantity: 3 }]);
    await refund([{ saleItemId: 'item-1', quantity: 2 }]);
    expect(fifoCosts()).toEqual(['300', '200']);
    expect(persistedFifo().equals('500')).toBe(true);
  });

  it('non-final partial uses the proportional FIFO share', async () => {
    const result = await refund([{ saleItemId: 'item-1', quantity: 2 }]);
    expect(result.items?.[0]?.fifoCost).toBe('200');
  });

  it('persists the historical FIFO cost on every SalesRefundItem', async () => {
    await refund([{ saleItemId: 'item-1', quantity: 1 }]);
    const stored = store[0]?.items[0];
    expect(stored).toBeDefined();
    expect(stored?.fifoCost.equals('100')).toBe(true);
    expect(stored?.quantity).toBe(1);
  });

  // ── 15-16. NULL fifoCost legacy fallback ────────────────────
  it('NULL fifoCost falls back to costPrice * qty (2 then 3 => 240 + 360 = 600)', async () => {
    saleItems = [
      saleItem({
        id: 'item-1',
        quantity: 5,
        costPrice: new Decimal('120.0000'),
        fifoCost: null,
        unitPrice: new Decimal('120.0000'),
        total: new Decimal('600.0000'),
      }),
    ];
    await refund([{ saleItemId: 'item-1', quantity: 2 }]);
    await refund([{ saleItemId: 'item-1', quantity: 3 }]);
    expect(fifoCosts()).toEqual(['240', '360']);
    expect(persistedFifo().equals('600')).toBe(true);
    expect(saleRow.status).toBe(SaleStatus.REFUNDED);
  });

  it('multiple legacy partial refunds conserve the total legacy cost', async () => {
    saleItems = [
      saleItem({
        id: 'item-1',
        quantity: 4,
        costPrice: new Decimal('10.0000'),
        fifoCost: null,
        total: new Decimal('40.0000'),
      }),
    ];
    await refund([{ saleItemId: 'item-1', quantity: 1 }]);
    await refund([{ saleItemId: 'item-1', quantity: 1 }]);
    await refund([{ saleItemId: 'item-1', quantity: 2 }]);
    expect(fifoCosts()).toEqual(['10', '10', '20']);
    expect(persistedFifo().equals('40')).toBe(true);
  });

  // ── Server-side amounts + refundNumber + tenant isolation ────
  it('calculates SalesRefund.total and item amounts server-side', async () => {
    const result = await refund([{ saleItemId: 'item-1', quantity: 2 }]);
    expect(new Decimal(result.total).equals('200')).toBe(true);
    expect(result.items?.[0]?.unitPrice).toBe('100');
    expect(new Decimal(result.items?.[0]?.total ?? '0').equals('200')).toBe(
      true,
    );
  });

  it('generates a tenant-scoped refundNumber from the SALES_REFUND sequence', async () => {
    const expectedPrefix = `REF-${COMPANY.substring(0, 8).toUpperCase()}-`;
    const first = await refund([{ saleItemId: 'item-1', quantity: 1 }]);
    const second = await refund([{ saleItemId: 'item-1', quantity: 1 }]);
    expect(first.refundNumber).toBe(`${expectedPrefix}0001`);
    expect(second.refundNumber).toBe(`${expectedPrefix}0002`);
    expect(mockDocumentSequence.nextNumber).toHaveBeenCalledWith(
      COMPANY,
      'SALES_REFUND',
      mockTx,
    );
  });

  it('rejects a sale that does not belong to the caller company', async () => {
    mockSalesRepository.findById.mockResolvedValueOnce(null);
    await expect(
      refund([{ saleItemId: 'item-1', quantity: 1 }]),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a SaleItem that does not belong to the sale', async () => {
    await expect(
      refund([{ saleItemId: 'item-999', quantity: 1 }]),
    ).rejects.toThrow(BadRequestException);
  });
  // ── 17-18. Status lifecycle across multiple items ────────────
  it('stays PARTIALLY_REFUNDED while any SaleItem still has remaining qty', async () => {
    saleItems = [
      saleItem({ id: 'item-1', quantity: 1, total: new Decimal('100.0000') }),
      saleItem({ id: 'item-2', quantity: 1, total: new Decimal('100.0000') }),
    ];
    await refund([{ saleItemId: 'item-1', quantity: 1 }]);
    expect(saleRow.status).toBe(SaleStatus.PARTIALLY_REFUNDED);
    await refund([{ saleItemId: 'item-2', quantity: 1 }]);
    expect(saleRow.status).toBe(SaleStatus.REFUNDED);
  });

  it('rejects refunding an already fully REFUNDED sale', async () => {
    saleRow = { ...saleRow, status: SaleStatus.REFUNDED } as ReturnType<
      typeof sale
    >;
    await expect(refund([])).rejects.toThrow(BadRequestException);
  });

  it('rejects refunding a sale that is not COMPLETED/PARTIALLY_REFUNDED', async () => {
    saleRow = { ...saleRow, status: SaleStatus.DRAFT } as ReturnType<
      typeof sale
    >;
    await expect(refund([])).rejects.toThrow(BadRequestException);
  });

  // ── 19-20. Concurrency / CAS ─────────────────────────────────
  it('throws ConflictException when the Sale rowVersion CAS is stale', async () => {
    mockSalesRepository.updateStatus.mockRejectedValueOnce(
      new ConflictException(
        'Sale sale-1 was modified by another user. Please refresh and retry.',
      ),
    );
    await expect(
      refund([{ saleItemId: 'item-1', quantity: 1 }]),
    ).rejects.toThrow(ConflictException);
  });

  it('leaves no orphan SalesRefund/SalesRefundItem after a CAS rollback', async () => {
    mockSalesRepository.updateStatus.mockRejectedValueOnce(
      new ConflictException('conflict'),
    );
    await expect(
      refund([{ saleItemId: 'item-1', quantity: 1 }]),
    ).rejects.toThrow(ConflictException);
    expect(store).toHaveLength(0);
    expect(saleRow.status).toBe(SaleStatus.COMPLETED);
  });

  // ── 21-23. Legacy event policy ───────────────────────────────
  it('single-shot full refund publishes the legacy SaleRefundedEvent', async () => {
    saleRow = { ...saleRow, cashShiftId: 'shift-1' } as ReturnType<typeof sale>;
    cashShift = {
      id: 'shift-1',
      status: 'OPEN',
      rowVersion: 3,
      cashSales: new Decimal('500.0000'),
      cardSales: new Decimal('0.0000'),
      qrSales: new Decimal('0.0000'),
      bankTransferSales: new Decimal('0.0000'),
      mobileWalletSales: new Decimal('0.0000'),
      totalSales: new Decimal('500.0000'),
    };
    payments = [{ method: 'CASH', amount: new Decimal('500.0000') }];

    await refund([]);

    const call = mockCashShiftRepository.update.mock.calls[0];
    expect(call?.[0]).toBe('shift-1');
    expect((call?.[1] as any).cashSales.equals('0')).toBe(true);
    expect((call?.[1] as any).totalSales.equals('0')).toBe(true);
    expect(call?.[2]).toBe(COMPANY);
    expect(call?.[3]).toBe(3);

    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    const published = mockEventBus.publish.mock.calls[0];
    expect((published?.[0] as any).eventName).toBe('sale.refunded');
    expect(published?.[1]).toEqual({
      context: { transactionClient: mockTx },
    });
  });

  it('partial refund publishes NO legacy event and touches no cash shift', async () => {
    cashShift = {
      id: 'shift-1',
      status: 'OPEN',
      rowVersion: 0,
      cashSales: new Decimal('500.0000'),
      cardSales: new Decimal('0.0000'),
      qrSales: new Decimal('0.0000'),
      bankTransferSales: new Decimal('0.0000'),
      mobileWalletSales: new Decimal('0.0000'),
      totalSales: new Decimal('500.0000'),
    };
    await refund([{ saleItemId: 'item-1', quantity: 2 }]);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    expect(mockCashShiftRepository.update).not.toHaveBeenCalled();
  });

  it('final refund after a partial publishes NO legacy event', async () => {
    await refund([{ saleItemId: 'item-1', quantity: 3 }]);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    await refund([{ saleItemId: 'item-1', quantity: 2 }]);
    expect(saleRow.status).toBe(SaleStatus.REFUNDED);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  // ── 24. Compatibility flow ───────────────────────────────────
  it('compatibility flow refunds ALL remaining quantities, not the original qty', async () => {
    await refund([{ saleItemId: 'item-1', quantity: 2 }]);
    mockEventBus.publish.mockClear();

    await service.refundAllRemaining('sale-1', 'user-1', COMPANY);

    expect(persistedQty()).toBe(5); // 2 + 3 remaining
    expect(saleRow.status).toBe(SaleStatus.REFUNDED);
    // final-after-partial must not publish the legacy full-sale event
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  // ── Audit ────────────────────────────────────────────────────
  it('writes SalesRefund CREATED and Sale STATUS_CHANGED audit entries in-tx', async () => {
    await refund([{ saleItemId: 'item-1', quantity: 2 }]);
    expect(mockAuditLog.log).toHaveBeenCalledTimes(2);
    const first = mockAuditLog.log.mock.calls[0];
    const second = mockAuditLog.log.mock.calls[1];
    expect(first?.[0]?.entityType).toBe('SalesRefund');
    expect(first?.[0]?.action).toBe('CREATED');
    expect(second?.[0]?.entityType).toBe('Sale');
    expect(second?.[0]?.action).toBe('STATUS_CHANGED');
    expect(second?.[0]?.before).toEqual({ status: SaleStatus.COMPLETED });
    expect(second?.[0]?.after).toEqual({
      status: SaleStatus.PARTIALLY_REFUNDED,
    });
    expect(first?.[1]).toBe(mockTx);
    expect(second?.[1]).toBe(mockTx);
  });
});