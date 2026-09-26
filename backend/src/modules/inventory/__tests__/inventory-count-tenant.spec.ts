import { NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { InventoryCountService } from '../services/inventory-count.service';
import { InventoryRepository } from '../repositories/inventory.repository';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { CostingService } from '../services/costing.service';

/**
 * G16-B-02 PH3 (B02-08) — Inventory Count tenant isolation.
 *
 * `create` persisted client-supplied `warehouseId` / `productId` verbatim and
 * `complete` trusted them, so a foreign (or inactive/deleted) warehouse could
 * reach `createStock` and materialize a Stock row pointing at another tenant's
 * warehouse. These tests lock in the fail-closed ownership guard on both paths
 * and prove a rejected count has no partial side effects.
 */
describe('InventoryCountService — tenant ownership (G16-B-02 PH3 B02-08)', () => {
  let service: InventoryCountService;
  let repo: {
    findWarehouseById: jest.Mock;
    findProductsByIds: jest.Mock;
    createInventoryCount: jest.Mock;
    createInventoryCountItem: jest.Mock;
    findInventoryCountById: jest.Mock;
    updateInventoryCount: jest.Mock;
    findStockByProductAndWarehouse: jest.Mock;
    createStock: jest.Mock;
    updateStock: jest.Mock;
    createStockMovement: jest.Mock;
    findProductById: jest.Mock;
  };
  let mockTx: Record<string, unknown>;
  let auditLog: { log: jest.Mock };
  let eventBus: { publish: jest.Mock };
  let costing: {
    calculateAverageCost: jest.Mock;
    recordInboundLayer: jest.Mock;
    consumeFifoLayers: jest.Mock;
  };

  const COMPANY_ID = 'comp-1';
  const USER_ID = 'user-1';

  const activeWarehouse = (id: string) => ({
    id,
    isActive: true,
    deletedAt: null,
  });
  const productRow = (id: string) => ({
    id,
    costPrice: null,
    isActive: true,
  });
  const inactiveProductRow = (id: string) => ({
    id,
    costPrice: null,
    isActive: false,
  });

  const createDto = (over: Record<string, unknown> = {}) => ({
    countNumber: 'CNT-001',
    warehouseId: 'wh-1',
    items: [
      { productId: 'prod-1', expectedQuantity: 10, actualQuantity: 12 },
      { productId: 'prod-2', expectedQuantity: 5, actualQuantity: 5 },
    ],
    ...over,
  });

  const countItem = (productId: string, expected: number, actual: number) => ({
    productId,
    expectedQuantity: expected,
    actualQuantity: actual,
    difference: actual - expected,
  });

  const draftCount = (items: any[], warehouseId = 'wh-1') => ({
    id: 'count-1',
    companyId: COMPANY_ID,
    warehouseId,
    countNumber: 'CNT-001',
    status: 'DRAFT',
    rowVersion: 0,
    items,
  });

  /** A completion rejection must not write Stock, movements, events or audit. */
  const expectNoCompletionSideEffects = () => {
    expect(repo.updateInventoryCount).not.toHaveBeenCalled();
    expect(repo.findStockByProductAndWarehouse).not.toHaveBeenCalled();
    expect(repo.createStock).not.toHaveBeenCalled();
    expect(repo.updateStock).not.toHaveBeenCalled();
    expect(repo.createStockMovement).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    mockTx = {};
    repo = {
      findWarehouseById: jest
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve(activeWarehouse(id)),
        ),
      findProductsByIds: jest
        .fn()
        .mockImplementation((ids: string[]) =>
          Promise.resolve(ids.map((id) => productRow(id))),
        ),
      createInventoryCount: jest.fn().mockResolvedValue({ id: 'count-1' }),
      createInventoryCountItem: jest
        .fn()
        .mockResolvedValue({ id: 'item-1' }),
      findInventoryCountById: jest.fn(),
      updateInventoryCount: jest.fn().mockResolvedValue({}),
      findStockByProductAndWarehouse: jest.fn(),
      createStock: jest.fn(),
      updateStock: jest.fn().mockResolvedValue({}),
      createStockMovement: jest.fn().mockResolvedValue({}),
      findProductById: jest.fn(),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    costing = {
      calculateAverageCost: jest.fn().mockResolvedValue(new Decimal('20')),
      recordInboundLayer: jest.fn().mockResolvedValue(undefined),
      consumeFifoLayers: jest
        .fn()
        .mockResolvedValue({ totalCost: new Decimal('100') }),
    };

    const mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    service = new InventoryCountService(
      repo as unknown as InventoryRepository,
      mockPrisma as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
      costing as unknown as CostingService,
      eventBus as any,
    );
  });

  describe('create', () => {
    beforeEach(() => {
      repo.findInventoryCountById.mockResolvedValue(
        draftCount([countItem('prod-1', 10, 12)]),
      );
    });

    it('rejects a foreign warehouse and persists nothing', async () => {
      repo.findWarehouseById.mockResolvedValueOnce(null);

      await expect(
        service.create(createDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.findWarehouseById).toHaveBeenCalledWith(
        'wh-1',
        COMPANY_ID,
        mockTx,
      );
      expect(repo.createInventoryCount).not.toHaveBeenCalled();
      expect(repo.createInventoryCountItem).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('rejects an inactive warehouse and persists nothing', async () => {
      repo.findWarehouseById.mockResolvedValueOnce({
        id: 'wh-1',
        isActive: false,
      });

      await expect(
        service.create(createDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.createInventoryCount).not.toHaveBeenCalled();
      expect(repo.createInventoryCountItem).not.toHaveBeenCalled();
    });

    it('rejects a deleted warehouse (repository returns null)', async () => {
      repo.findWarehouseById.mockResolvedValueOnce(null);

      await expect(
        service.create(createDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.createInventoryCount).not.toHaveBeenCalled();
    });

    it('rejects a foreign product not returned by the company-scoped lookup', async () => {
      // Company lookup only resolves prod-1; prod-2 is foreign/missing.
      repo.findProductsByIds.mockResolvedValueOnce([productRow('prod-1')]);

      await expect(
        service.create(createDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.findProductsByIds).toHaveBeenCalledWith(
        ['prod-1', 'prod-2'],
        COMPANY_ID,
        mockTx,
      );
      expect(repo.createInventoryCount).not.toHaveBeenCalled();
      expect(repo.createInventoryCountItem).not.toHaveBeenCalled();
    });

    it('rejects a deleted product excluded by the company-scoped lookup', async () => {
      // A soft-deleted product is filtered out by findProductsByIds, so the
      // result is shorter than the requested set -> indistinguishable 404.
      repo.findProductsByIds.mockResolvedValueOnce([]);

      await expect(
        service.create(createDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.createInventoryCount).not.toHaveBeenCalled();
    });

    it('rejects a same-company inactive product and persists nothing', async () => {
      // Both products belong to the caller's company, but prod-2 is inactive:
      // the same 404 must fire before any count/item/audit persistence.
      repo.findProductsByIds.mockResolvedValueOnce([
        productRow('prod-1'),
        inactiveProductRow('prod-2'),
      ]);

      await expect(
        service.create(createDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.findProductsByIds).toHaveBeenCalledWith(
        ['prod-1', 'prod-2'],
        COMPANY_ID,
        mockTx,
      );
      expect(repo.createInventoryCount).not.toHaveBeenCalled();
      expect(repo.createInventoryCountItem).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('performs no Inventory Count persistence when validation fails', async () => {
      repo.findWarehouseById.mockResolvedValueOnce(null);

      await expect(
        service.create(createDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.createInventoryCount).not.toHaveBeenCalled();
      expect(repo.createInventoryCountItem).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    it('rejects a persisted foreign warehouse with no side effects', async () => {
      repo.findInventoryCountById.mockResolvedValue(
        draftCount([countItem('prod-1', 10, 15)]),
      );
      repo.findWarehouseById.mockResolvedValueOnce(null);

      await expect(
        service.complete('count-1', { rowVersion: 0 } as any, COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.findWarehouseById).toHaveBeenCalledWith(
        'wh-1',
        COMPANY_ID,
        mockTx,
      );
      expectNoCompletionSideEffects();
    });

    it('rejects a persisted foreign product with no side effects', async () => {
      repo.findInventoryCountById.mockResolvedValue(
        draftCount([countItem('prod-1', 10, 15), countItem('prod-9', 5, 8)]),
      );
      repo.findProductsByIds.mockResolvedValueOnce([productRow('prod-1')]);

      await expect(
        service.complete('count-1', { rowVersion: 0 } as any, COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expectNoCompletionSideEffects();
    });

    it('rejects a persisted inactive warehouse with no side effects', async () => {
      repo.findInventoryCountById.mockResolvedValue(
        draftCount([countItem('prod-1', 10, 15)]),
      );
      repo.findWarehouseById.mockResolvedValueOnce({
        id: 'wh-1',
        isActive: false,
      });

      await expect(
        service.complete('count-1', { rowVersion: 0 } as any, COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expectNoCompletionSideEffects();
    });

    it('rejects a persisted deleted warehouse with no side effects', async () => {
      repo.findInventoryCountById.mockResolvedValue(
        draftCount([countItem('prod-1', 10, 15)]),
      );
      repo.findWarehouseById.mockResolvedValueOnce(null);

      await expect(
        service.complete('count-1', { rowVersion: 0 } as any, COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expectNoCompletionSideEffects();
    });

    it('rejects a persisted deleted product with no side effects', async () => {
      repo.findInventoryCountById.mockResolvedValue(
        draftCount([countItem('prod-1', 10, 15)]),
      );
      repo.findProductsByIds.mockResolvedValueOnce([]);

      await expect(
        service.complete('count-1', { rowVersion: 0 } as any, COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expectNoCompletionSideEffects();
    });

    it('rejects a persisted inactive product before any Stock mutation', async () => {
      repo.findInventoryCountById.mockResolvedValue(
        draftCount([countItem('prod-1', 10, 15)]),
      );
      // Same-company but inactive: must be rejected before status update,
      // Stock reads/writes, movement, audit or events.
      repo.findProductsByIds.mockResolvedValueOnce([inactiveProductRow('prod-1')]);

      await expect(
        service.complete('count-1', { rowVersion: 0 } as any, COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.findProductsByIds).toHaveBeenCalledWith(
        ['prod-1'],
        COMPANY_ID,
        mockTx,
      );
      expectNoCompletionSideEffects();
    });

    it('does not mutate Stock when validation fails', async () => {
      repo.findInventoryCountById.mockResolvedValue(
        draftCount([countItem('prod-1', 10, 15)]),
      );
      repo.findWarehouseById.mockResolvedValueOnce(null);

      await expect(
        service.complete('count-1', { rowVersion: 0 } as any, COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.createStock).not.toHaveBeenCalled();
      expect(repo.updateStock).not.toHaveBeenCalled();
    });

    it('does not create a StockMovement when validation fails', async () => {
      repo.findInventoryCountById.mockResolvedValue(
        draftCount([countItem('prod-1', 10, 15)]),
      );
      repo.findWarehouseById.mockResolvedValueOnce(null);

      await expect(
        service.complete('count-1', { rowVersion: 0 } as any, COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.createStockMovement).not.toHaveBeenCalled();
    });

    it('does not emit audit or event side effects when validation fails', async () => {
      repo.findInventoryCountById.mockResolvedValue(
        draftCount([countItem('prod-1', 10, 15)]),
      );
      repo.findWarehouseById.mockResolvedValueOnce(null);

      await expect(
        service.complete('count-1', { rowVersion: 0 } as any, COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('completes a valid same-company active count', async () => {
      repo.findInventoryCountById.mockResolvedValue(
        draftCount([countItem('prod-1', 10, 15)]),
      );
      repo.findStockByProductAndWarehouse.mockResolvedValue({
        id: 'stock-1',
        productId: 'prod-1',
        warehouseId: 'wh-1',
        companyId: COMPANY_ID,
        quantity: 10,
        reservedQuantity: 0,
        rowVersion: 1,
      });

      await service.complete(
        'count-1',
        { rowVersion: 0 } as any,
        COMPANY_ID,
        USER_ID,
      );

      expect(repo.findWarehouseById).toHaveBeenCalledWith(
        'wh-1',
        COMPANY_ID,
        mockTx,
      );
      expect(repo.findProductsByIds).toHaveBeenCalledWith(
        ['prod-1'],
        COMPANY_ID,
        mockTx,
      );
      expect(repo.updateStock).toHaveBeenCalledWith(
        'stock-1',
        expect.objectContaining({ quantity: 15 }),
        COMPANY_ID,
        1,
        mockTx,
      );
      expect(repo.createStockMovement).toHaveBeenCalledTimes(1);
      expect(repo.updateInventoryCount).toHaveBeenCalled();
    });
  });
});
