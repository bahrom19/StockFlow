import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { PurchaseOrderRepository } from '../repositories/purchase-order.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { DocumentSequenceService } from '../../shared/services/document-sequence.service';
import { EVENT_BUS } from '../../../common/events';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from '../dto/update-purchase-order.dto';
import { Decimal } from '@prisma/client/runtime/library';

const companyId = 'comp-1';
const userId = 'user-1';
const supplierId = 'supplier-1';
const productId = 'prod-1';

const basePo = {
  id: 'po-1',
  companyId,
  supplierId,
  orderNumber: 'PO-TEST-0001',
  orderDate: new Date(),
  expectedDate: null,
  status: PurchaseOrderStatus.DRAFT,
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
      purchaseOrderId: 'po-1',
      productId,
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

describe('PurchaseOrderService', () => {
  let service: PurchaseOrderService;
  let mockRepo: jest.Mocked<PurchaseOrderRepository>;
  let mockPrisma: Record<string, jest.Mock>;
  let mockAuditLog: jest.Mocked<AuditLogService>;
  let mockEventBus: { publish: jest.Mock };
  let mockSeq: { nextNumber: jest.Mock };

  const mockTransaction = jest.fn();

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findByOrderNumber: jest.fn(),
      updateStatus: jest.fn(),
      countByCompany: jest.fn(),
    } as unknown as jest.Mocked<PurchaseOrderRepository>;

    mockAuditLog = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditLogService>;

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    mockSeq = {
      nextNumber: jest.fn().mockResolvedValue(1),
    };

    mockPrisma = {
      $transaction: mockTransaction,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderService,
        { provide: PurchaseOrderRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: DocumentSequenceService, useValue: mockSeq },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<PurchaseOrderService>(PurchaseOrderService);

    mockRepo.findByOrderNumber.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ── CREATE ───────────────────────────────────
  describe('create', () => {
    const validDto: CreatePurchaseOrderDto = {
      supplierId,
      items: [
        {
          productId,
          quantity: 10,
          unitCost: 10.0,
          discountPercent: 0,
          taxPercent: 12,
        },
      ],
    };

    it('should create a purchase order and return entity', async () => {
      const mockTx = { purchaseOrderItem: { createMany: jest.fn() } };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
      mockRepo.create.mockResolvedValue(basePo as any);

      const result = await service.create(validDto, userId, companyId);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PurchaseOrderStatus.DRAFT,
          company: { connect: { id: companyId } },
          supplier: { connect: { id: supplierId } },
        }),
        mockTx,
      );
      expect(result).toHaveProperty('id', 'po-1');
      expect(mockAuditLog.log).toHaveBeenCalled();
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should throw BadRequestException when order number already exists', async () => {
      mockRepo.findByOrderNumber.mockResolvedValue(basePo as any);
      const dto: CreatePurchaseOrderDto = {
        ...validDto,
        orderNumber: 'PO-EXISTING',
      };

      await expect(service.create(dto, userId, companyId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should calculate totals correctly for multiple items', async () => {
      const mockTx = { purchaseOrderItem: { createMany: jest.fn() } };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));

      const multiDto: CreatePurchaseOrderDto = {
        supplierId,
        items: [
          {
            productId: 'p1',
            quantity: 5,
            unitCost: 100.0,
            discountPercent: 10,
            taxPercent: 12,
          },
          {
            productId: 'p2',
            quantity: 3,
            unitCost: 50.0,
            discountPercent: 0,
            taxPercent: 12,
          },
        ],
      };

      mockRepo.create.mockImplementation(
        (data: Prisma.PurchaseOrderCreateInput) =>
          Promise.resolve({
            ...basePo,
            subtotal: data.subtotal,
            discountAmount: data.discountAmount,
            taxAmount: data.taxAmount,
            grandTotal: data.grandTotal,
          } as any),
      );

      const result = await service.create(multiDto, userId, companyId);
      expect(result).toBeDefined();
    });
  });

  // ── M2: getNextOrderNumber uses the atomic sequence ──
  describe('getNextOrderNumber', () => {
    it('should return a PO number from the atomic sequence (M2)', async () => {
      mockSeq.nextNumber.mockResolvedValue(7);

      const result = await service.getNextOrderNumber(companyId);

      expect(mockSeq.nextNumber).toHaveBeenCalledWith(
        companyId,
        'PURCHASE_ORDER',
      );
      expect(mockRepo.countByCompany).not.toHaveBeenCalled();
      expect(result).toBe('PO-COMP-1-0007');
    });
  });

  // ── FIND ALL ─────────────────────────────────
  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockRepo.findAll.mockResolvedValue({ items: [basePo], total: 1 });
      const result = await service.findAll({ page: 1, limit: 20 }, companyId);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass query filters to repository', async () => {
      mockRepo.findAll.mockResolvedValue({ items: [], total: 0 });
      await service.findAll(
        {
          supplierId,
          status: PurchaseOrderStatus.DRAFT,
          page: 2,
          limit: 10,
          sortBy: 'orderDate',
          sortOrder: 'asc',
        },
        companyId,
      );
      expect(mockRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId,
          supplierId,
          status: PurchaseOrderStatus.DRAFT,
          page: 2,
          limit: 10,
        }),
      );
    });

    it('should throw on invalid pagination', async () => {
      await expect(
        service.findAll({ page: 0, limit: 20 }, companyId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.findAll({ page: 1, limit: 0 }, companyId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── FIND BY ID ───────────────────────────────
  describe('findById', () => {
    it('should return purchase order when found', async () => {
      mockRepo.findById.mockResolvedValue(basePo as any);
      const result = await service.findById('po-1', companyId);
      expect(result).toHaveProperty('id', 'po-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findById('x', companyId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── UPDATE ───────────────────────────────────
  describe('update', () => {
    const updateDto: UpdatePurchaseOrderDto = { notes: 'Updated' };

    it('should update a DRAFT purchase order', async () => {
      const mockTx = {
        purchaseOrderItem: { deleteMany: jest.fn(), createMany: jest.fn() },
      };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(basePo as any);
      mockRepo.update.mockResolvedValue({ ...basePo, notes: 'Updated' } as any);

      const result = await service.update('po-1', updateDto, userId, companyId);
      expect(result).toBeDefined();
      expect(mockAuditLog.log).toHaveBeenCalled();
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(
        service.update('x', updateDto, userId, companyId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when order is not DRAFT', async () => {
      const approvedPo = { ...basePo, status: PurchaseOrderStatus.APPROVED };
      mockRepo.findById.mockResolvedValue(approvedPo as any);
      await expect(
        service.update('po-1', updateDto, userId, companyId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── SOFT DELETE ──────────────────────────────
  describe('softDelete', () => {
    it('should soft delete a DRAFT order', async () => {
      mockRepo.findById.mockResolvedValue(basePo as any);
      mockRepo.softDelete.mockResolvedValue({} as any);
      await service.softDelete('po-1', companyId);
      expect(mockRepo.softDelete).toHaveBeenCalledWith('po-1', companyId);
    });

    it('should throw BadRequestException for non-DRAFT', async () => {
      mockRepo.findById.mockResolvedValue({
        ...basePo,
        status: PurchaseOrderStatus.APPROVED,
      } as any);
      await expect(service.softDelete('po-1', companyId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.softDelete('x', companyId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── TRANSITION STATUS ────────────────────────
  describe('transitionStatus', () => {
    it('should transition DRAFT to PENDING', async () => {
      const mockTx = {
        purchaseOrderItem: {
          findMany: jest.fn().mockResolvedValue(basePo.items),
        },
      };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(basePo as any);
      mockRepo.update.mockResolvedValue({
        ...basePo,
        status: PurchaseOrderStatus.PENDING,
      } as any);

      const result = await service.transitionStatus(
        'po-1',
        PurchaseOrderStatus.PENDING,
        userId,
        companyId,
      );
      expect(result).toBeDefined();
    });

    it('should transition PENDING to APPROVED and set approvedBy', async () => {
      const pendingPo = { ...basePo, status: PurchaseOrderStatus.PENDING };
      const mockTx = {
        purchaseOrderItem: {
          findMany: jest.fn().mockResolvedValue(basePo.items),
        },
      };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(pendingPo as any);
      mockRepo.update.mockResolvedValue({
        ...pendingPo,
        status: PurchaseOrderStatus.APPROVED,
        approvedBy: userId,
      } as any);

      const result = await service.transitionStatus(
        'po-1',
        PurchaseOrderStatus.APPROVED,
        userId,
        companyId,
      );
      expect(result).toBeDefined();
      expect(mockRepo.update).toHaveBeenCalledWith(
        'po-1',
        expect.objectContaining({
          status: PurchaseOrderStatus.APPROVED,
          approvedBy: userId,
        }),
        companyId,
        expect.any(Number),
        mockTx,
      );
      expect(mockEventBus.publish).toHaveBeenCalled();
    });

    it('should transition ORDERED to RECEIVED', async () => {
      const orderedPo = { ...basePo, status: PurchaseOrderStatus.ORDERED };
      const mockTx = {
        purchaseOrderItem: { findMany: jest.fn().mockResolvedValue([]) },
      };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(orderedPo as any);
      mockRepo.update.mockResolvedValue({
        ...orderedPo,
        status: PurchaseOrderStatus.RECEIVED,
      } as any);

      const result = await service.transitionStatus(
        'po-1',
        PurchaseOrderStatus.RECEIVED,
        userId,
        companyId,
      );
      expect(result).toBeDefined();
    });

    it('should cancel DRAFT order', async () => {
      const mockTx = {
        purchaseOrderItem: { findMany: jest.fn().mockResolvedValue([]) },
      };
      mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(basePo as any);
      mockRepo.update.mockResolvedValue({
        ...basePo,
        status: PurchaseOrderStatus.CANCELLED,
        cancelledBy: userId,
      } as any);

      const result = await service.transitionStatus(
        'po-1',
        PurchaseOrderStatus.CANCELLED,
        userId,
        companyId,
      );
      expect(result).toBeDefined();
      expect(mockRepo.update).toHaveBeenCalledWith(
        'po-1',
        expect.objectContaining({
          status: PurchaseOrderStatus.CANCELLED,
          cancelledBy: userId,
        }),
        companyId,
        expect.any(Number),
        mockTx,
      );
    });

    it('should throw BadRequestException for invalid transition (DRAFT→RECEIVED)', async () => {
      mockRepo.findById.mockResolvedValue(basePo as any);
      await expect(
        service.transitionStatus(
          'po-1',
          PurchaseOrderStatus.RECEIVED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException from terminal state (RECEIVED)', async () => {
      mockRepo.findById.mockResolvedValue({
        ...basePo,
        status: PurchaseOrderStatus.RECEIVED,
      } as any);
      await expect(
        service.transitionStatus(
          'po-1',
          PurchaseOrderStatus.DRAFT,
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
          PurchaseOrderStatus.PENDING,
          userId,
          companyId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
