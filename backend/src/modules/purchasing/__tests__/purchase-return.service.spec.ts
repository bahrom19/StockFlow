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
    mockPrisma = { $transaction: mockTransaction };

    const mod = await Test.createTestingModule({
      providers: [
        { provide: CompaniesService, useValue: { getBaseCurrency: jest.fn().mockResolvedValue('KZT') } },
        PurchaseReturnService,
        { provide: PurchaseReturnRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EVENT_BUS, useValue: mockEventBus },
        { provide: PurchasingFinanceService, useValue: mockFinance },
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

    it('should create a purchase return', async () => {
      const mockTx = {
        warehouse: {
          findFirst: jest.fn().mockResolvedValue({
            id: warehouseId,
            companyId,
            deletedAt: null,
            isActive: true,
          }),
        },
      };
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

    it('should throw NotFoundException when warehouse does not exist', async () => {
      const mockTx = {
        warehouse: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      await expect(service.create(validDto, userId, companyId)).rejects.toThrow(
        NotFoundException,
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
