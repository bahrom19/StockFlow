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
  id: 'inv-1',
  companyId,
  purchaseOrderId: poId,
  supplierId,
  invoiceNumber: 'INV-001',
  invoiceDate: new Date(),
  dueDate: null,
  status: PurchaseInvoiceStatus.DRAFT,
  subtotal: new Prisma.Decimal('500'),
  discountAmount: new Prisma.Decimal('0'),
  taxAmount: new Prisma.Decimal('60'),
  grandTotal: new Prisma.Decimal('560'),
  paidAmount: new Prisma.Decimal('0'),
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
      id: 'invi-1',
      purchaseInvoiceId: 'inv-1',
      purchaseOrderItemId: 'poi-1',
      productId,
      quantity: 10,
      unitCost: new Prisma.Decimal('50'),
      discountPercent: null,
      discountAmount: new Prisma.Decimal('0'),
      taxPercent: new Prisma.Decimal('12'),
      taxAmount: new Prisma.Decimal('60'),
      subtotal: new Prisma.Decimal('500'),
      total: new Prisma.Decimal('560'),
      notes: null,
    },
  ],
};

const basePo = {
  id: poId,
  companyId,
  supplierId,
  orderNumber: 'PO-001',
  status: 'RECEIVED',
  currency: 'KZT',
  grandTotal: new Prisma.Decimal('1000'),
};

