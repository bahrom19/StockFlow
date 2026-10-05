import { InventoryRepository } from '../../repositories/inventory.repository';
import { CostingService } from '../../services/costing.service';
import { PrismaService } from '../../../../common/prisma';
import { GlEngineService } from '../../../finance/services/gl-engine.service';
import { FinanceIntegrationService } from '../../../finance/services/finance-integration.service';
import { AuditLogService } from '../../../shared/services/audit-log.service';
import { SaleCompletedEventHandler } from '../sale-completed.handler';
import { SaleRefundedEventHandler } from '../sale-refunded.handler';
import { PurchaseReceivedEventHandler } from '../purchase-received.handler';
import { SalePartiallyRefundedEventHandler } from '../sale-partially-refunded.handler';
import { InventoryFinanceHandler } from '../finance-integration.handler';
import { SaleCompletedEventHandler as FinanceSaleCompletedHandler } from '../../../finance/events/sale-completed.handler';
import { SaleRefundedEventHandler as FinanceSaleRefundedHandler } from '../../../finance/events/sale-refunded.handler';
import { SaleCompletedEvent } from '../../../sales/events/sale-completed.event';
import { SaleRefundedEvent } from '../../../sales/events/sale-refunded.event';
import { SalePartiallyRefundedEvent } from '../../../sales/events/sale-partially-refunded.event';
import { PurchaseReceivedEvent } from '../../../purchasing/events/purchase-received.event';
import { InventoryAdjustedEvent } from '../inventory-adjusted.event';

/**
 * G16-N-4 P2 — Event handler idempotency (Option 1).
 *
 * Two things are proven here.
 *
 * 1. DUPLICATE DELIVERY IS A NO-OP. Each handler reads a durable marker
 *    before its first side effect and returns when the marker is present, so
 *    re-delivering one event occurrence cannot decrement stock twice, consume
 *    FIFO twice, restore a refund twice or post a second journal.
 *
 * 2. THE OBVIOUS IDENTITY IS NOT ALWAYS THE RIGHT ONE. Two guards exist
 *    specifically because a plausible-looking "dedupe on referenceId" fix
 *    would silently destroy real business behaviour:
 *      - purchase.received: ONE purchase order accepts MANY receipts, so the
 *        marker must be the receipt, never the order.
 *      - inventory.adjusted: an inventory count publishes ONE event PER
 *        COUNTED ITEM, all sharing ('INVENTORY_COUNT', countId), so that pair
 *        is not unique and must never be a journal identity.
 *
 * These are unit tests with explicit transaction-client doubles: they prove
 * the handler's control flow and its read/write sequence. They do NOT claim
 * database-level rollback or concurrency safety — that is proven separately
 * against a real PostgreSQL instance (see the idempotency integration spec).
 */

const COMPANY = 'comp-1';
const WAREHOUSE = 'wh-1';
const PRODUCT = 'prod-1';

