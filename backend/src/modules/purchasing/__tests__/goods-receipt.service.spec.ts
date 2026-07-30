import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, GoodsReceiptStatus, PurchaseOrderStatus } from '@prisma/client';
import { GoodsReceiptService } from '../services/goods-receipt.service';
import { GoodsReceiptRepository } from '../repositories/goods-receipt.repository';
import { PurchaseOrderRepository } from '../repositories/purchase-order.repository';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PurchasingFinanceService } from '../services/purchasing-finance.service';
import { EVENT_BUS } from '../../../common/events';
import { CreateGoodsReceiptDto } from '../dto/create-goods-receipt.dto';

const companyId = 'comp-1';
const userId = 'user-1';
const warehouseId = 'wh-1';
const productId = 'prod-1';
const poId = 'po-1';
const poItemId = 'po-item-1';

const basePo = {
  id: poId,
  companyId, supplierId: 's-1', orderNumber: 'PO-001',
  status: PurchaseOrderStatus.ORDERED,
  subtotal: new Prisma.Decimal('100'), discountAmount: new Prisma.Decimal('0'),
  taxAmount: new Prisma.Decimal('12'), grandTotal: new Prisma.Decimal('112'),
  paidAmount: new Prisma.Decimal('0'), rowVersion: 0,
  createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  items: [{ id: poItemId, purchaseOrderId: poId, productId, quantity: 10,
    unitCost: new Prisma.Decimal('10'), receivedQuantity: 0,
    subtotal: new Prisma.Decimal('100'), total: new Prisma.Decimal('112') }],
  supplier: { id: 's-1', companyName: 'TS' },
};

const baseReceipt = {
  id: 'gr-1', companyId, purchaseOrderId: poId, warehouseId,
  receiptNumber: 'GR-001', receiptDate: new Date(),
  status: GoodsReceiptStatus.COMPLETED, notes: null, receivedBy: userId,
  rowVersion: 0, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  items: [], purchaseOrder: { orderNumber: 'PO-001' },
  warehouse: { id: warehouseId, name: 'Main' },
};