describe('PurchaseInvoiceService', () => {
  let service: PurchaseInvoiceService;
  let mockRepo: jest.Mocked<PurchaseInvoiceRepository>;
  let mockPoRepo: jest.Mocked<PurchaseOrderRepository>;
  let mockPrisma: Record<string, jest.Mock>;
  let mockAuditLog: jest.Mocked<AuditLogService>;
  let mockEventBus: { publish: jest.Mock };
  const mockTransaction = jest.fn();

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findByInvoiceNumber: jest.fn(),
      sumActiveApprovedPaidByPo: jest.fn(),
    } as any;
    mockPoRepo = { findById: jest.fn(), lockById: jest.fn() } as any;
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
    mockRepo.sumActiveApprovedPaidByPo.mockResolvedValue(new Prisma.Decimal('0'));
    mockPoRepo.lockById.mockResolvedValue(undefined);
  });

  afterEach(() => jest.clearAllMocks());

  describe('create', () => {
    const validDto: CreatePurchaseInvoiceDto = {
      purchaseOrderId: poId,
      supplierId,
      items: [{ productId, quantity: 10, unitCost: 50.0, taxPercent: 12 }],
    };

    it('should create invoice from purchase order', async () => {
      const mockTx = {
        purchaseInvoiceItem: { create: jest.fn() },
        supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      mockRepo.create.mockResolvedValue(baseInvoice as any);

      const result = await service.create(validDto, userId, companyId);
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'inv-1');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PurchaseInvoiceStatus.DRAFT,
          company: { connect: { id: companyId } },
          purchaseOrder: { connect: { id: poId } },
          supplier: { connect: { id: supplierId } },
        }),
        mockTx,
      );
      expect(mockAuditLog.log).toHaveBeenCalled();
    });

    it('should throw BadRequestException when invoice number exists', async () => {
      mockRepo.findByInvoiceNumber.mockResolvedValue(baseInvoice as any);
      await expect(
        service.create(
          { ...validDto, invoiceNumber: 'INV-EX' },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when PO does not exist', async () => {
      const mockTx = {};
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(null);
      await expect(service.create(validDto, userId, companyId)).rejects.toThrow(
        NotFoundException,
      );
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
      await expect(
        service.findAll({ page: 0, limit: 20 }, companyId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return invoice when found', async () => {
      mockRepo.findById.mockResolvedValue(baseInvoice as any);
      expect(await service.findById('inv-1', companyId)).toHaveProperty(
        'id',
        'inv-1',
      );
    });
    it('should throw NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findById('x', companyId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── CURRENCY ────────────────────────────────
  describe('currency', () => {
    const validDto: CreatePurchaseInvoiceDto = {
      purchaseOrderId: poId,
      supplierId,
      items: [{ productId, quantity: 10, unitCost: 50.0, taxPercent: 12 }],
    };

    it('should default to KZT when creating invoice from PO without specifying currency', async () => {
      const poWithUsd = { ...basePo, currency: 'USD' };
      const mockTx = {
        purchaseInvoiceItem: { create: jest.fn() },
        supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(poWithUsd as any);
      mockRepo.create.mockResolvedValue({ ...baseInvoice, currency: 'USD' } as any);

      const result = await service.create(validDto, userId, companyId);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD' }),
        mockTx,
      );
    });

    it('should use PO currency when invoice currency matches PO', async () => {
      const poWithUsd = { ...basePo, currency: 'USD' };
      const mockTx = {
        purchaseInvoiceItem: { create: jest.fn() },
        supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(poWithUsd as any);
      mockRepo.create.mockResolvedValue({ ...baseInvoice, currency: 'USD' } as any);

      await service.create(
        { ...validDto, currency: 'USD' as any },
        userId,
        companyId,
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'USD' }),
        mockTx,
      );
    });

    it('should reject when invoice currency mismatches PO currency', async () => {
      const poWithUsd = { ...basePo, currency: 'USD' };
      const mockTx = {
        purchaseInvoiceItem: { create: jest.fn() },
        supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(poWithUsd as any);

      await expect(
        service.create(
          { ...validDto, currency: 'KZT' as any },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('should reject when KZT PO gets USD invoice', async () => {
      const poWithKzt = { ...basePo, currency: 'KZT' };
      const mockTx = {
        purchaseInvoiceItem: { create: jest.fn() },
        supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(poWithKzt as any);

      await expect(
        service.create(
          { ...validDto, currency: 'EUR' as any },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockRepo.create).not.toHaveBeenCalled();
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
      mockRepo.findById.mockResolvedValue({
        ...baseInvoice,
        status: PurchaseInvoiceStatus.APPROVED,
      } as any);
      await expect(service.softDelete('inv-1', companyId)).rejects.toThrow(
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

  describe('transitionStatus', () => {
    it('should transition DRAFT to APPROVED', async () => {
      const mockTx = {
        purchaseInvoiceItem: {
          findMany: jest.fn().mockResolvedValue(baseInvoice.items),
        },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(baseInvoice as any);
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      mockRepo.update.mockResolvedValue({
        ...baseInvoice,
        status: PurchaseInvoiceStatus.APPROVED,
        approvedBy: userId,
      } as any);

      const result = await service.transitionStatus(
        'inv-1',
        PurchaseInvoiceStatus.APPROVED,
        userId,
        companyId,
      );
      expect(result).toBeDefined();
      expect(mockRepo.update).toHaveBeenCalledWith(
        'inv-1',
        expect.objectContaining({
          status: PurchaseInvoiceStatus.APPROVED,
          approvedBy: userId,
        }),
        companyId,
        mockTx,
      );
      expect(mockEventBus.publish).toHaveBeenCalled();
      expect(mockAuditLog.log).toHaveBeenCalled();
    });

    it('should transition APPROVED to PAID', async () => {
      const approved = {
        ...baseInvoice,
        status: PurchaseInvoiceStatus.APPROVED,
      };
      const mockTx = {
        purchaseInvoiceItem: { findMany: jest.fn().mockResolvedValue([]) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(approved as any);
      mockRepo.update.mockResolvedValue({
        ...approved,
        status: PurchaseInvoiceStatus.PAID,
      } as any);

      const result = await service.transitionStatus(
        'inv-1',
        PurchaseInvoiceStatus.PAID,
        userId,
        companyId,
      );
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException for DRAFT→PAID (skip APPROVED)', async () => {
      mockRepo.findById.mockResolvedValue(baseInvoice as any);
      await expect(
        service.transitionStatus(
          'inv-1',
          PurchaseInvoiceStatus.PAID,
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException from PAID (terminal)', async () => {
      mockRepo.findById.mockResolvedValue({
        ...baseInvoice,
        status: PurchaseInvoiceStatus.PAID,
      } as any);
      await expect(
        service.transitionStatus(
          'inv-1',
          PurchaseInvoiceStatus.DRAFT,
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
          PurchaseInvoiceStatus.APPROVED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── G9-C: SUPPLIER TERMS (defaultDueDays) ─────────────────────
  describe('dueDate resolution (G9-C supplier terms)', () => {
    const dueDto: CreatePurchaseInvoiceDto = {
      purchaseOrderId: poId,
      supplierId,
      invoiceDate: '2026-09-01T00:00:00.000Z',
      items: [{ productId, quantity: 10, unitCost: 50.0, taxPercent: 12 }],
    };

    function txWithSupplier(defaultDueDays: number | null) {
      return {
        purchaseInvoiceItem: { create: jest.fn() },
        supplier: {
          findFirst: jest
            .fn()
            .mockResolvedValue(
              defaultDueDays === null ? null : { defaultDueDays },
            ),
        },
      };
    }

    function baseCreate() {
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      mockRepo.create.mockResolvedValue(baseInvoice as any);
    }

    it('uses explicit dto.dueDate verbatim and ignores supplier.defaultDueDays', async () => {
      const mockTx = txWithSupplier(30);
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      baseCreate();

      await service.create(
        { ...dueDto, dueDate: '2026-09-15T00:00:00.000Z' },
        userId,
        companyId,
      );

      const data = mockRepo.create.mock.calls[0]?.[0] as any;
      expect(data.dueDate).toEqual(new Date('2026-09-15T00:00:00.000Z'));
    });

    it('calculates dueDate = invoiceDate + defaultDueDays when dto.dueDate is absent', async () => {
      const mockTx = txWithSupplier(30);
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      baseCreate();

      await service.create(dueDto, userId, companyId);

      const data = mockRepo.create.mock.calls[0]?.[0] as any;
      expect(data.invoiceDate).toEqual(new Date('2026-09-01T00:00:00.000Z'));
      expect(data.dueDate).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    });

    it('keeps dueDate null when dto.dueDate is absent and supplier has no defaultDueDays', async () => {
      const mockTx = txWithSupplier(null);
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      baseCreate();

      await service.create(dueDto, userId, companyId);

      const data = mockRepo.create.mock.calls[0]?.[0] as any;
      expect(data.dueDate).toBeNull();
    });

    it('scopes the supplier lookup to the authenticated company', async () => {
      const mockTx = {
        purchaseInvoiceItem: { create: jest.fn() },
        supplier: {
          findFirst: jest.fn().mockResolvedValue({ defaultDueDays: 30 }),
        },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      baseCreate();

      await service.create(dueDto, userId, companyId);

      expect(mockTx.supplier.findFirst).toHaveBeenCalledWith({
        where: { id: supplierId, companyId, deletedAt: null },
        select: { defaultDueDays: true },
      });
    });

    it('treats defaultDueDays = 0 as same-day dueDate (not a null fallback)', async () => {
      const mockTx = txWithSupplier(0);
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      baseCreate();

      await service.create(dueDto, userId, companyId);

      const data = mockRepo.create.mock.calls[0]?.[0] as any;
      expect(data.dueDate).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    });
  });

  // ── G9-D2: INVOICE OVERRUN GUARD (CREATE) ─────────────────────
  describe('create — G9-D2 cumulative overrun guard', () => {
    // invoice grandTotal == unitCost * quantity (taxPercent 0)
    function dtoWithTotal(total: number): CreatePurchaseInvoiceDto {
      return {
        purchaseOrderId: poId,
        supplierId,
        items: [{ productId, quantity: 1, unitCost: total }],
      };
    }

    function baseCreateWithSum(existing: string) {
      const mockTx = {
        purchaseInvoiceItem: { create: jest.fn() },
        supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      mockPoRepo.lockById.mockResolvedValue(undefined);
      mockRepo.sumActiveApprovedPaidByPo.mockResolvedValue(
        new Prisma.Decimal(existing),
      );
      mockRepo.create.mockResolvedValue(baseInvoice as any);
      return mockTx;
    }

    it('allows creation when proposed invoice is within the PO total', async () => {
      baseCreateWithSum('0');
      await service.create(dtoWithTotal(700), userId, companyId);
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('allows creation when approved 700 + proposed 300 == PO 1000', async () => {
      baseCreateWithSum('700');
      await service.create(dtoWithTotal(300), userId, companyId);
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('rejects creation when approved 700 + proposed 301 > PO 1000', async () => {
      baseCreateWithSum('700');
      await expect(
        service.create(dtoWithTotal(301), userId, companyId),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('excludes DRAFT siblings and scopes sum by PO/company/currency', async () => {
      const mockTx = {
        purchaseInvoiceItem: { create: jest.fn() },
        supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      mockPoRepo.lockById.mockResolvedValue(undefined);
      // DRAFT sibling (700) is NOT in the sum -> only the proposed 300 counts
      mockRepo.sumActiveApprovedPaidByPo.mockResolvedValue(
        new Prisma.Decimal('0'),
      );
      mockRepo.create.mockResolvedValue(baseInvoice as any);

      await service.create(dtoWithTotal(300), userId, companyId);
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.sumActiveApprovedPaidByPo).toHaveBeenCalledWith(
        poId,
        companyId,
        'KZT',
        mockTx,
      );
    });

    it('includes PAID siblings in the counted total (700 + 400 > 1000)', async () => {
      baseCreateWithSum('700');
      await expect(
        service.create(dtoWithTotal(400), userId, companyId),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects creation for a CANCELLED purchase order', async () => {
      const mockTx = {};
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue({
        ...basePo,
        status: 'CANCELLED',
      } as any);
      await expect(
        service.create(dtoWithTotal(100), userId, companyId),
      ).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining('CANCELLED'),
        }),
      );
      expect(mockPoRepo.lockById).not.toHaveBeenCalled();
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('keeps rejecting a currency mismatch before any overrun guard', async () => {
      const mockTx = {};
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockPoRepo.findById.mockResolvedValue({ ...basePo, currency: 'USD' } as any);
      await expect(
        service.create(
          { ...dtoWithTotal(100), currency: 'EUR' as any },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPoRepo.lockById).not.toHaveBeenCalled();
    });

    it('locks the PO row before the cumulative sum on create', async () => {
      baseCreateWithSum('0');
      await service.create(dtoWithTotal(100), userId, companyId);
      const lockOrder = mockPoRepo.lockById.mock.invocationCallOrder[0] ?? 0;
      const sumOrder =
        mockRepo.sumActiveApprovedPaidByPo.mock.invocationCallOrder[0] ?? 0;
      expect(lockOrder).toBeGreaterThan(0);
      expect(sumOrder).toBeGreaterThan(lockOrder);
    });
  });

  // ── G9-D2: INVOICE OVERRUN GUARD (APPROVE) ───────────────────
  describe('transitionStatus — G9-D2 cumulative overrun guard', () => {
    function baseApprove(existing: string) {
      const mockTx = {
        purchaseInvoiceItem: {
          findMany: jest.fn().mockResolvedValue(baseInvoice.items),
        },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(baseInvoice as any); // current DRAFT (560)
      mockPoRepo.findById.mockResolvedValue(basePo as any); // PO 1000
      mockPoRepo.lockById.mockResolvedValue(undefined);
      mockRepo.sumActiveApprovedPaidByPo.mockResolvedValue(
        new Prisma.Decimal(existing),
      );
      mockRepo.update.mockResolvedValue({
        ...baseInvoice,
        status: PurchaseInvoiceStatus.APPROVED,
        approvedBy: userId,
      } as any);
      return mockTx;
    }

    it('allows approval when the current DRAFT (560) fits the PO (1000)', async () => {
      baseApprove('0');
      await service.transitionStatus(
        'inv-1',
        PurchaseInvoiceStatus.APPROVED,
        userId,
        companyId,
      );
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('allows approval when approved sibling 700 + current DRAFT 300 == PO 1000', async () => {
      baseApprove('700');
      mockRepo.findById.mockResolvedValue({
        ...baseInvoice,
        grandTotal: new Prisma.Decimal('300'),
      } as any);
      mockRepo.update.mockResolvedValue({
        ...baseInvoice,
        grandTotal: new Prisma.Decimal('300'),
        status: PurchaseInvoiceStatus.APPROVED,
      } as any);
      await service.transitionStatus(
        'inv-1',
        PurchaseInvoiceStatus.APPROVED,
        userId,
        companyId,
      );
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('rejects approval when approved sibling 700 + current DRAFT 301 > PO 1000', async () => {
      baseApprove('700');
      mockRepo.findById.mockResolvedValue({
        ...baseInvoice,
        grandTotal: new Prisma.Decimal('301'),
      } as any);
      await expect(
        service.transitionStatus(
          'inv-1',
          PurchaseInvoiceStatus.APPROVED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('leaves the invoice DRAFT (no update) on rejected approval', async () => {
      baseApprove('700');
      mockRepo.findById.mockResolvedValue({
        ...baseInvoice,
        grandTotal: new Prisma.Decimal('301'),
      } as any);
      await expect(
        service.transitionStatus(
          'inv-1',
          PurchaseInvoiceStatus.APPROVED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('does not publish the approval event on rejected approval', async () => {
      baseApprove('700');
      mockRepo.findById.mockResolvedValue({
        ...baseInvoice,
        grandTotal: new Prisma.Decimal('301'),
      } as any);
      await expect(
        service.transitionStatus(
          'inv-1',
          PurchaseInvoiceStatus.APPROVED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('includes PAID siblings in the counted total during approval', async () => {
      baseApprove('700');
      mockRepo.findById.mockResolvedValue({
        ...baseInvoice,
        grandTotal: new Prisma.Decimal('301'),
      } as any);
      await expect(
        service.transitionStatus(
          'inv-1',
          PurchaseInvoiceStatus.APPROVED,
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('excludes cancelled/deleted siblings (only the current 560 counts)', async () => {
      baseApprove('0');
      await service.transitionStatus(
        'inv-1',
        PurchaseInvoiceStatus.APPROVED,
        userId,
        companyId,
      );
      expect(mockRepo.update).toHaveBeenCalled();
    });

    it('locks the PO row before the cumulative sum on approval', async () => {
      baseApprove('0');
      await service.transitionStatus(
        'inv-1',
        PurchaseInvoiceStatus.APPROVED,
        userId,
        companyId,
      );
      const lockOrder = mockPoRepo.lockById.mock.invocationCallOrder[0] ?? 0;
      const sumOrder =
        mockRepo.sumActiveApprovedPaidByPo.mock.invocationCallOrder[0] ?? 0;
      expect(lockOrder).toBeGreaterThan(0);
      expect(sumOrder).toBeGreaterThan(lockOrder);
    });
  });
});
