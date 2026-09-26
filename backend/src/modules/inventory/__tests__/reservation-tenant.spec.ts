import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ReservationService } from '../services/reservation.service';
import { InventoryRepository } from '../repositories/inventory.repository';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';

/**
 * G16-B-02 PH3 (B02-12) — Reservation (reserve/release) hardening.
 *
 * `reserve`/`release` accepted client-supplied `productId`/`warehouseId`
 * verbatim: a foreign, soft-deleted or inactive product/warehouse could
 * reach `createStockMovement` connects and mutate `Stock.reservedQuantity`
 * without any ownership or state validation. These tests lock in the
 * fail-closed reference guard on both paths (same semantics as B02-07/
 * B02-08) and prove a rejected call has no Stock or movement side effects.
 */
describe('ReservationService — reference ownership (G16-B-02 PH3 B02-12)', () => {
  let service: ReservationService;
  let repo: {
    findWarehouseById: jest.Mock;
    findProductsByIds: jest.Mock;
    findStockByProductAndWarehouse: jest.Mock;
    updateStock: jest.Mock;
    createStockMovement: jest.Mock;
  };
  let mockTx: Record<string, unknown>;
  let auditLog: { log: jest.Mock };

  const COMPANY_ID = 'comp-1';
  const USER_ID = 'user-1';
  const PRODUCT_ID = 'prod-1';
  const WAREHOUSE_ID = 'wh-1';

  const activeWarehouse = (id: string) => ({
    id,
    isActive: true,
    deletedAt: null,
  });
  const productRow = (id: string, isActive = true) => ({
    id,
    costPrice: null,
    isActive,
  });

  const stockRow = (over: Record<string, unknown> = {}) => ({
    id: 'stock-1',
    productId: PRODUCT_ID,
    warehouseId: WAREHOUSE_ID,
    companyId: COMPANY_ID,
    quantity: 10,
    reservedQuantity: 2,
    rowVersion: 3,
    ...over,
  });

  const reserveDto = (over: Record<string, unknown> = {}) => ({
    productId: PRODUCT_ID,
    warehouseId: WAREHOUSE_ID,
    quantity: 5,
    ...over,
  });

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
      findStockByProductAndWarehouse: jest
        .fn()
        .mockResolvedValue(stockRow()),
      updateStock: jest.fn().mockResolvedValue({}),
      createStockMovement: jest
        .fn()
        .mockResolvedValue({ id: 'movement-1' }),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };

    service = new ReservationService(
      repo as unknown as InventoryRepository,
      mockPrisma as unknown as PrismaService,
      auditLog as unknown as AuditLogService,
      { publish: jest.fn() } as any,
    );
  });

  describe('reserve', () => {
    it('reserves stock for a valid same-company active reference', async () => {
      const result = await service.reserve(
        reserveDto(),
        COMPANY_ID,
        USER_ID,
      );

      expect(repo.findWarehouseById).toHaveBeenCalledWith(
        WAREHOUSE_ID,
        COMPANY_ID,
        mockTx,
      );
      expect(repo.findProductsByIds).toHaveBeenCalledWith(
        [PRODUCT_ID],
        COMPANY_ID,
        mockTx,
      );
      expect(repo.updateStock).toHaveBeenCalledWith(
        'stock-1',
        { reservedQuantity: 7, availableQuantity: 3 },
        COMPANY_ID,
        3,
        mockTx,
      );
      expect(repo.createStockMovement).toHaveBeenCalledTimes(1);
      expect(auditLog.log).toHaveBeenCalledTimes(1);
      expect(result.reservedQuantity).toBe(7);
    });

    it('rejects a foreign warehouse before any mutation', async () => {
      repo.findWarehouseById.mockResolvedValueOnce(null);

      await expect(
        service.reserve(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.updateStock).not.toHaveBeenCalled();
      expect(repo.createStockMovement).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('rejects a foreign product before any mutation', async () => {
      // Company-scoped product lookup resolves nothing.
      repo.findProductsByIds.mockResolvedValueOnce([]);

      await expect(
        service.reserve(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.updateStock).not.toHaveBeenCalled();
      expect(repo.createStockMovement).not.toHaveBeenCalled();
    });

    it('rejects an inactive warehouse before any mutation', async () => {
      repo.findWarehouseById.mockResolvedValueOnce({
        id: WAREHOUSE_ID,
        isActive: false,
      });

      await expect(
        service.reserve(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.updateStock).not.toHaveBeenCalled();
      expect(repo.createStockMovement).not.toHaveBeenCalled();
    });

    it('rejects an inactive product before any mutation', async () => {
      repo.findProductsByIds.mockResolvedValueOnce([
        productRow(PRODUCT_ID, false),
      ]);

      await expect(
        service.reserve(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.updateStock).not.toHaveBeenCalled();
      expect(repo.createStockMovement).not.toHaveBeenCalled();
    });

    it('rejects a deleted/missing warehouse before any mutation', async () => {
      // findWarehouseById filters deletedAt — deleted resolves to null.
      repo.findWarehouseById.mockResolvedValueOnce(null);

      await expect(
        service.reserve(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.findStockByProductAndWarehouse).not.toHaveBeenCalled();
      expect(repo.updateStock).not.toHaveBeenCalled();
    });

    it('rejects a deleted/missing product before any mutation', async () => {
      // findProductsByIds filters deletedAt — deleted resolves to empty.
      repo.findProductsByIds.mockResolvedValueOnce([]);

      await expect(
        service.reserve(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.updateStock).not.toHaveBeenCalled();
      expect(repo.createStockMovement).not.toHaveBeenCalled();
    });

    it('validation failure does not update Stock (mutation boundary)', async () => {
      repo.findWarehouseById.mockResolvedValueOnce(null);

      await expect(
        service.reserve(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.updateStock).not.toHaveBeenCalled();
    });

    it('validation failure does not create a StockMovement (mutation boundary)', async () => {
      repo.findProductsByIds.mockResolvedValueOnce([]);

      await expect(
        service.reserve(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.createStockMovement).not.toHaveBeenCalled();
    });
  });

  describe('release', () => {
    it('releases stock for a valid same-company active reference', async () => {
      const result = await service.release(
        reserveDto(),
        COMPANY_ID,
        USER_ID,
      );

      expect(repo.findWarehouseById).toHaveBeenCalledWith(
        WAREHOUSE_ID,
        COMPANY_ID,
        mockTx,
      );
      expect(repo.findProductsByIds).toHaveBeenCalledWith(
        [PRODUCT_ID],
        COMPANY_ID,
        mockTx,
      );
      expect(repo.updateStock).toHaveBeenCalledWith(
        'stock-1',
        { reservedQuantity: 0, availableQuantity: 10 },
        COMPANY_ID,
        3,
        mockTx,
      );
      expect(repo.createStockMovement).toHaveBeenCalledTimes(1);
      expect(result.quantity).toBe(2);
    });

    it('rejects a foreign warehouse before any mutation', async () => {
      repo.findWarehouseById.mockResolvedValueOnce(null);

      await expect(
        service.release(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.updateStock).not.toHaveBeenCalled();
      expect(repo.createStockMovement).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('rejects a foreign product before any mutation', async () => {
      repo.findProductsByIds.mockResolvedValueOnce([]);

      await expect(
        service.release(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.updateStock).not.toHaveBeenCalled();
      expect(repo.createStockMovement).not.toHaveBeenCalled();
    });

    it('rejects an inactive warehouse before any mutation', async () => {
      repo.findWarehouseById.mockResolvedValueOnce({
        id: WAREHOUSE_ID,
        isActive: false,
      });

      await expect(
        service.release(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.updateStock).not.toHaveBeenCalled();
      expect(repo.createStockMovement).not.toHaveBeenCalled();
    });

    it('rejects an inactive product before any mutation', async () => {
      repo.findProductsByIds.mockResolvedValueOnce([
        productRow(PRODUCT_ID, false),
      ]);

      await expect(
        service.release(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.updateStock).not.toHaveBeenCalled();
      expect(repo.createStockMovement).not.toHaveBeenCalled();
    });

    it('rejects deleted/missing references before any mutation', async () => {
      repo.findWarehouseById.mockResolvedValueOnce(null);

      await expect(
        service.release(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.updateStock).not.toHaveBeenCalled();
      expect(repo.createStockMovement).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('validation failure produces no updateStock/createStockMovement/audit', async () => {
      repo.findProductsByIds.mockResolvedValueOnce([]);

      await expect(
        service.release(reserveDto(), COMPANY_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(repo.updateStock).not.toHaveBeenCalled();
      expect(repo.createStockMovement).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });
  });

  describe('regression (business semantics unchanged)', () => {
    it('insufficient available stock still throws BadRequest with no update', async () => {
      // available = 10 - 8 = 2 < requested 5
      repo.findStockByProductAndWarehouse.mockResolvedValueOnce(
        stockRow({ reservedQuantity: 8 }),
      );

      await expect(
        service.reserve(reserveDto({ quantity: 5 }), COMPANY_ID, USER_ID),
      ).rejects.toThrow(BadRequestException);

      expect(repo.updateStock).not.toHaveBeenCalled();
      expect(repo.createStockMovement).not.toHaveBeenCalled();
    });

    it('release clamps to reservedQuantity (Math.min semantics)', async () => {
      // Reserved 2, requested 5 → releases only 2.
      const result = await service.release(
        reserveDto({ quantity: 5 }),
        COMPANY_ID,
        USER_ID,
      );

      expect(result.quantity).toBe(2);
      expect(repo.updateStock).toHaveBeenCalledWith(
        'stock-1',
        { reservedQuantity: 0, availableQuantity: 10 },
        COMPANY_ID,
        3,
        mockTx,
      );
      expect(repo.createStockMovement).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: -2 }),
        mockTx,
      );
    });

    it('CAS update arguments include companyId and rowVersion', async () => {
      await service.reserve(reserveDto(), COMPANY_ID, USER_ID);

      expect(repo.updateStock).toHaveBeenCalledWith(
        'stock-1',
        expect.objectContaining({ reservedQuantity: 7 }),
        COMPANY_ID,
        3,
        mockTx,
      );
    });
  });
});