describe('GoodsReceiptService', () => {
  let service: GoodsReceiptService;
  let mockGrRepo: jest.Mocked<GoodsReceiptRepository>;
  let mockPoRepo: jest.Mocked<PurchaseOrderRepository>;
  let mockPoService: jest.Mocked<PurchaseOrderService>;
  let mockPrisma: Record<string, jest.Mock>;
  let mockFinanceService: jest.Mocked<PurchasingFinanceService>;
  let mockEventBus: { publish: jest.Mock };
  const mockTransaction = jest.fn();

  beforeEach(async () => {
    mockGrRepo = { create: jest.fn(), findById: jest.fn(), findAll: jest.fn(), update: jest.fn(), softDelete: jest.fn(), updateStatus: jest.fn(), findByReceiptNumber: jest.fn() } as any;
    mockPoRepo = { findById: jest.fn(), findByOrderNumber: jest.fn(), findAll: jest.fn() } as any;
    mockPoService = { updateStatusAfterReceipt: jest.fn().mockResolvedValue(undefined) } as any;
    mockFinanceService = { createGoodsReceiptJournal: jest.fn().mockResolvedValue(undefined) } as any;
    mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    mockPrisma = { $transaction: mockTransaction };

    const mod = await Test.createTestingModule({
      providers: [
        GoodsReceiptService,
        { provide: GoodsReceiptRepository, useValue: mockGrRepo },
        { provide: PurchaseOrderRepository, useValue: mockPoRepo },
        { provide: PurchaseOrderService, useValue: mockPoService },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PurchasingFinanceService, useValue: mockFinanceService },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();
    service = mod.get(GoodsReceiptService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    const validDto: CreateGoodsReceiptDto = {
      purchaseOrderId: poId, warehouseId,
      items: [{ purchaseOrderItemId: poItemId, productId, quantity: 5, unitCost: 10.00 }],
    };

    it('should create goods receipt and update stock', async () => {
      const mockTx = {
        warehouse: { findFirst: jest.fn().mockResolvedValue({ id: warehouseId, companyId, deletedAt: null, isActive: true }) },
        purchaseOrderItem: { findFirst: jest.fn().mockResolvedValue(basePo.items[0]), findUnique: jest.fn().mockResolvedValue(basePo.items[0]), update: jest.fn() },
        stock: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 's-1' }), update: jest.fn() },
        stockMovement: { create: jest.fn() },
        goodsReceiptItem: { create: jest.fn() },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      mockGrRepo.create.mockResolvedValue(baseReceipt as any);
      mockGrRepo.updateStatus.mockResolvedValue({} as any);
      mockGrRepo.findById.mockResolvedValue(baseReceipt as any);

      const result = await service.create(validDto, userId, companyId);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'gr-1');
      expect(mockEventBus.publish).toHaveBeenCalled();
      expect(mockFinanceService.createGoodsReceiptJournal).toHaveBeenCalled();
      expect(mockPoService.updateStatusAfterReceipt).toHaveBeenCalledWith(poId, companyId, mockTx);
    });

    it('should throw NotFoundException when PO does not exist', async () => {
      mockPoRepo.findById.mockResolvedValue(null);
      await expect(service.create(validDto, userId, companyId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when PO is not ORDERED or PARTIALLY_RECEIVED', async () => {
      mockPoRepo.findById.mockResolvedValue({ ...basePo, status: PurchaseOrderStatus.DRAFT } as any);
      await expect(service.create(validDto, userId, companyId)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when warehouse does not exist', async () => {
      const mockTx = { warehouse: { findFirst: jest.fn().mockResolvedValue(null) }, purchaseOrderItem: { findFirst: jest.fn() } };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      await expect(service.create(validDto, userId, companyId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when receiving more than remaining', async () => {
      const mockTx = {
        warehouse: { findFirst: jest.fn().mockResolvedValue({ id: warehouseId, companyId, deletedAt: null, isActive: true }) },
        purchaseOrderItem: { findFirst: jest.fn().mockResolvedValue({ ...basePo.items[0], receivedQuantity: 8 }) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      const dto: CreateGoodsReceiptDto = { ...validDto, items: [{ purchaseOrderItemId: poItemId, productId, quantity: 5, unitCost: 10.00 }] };
      await expect(service.create(dto, userId, companyId)).rejects.toThrow(BadRequestException);
    });

    it('should handle zero items gracefully', async () => {
      const mockTx = {
        warehouse: { findFirst: jest.fn().mockResolvedValue({ id: warehouseId, companyId, deletedAt: null, isActive: true }) },
        purchaseOrderItem: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
        stock: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
        stockMovement: { create: jest.fn() },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      mockGrRepo.create.mockResolvedValue(baseReceipt as any);
      mockGrRepo.updateStatus.mockResolvedValue({} as any);
      mockGrRepo.findById.mockResolvedValue(baseReceipt as any);

      const result = await service.create({ purchaseOrderId: poId, warehouseId, items: [] }, userId, companyId);
      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockGrRepo.findAll.mockResolvedValue({ items: [baseReceipt], total: 1 });
      const r = await service.findAll({ page: 1, limit: 20 }, companyId);
      expect(r.items).toHaveLength(1);
      expect(r.total).toBe(1);
    });
    it('should throw on invalid pagination', async () => {
      await expect(service.findAll({ page: 0, limit: 20 }, companyId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return receipt when found', async () => {
      mockGrRepo.findById.mockResolvedValue(baseReceipt as any);
      expect((await service.findById('gr-1', companyId))).toHaveProperty('id', 'gr-1');
    });
    it('should throw NotFoundException when not found', async () => {
      mockGrRepo.findById.mockResolvedValue(null);
      await expect(service.findById('x', companyId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete DRAFT receipt', async () => {
      mockGrRepo.findById.mockResolvedValue({ ...baseReceipt, status: GoodsReceiptStatus.DRAFT } as any);
      mockGrRepo.softDelete.mockResolvedValue({} as any);
      await service.softDelete('gr-1', companyId);
      expect(mockGrRepo.softDelete).toHaveBeenCalledWith('gr-1', companyId);
    });
    it('should throw for non-DRAFT', async () => {
      mockGrRepo.findById.mockResolvedValue(baseReceipt as any);
      await expect(service.softDelete('gr-1', companyId)).rejects.toThrow(BadRequestException);
    });
    it('should throw when not found', async () => {
      mockGrRepo.findById.mockResolvedValue(null);
      await expect(service.softDelete('x', companyId)).rejects.toThrow(NotFoundException);
    });
  });
});
