import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PurchaseInvoiceStatus } from '@prisma/client';
import { PurchaseInvoiceService } from '../services/purchase-invoice.service';
import { PurchaseInvoiceRepository } from '../repositories/purchase-invoice.repository';
import { PurchaseOrderRepository } from '../repositories/purchase-order.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EVENT_BUS } from '../../../common/events';
import { CreatePurchaseInvoiceDto } from '../dto/create-purchase-invoice.dto';

const companyId = 'comp-1';
const userId = 'user-1';
const supplierId = 'supplier-1';
const productId = 'prod-1';
const poId = 'po-1';

const baseInvoice = {
  id: 'inv-1', companyId, purchaseOrderId: poId, supplierId,
  invoiceNumber: 'INV-001', invoiceDate: new Date(), dueDate: null,
  status: PurchaseInvoiceStatus.DRAFT,
  subtotal: new Prisma.Decimal('500'), discountAmount: new Prisma.Decimal('0'),
  taxAmount: new Prisma.Decimal('60'), grandTotal: new Prisma.Decimal('560'),
  paidAmount: new Prisma.Decimal('0'), notes: null,
  approvedBy: null, approvedAt: null, cancelledBy: null, cancelledAt: null,
  rowVersion: 0, createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
  items: [{ id: 'invi-1', purchaseInvoiceId: 'inv-1', purchaseOrderItemId: 'poi-1',
    productId, quantity: 10, unitCost: new Prisma.Decimal('50'),
    discountPercent: null, discountAmount: new Prisma.Decimal('0'),
    taxPercent: new Prisma.Decimal('12'), taxAmount: new Prisma.Decimal('60'),
    subtotal: new Prisma.Decimal('500'), total: new Prisma.Decimal('560'),
    notes: null }],
};

const basePo = { id: poId, companyId, supplierId, orderNumber: 'PO-001', status: 'RECEIVED' };

describe('PurchaseInvoiceService', () => {
  let service: PurchaseInvoiceService;
  let mockRepo: jest.Mocked<PurchaseInvoiceRepository>;
  let mockPoRepo: jest.Mocked<PurchaseOrderRepository>;
  let mockPrisma: Record<string, jest.Mock>;
  let mockAuditLog: jest.Mocked<AuditLogService>;
  let mockEventBus: { publish: jest.Mock };
  const mockTransaction = jest.fn();

  beforeEach(async () => {
    mockRepo = { create: jest.fn(), findById: jest.fn(), findAll: jest.fn(), update: jest.fn(), softDelete: jest.fn(), findByInvoiceNumber: jest.fn() } as any;
    mockPoRepo = { findById: jest.fn() } as any;
    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) } as any;
    mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    mockPrisma = { $transaction: mockTransaction };

    const mod = await Test.createTestingModule({
      providers: [
        PurchaseInvoiceService,
        { provide: PurchaseInvoiceRepository, useValue: mockRepo },
        { provide: PurchaseOrderRepository, useValue: mockPoRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();
    service = mod.get(PurchaseInvoiceService);
    mockRepo.findByInvoiceNumber.mockResolvedValue(null);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    const validDto: CreatePurchaseInvoiceDto = {
      purchaseOrderId: poId, supplierId,
      items: [{ productId, quantity: 10, unitCost: 50.00, taxPercent: 12 }],
    };

    it('should create invoice from purchase order', async () => {
      const mockTx = { purchaseInvoiceItem: { create: jest.fn() } };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      mockRepo.create.mockResolvedValue(baseInvoice as any);

      const result = await service.create(validDto, userId, companyId);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'inv-1');
      expect(mockRepo.create).toHaveBeenCalledWith(expect.objectContaining({
        status: PurchaseInvoiceStatus.DRAFT,
        company: { connect: { id: companyId } },
        purchaseOrder: { connect: { id: poId } },
        supplier: { connect: { id: supplierId } },
      }), mockTx);
      expect(mockAuditLog.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException when invoice number exists', async () => {
      mockRepo.findByInvoiceNumber.mockResolvedValue(baseInvoice as any);
      await expect(service.create({ ...validDto, invoiceNumber: 'INV-EX' }, userId, companyId)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when PO does not exist', async () => {
      const mockTx = {};
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(null);
      await expect(service.create(validDto, userId, companyId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockRepo.findAll.mockResolvedValue({ items: [baseInvoice], total: 1 });
      const r = await service.findAll({ page: 1, limit: 20 }, companyId);
      expect(r.items).toHaveLength(1);
      expect(r.total).toBe(1);
    });
    it('should throw on invalid pagination', async () => {
      await expect(service.findAll({ page: 0, limit: 20 }, companyId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return invoice when found', async () => {
      mockRepo.findById.mockResolvedValue(baseInvoice as any);
      expect((await service.findById('inv-1', companyId))).toHaveProperty('id', 'inv-1');
    });
    it('should throw NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findById('x', companyId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should soft delete DRAFT invoice', async () => {
      mockRepo.findById.mockResolvedValue(baseInvoice as any);
      mockRepo.softDelete.mockResolvedValue({} as any);
      await service.softDelete('inv-1', companyId);
      expect(mockRepo.softDelete).toHaveBeenCalledWith('inv-1', companyId);
    });
    it('should throw for non-DRAFT', async () => {
      mockRepo.findById.mockResolvedValue({ ...baseInvoice, status: PurchaseInvoiceStatus.APPROVED } as any);
      await expect(service.softDelete('inv-1', companyId)).rejects.toThrow(BadRequestException);
    });
    it('should throw when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.softDelete('x', companyId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('transitionStatus', () => {
    it('should transition DRAFT to APPROVED', async () => {
      const mockTx = { purchaseInvoiceItem: { findMany: jest.fn().mockResolvedValue(baseInvoice.items) } };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(baseInvoice as any);
      mockRepo.update.mockResolvedValue({ ...baseInvoice, status: PurchaseInvoiceStatus.APPROVED, approvedBy: userId } as any);

      const result = await service.transitionStatus('inv-1', PurchaseInvoiceStatus.APPROVED, userId, companyId);
      expect(result).toBeDefined();
      expect(mockRepo.update).toHaveBeenCalledWith('inv-1', expect.objectContaining({ status: PurchaseInvoiceStatus.APPROVED, approvedBy: userId }), companyId, mockTx);
      expect(mockEventBus.publish).toHaveBeenCalled();
      expect(mockAuditLog.log).toHaveBeenCalled();
    });

    it('should transition APPROVED to PAID', async () => {
      const approved = { ...baseInvoice, status: PurchaseInvoiceStatus.APPROVED };
      const mockTx = { purchaseInvoiceItem: { findMany: jest.fn().mockResolvedValue([]) } };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(approved as any);
      mockRepo.update.mockResolvedValue({ ...approved, status: PurchaseInvoiceStatus.PAID } as any);

      const result = await service.transitionStatus('inv-1', PurchaseInvoiceStatus.PAID, userId, companyId);
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException for DRAFT→PAID (skip APPROVED)', async () => {
      mockRepo.findById.mockResolvedValue(baseInvoice as any);
      await expect(service.transitionStatus('inv-1', PurchaseInvoiceStatus.PAID, userId, companyId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException from PAID (terminal)', async () => {
      mockRepo.findById.mockResolvedValue({ ...baseInvoice, status: PurchaseInvoiceStatus.PAID } as any);
      await expect(service.transitionStatus('inv-1', PurchaseInvoiceStatus.DRAFT, userId, companyId)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.transitionStatus('x', PurchaseInvoiceStatus.APPROVED, userId, companyId)).rejects.toThrow(NotFoundException);
    });
  });
});
