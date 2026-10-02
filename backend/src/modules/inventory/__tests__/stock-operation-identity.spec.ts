import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { StockService } from '../services/stock.service';
import { InventoryRepository } from '../repositories/inventory.repository';
import { PrismaService } from '../../../common/prisma';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { CostingService } from '../services/costing.service';
import { EVENT_BUS } from '../../../common/events';

/**
 * G16-N-3 P2-B-2 — durable business-operation identity for inventory.
 *
 * A committed adjustStock/transferStock retried after the 24h
 * IdempotencyRecord TTL must never execute twice. The durable guard is
 * @@unique([companyId, clientOperationId, type]) on StockMovement: a retried
 * leg collides deterministically (P2002 → 409 with "unique" in the message),
 * rolling back the whole transaction.
 *
 * The mocked repository below faithfully simulates the composite unique: it
 * tracks (companyId, clientOperationId, type) tuples and rejects duplicates
 * with a real Prisma P2002 error carrying meta.target, exactly as PostgreSQL
 * would. NULL identities never collide (PostgreSQL semantics).
 */
describe('StockService — durable operation identity (P2-B-2)', () => {
  let service: StockService;
  let repo: {
    findProductById: jest.Mock;
    findWarehouseById: jest.Mock;
    findStockByProductAndWarehouse: jest.Mock;
    createStock: jest.Mock;
    updateStock: jest.Mock;
    createStockMovement: jest.Mock;
  };
  let auditLog: { log: jest.Mock };
  let costing: {
    calculateAverageCost: jest.Mock;
    resolvePositiveEntryUnitCost: jest.Mock;
    recordInboundLayer: jest.Mock;
    consumeFifoLayers: jest.Mock;
  };
  let eventBus: { publish: jest.Mock };

  // In-memory stand-in for @@unique([companyId, clientOperationId, type]).
  // NULL identities are skipped (never collide), matching PostgreSQL.
  const claimed = new Set<string>();
  const claimKey = (
    companyId: string,
    clientOperationId: string | null | undefined,
    type: string,
  ) => `${companyId}|${clientOperationId}|${type}`;

  const p2002 = () =>
    new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`companyId`, `clientOperationId`, `type`)',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['companyId', 'clientOperationId', 'type'] },
      },
    );

  const stockRow = (quantity: number, rowVersion = 0) => ({
    id: 'stock-1',
    productId: 'prod-1',
    warehouseId: 'wh-1',
    quantity,
    reservedQuantity: 0,
    availableQuantity: quantity,
    rowVersion,
  });

  const adjustDto = (quantity: number, clientOperationId?: string) => ({
    productId: 'prod-1',
    warehouseId: 'wh-1',
    quantity,
    reason: 'test',
    clientOperationId,
  });

  const transferDto = (clientOperationId?: string) => ({
    productId: 'prod-1',
    fromWarehouseId: 'wh-1',
    toWarehouseId: 'wh-2',
    quantity: 2,
    clientOperationId,
  });

  beforeEach(() => {
    claimed.clear();
    repo = {
      findProductById: jest.fn().mockResolvedValue({
        id: 'prod-1',
        costPrice: new Decimal('100'),
      }),
      findWarehouseById: jest.fn().mockImplementation(async (id: string) => ({
        id,
        isActive: true,
      })),
      findStockByProductAndWarehouse: jest
        .fn()
        .mockImplementation(async (productId: string, warehouseId: string) =>
          stockRow(warehouseId === 'wh-1' ? 10 : 0),
        ),
      createStock: jest.fn().mockImplementation(async (data: any) => ({
        id: `stock-${data.warehouse?.connect?.id ?? 'new'}`,
        ...data,
        rowVersion: 0,
      })),
      updateStock: jest.fn().mockResolvedValue({ id: 'stock-1' }),
      createStockMovement: jest.fn().mockImplementation(async (data: any) => {
        if (data.clientOperationId != null) {
          const key = claimKey(
            data.company?.connect?.id,
            data.clientOperationId,
            data.type,
          );
          if (claimed.has(key)) throw p2002();
          claimed.add(key);
        }
        return { id: `mov-${claimed.size}`, ...data };
      }),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    costing = {
      calculateAverageCost: jest.fn().mockResolvedValue(new Decimal('15')),
      resolvePositiveEntryUnitCost: jest
        .fn()
        .mockResolvedValue({ unitCost: new Decimal('15'), source: 'AVERAGE' }),
      recordInboundLayer: jest.fn().mockResolvedValue(undefined),
      consumeFifoLayers: jest.fn().mockResolvedValue(undefined),
    };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    service = new StockService(
      repo as unknown as InventoryRepository,
      {
        $transaction: jest.fn((cb: any) => cb({})),
      } as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
      costing as unknown as CostingService,
      {
        hashRequest: jest.fn().mockReturnValue('hash'),
      } as unknown as IdempotencyService,
      eventBus as any,
    );
  });

  describe('adjustStock', () => {
    it('first request creates exactly one movement with correct delta', async () => {
      await service.adjustStock(
        adjustDto(5, 'op-adjust-1'),
        'comp-1',
        'user-1',
      );

      expect(repo.createStockMovement).toHaveBeenCalledTimes(1);
      expect(repo.createStockMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          type: StockMovementType.ADJUSTMENT,
          quantity: 5,
          beforeQuantity: 10,
          afterQuantity: 15,
          clientOperationId: 'op-adjust-1',
        }),
        expect.anything(),
      );
      expect(repo.updateStock).toHaveBeenCalledTimes(1);
    });

    it('duplicate same ID after TTL expiry → 409 with "unique", no second effect', async () => {
      // First execution commits (simulating the pre-expiry commit).
      await service.adjustStock(
        adjustDto(5, 'op-adjust-2'),
        'comp-1',
        'user-1',
      );
      expect(repo.createStockMovement).toHaveBeenCalledTimes(1);
      jest.clearAllMocks();

      // Post-expiry retry: idempotency record gone, unique still holds.
      const err = await service
        .adjustStock(adjustDto(5, 'op-adjust-2'), 'comp-1', 'user-1')
        .catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.message.toLowerCase()).toContain('unique');

      // No second movement: the retry collides on the insert itself, so the
      // only createStockMovement call is the failing one. The stock update
      // IS attempted first (it precedes the movement insert in-tx), but the
      // P2002 aborts the whole transaction — in production nothing persists.
      // Everything AFTER the movement insert never runs.
      expect(repo.createStockMovement).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('same ID + different payload → 409, original intact', async () => {
      await service.adjustStock(
        adjustDto(5, 'op-adjust-3'),
        'comp-1',
        'user-1',
      );

      await expect(
        service.adjustStock(adjustDto(7, 'op-adjust-3'), 'comp-1', 'user-1'),
      ).rejects.toThrow(ConflictException);
      // The +7 payload never executes: only the original +5 movement exists.
      const movements = [...claimed].filter((k) =>
        k.startsWith('comp-1|op-adjust-3|'),
      );
      expect(movements).toHaveLength(1);
    });

    it('NULL clientOperationId preserves legacy behavior', async () => {
      await service.adjustStock(adjustDto(5), 'comp-1', 'user-1');
      await service.adjustStock(adjustDto(5), 'comp-1', 'user-1');

      // No identity → no collision → both execute (legacy TTL-only path).
      expect(repo.createStockMovement).toHaveBeenCalledTimes(2);
    });
  });

  describe('transferStock', () => {
    it('first request creates exactly OUT + IN legs with the same ID', async () => {
      const result = await service.transferStock(
        transferDto('op-transfer-1'),
        'comp-1',
        'user-1',
      );

      expect(result).toHaveLength(2);
      const outCall = repo.createStockMovement.mock.calls.find(
        (c: any[]) => c[0].type === StockMovementType.TRANSFER_OUT,
      );
      const inCall = repo.createStockMovement.mock.calls.find(
        (c: any[]) => c[0].type === StockMovementType.TRANSFER_IN,
      );
      expect(outCall).toBeDefined();
      expect(inCall).toBeDefined();
      expect(outCall[0].clientOperationId).toBe('op-transfer-1');
      expect(inCall[0].clientOperationId).toBe('op-transfer-1');
      expect(outCall[0].quantity).toBe(2);
      expect(inCall[0].quantity).toBe(2);
    });

    it('duplicate same ID after TTL expiry → 409, no second transfer', async () => {
      await service.transferStock(
        transferDto('op-transfer-2'),
        'comp-1',
        'user-1',
      );
      const callsAfterFirst = repo.createStockMovement.mock.calls.length;
      jest.clearAllMocks();

      const err = await service
        .transferStock(transferDto('op-transfer-2'), 'comp-1', 'user-1')
        .catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.message.toLowerCase()).toContain('unique');

      // The retry collides on the OUT leg; the whole tx rolls back — no new
      // IN leg is attempted after the OUT insert throws, and the source/dest
      // updates attempted before it are rolled back with the transaction.
      expect(repo.createStockMovement).toHaveBeenCalledTimes(1);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('same ID + different warehouse pair → 409, no second transfer', async () => {
      await service.transferStock(
        transferDto('op-transfer-3'),
        'comp-1',
        'user-1',
      );

      await expect(
        service.transferStock(
          {
            ...transferDto('op-transfer-3'),
            toWarehouseId: 'wh-9',
          },
          'comp-1',
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('cross-cutting', () => {
    it('same ID across two companies executes independently', async () => {
      await service.adjustStock(
        adjustDto(5, 'op-shared-1'),
        'comp-1',
        'user-1',
      );
      // Different company: no collision (unique is company-scoped).
      // findStockByProductAndWarehouse is company-agnostic in the mock, so
      // the second call proceeds to its own movement insert.
      await service.adjustStock(
        adjustDto(5, 'op-shared-1'),
        'comp-2',
        'user-9',
      );

      expect(repo.createStockMovement).toHaveBeenCalledTimes(2);
    });

    it('concurrent duplicate adjust: one commits, one gets 409', async () => {
      // The mock's check-and-add is synchronous (no await between), so the
      // two concurrent calls serialize exactly like PostgreSQL's unique
      // index would: exactly one wins, the loser gets P2002 → 409.
      const results = await Promise.allSettled([
        service.adjustStock(adjustDto(5, 'op-race-1'), 'comp-1', 'user-1'),
        service.adjustStock(adjustDto(5, 'op-race-1'), 'comp-1', 'user-1'),
      ]);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        ConflictException,
      );
      expect(
        (
          (rejected[0] as PromiseRejectedResult).reason as Error
        ).message.toLowerCase(),
      ).toContain('unique');
    });

    it('rollback before identity commit leaves no marker; retry succeeds once', async () => {
      // Simulate a failure BEFORE the movement insert (e.g. insufficient
      // stock): no identity row exists, so a later retry executes cleanly.
      repo.findStockByProductAndWarehouse.mockResolvedValueOnce({
        id: 'stock-1',
        productId: 'prod-1',
        warehouseId: 'wh-1',
        quantity: 1,
        reservedQuantity: 0,
        availableQuantity: 1,
        rowVersion: 0,
      });
      await expect(
        service.adjustStock(adjustDto(-5, 'op-rollback-1'), 'comp-1', 'user-1'),
      ).rejects.toThrow(BadRequestException);

      // Retry after fixing stock succeeds exactly once.
      repo.findStockByProductAndWarehouse.mockResolvedValue({
        id: 'stock-1',
        productId: 'prod-1',
        warehouseId: 'wh-1',
        quantity: 10,
        reservedQuantity: 0,
        availableQuantity: 10,
        rowVersion: 0,
      });
      await service.adjustStock(
        adjustDto(-5, 'op-rollback-1'),
        'comp-1',
        'user-1',
      );
      const marked = [...claimed].filter((k) => k.includes('op-rollback-1'));
      expect(marked).toHaveLength(1);
    });
  });
});
