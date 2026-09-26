import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StockService } from '../services/stock.service';
import { InventoryRepository } from '../repositories/inventory.repository';
import { PrismaService } from '../../../common/prisma';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { CostingService } from '../services/costing.service';

/**
 * G16-B-02 PH3 (B02-07) — Stock transfer tenant isolation.
 *
 * `transferStock` previously relied on Prisma `connect`, which enforces
 * existence only and never tenant ownership. A transfer could therefore touch
 * a foreign, inactive, or soft-deleted warehouse — and when the destination
 * Stock row did not exist, create one inside that foreign warehouse. These
 * tests lock in the pre-mutation guard and prove that a rejected transfer has
 * no partial side effects (no Stock row write, no TRANSFER movement, no
 * published event, no audit entry).
 */
describe('StockService.transferStock — tenant ownership (G16-B-02 PH3 B02-07)', () => {
  let service: StockService;
  let repo: {
    findProductById: jest.Mock;
    findWarehouseById: jest.Mock;
    findStockByProductAndWarehouse: jest.Mock;
    createStock: jest.Mock;
    updateStock: jest.Mock;
    createStockMovement: jest.Mock;
  };
  let mockPrisma: { $transaction: jest.Mock };
  let auditLog: { log: jest.Mock };
  let eventBus: { publish: jest.Mock };

  const COMPANY_ID = 'comp-1';
  const USER_ID = 'user-1';

  const sourceStock = () => ({
    id: 'stock-1',
    productId: 'prod-1',
    warehouseId: 'wh-1',
    quantity: 100,
    reservedQuantity: 0,
    availableQuantity: 100,
    rowVersion: 0,
  });

  const destStock = () => ({
    id: 'stock-2',
    productId: 'prod-1',
    warehouseId: 'wh-2',
    quantity: 50,
    reservedQuantity: 0,
    availableQuantity: 50,
    rowVersion: 0,
  });

  const dto = (over: Record<string, unknown> = {}) => ({
    productId: 'prod-1',
    fromWarehouseId: 'wh-1',
    toWarehouseId: 'wh-2',
    quantity: 10,
    ...over,
  });

  const activeWarehouse = (id: string) => ({ id, isActive: true });

  /** Asserts the transfer was rejected with no observable side effects. */
  const expectNoSideEffects = () => {
    // No Stock mutation.
    expect(repo.updateStock).not.toHaveBeenCalled();
    expect(repo.createStock).not.toHaveBeenCalled();
    // No transfer movement.
    expect(repo.createStockMovement).not.toHaveBeenCalled();
    // No audit/event side effects.
    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    repo = {
      findProductById: jest
        .fn()
        .mockResolvedValue({ id: 'prod-1', costPrice: null }),
      findWarehouseById: jest
        .fn()
        .mockImplementation((id: string) =>
          Promise.resolve(activeWarehouse(id)),
        ),
      findStockByProductAndWarehouse: jest.fn(),
      createStock: jest.fn(),
      updateStock: jest.fn().mockResolvedValue({ id: 'stock-1' }),
      createStockMovement: jest.fn().mockResolvedValue({ id: 'mov-1' }),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
    };

    const idempotencyService = {
      hashRequest: jest.fn().mockReturnValue('hash'),
    } as unknown as IdempotencyService;

    const costing = {
      calculateAverageCost: jest.fn().mockResolvedValue(null),
      recordInboundLayer: jest.fn().mockResolvedValue(undefined),
      consumeFifoLayers: jest.fn().mockResolvedValue(undefined),
    } as unknown as CostingService;

    service = new StockService(
      repo as unknown as InventoryRepository,
      mockPrisma as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
      costing,
      idempotencyService,
      eventBus as any,
    );
  });

  it('rejects a foreign source warehouse and leaves no side effects', async () => {
    repo.findWarehouseById.mockResolvedValueOnce(null);

    await expect(
      service.transferStock(dto(), COMPANY_ID, USER_ID),
    ).rejects.toThrow(NotFoundException);

    expect(repo.findWarehouseById).toHaveBeenCalledWith(
      'wh-1',
      COMPANY_ID,
      expect.anything(),
    );
    // Stock is never even read, and no write/movement/event occurs.
    expect(repo.findStockByProductAndWarehouse).not.toHaveBeenCalled();
    expectNoSideEffects();
  });

  it('rejects a foreign destination warehouse and never creates stock in it', async () => {
    repo.findWarehouseById
      .mockResolvedValueOnce(activeWarehouse('wh-1'))
      .mockResolvedValueOnce(null);

    await expect(
      service.transferStock(dto(), COMPANY_ID, USER_ID),
    ).rejects.toThrow(NotFoundException);

    expect(repo.findWarehouseById).toHaveBeenCalledWith(
      'wh-2',
      COMPANY_ID,
      expect.anything(),
    );
    expect(repo.findStockByProductAndWarehouse).not.toHaveBeenCalled();
    expectNoSideEffects();
  });

  it('rejects a foreign product before any warehouse or stock lookup', async () => {
    repo.findProductById.mockResolvedValue(null);

    await expect(
      service.transferStock(dto(), COMPANY_ID, USER_ID),
    ).rejects.toThrow(NotFoundException);

    expect(repo.findProductById).toHaveBeenCalledWith(
      'prod-1',
      COMPANY_ID,
      expect.anything(),
    );
    expect(repo.findWarehouseById).not.toHaveBeenCalled();
    expect(repo.findStockByProductAndWarehouse).not.toHaveBeenCalled();
    expectNoSideEffects();
  });

  it('rejects an inactive source warehouse', async () => {
    repo.findWarehouseById.mockResolvedValueOnce({
      id: 'wh-1',
      isActive: false,
    });

    await expect(
      service.transferStock(dto(), COMPANY_ID, USER_ID),
    ).rejects.toThrow(NotFoundException);

    expect(repo.findStockByProductAndWarehouse).not.toHaveBeenCalled();
    expectNoSideEffects();
  });

  it('rejects an inactive destination warehouse', async () => {
    repo.findWarehouseById
      .mockResolvedValueOnce(activeWarehouse('wh-1'))
      .mockResolvedValueOnce({ id: 'wh-2', isActive: false });

    await expect(
      service.transferStock(dto(), COMPANY_ID, USER_ID),
    ).rejects.toThrow(NotFoundException);

    expect(repo.findStockByProductAndWarehouse).not.toHaveBeenCalled();
    expectNoSideEffects();
  });

  it('rejects a deleted source warehouse (repository returns null)', async () => {
    // `findWarehouseById` filters `deletedAt: null`, so a soft-deleted
    // warehouse is indistinguishable from a missing one here.
    repo.findWarehouseById.mockResolvedValueOnce(null);

    await expect(
      service.transferStock(dto(), COMPANY_ID, USER_ID),
    ).rejects.toThrow(NotFoundException);

    expectNoSideEffects();
  });

  it('rejects a deleted destination warehouse (repository returns null)', async () => {
    repo.findWarehouseById
      .mockResolvedValueOnce(activeWarehouse('wh-1'))
      .mockResolvedValueOnce(null);

    await expect(
      service.transferStock(dto(), COMPANY_ID, USER_ID),
    ).rejects.toThrow(NotFoundException);

    expectNoSideEffects();
  });

  it('rejects a transfer to the same warehouse before any validation', async () => {
    await expect(
      service.transferStock(
        dto({ toWarehouseId: 'wh-1' }),
        COMPANY_ID,
        USER_ID,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(repo.findProductById).not.toHaveBeenCalled();
    expect(repo.findWarehouseById).not.toHaveBeenCalled();
    expectNoSideEffects();
  });

  it('does not mutate Stock when validation fails', async () => {
    repo.findWarehouseById.mockResolvedValueOnce(null);

    await expect(
      service.transferStock(dto(), COMPANY_ID, USER_ID),
    ).rejects.toThrow(NotFoundException);

    expect(repo.createStock).not.toHaveBeenCalled();
    expect(repo.updateStock).not.toHaveBeenCalled();
  });

  it('does not create a transfer movement when validation fails', async () => {
    repo.findWarehouseById
      .mockResolvedValueOnce(activeWarehouse('wh-1'))
      .mockResolvedValueOnce(null);

    await expect(
      service.transferStock(dto(), COMPANY_ID, USER_ID),
    ).rejects.toThrow(NotFoundException);

    expect(repo.createStockMovement).not.toHaveBeenCalled();
  });

  it('does not emit an audit or event side effect when validation fails', async () => {
    repo.findWarehouseById.mockResolvedValueOnce({
      id: 'wh-1',
      isActive: false,
    });

    await expect(
      service.transferStock(dto(), COMPANY_ID, USER_ID),
    ).rejects.toThrow(NotFoundException);

    expect(eventBus.publish).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('succeeds for valid same-company active warehouses', async () => {
    repo.findStockByProductAndWarehouse
      .mockResolvedValueOnce(sourceStock())
      .mockResolvedValueOnce(destStock());

    const result = await service.transferStock(dto(), COMPANY_ID, USER_ID);

    expect(result).toHaveLength(2);
    expect(repo.findWarehouseById).toHaveBeenCalledWith(
      'wh-1',
      COMPANY_ID,
      expect.anything(),
    );
    expect(repo.findWarehouseById).toHaveBeenCalledWith(
      'wh-2',
      COMPANY_ID,
      expect.anything(),
    );
    // Both balances move and both TRANSFER_OUT / TRANSFER_IN rows are written.
    expect(repo.updateStock).toHaveBeenCalledTimes(2);
    expect(repo.updateStock).toHaveBeenCalledWith(
      'stock-1',
      expect.objectContaining({ quantity: 90 }),
      COMPANY_ID,
      0,
      expect.anything(),
    );
    expect(repo.updateStock).toHaveBeenCalledWith(
      'stock-2',
      expect.objectContaining({ quantity: 60 }),
      COMPANY_ID,
      0,
      expect.anything(),
    );
    expect(repo.createStockMovement).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });
});
