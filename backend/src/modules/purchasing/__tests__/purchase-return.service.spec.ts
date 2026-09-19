import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  PurchaseReturnStatus,
  StockMovementType,
} from '@prisma/client';
import { PurchaseReturnService } from '../services/purchase-return.service';
import { PurchaseReturnRepository } from '../repositories/purchase-return.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EVENT_BUS } from '../../../common/events';
import { CreatePurchaseReturnDto } from '../dto/create-purchase-return.dto';
import { UpdatePurchaseReturnDto } from '../dto/update-purchase-return.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { CompaniesService } from '../../companies/services/companies.service';
import { PurchasingFinanceService } from '../services/purchasing-finance.service';
import { GlEngineService } from '../../finance/services/gl-engine.service';
import { CostingService } from '../../inventory/services/costing.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';

const companyId = 'comp-1';
const userId = 'user-1';
const supplierId = 'supplier-1';
const warehouseId = 'wh-1';
const productId = 'prod-1';

const baseReturn = {
  id: 'pr-1',
  companyId,
  supplierId,
  warehouseId,
  returnNumber: 'PR-TEST-0001',
  returnDate: new Date(),
  status: PurchaseReturnStatus.DRAFT,
  subtotal: new Prisma.Decimal('100'),
  discountAmount: new Prisma.Decimal('0'),
  taxAmount: new Prisma.Decimal('0'),
  grandTotal: new Prisma.Decimal('100'),
  currency: 'KZT' as const,
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
      id: 'pri-1',
      purchaseReturnId: 'pr-1',
      productId,
      quantity: 5,
      unitCost: new Prisma.Decimal('20'),
      discountPercent: null,
      discountAmount: new Prisma.Decimal('0'),
      taxPercent: null,
      taxAmount: new Prisma.Decimal('0'),
      subtotal: new Prisma.Decimal('100'),
      total: new Prisma.Decimal('100'),
      notes: null,
    },
  ],
  supplier: { id: supplierId, companyName: 'TS' },
  warehouse: { id: warehouseId, name: 'Main' },
};