describe('G16-N-4 P2 — event handler idempotency', () => {
  describe('inventory SaleCompletedEventHandler', () => {
    const build = (movementExists: boolean) => {
      const findFirst = jest
        .fn()
        .mockResolvedValue(movementExists ? { id: 'm-1' } : null);
      const updateMany = jest.fn().mockResolvedValue({ count: 1 });
      const createMovement = jest.fn().mockResolvedValue({ id: 'm-1' });
      const tx = {
        stock: { updateMany },
        stockMovement: { findFirst, create: createMovement },
        saleItem: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      const inventoryRepository = {
        findStockByProductAndWarehouse: jest.fn().mockResolvedValue({
          id: 'st-1',
          quantity: 10,
          reservedQuantity: 0,
          rowVersion: 1,
        }),
      } as unknown as InventoryRepository;
      const costingService = {
        consumeFifoLayers: jest.fn().mockResolvedValue({ totalCost: 15 }),
      } as unknown as CostingService;
      const handler = new SaleCompletedEventHandler(
        inventoryRepository,
        costingService,
        {} as PrismaService,
      );
      const event = new SaleCompletedEvent({
        saleId: 'sale-1',
        companyId: COMPANY,
        warehouseId: WAREHOUSE,
        cashierId: 'u-1',
        customerId: null,
        saleNumber: 'S-1',
        subtotal: '30',
        discount: '0',
        total: '30',
        paidAmount: '30',
        changeAmount: '0',
        currency: 'USD',
        items: [
          {
            saleItemId: 'si-1',
            productId: PRODUCT,
            quantity: 2,
            unitPrice: '15',
            costPrice: '3',
            discount: '0',
            subtotal: '30',
            total: '30',
            margin: '24',
          },
        ],
        payments: [{ method: 'CASH', amount: '30' }],
      });
      return {
        tx,
        handler,
        event,
        findFirst,
        updateMany,
        createMovement,
        costingService,
      };
    };

    it('applies the full side-effect set on first delivery', async () => {
      const h = build(false);
      await h.handler.handle(h.event, { transactionClient: h.tx as never });

      expect(h.findFirst).toHaveBeenCalledWith({
        where: {
          companyId: COMPANY,
          referenceType: 'SALE',
          referenceId: 'sale-1',
        },
        select: { id: true },
      });
      expect(h.updateMany).toHaveBeenCalledTimes(1);
      expect(h.createMovement).toHaveBeenCalledTimes(1);
      expect(h.costingService.consumeFifoLayers).toHaveBeenCalledTimes(1);
    });

    it('is a complete no-op when the SALE movement marker already exists', async () => {
      const h = build(true);
      await expect(
        h.handler.handle(h.event, { transactionClient: h.tx as never }),
      ).resolves.toBeUndefined();

      // No stock mutation, no second movement, no second FIFO consumption.
      expect(h.updateMany).not.toHaveBeenCalled();
      expect(h.createMovement).not.toHaveBeenCalled();
      expect(h.costingService.consumeFifoLayers).not.toHaveBeenCalled();
    });

    it('fails closed without a transaction context (no root-Prisma fallback)', async () => {
      const h = build(false);
      await expect(h.handler.handle(h.event, {})).rejects.toThrow(
        /No transaction context for sale\.completed/,
      );
      expect(h.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('inventory SaleRefundedEventHandler', () => {
    const build = (movementExists: boolean) => {
      const findFirst = jest
        .fn()
        .mockResolvedValue(movementExists ? { id: 'm-1' } : null);
      const createMovement = jest.fn().mockResolvedValue({ id: 'm-1' });
      const tx = {
        stockMovement: { findFirst, create: createMovement },
        stock: {},
      };
      const inventoryRepository = {
        findStockByProductAndWarehouse: jest.fn().mockResolvedValue({
          id: 'st-1',
          quantity: 0,
          reservedQuantity: 0,
          rowVersion: 1,
        }),
        updateStock: jest.fn().mockResolvedValue({}),
      } as unknown as InventoryRepository;
      const costingService = {
        findOutLayersByReferenceAndProduct: jest.fn().mockResolvedValue([]),
        restoreLayer: jest.fn().mockResolvedValue(undefined),
      } as unknown as CostingService;
      const handler = new SaleRefundedEventHandler(
        inventoryRepository,
        costingService,
        {} as PrismaService,
      );
      const event = new SaleRefundedEvent({
        saleId: 'sale-1',
        companyId: COMPANY,
        warehouseId: WAREHOUSE,
        cashierId: 'u-1',
        saleNumber: 'S-1',
        total: '30',
        refundTotal: '30',
        currency: 'USD',
        items: [
          { productId: PRODUCT, quantity: 2, unitCost: '15', total: '30' },
        ],
        payments: [],
      } as never);
      return {
        tx,
        handler,
        event,
        findFirst,
        createMovement,
        inventoryRepository,
        costingService,
      };
    };

    it('restores stock and cost layers on first delivery', async () => {
      const h = build(false);
      await h.handler.handle(h.event, { transactionClient: h.tx as never });
      expect(h.inventoryRepository.updateStock).toHaveBeenCalledTimes(1);
      expect(h.createMovement).toHaveBeenCalledTimes(1);
    });

    it('is a complete no-op when the REFUND movement marker already exists', async () => {
      const h = build(true);
      await h.handler.handle(h.event, { transactionClient: h.tx as never });

      expect(h.findFirst).toHaveBeenCalledWith({
        where: {
          companyId: COMPANY,
          referenceType: 'REFUND',
          referenceId: 'sale-1',
        },
        select: { id: true },
      });
      expect(h.inventoryRepository.updateStock).not.toHaveBeenCalled();
      expect(h.createMovement).not.toHaveBeenCalled();
    });

    it('fails closed without a transaction context', async () => {
      const h = build(false);
      await expect(h.handler.handle(h.event, {})).rejects.toThrow(
        /No transaction context for sale\.refunded/,
      );
    });
  });

  describe('inventory PurchaseReceivedEventHandler — the multi-receipt guard', () => {
    const build = (existingMarkers: string[]) => {
      // Realistic double: the marker lookup matches any movement carrying a
      // clientOperationId for THIS receipt, regardless of purchase order.
      const findFirst = jest.fn(async ({ where }: any) => {
        const prefix = where?.clientOperationId?.startsWith as
          | string
          | undefined;
        const hit = prefix
          ? existingMarkers.some((m) => m.startsWith(prefix))
          : existingMarkers.length > 0;
        return hit ? { id: 'm-1' } : null;
      });
      const createMovement = jest.fn().mockResolvedValue({ id: 'm-1' });
      const createCostLayer = jest.fn().mockResolvedValue({ id: 'cl-1' });
      const findFirstStock = jest.fn().mockResolvedValue({
        id: 'st-1',
        quantity: 10,
        reservedQuantity: 0,
        rowVersion: 1,
      });
      const updateStock = jest.fn().mockResolvedValue({});
      const tx = {
        stockMovement: { findFirst, create: createMovement },
        costLayer: { create: createCostLayer },
        batch: { create: jest.fn() },
      };
      const inventoryRepository = {
        findStockByProductAndWarehouse: jest
          .fn()
          .mockResolvedValue(findFirstStock),
        updateStock,
      } as unknown as InventoryRepository;
      const handler = new PurchaseReceivedEventHandler(
        inventoryRepository,
        {} as PrismaService,
      );
      return {
        handler,
        tx,
        findFirst,
        createMovement,
        createCostLayer,
        updateStock,
      };
    };

    const eventFor = (receiptNumber: string, purchaseOrderId = 'po-1') =>
      new PurchaseReceivedEvent({
        purchaseOrderId,
        companyId: COMPANY,
        warehouseId: WAREHOUSE,
        receivedBy: 'u-1',
        receiptNumber,
        items: [{ productId: PRODUCT, quantity: 5, unitCost: '3' }],
      });

    it('applies the receipt on first delivery', async () => {
      const h = build([]);
      await h.handler.handle(eventFor('GR-1'), {
        transactionClient: h.tx as never,
      });

      expect(h.updateStock).toHaveBeenCalledTimes(1);
      expect(h.createCostLayer).toHaveBeenCalledTimes(1);
      expect(h.createMovement).toHaveBeenCalledTimes(1);
    });

    it('writes a receipt-scoped clientOperationId marker on every item', async () => {
      const h = build([]);
      await h.handler.handle(eventFor('GR-1'), {
        transactionClient: h.tx as never,
      });

      const write = h.createMovement.mock.calls[0][0].data;
      // The MARKER is receipt-scoped...
      expect(write.clientOperationId).toBe('PURCHASE_RECEIPT:GR-1:0');
      // ...while the existing reference semantics are untouched.
      expect(write.referenceType).toBe('PURCHASE_RECEIPT');
      expect(write.referenceId).toBe('po-1');
    });

    it('is a no-op when the SAME receipt is re-delivered', async () => {
      const h = build(['PURCHASE_RECEIPT:GR-1:0']);
      await h.handler.handle(eventFor('GR-1'), {
        transactionClient: h.tx as never,
      });

      expect(h.updateStock).not.toHaveBeenCalled();
      expect(h.createCostLayer).not.toHaveBeenCalled();
      expect(h.createMovement).not.toHaveBeenCalled();
    });

    // ── The trap guard ────────────────────────────────────────────────────
    it('SECOND RECEIPT AGAINST THE SAME PO IS NOT SUPPRESSED', async () => {
      // Receipt GR-1 already applied against po-1.
      const h = build(['PURCHASE_RECEIPT:GR-1:0']);

      // GR-2 is a different, later receipt of the SAME purchase order. It
      // MUST apply. Deduplicating on purchaseOrderId would swallow it and
      // silently under-stock the warehouse.
      await h.handler.handle(eventFor('GR-2', 'po-1'), {
        transactionClient: h.tx as never,
      });

      expect(h.updateStock).toHaveBeenCalledTimes(1);
      expect(h.createCostLayer).toHaveBeenCalledTimes(1);
      expect(h.createMovement).toHaveBeenCalledTimes(1);
      expect(h.createMovement.mock.calls[0][0].data.clientOperationId).toBe(
        'PURCHASE_RECEIPT:GR-2:0',
      );
    });

    it('scopes the marker lookup by company — a foreign company does not suppress', async () => {
      const findFirst = jest.fn().mockResolvedValue(null);
      const createMovement = jest.fn().mockResolvedValue({ id: 'm-1' });
      const tx = {
        stockMovement: { findFirst, create: createMovement },
        costLayer: { create: jest.fn().mockResolvedValue({ id: 'cl' }) },
        batch: { create: jest.fn() },
      };
      const inventoryRepository = {
        findStockByProductAndWarehouse: jest.fn().mockResolvedValue({
          id: 'st-1',
          quantity: 0,
          reservedQuantity: 0,
          rowVersion: 0,
        }),
        updateStock: jest.fn().mockResolvedValue({}),
      } as unknown as InventoryRepository;
      const handler = new PurchaseReceivedEventHandler(
        inventoryRepository,
        {} as PrismaService,
      );

      await handler.handle(eventFor('GR-1'), {
        transactionClient: tx as never,
      });

      expect(findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: COMPANY }),
        }),
      );
    });

    it('fails closed without a transaction context', async () => {
      const h = build([]);
      await expect(h.handler.handle(eventFor('GR-1'), {})).rejects.toThrow(
        /No transaction context for purchase\.received/,
      );
    });
  });

  describe('inventory SalePartiallyRefundedEventHandler (existing marker preserved)', () => {
    const build = (movementExists: boolean) => {
      const findFirst = jest
        .fn()
        .mockResolvedValue(movementExists ? { id: 'm-1' } : null);
      const createMovement = jest.fn().mockResolvedValue({ id: 'm-1' });
      const tx = {
        stockMovement: { findFirst, create: createMovement },
        stock: {},
      };
      const inventoryRepository = {
        findStockByProductAndWarehouse: jest.fn().mockResolvedValue({
          id: 'st-1',
          quantity: 0,
          reservedQuantity: 0,
          rowVersion: 1,
        }),
        updateStock: jest.fn().mockResolvedValue({}),
      } as unknown as InventoryRepository;
      const costingService = {
        restoreRefundLayer: jest.fn().mockResolvedValue(undefined),
      } as unknown as CostingService;
      const handler = new SalePartiallyRefundedEventHandler(
        inventoryRepository,
        costingService,
        {} as PrismaService,
      );
      const event = new SalePartiallyRefundedEvent({
        saleId: 'sale-1',
        refundId: 'ref-1',
        refundNumber: 'R-1',
        companyId: COMPANY,
        warehouseId: WAREHOUSE,
        total: '10',
        currency: 'USD',
        createdBy: 'u-1',
        items: [{ productId: PRODUCT, quantity: 1, fifoCost: '10' }],
        payments: [],
      } as never);
      return {
        tx,
        handler,
        event,
        findFirst,
        createMovement,
        inventoryRepository,
        costingService,
      };
    };

    it('still keys the marker on (companyId, REFUND, refundId)', async () => {
      const h = build(false);
      await h.handler.handle(h.event, { transactionClient: h.tx as never });
      expect(h.findFirst).toHaveBeenCalledWith({
        where: {
          companyId: COMPANY,
          referenceType: 'REFUND',
          referenceId: 'ref-1',
        },
        select: { id: true },
      });
      expect(h.createMovement).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when the refund marker already exists', async () => {
      const h = build(true);
      await h.handler.handle(h.event, { transactionClient: h.tx as never });
      expect(h.inventoryRepository.updateStock).not.toHaveBeenCalled();
      expect(h.createMovement).not.toHaveBeenCalled();
    });

    it('fails closed without a transaction context', async () => {
      const h = build(false);
      await expect(h.handler.handle(h.event, {})).rejects.toThrow(
        /No transaction context for sale\.partially_refunded/,
      );
    });
  });

  describe('finance sale.completed / sale.refunded journals', () => {
    const buildFinance = () => {
      const journalFindFirst = jest.fn().mockResolvedValue(null);
      const glPost = jest
        .fn()
        .mockResolvedValue({ id: 'je-1', entryNumber: 1 });
      const tx = {
        journalEntry: { findFirst: journalFindFirst },
        chartOfAccount: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'a-cash', code: '1010' },
            { id: 'a-bank', code: '1020' },
            { id: 'a-ar', code: '1200' },
            { id: 'a-rev', code: '4000' },
            { id: 'a-cogs', code: '5000' },
            { id: 'a-inv', code: '1300' },
          ]),
        },
        costLayer: { findMany: jest.fn().mockResolvedValue([]) },
        journalEntry_: jest.fn(),
        calendar: {},
      };
      const integration = new FinanceIntegrationService(
        {
          ensureCurrentCalendar: jest.fn().mockResolvedValue({
            isPostable: true,
            financialPeriod: { id: 'fp-1', name: 'Sep', status: 'OPEN' },
          }),
        } as never,
        { post: glPost } as unknown as GlEngineService,
      );
      const completedHandler = new FinanceSaleCompletedHandler(integration);
      const refundedHandler = new FinanceSaleRefundedHandler(integration);
      return {
        tx,
        journalFindFirst,
        glPost,
        integration,
        completedHandler,
        refundedHandler,
      };
    };

    const completedEvent = () =>
      new SaleCompletedEvent({
        saleId: 'sale-1',
        companyId: COMPANY,
        warehouseId: WAREHOUSE,
        cashierId: 'u-1',
        customerId: null,
        saleNumber: 'S-1',
        subtotal: '30',
        discount: '0',
        total: '30',
        paidAmount: '30',
        changeAmount: '0',
        currency: 'USD',
        items: [
          {
            saleItemId: 'si-1',
            productId: PRODUCT,
            quantity: 2,
            unitPrice: '15',
            costPrice: '3',
            discount: '0',
            subtotal: '30',
            total: '30',
            margin: '24',
          },
        ],
        payments: [{ method: 'CASH', amount: '30' }],
      });

    it('posts with clientOperationId = eventId on first delivery', async () => {
      const f = buildFinance();
      const event = completedEvent();
      await f.completedHandler.handle(event, {
        transactionClient: f.tx as never,
      });

      expect(f.glPost).toHaveBeenCalledTimes(1);
      expect(f.glPost.mock.calls[0][0].clientOperationId).toBe(event.eventId);
    });

    it('is a no-op when the event occurrence was already journaled', async () => {
      const f = buildFinance();
      f.journalFindFirst.mockResolvedValue({ id: 'je-existing' });
      const event = completedEvent();

      await f.completedHandler.handle(event, {
        transactionClient: f.tx as never,
      });

      expect(f.journalFindFirst).toHaveBeenCalledWith({
        where: { companyId: COMPANY, clientOperationId: event.eventId },
        select: { id: true },
      });
      expect(f.glPost).not.toHaveBeenCalled();
    });

    it('fails closed without a transaction context', async () => {
      const f = buildFinance();
      await expect(
        f.completedHandler.handle(completedEvent(), {}),
      ).rejects.toThrow(/No transaction context for sale\.completed/);
      expect(f.glPost).not.toHaveBeenCalled();
    });

    it('sale.refunded fails closed without a transaction context', async () => {
      const f = buildFinance();
      const event = new SaleRefundedEvent({
        saleId: 'sale-1',
        companyId: COMPANY,
        warehouseId: WAREHOUSE,
        cashierId: 'u-1',
        saleNumber: 'S-1',
        total: '30',
        refundTotal: '30',
        currency: 'USD',
        items: [
          { productId: PRODUCT, quantity: 2, unitCost: '15', total: '30' },
        ],
        payments: [],
      } as never);
      await expect(f.refundedHandler.handle(event, {})).rejects.toThrow(
        /No transaction context for sale\.refunded/,
      );
      expect(f.glPost).not.toHaveBeenCalled();
    });
  });

  describe('InventoryFinanceHandler — the multi-item count guard', () => {
    const build = (existingJournal: unknown) => {
      const journalFindFirst = jest.fn().mockResolvedValue(existingJournal);
      const glPost = jest.fn().mockResolvedValue({ id: 'je-1' });
      const auditLog = { log: jest.fn().mockResolvedValue(undefined) };
      const tx = {
        journalEntry: { findFirst: journalFindFirst },
        chartOfAccount: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'a-inv', code: '1300' },
            { id: 'a-adj', code: '5100' },
          ]),
        },
        financialPeriod: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 'fp-1', status: 'OPEN' }),
        },
      };
      const handler = new InventoryFinanceHandler(
        {} as PrismaService,
        { post: glPost } as unknown as GlEngineService,
        auditLog as unknown as AuditLogService,
      );
      return { handler, tx, journalFindFirst, glPost, auditLog };
    };

    const adjustedEvent = (productId: string, eventId: string) =>
      Object.assign(
        new InventoryAdjustedEvent({
          productId,
          companyId: COMPANY,
          warehouseId: WAREHOUSE,
          quantity: -2,
          beforeQuantity: 10,
          afterQuantity: 8,
          reason: 'count CNT-1',
          adjustedBy: 'u-1',
          referenceType: 'INVENTORY_COUNT',
          referenceId: 'count-1',
          totalCost: '20',
          unitCost: '10',
        }),
        { eventId },
      );

    it('posts one journal per event occurrence, keyed on eventId', async () => {
      const h = build(null);
      const event = adjustedEvent(PRODUCT, 'evt-a');
      await h.handler.handle(event, { transactionClient: h.tx as never });

      expect(h.glPost).toHaveBeenCalledTimes(1);
      expect(h.glPost.mock.calls[0][0].clientOperationId).toBe('evt-a');
      // The reference pair is preserved exactly as before (not unique).
      expect(h.glPost.mock.calls[0][0].referenceType).toBe(
        'INVENTORY_ADJUSTMENT',
      );
      expect(h.glPost.mock.calls[0][0].referenceId).toBe('count-1');
    });

    it('MULTI-ITEM INVENTORY COUNT STILL PRODUCES ONE JOURNAL PER ITEM', async () => {
      // One count (count-1) emits one event per counted item, all sharing
      // ('INVENTORY_COUNT', 'count-1'). Deduplicating on that pair would
      // suppress every adjustment after the first and under-post shrinkage.
      const h = build(null);

      for (const [productId, eventId] of [
        ['prod-1', 'evt-1'],
        ['prod-2', 'evt-2'],
        ['prod-3', 'evt-3'],
      ] as const) {
        await h.handler.handle(adjustedEvent(productId, eventId), {
          transactionClient: h.tx as never,
        });
      }

      expect(h.glPost).toHaveBeenCalledTimes(3);
      expect(h.glPost.mock.calls.map((c) => c[0].clientOperationId)).toEqual([
        'evt-1',
        'evt-2',
        'evt-3',
      ]);
      // All three legitimately share the same reference pair.
      expect(new Set(h.glPost.mock.calls.map((c) => c[0].referenceId))).toEqual(
        new Set(['count-1']),
      );
    });

    it('is a no-op when that event occurrence was already journaled', async () => {
      const h = build({ id: 'je-existing' });
      await h.handler.handle(adjustedEvent(PRODUCT, 'evt-a'), {
        transactionClient: h.tx as never,
      });
      expect(h.glPost).not.toHaveBeenCalled();
    });

    it('preserves the G16-F no-transaction observable-skip policy', async () => {
      const h = build(null);
      const auditLogSpy = h.auditLog.log;
      await h.handler.handle(adjustedEvent(PRODUCT, 'evt-a'), {});
      expect(h.glPost).not.toHaveBeenCalled();
      expect(auditLogSpy).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'GL_SKIP_NO_TX_CONTEXT' }),
      );
    });
  });
});