describe('PurchaseReturnService', () => {
  let service: PurchaseReturnService;
  let mockRepo: jest.Mocked<PurchaseReturnRepository>;
  let mockPrisma: Record<string, jest.Mock>;
  let mockEventBus: { publish: jest.Mock };
  let mockFinance: { createPurchaseReturnJournal: jest.Mock };
  let mockAuditLog: jest.Mocked<AuditLogService>;
  let mockCosting: { consumeFifoLayers: jest.Mock };
  let mockIdempotency: { reserve: jest.Mock; complete: jest.Mock; hashRequest: jest.Mock };
  const mockTransaction = jest.fn();

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findByReturnNumber: jest.fn(),
      completeIfApproved: jest.fn().mockResolvedValue(1),
    } as any;
    mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    mockFinance = { createPurchaseReturnJournal: jest.fn().mockResolvedValue(undefined) };
    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) } as any;
    mockCosting = {
      // G9-F4: default FIFO basis covers the fixture item exactly
      // (5 × 20 = 100), so legacy journal expectations stay unchanged.
      consumeFifoLayers: jest
        .fn()
        .mockResolvedValue({
          totalCost: new Decimal('100'),
          layers: [],
          fallbackCost: new Decimal('0'),
        }),
    };
    mockIdempotency = {
      reserve: jest.fn().mockResolvedValue({ type: 'created', requestHash: 'hash' }),
      complete: jest.fn().mockResolvedValue(undefined),
      hashRequest: jest.fn().mockReturnValue('hash'),
    };
    mockPrisma = { $transaction: mockTransaction };

    const mod = await Test.createTestingModule({
      providers: [
        { provide: CompaniesService, useValue: { getBaseCurrency: jest.fn().mockResolvedValue('KZT') } },
        PurchaseReturnService,
        { provide: PurchaseReturnRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EVENT_BUS, useValue: mockEventBus },
        { provide: PurchasingFinanceService, useValue: mockFinance },
        { provide: CostingService, useValue: mockCosting },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: IdempotencyService, useValue: mockIdempotency },
      ],
    }).compile();
    service = mod.get(PurchaseReturnService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    const validDto: CreatePurchaseReturnDto = {
      supplierId,
      warehouseId,
      items: [{ productId, quantity: 5, unitCost: 20.0 }],
    };

    // G9-E2: tenant-scoped supplier + batched product lookups are part of
    // every successful create; fixtures provide tenant-resolved rows.
    const tenantTx = (over: Record<string, unknown> = {}) => ({
      warehouse: {
        findFirst: jest.fn().mockResolvedValue({
          id: warehouseId,
          companyId,
          deletedAt: null,
          isActive: true,
        }),
      },
      supplier: { findFirst: jest.fn().mockResolvedValue({ id: supplierId }) },
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: productId }]),
      },
      ...over,
    } as any);

    it('should create a purchase return', async () => {
      const mockTx = tenantTx();
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.create.mockResolvedValue(baseReturn as any);

      const result = await service.create(validDto, userId, companyId);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'pr-1');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PurchaseReturnStatus.DRAFT,
          company: { connect: { id: companyId } },
          supplier: { connect: { id: supplierId } },
          warehouse: { connect: { id: warehouseId } },
        }),
        mockTx,
      );
    });

    // G11-A: creation audit trail, inside the same transaction as the document.
    it('writes a PurchaseReturn CREATE audit record inside the transaction', async () => {
      const mockTx = tenantTx();
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.create.mockResolvedValue(baseReturn as any);

      await service.create(validDto, userId, companyId);

      expect(mockAuditLog.log).toHaveBeenCalledTimes(1);
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          userId,
          entityType: 'PurchaseReturn',
          entityId: 'pr-1',
          action: 'CREATE',
          before: null,
          after: expect.objectContaining({
            status: PurchaseReturnStatus.DRAFT,
            supplierId,
            warehouseId,
            total: '100',
          }),
        }),
        mockTx,
      );
    });

    it('should throw NotFoundException when warehouse does not exist', async () => {
      const mockTx = {
        warehouse: { findFirst: jest.fn().mockResolvedValue(null) },
        supplier: { findFirst: jest.fn() },
        product: { findMany: jest.fn() },
      } as any;
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      await expect(service.create(validDto, userId, companyId)).rejects.toThrow(
        NotFoundException,
      );
    });

    // ── G9-E2: tenant validation hardening ──────────────────────────────

    // Test 1 — own supplier (regression protection): the lookup must run
    // tenant-scoped and a tenant-resolved supplier lets CREATE proceed.
    it('resolves the own-company supplier with a tenant-scoped lookup and creates the return', async () => {
      const mockTx = tenantTx();
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.create.mockResolvedValue(baseReturn as any);

      const result = await service.create(validDto, userId, companyId);

      expect(result).toBeDefined();
      expect(mockTx.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: supplierId, companyId, deletedAt: null },
        select: { id: true },
      });
      expect(mockRepo.create).toHaveBeenCalled();
    });

    // Test 2 — nonexistent supplier → 404, no creation (P2025/500 eliminated)
    it('throws NotFoundException for a nonexistent supplier and does NOT create', async () => {
      const mockTx = tenantTx({
        supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      });
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.create(validDto, userId, companyId),
      ).rejects.toThrow(NotFoundException);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    // Test 3 — foreign-tenant supplier: the WHERE carries companyId, so a
    // supplier of another company is invisible → 404 (no 403, no oracle).
    it('throws NotFoundException for a foreign-tenant supplier (companyId in lookup) and does NOT create', async () => {
      const mockTx = tenantTx({
        supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      });
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.create(validDto, userId, companyId),
      ).rejects.toThrow(NotFoundException);
      // Tenant boundary is enforced in the query shape itself
      expect(mockTx.supplier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId, deletedAt: null }),
        }),
      );
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    // Test 4 — soft-deleted supplier: deletedAt: null excludes the row → 404
    it('throws NotFoundException for a soft-deleted supplier (deletedAt filter) and does NOT create', async () => {
      const mockTx = tenantTx({
        supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      });
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.create(validDto, userId, companyId),
      ).rejects.toThrow(NotFoundException);
      expect(mockTx.supplier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deletedAt: null }),
        }),
      );
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    // Test 5 — foreign-tenant product: batched lookup is companyId-scoped;
    // a product of another company is invisible → 404, no creation.
    it('throws NotFoundException for a foreign-tenant product (companyId in batched lookup) and does NOT create', async () => {
      const mockTx = tenantTx({
        product: {
          findMany: jest.fn().mockResolvedValue([]),
        } as any,
      });
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.create(validDto, userId, companyId),
      ).rejects.toThrow(NotFoundException);
      expect(mockTx.product.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [productId] },
          companyId,
          deletedAt: null,
        },
        select: { id: true },
      });
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    // Test 6 — nonexistent product: absent from the batched result → 404
    it('throws NotFoundException for a nonexistent product and does NOT create', async () => {
      const mockTx = tenantTx({
        product: { findMany: jest.fn().mockResolvedValue([]) },
      });
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));

      await expect(
        service.create(validDto, userId, companyId),
      ).rejects.toThrow(/Product with id/);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    // N+1 safety: N item productIds (with duplicates) → exactly ONE findMany
    it('validates all item products with a single batched lookup (N product IDs → 1 findMany)', async () => {
      const multiItemDto: CreatePurchaseReturnDto = {
        supplierId,
        warehouseId,
        items: [
          { productId, quantity: 1, unitCost: 1 },
          { productId: 'prod-2', quantity: 2, unitCost: 2 },
          { productId, quantity: 3, unitCost: 3 }, // duplicate → deduped
        ],
      };
      const mockTx = tenantTx({
        product: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: productId }, { id: 'prod-2' }]),
        },
      });
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.create.mockResolvedValue(baseReturn as any);

      await service.create(multiItemDto, userId, companyId);

      expect(mockTx.product.findMany).toHaveBeenCalledTimes(1);
      expect(mockTx.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: [productId, 'prod-2'] },
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockRepo.findAll.mockResolvedValue({ items: [baseReturn], total: 1 });
      const r = await service.findAll({ page: 1, limit: 20 }, companyId);
      expect(r.items).toHaveLength(1);
      expect(r.total).toBe(1);
    });
    it('should throw on invalid pagination', async () => {
      await expect(
        service.findAll({ page: 0, limit: 20 }, companyId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return return when found', async () => {
      mockRepo.findById.mockResolvedValue(baseReturn as any);
      expect(await service.findById('pr-1', companyId)).toHaveProperty(
        'id',
        'pr-1',
      );
    });
    it('should throw NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findById('x', companyId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const upd: UpdatePurchaseReturnDto = { notes: 'U' };

    it('should update a DRAFT return', async () => {
      const mockTx = {
        purchaseReturnItem: { deleteMany: jest.fn(), createMany: jest.fn() },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(baseReturn as any);
      mockRepo.update.mockResolvedValue({ ...baseReturn, notes: 'U' } as any);
      expect(await service.update('pr-1', upd, companyId)).toBeDefined();
    });

    it('should throw when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.update('x', upd, companyId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw when not DRAFT', async () => {
      mockRepo.findById.mockResolvedValue({
        ...baseReturn,
        status: PurchaseReturnStatus.APPROVED,
      } as any);
      await expect(service.update('pr-1', upd, companyId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('transitionStatus', () => {
    it('should transition DRAFT to APPROVED and set approvedBy', async () => {
      const mockTx = {
        purchaseReturnItem: { findMany: jest.fn().mockResolvedValue([]) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(baseReturn as any);
      mockRepo.update.mockResolvedValue({
        ...baseReturn,
        status: PurchaseReturnStatus.APPROVED,
      } as any);

      const result = await service.transitionStatus(
        'pr-1',
        PurchaseReturnStatus.APPROVED,
        userId,
        companyId,
      );
      expect(result).toBeDefined();
      expect(mockRepo.update).toHaveBeenCalledWith(
        'pr-1',
        expect.objectContaining({
          status: PurchaseReturnStatus.APPROVED,
          approvedBy: userId,
        }),
        companyId,
        mockTx,
      );
    });

    it('should transition APPROVED to COMPLETED and decrease stock', async () => {
      const approved = { ...baseReturn, status: PurchaseReturnStatus.APPROVED };
      const mockTx = {
        purchaseReturnItem: {
          findMany: jest.fn().mockResolvedValue(baseReturn.items),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue({
            id: 's-1',
            quantity: 50,
            reservedQuantity: 0,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        stockMovement: { create: jest.fn() },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(approved as any);
      mockRepo.update.mockResolvedValue({
        ...approved,
        status: PurchaseReturnStatus.COMPLETED,
      } as any);

      const result = await service.transitionStatus(
        'pr-1',
        PurchaseReturnStatus.COMPLETED,
        userId,
        companyId,
      );
      expect(result).toBeDefined();
      expect(mockTx.stock.findFirst).toHaveBeenCalled();
      expect(mockTx.stock.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          id: 's-1',
          companyId,
          quantity: { gte: 5 },
        }),
        data: expect.objectContaining({
          quantity: { decrement: 5 },
          availableQuantity: { decrement: 5 },
          rowVersion: { increment: 1 },
        }),
      });
      expect(mockTx.stockMovement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: StockMovementType.RETURN,
          quantity: -5,
          beforeQuantity: 50,
          afterQuantity: 45,
        }),
      });
      const movement = mockTx.stockMovement.create.mock.calls[0][0].data;
      expect(movement.beforeQuantity + movement.quantity).toBe(
        movement.afterQuantity,
      );
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should reject COMPLETED when stock is insufficient (strict stock)', async () => {
      const approved = { ...baseReturn, status: PurchaseReturnStatus.APPROVED };
      const mockTx = {
        purchaseReturnItem: {
          findMany: jest.fn().mockResolvedValue(baseReturn.items),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue({
            id: 's-1',
            quantity: 3,
            reservedQuantity: 0,
          }),
          updateMany: jest.fn(),
        },
        stockMovement: { create: jest.fn() },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(approved as any);

      await expect(
        service.transitionStatus(
          'pr-1',
          PurchaseReturnStatus.COMPLETED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(new BadRequestException('Insufficient stock'));
      // No partial stock update, no movement, no event.
      expect(mockTx.stock.updateMany).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should reject COMPLETED when a concurrent race leaves insufficient stock', async () => {
      const approved = { ...baseReturn, status: PurchaseReturnStatus.APPROVED };
      const mockTx = {
        purchaseReturnItem: {
          findMany: jest.fn().mockResolvedValue(baseReturn.items),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue({
            id: 's-1',
            quantity: 10,
            reservedQuantity: 0,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
        stockMovement: { create: jest.fn() },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(approved as any);

      await expect(
        service.transitionStatus(
          'pr-1',
          PurchaseReturnStatus.COMPLETED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(new BadRequestException('Insufficient stock'));
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should transition DRAFT to CANCELLED and set cancelledBy', async () => {
      const mockTx = {
        purchaseReturnItem: { findMany: jest.fn().mockResolvedValue([]) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(baseReturn as any);
      mockRepo.update.mockResolvedValue({
        ...baseReturn,
        status: PurchaseReturnStatus.CANCELLED,
        cancelledBy: userId,
      } as any);

      const result = await service.transitionStatus(
        'pr-1',
        PurchaseReturnStatus.CANCELLED,
        userId,
        companyId,
      );
      expect(result).toBeDefined();
      expect(mockRepo.update).toHaveBeenCalledWith(
        'pr-1',
        expect.objectContaining({
          status: PurchaseReturnStatus.CANCELLED,
          cancelledBy: userId,
        }),
        companyId,
        mockTx,
      );
    });

    it('should throw BadRequestException for invalid transition (DRAFT→COMPLETED)', async () => {
      mockRepo.findById.mockResolvedValue(baseReturn as any);
      await expect(
        service.transitionStatus(
          'pr-1',
          PurchaseReturnStatus.COMPLETED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(
        service.transitionStatus(
          'x',
          PurchaseReturnStatus.APPROVED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── CURRENCY ────────────────────────────────
  describe('currency', () => {
    const validDto: CreatePurchaseReturnDto = {
      supplierId,
      warehouseId,
      items: [{ productId, quantity: 5, unitCost: 20.0 }],
    };

    it('should default to KZT when currency not provided', async () => {
      const mockTx = {
        warehouse: {
          findFirst: jest.fn().mockResolvedValue({
            id: warehouseId,
            companyId,
            deletedAt: null,
            isActive: true,
          }),
        },
        supplier: { findFirst: jest.fn().mockResolvedValue({ id: supplierId }) },
        product: { findMany: jest.fn().mockResolvedValue([{ id: productId }]) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.create.mockResolvedValue(baseReturn as any);

      await service.create(validDto, userId, companyId);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'KZT' }),
        mockTx,
      );
    });

    it('should reject USD when company currency is KZT', async () => {
      const mockTx = {
        warehouse: {
          findFirst: jest.fn().mockResolvedValue({
            id: warehouseId,
            companyId,
            deletedAt: null,
            isActive: true,
          }),
        },
        supplier: { findFirst: jest.fn().mockResolvedValue({ id: supplierId }) },
        product: { findMany: jest.fn() },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      await expect(
        service.create(
          { ...validDto, currency: 'USD' as any },
          userId,
          companyId,
        ),
      ).rejects.toThrow('does not match company currency');
    });

    it('should reject currency change to different currency', async () => {
      const mockTx = {
        purchaseReturnItem: { deleteMany: jest.fn(), createMany: jest.fn() },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(baseReturn as any);

      await expect(
        service.update(
          'pr-1',
          { currency: 'USD' as any },
          companyId,
        ),
      ).rejects.toThrow('does not match company currency');
    });

    it('should reject currency change when not DRAFT', async () => {
      const approvedReturn = { ...baseReturn, status: PurchaseReturnStatus.APPROVED };
      const mockTx = {
        purchaseReturnItem: { deleteMany: jest.fn(), createMany: jest.fn() },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(approvedReturn as any);

      await expect(
        service.update(
          'pr-1',
          { currency: 'USD' as any },
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── G9-E1: atomic/idempotent APPROVED → COMPLETED (CAS + GL journal) ──
  describe('transitionStatus — G9-E1 CAS & GL journal', () => {
    const approved = { ...baseReturn, status: PurchaseReturnStatus.APPROVED };

    function baseCompleteTx() {
      const mockTx = {
        purchaseReturnItem: {
          findMany: jest.fn().mockResolvedValue(baseReturn.items),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue({
            id: 's-1',
            quantity: 50,
            reservedQuantity: 0,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        stockMovement: { create: jest.fn() },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      return mockTx;
    }

    // A. Normal completion: CAS win → stock + movement + journal + event
    it('on CAS win: decrements stock, creates movement, posts GL journal, publishes event, does NOT double-update status', async () => {
      const mockTx = baseCompleteTx();
      mockRepo.findById.mockResolvedValue(approved as any);
      mockRepo.completeIfApproved.mockResolvedValue(1);
      mockRepo.findById
        .mockResolvedValueOnce(approved as any)
        .mockResolvedValueOnce({
          ...approved,
          status: PurchaseReturnStatus.COMPLETED,
        } as any);

      const result = await service.transitionStatus(
        'pr-1',
        PurchaseReturnStatus.COMPLETED,
        userId,
        companyId,
      );

      expect(result.status).toBe(PurchaseReturnStatus.COMPLETED);
      expect(mockRepo.completeIfApproved).toHaveBeenCalledWith(
        'pr-1',
        companyId,
        mockTx,
      );
      expect(mockTx.stock.updateMany).toHaveBeenCalled();
      expect(mockTx.stockMovement.create).toHaveBeenCalled();
      expect(mockFinance.createPurchaseReturnJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          returnNumber: 'PR-TEST-0001',
          items: [
            expect.objectContaining({ productId, quantity: 5, unitCost: '20' }),
          ],
          createdBy: userId,
        }),
        mockTx,
      );
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      // Status was written by the CAS — the generic update must not run again
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    // B. Transaction rollback: journal failure → BadRequest propagates;
    //    status write happened via CAS inside the same tx, so the real DB
    //    rolls back status + stock + movement together (verified by tx sharing).
    it('rolls back the whole transition when the GL journal fails (single shared transaction)', async () => {
      const mockTx = baseCompleteTx();
      mockRepo.findById.mockResolvedValue(approved as any);
      mockFinance.createPurchaseReturnJournal.mockRejectedValue(
        new Error('GL engine down'),
      );

      await expect(
        service.transitionStatus(
          'pr-1',
          PurchaseReturnStatus.COMPLETED,
          userId,
          companyId,
        ),
      ).rejects.toThrow('GL engine down');

      // Stock was mutated inside the SAME tx that the journal failed in —
      // the real $transaction would roll everything back together.
      expect(mockTx.stock.updateMany).toHaveBeenCalled();
      expect(mockFinance.createPurchaseReturnJournal).toHaveBeenCalledWith(
        expect.anything(),
        mockTx,
      );
      // Event must NOT be published when the journal failed
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    // G11-A: status-transition audit trail (action = new status).
    it('writes a PurchaseReturn COMPLETED audit record with the status pair inside the transaction', async () => {
      const mockTx = baseCompleteTx();
      mockRepo.findById
        .mockResolvedValueOnce(approved as any)
        .mockResolvedValueOnce({
          ...approved,
          status: PurchaseReturnStatus.COMPLETED,
        } as any);
      mockRepo.completeIfApproved.mockResolvedValue(1);

      await service.transitionStatus(
        'pr-1',
        PurchaseReturnStatus.COMPLETED,
        userId,
        companyId,
      );

      expect(mockAuditLog.log).toHaveBeenCalledTimes(1);
      expect(mockAuditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          userId,
          entityType: 'PurchaseReturn',
          entityId: 'pr-1',
          action: 'COMPLETED',
          before: { status: PurchaseReturnStatus.APPROVED },
          after: { status: PurchaseReturnStatus.COMPLETED },
        }),
        mockTx,
      );
    });

    // G11-A: a failed transition must not leave an audit record behind — the
    // audit write shares the transaction that carries the failure back out.
    it('writes no audit record when the GL journal fails (rollback)', async () => {
      baseCompleteTx();
      mockRepo.findById.mockResolvedValue(approved as any);
      mockRepo.completeIfApproved.mockResolvedValue(1);
      mockFinance.createPurchaseReturnJournal.mockRejectedValue(
        new BadRequestException(
          'Chart of Accounts not configured for company comp-1 — missing mandatory account(s): 1300 (Inventory)',
        ),
      );

      await expect(
        service.transitionStatus(
          'pr-1',
          PurchaseReturnStatus.COMPLETED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockAuditLog.log).not.toHaveBeenCalled();
    });

    // C. Duplicate completion: CAS loses → no stock/movement/journal/event
    it('rejects a duplicate COMPLETED with no stock mutation, no movement, no journal, no event', async () => {
      const mockTx = baseCompleteTx();
      mockRepo.findById.mockResolvedValue(approved as any);
      mockRepo.completeIfApproved.mockResolvedValue(0);

      await expect(
        service.transitionStatus(
          'pr-1',
          PurchaseReturnStatus.COMPLETED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.stock.updateMany).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
      expect(mockFinance.createPurchaseReturnJournal).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    // D. Wrong concurrent state: CAS sees the row no longer APPROVED
    it('stops before any side effects when CAS finds status no longer APPROVED', async () => {
      const mockTx = baseCompleteTx();
      mockRepo.findById.mockResolvedValue(approved as any);
      mockRepo.completeIfApproved.mockResolvedValue(0);

      await expect(
        service.transitionStatus(
          'pr-1',
          PurchaseReturnStatus.COMPLETED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(/no longer APPROVED|Allowed:/);

      expect(mockTx.stock.findFirst).not.toHaveBeenCalled();
      expect(mockTx.stock.updateMany).not.toHaveBeenCalled();
      expect(mockTx.stockMovement.create).not.toHaveBeenCalled();
      expect(mockFinance.createPurchaseReturnJournal).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    // E/F. Existing guards & lifecycle preserved
    it('keeps the strict-stock guard ordering after the CAS win', async () => {
      const mockTx = baseCompleteTx();
      mockTx.stock.findFirst.mockResolvedValue({
        id: 's-1',
        quantity: 3,
        reservedQuantity: 1,
      });
      mockRepo.findById.mockResolvedValue(approved as any);

      await expect(
        service.transitionStatus(
          'pr-1',
          PurchaseReturnStatus.COMPLETED,
          userId,
          companyId,
        ),
      ).rejects.toThrow('Insufficient stock');

      // CAS ran (won) but no journal/event after the stock guard failed
      expect(mockRepo.completeIfApproved).toHaveBeenCalled();
      expect(mockTx.stock.updateMany).not.toHaveBeenCalled();
      expect(mockFinance.createPurchaseReturnJournal).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('does not invoke CAS or the GL journal for non-COMPLETED transitions', async () => {
      const mockTx = {
        purchaseReturnItem: { findMany: jest.fn().mockResolvedValue([]) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(baseReturn as any);
      mockRepo.update.mockResolvedValue({
        ...baseReturn,
        status: PurchaseReturnStatus.APPROVED,
      } as any);

      await service.transitionStatus(
        'pr-1',
        PurchaseReturnStatus.APPROVED,
        userId,
        companyId,
      );

      expect(mockRepo.completeIfApproved).not.toHaveBeenCalled();
      expect(mockFinance.createPurchaseReturnJournal).not.toHaveBeenCalled();
      expect(mockRepo.update).toHaveBeenCalled();
    });
  });

  // ── G9-F4: FIFO cost integrity on COMPLETE ──────────────────────────────
  describe('transitionStatus — G9-F4 FIFO cost consumption', () => {
    const approved = { ...baseReturn, status: PurchaseReturnStatus.APPROVED };

    function fifoCompleteTx() {
      const mockTx = {
        purchaseReturnItem: {
          findMany: jest.fn().mockResolvedValue(baseReturn.items),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue({
            id: 's-1',
            quantity: 50,
            reservedQuantity: 0,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        stockMovement: { create: jest.fn() },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      return mockTx;
    }

    it('consumes FIFO for each item with the return reference inside the same transaction', async () => {
      const mockTx = fifoCompleteTx();
      mockRepo.findById.mockResolvedValue(approved as any);
      mockRepo.findById
        .mockResolvedValueOnce(approved as any)
        .mockResolvedValueOnce({
          ...approved,
          status: PurchaseReturnStatus.COMPLETED,
        } as any);

      await service.transitionStatus(
        'pr-1',
        PurchaseReturnStatus.COMPLETED,
        userId,
        companyId,
      );

      expect(mockCosting.consumeFifoLayers).toHaveBeenCalledTimes(1);
      expect(mockCosting.consumeFifoLayers).toHaveBeenCalledWith(
        productId,
        companyId,
        5,
        'PURCHASE_RETURN',
        'pr-1',
        mockTx,
      );
    });

    it('passes the FIFO totalCost to the journal as the Inventory relief', async () => {
      const mockTx = fifoCompleteTx();
      mockCosting.consumeFifoLayers.mockResolvedValue({
        totalCost: new Decimal('85'),
        layers: [],
        fallbackCost: new Decimal('0'),
      });
      mockRepo.findById.mockResolvedValue(approved as any);

      await service.transitionStatus(
        'pr-1',
        PurchaseReturnStatus.COMPLETED,
        userId,
        companyId,
      );

      expect(mockFinance.createPurchaseReturnJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [expect.objectContaining({ productId, quantity: 5, unitCost: '20' })],
          fifoCostItems: [
            { productId, quantity: 5, totalCost: '85' },
          ],
        }),
        mockTx,
      );
    });

    it('consumes FIFO for every item of a multi-item return', async () => {
      const twoItems = {
        ...approved,
        items: [
          { ...baseReturn.items[0], id: 'pri-1', productId: 'prod-1' },
          {
            ...baseReturn.items[0],
            id: 'pri-2',
            productId: 'prod-2',
            quantity: 3,
            unitCost: new Prisma.Decimal('10'),
          },
        ],
      };
      mockRepo.findById.mockResolvedValue(twoItems as any);
      const mockTx = fifoCompleteTx();
      mockTx.purchaseReturnItem.findMany.mockResolvedValue(twoItems.items);

      await service.transitionStatus(
        'pr-1',
        PurchaseReturnStatus.COMPLETED,
        userId,
        companyId,
      );

      expect(mockCosting.consumeFifoLayers).toHaveBeenCalledTimes(2);
      expect(mockCosting.consumeFifoLayers).toHaveBeenCalledWith(
        'prod-1', companyId, 5, 'PURCHASE_RETURN', 'pr-1', mockTx,
      );
      expect(mockCosting.consumeFifoLayers).toHaveBeenCalledWith(
        'prod-2', companyId, 3, 'PURCHASE_RETURN', 'pr-1', mockTx,
      );
      expect(mockFinance.createPurchaseReturnJournal).toHaveBeenCalledWith(
        expect.objectContaining({
          fifoCostItems: [
            expect.objectContaining({ productId: 'prod-1', totalCost: '100' }),
            expect.objectContaining({ productId: 'prod-2', totalCost: '100' }),
          ],
        }),
        mockTx,
      );
    });

    it('rolls back the whole return when FIFO consumption fails (no basis)', async () => {
      const mockTx = fifoCompleteTx();
      mockCosting.consumeFifoLayers.mockRejectedValue(
        new Error('No FIFO basis available'),
      );
      mockRepo.findById.mockResolvedValue(approved as any);

      await expect(
        service.transitionStatus(
          'pr-1',
          PurchaseReturnStatus.COMPLETED,
          userId,
          companyId,
        ),
      ).rejects.toThrow('No FIFO basis available');

      // FIFO ran after the stock mutation in the same tx — a real $transaction
      // rolls stock + movement + status back together.
      expect(mockTx.stock.updateMany).toHaveBeenCalled();
      expect(mockFinance.createPurchaseReturnJournal).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('performs no FIFO consumption for non-COMPLETED transitions', async () => {
      const mockTx = {
        purchaseReturnItem: { findMany: jest.fn().mockResolvedValue([]) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(baseReturn as any);
      mockRepo.update.mockResolvedValue({
        ...baseReturn,
        status: PurchaseReturnStatus.APPROVED,
      } as any);

      await service.transitionStatus(
        'pr-1',
        PurchaseReturnStatus.APPROVED,
        userId,
        companyId,
      );

      expect(mockCosting.consumeFifoLayers).not.toHaveBeenCalled();
    });
  });

  // ── G11-A: real account gate — COMPLETE fails fast on missing CoA ────────
  // Uses the REAL PurchasingFinanceService (only the GL engine is mocked) to
  // prove the D2 per-operation contract end-to-end through the return service.
  describe('transitionStatus — G11-A real PurchasingFinanceService account gate', () => {
    const approved = { ...baseReturn, status: PurchaseReturnStatus.APPROVED };

    const ACCOUNTS: Record<string, { id: string; code: string }> = {
      '1300': { id: 'acc-1300', code: '1300' },
      '2100': { id: 'acc-2100', code: '2100' },
      '2110': { id: 'acc-2110', code: '2110' },
      '5200': { id: 'acc-5200', code: '5200' },
    };

    let gateService: PurchaseReturnService;
    let gateGlPost: jest.Mock;
    let chartOfAccountFindMany: jest.Mock;
    let gateEventBus: { publish: jest.Mock };
    let gateTx: Record<string, any>;

    beforeEach(async () => {
      gateGlPost = jest.fn().mockResolvedValue(undefined);
      gateEventBus = { publish: jest.fn().mockResolvedValue(undefined) };
      chartOfAccountFindMany = jest
        .fn()
        .mockImplementation(({ where }: any) => {
          const codes: string[] = where.code.in;
          return Promise.resolve(
            codes.map((code) => ACCOUNTS[code]).filter(Boolean),
          );
        });

      const mod = await Test.createTestingModule({
        providers: [
          {
            provide: CompaniesService,
            useValue: { getBaseCurrency: jest.fn().mockResolvedValue('KZT') },
          },
          // REAL finance service — only the GL engine boundary is mocked.
          { provide: GlEngineService, useValue: { post: gateGlPost } },
          PurchasingFinanceService,
          PurchaseReturnService,
          { provide: PurchaseReturnRepository, useValue: mockRepo },
          { provide: PrismaService, useValue: mockPrisma },
          { provide: EVENT_BUS, useValue: gateEventBus },
          { provide: CostingService, useValue: mockCosting },
          {
            provide: AuditLogService,
            useValue: { log: jest.fn().mockResolvedValue(undefined) },
          },
          { provide: IdempotencyService, useValue: mockIdempotency },
        ],
      }).compile();
      gateService = mod.get(PurchaseReturnService);
    });

    function gateCompleteTx(withVariance = false) {
      gateTx = {
        purchaseReturnItem: {
          findMany: jest.fn().mockResolvedValue(baseReturn.items),
        },
        stock: {
          findFirst: jest.fn().mockResolvedValue({
            id: 's-1',
            quantity: 50,
            reservedQuantity: 0,
          }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        stockMovement: { create: jest.fn() },
        chartOfAccount: { findMany: chartOfAccountFindMany },
        financialPeriod: {
          findFirst: jest.fn().mockResolvedValue({ id: 'fp-1' }),
        },
      };
      mockTransaction.mockImplementation((cb: any) => cb(gateTx));
      // Default FIFO basis matches the fixture exactly (variance = 0);
      // pass withVariance to produce a declared (100) ≠ FIFO (85) basis.
      mockCosting.consumeFifoLayers.mockResolvedValue({
        totalCost: new Decimal(withVariance ? '85' : '100'),
        layers: [],
        fallbackCost: new Decimal('0'),
      });
      mockRepo.findById.mockResolvedValue(approved as any);
      mockRepo.completeIfApproved.mockResolvedValue(1);
      return gateTx;
    }

    function dropAccount(code: string) {
      chartOfAccountFindMany.mockImplementation(({ where }: any) =>
        Promise.resolve(
          (where.code.in as string[])
            .filter((c) => c !== code)
            .map((c) => ACCOUNTS[c])
            .filter(Boolean),
        ),
      );
    }

    it('fails COMPLETE with BadRequestException when 1300 (Inventory) is missing', async () => {
      gateCompleteTx();
      dropAccount('1300');

      await expect(
        gateService.transitionStatus(
          'pr-1',
          PurchaseReturnStatus.COMPLETED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(
        `Chart of Accounts not configured for company ${companyId} — missing mandatory account(s): 1300 (Inventory)`,
      );

      // The journal never posted and the completion never published.
      expect(gateGlPost).not.toHaveBeenCalled();
      expect(gateEventBus.publish).not.toHaveBeenCalled();
    });

    it('fails COMPLETE with BadRequestException when 2100 (AP) is missing', async () => {
      gateCompleteTx();
      dropAccount('2100');

      await expect(
        gateService.transitionStatus(
          'pr-1',
          PurchaseReturnStatus.COMPLETED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(
        `Chart of Accounts not configured for company ${companyId} — missing mandatory account(s): 2100 (Accounts Payable)`,
      );
      expect(gateGlPost).not.toHaveBeenCalled();
    });

    it('succeeds with a zero-variance return even when 5200 is missing', async () => {
      gateCompleteTx(false);
      dropAccount('5200');

      await gateService.transitionStatus(
        'pr-1',
        PurchaseReturnStatus.COMPLETED,
        userId,
        companyId,
      );

      expect(gateGlPost).toHaveBeenCalledTimes(1);
      const lines = gateGlPost.mock.calls[0][0].lines;
      expect(lines).toHaveLength(2); // Dr AP, Cr Inventory — no 5200 line
      expect(lines.map((l: any) => l.accountId).sort()).toEqual([
        'acc-1300',
        'acc-2100',
      ]);
    });

    it('fails COMPLETE when 5200 is missing AND the return has a non-zero variance', async () => {
      gateCompleteTx(true);
      dropAccount('5200');

      await expect(
        gateService.transitionStatus(
          'pr-1',
          PurchaseReturnStatus.COMPLETED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(
        `Chart of Accounts not configured for company ${companyId} — missing mandatory account(s): 5200 (Purchase Discounts and Write-Offs)`,
      );
      expect(gateGlPost).not.toHaveBeenCalled();
      expect(gateEventBus.publish).not.toHaveBeenCalled();
    });

    it('keeps the CoA lookup tenant-scoped and posts the balanced zero-variance journal', async () => {
      gateCompleteTx(false);

      await gateService.transitionStatus(
        'pr-1',
        PurchaseReturnStatus.COMPLETED,
        userId,
        companyId,
      );

      // Tenant isolation: the account resolution carries companyId.
      expect(chartOfAccountFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId,
            isActive: true,
            deletedAt: null,
          }),
        }),
      );
      // Balanced zero-variance journal: Dr AP 100 / Cr Inventory 100.
      expect(gateGlPost).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceType: 'PURCHASE_RETURN',
          referenceId: 'PR-TEST-0001',
          lines: [
            expect.objectContaining({
              accountId: 'acc-2100',
              debit: '100',
              credit: '0',
            }),
            expect.objectContaining({
              accountId: 'acc-1300',
              debit: '0',
              credit: '100',
            }),
          ],
        }),
        gateTx,
      );
    });
  });

  describe('softDelete', () => {
    it('should soft delete a DRAFT return', async () => {
      mockRepo.findById.mockResolvedValue(baseReturn as any);
      mockRepo.softDelete.mockResolvedValue({} as any);
      await service.softDelete('pr-1', companyId);
      expect(mockRepo.softDelete).toHaveBeenCalledWith('pr-1', companyId);
    });
    it('should throw for non-DRAFT', async () => {
      mockRepo.findById.mockResolvedValue({
        ...baseReturn,
        status: PurchaseReturnStatus.APPROVED,
      } as any);
      await expect(service.softDelete('pr-1', companyId)).rejects.toThrow(
        BadRequestException,
      );
    });
    it('should throw when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.softDelete('x', companyId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
