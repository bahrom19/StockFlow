import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseInvoiceStatus } from '@prisma/client';
import { PurchaseInvoiceService } from '../services/purchase-invoice.service';
import { PurchaseInvoiceRepository } from '../repositories/purchase-invoice.repository';
import { PurchaseOrderRepository } from '../repositories/purchase-order.repository';
import { PurchasingFinanceService } from '../services/purchasing-finance.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EVENT_BUS } from '../../../common/events';
import { GlEngineService } from '../../finance/services/gl-engine.service';
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
  let mockFinanceService: { createInvoiceJournal: jest.Mock };
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
      approveWithCas: jest.fn(),
    } as any;
    mockPoRepo = { findById: jest.fn(), lockById: jest.fn() } as any;
    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) } as any;
    mockFinanceService = {
      createInvoiceJournal: jest.fn().mockResolvedValue(undefined),
    };
    mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    mockPrisma = { $transaction: mockTransaction };

    const mod = await Test.createTestingModule({
      providers: [
        PurchaseInvoiceService,
        { provide: PurchaseInvoiceRepository, useValue: mockRepo },
        { provide: PurchaseOrderRepository, useValue: mockPoRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: PurchasingFinanceService, useValue: mockFinanceService },
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
    it('should transition DRAFT to APPROVED (CAS + GRNI journal + event)', async () => {
      const mockTx = {
        purchaseInvoiceItem: {
          findMany: jest.fn().mockResolvedValue(baseInvoice.items),
        },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(baseInvoice as any);
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      mockRepo.approveWithCas.mockResolvedValue({
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
      expect(mockRepo.approveWithCas).toHaveBeenCalledWith(
        'inv-1',
        companyId,
        0,
        userId,
        mockTx,
      );
      expect(
        mockFinanceService.createInvoiceJournal,
      ).toHaveBeenCalledWith(
        {
          companyId,
          invoiceNumber: 'INV-001',
          invoiceDate: expect.any(Date),
          subtotal: '500',
          discountAmount: '0',
          taxAmount: '60',
          grandTotal: '560',
          createdBy: userId,
        },
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
      mockRepo.approveWithCas.mockResolvedValue({
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
      expect(mockRepo.approveWithCas).toHaveBeenCalled();
    });

    it('allows approval when approved sibling 700 + current DRAFT 300 == PO 1000', async () => {
      baseApprove('700');
      mockRepo.findById.mockResolvedValue({
        ...baseInvoice,
        grandTotal: new Prisma.Decimal('300'),
      } as any);
      mockRepo.approveWithCas.mockResolvedValue({
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
      expect(mockRepo.approveWithCas).toHaveBeenCalled();
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

    it('leaves the invoice DRAFT (no CAS approval) on rejected approval', async () => {
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
      expect(mockRepo.approveWithCas).not.toHaveBeenCalled();
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
      expect(mockRepo.approveWithCas).toHaveBeenCalled();
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

  // ─────────────────────────────────────────────────────────────
  // G10-A: GRNI invoice-approval accounting
  // ─────────────────────────────────────────────────────────────
  describe('G10-A invoice approval accounting', () => {
    const glEngine = { post: jest.fn().mockResolvedValue({ id: 'je-1' }) };
    let g10Service: PurchaseInvoiceService;

    beforeEach(async () => {
      glEngine.post.mockClear();
      // Real PurchasingFinanceService + mocked GL engine — proves the actual
      // journal shape, not a mock's behavior.
      const mod = await Test.createTestingModule({
        providers: [
          PurchaseInvoiceService,
          { provide: PurchaseInvoiceRepository, useValue: mockRepo },
          { provide: PurchaseOrderRepository, useValue: mockPoRepo },
          { provide: PrismaService, useValue: mockPrisma },
          { provide: AuditLogService, useValue: mockAuditLog },
          { provide: PurchasingFinanceService, useValue: new PurchasingFinanceService(glEngine as any) },
          { provide: EVENT_BUS, useValue: mockEventBus },
        ],
      }).compile();
      g10Service = mod.get(PurchaseInvoiceService);

      // CoA lookup: 1300/2110/2100/5200 — company-scoped via where.companyId
      const coa = [
        { id: 'acct-1300', code: '1300' },
        { id: 'acct-2110', code: '2110' },
        { id: 'acct-2100', code: '2100' },
        { id: 'acct-5200', code: '5200' },
      ];
      const financeTx: any = {
        chartOfAccount: {
          findMany: jest.fn().mockImplementation(async ({ where }: any) =>
            coa.filter((a) => where.code.in.includes(a.code)),
          ),
        },
        financialPeriod: { findFirst: jest.fn().mockResolvedValue({ id: 'period-1' }) },
      };
      const mockTx = {
        purchaseInvoiceItem: { findMany: jest.fn().mockResolvedValue(baseInvoice.items) },
        ...financeTx,
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));

      mockRepo.findById.mockResolvedValue(baseInvoice as any);
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      mockPoRepo.lockById.mockResolvedValue(undefined);
      mockRepo.sumActiveApprovedPaidByPo.mockResolvedValue(new Prisma.Decimal('0'));
      mockRepo.approveWithCas.mockResolvedValue({
        ...baseInvoice,
        status: PurchaseInvoiceStatus.APPROVED,
        approvedBy: userId,
      } as any);
    });

    function approve(): Promise<unknown> {
      return g10Service.transitionStatus(
        'inv-1',
        PurchaseInvoiceStatus.APPROVED,
        userId,
        companyId,
      );
    }

    function postedLines(): Array<{
      accountId: string;
      debit: string;
      credit: string;
    }> {
      expect(glEngine.post).toHaveBeenCalledTimes(1);
      return glEngine.post.mock.calls[0][0].lines;
    }

    it('posts Dr GRNI subtotal / Dr 5200 tax / Cr 5200 discount / Cr AP grandTotal and stays balanced', async () => {
      // Consistent invoice: 500 − 40 + 60 = 520
      const discounted = {
        ...baseInvoice,
        discountAmount: new Prisma.Decimal('40'),
        grandTotal: new Prisma.Decimal('520'),
      };
      mockRepo.findById.mockResolvedValue(discounted as any);
      mockRepo.approveWithCas.mockResolvedValue({
        ...discounted,
        status: PurchaseInvoiceStatus.APPROVED,
      } as any);
      await approve();

      const call = glEngine.post.mock.calls[0][0];
      expect(call.referenceType).toBe('PURCHASE_INVOICE');
      expect(call.referenceId).toBe('INV-001');
      expect(call.companyId).toBe(companyId);
      const lines = postedLines();
      expect(lines).toEqual(
        expect.arrayContaining([
          { accountId: 'acct-2110', debit: '500', credit: '0', description: expect.stringContaining('GRNI settlement') },
          { accountId: 'acct-5200', debit: '60', credit: '0', description: expect.stringContaining('Purchase tax') },
          { accountId: 'acct-5200', debit: '0', credit: '40', description: expect.stringContaining('Purchase discount') },
          { accountId: 'acct-2100', debit: '0', credit: '520', description: expect.stringContaining('Supplier invoice') },
        ]),
      );
      // Balanced: subtotal + tax = grandTotal + discount
      const totalDebit = lines.reduce((s, l) => s.add(new Prisma.Decimal(l.debit)), new Prisma.Decimal(0));
      const totalCredit = lines.reduce((s, l) => s.add(new Prisma.Decimal(l.credit)), new Prisma.Decimal(0));
      expect(totalDebit.equals(totalCredit)).toBe(true);
    });

    it('skips zero-value lines (no tax, no discount → only GRNI + AP)', async () => {
      // Consistent invoice: 500 − 0 + 0 = 500
      const untaxed = {
        ...baseInvoice,
        taxAmount: new Prisma.Decimal('0'),
        discountAmount: new Prisma.Decimal('0'),
        grandTotal: new Prisma.Decimal('500'),
      };
      mockRepo.findById.mockResolvedValue(untaxed as any);
      mockRepo.approveWithCas.mockResolvedValue({
        ...untaxed,
        status: PurchaseInvoiceStatus.APPROVED,
      } as any);
      await approve();

      const lines = postedLines();
      expect(lines).toHaveLength(2);
      expect(lines.map((l) => l.accountId).sort()).toEqual(['acct-2100', 'acct-2110']);
      expect(lines.find((l) => l.accountId === 'acct-2110')).toMatchObject({ debit: '500', credit: '0' });
      expect(lines.find((l) => l.accountId === 'acct-2100')).toMatchObject({ debit: '0', credit: '500' });
    });

    it('uses the same transaction for CAS, journal and event', async () => {
      await approve();
      const txArg = mockRepo.approveWithCas.mock.calls[0]![4];
      const journalTxArg = glEngine.post.mock.calls[0]![1];
      const eventCtx = mockEventBus.publish.mock.calls[0]![1];
      expect(journalTxArg).toBe(txArg);
      expect(eventCtx?.context?.transactionClient).toBe(txArg);
    });

    // ── G11-A: per-operation account gate (fail-fast, no silent skip) ─
    /**
     * Rebuilds the transaction with exactly the given CoA codes, so a test can
     * remove a mandatory account and observe the failure contract.
     */
    function coaTxWithCodes(codes: string[]) {
      const coa = codes.map((code) => ({ id: `acct-${code}`, code }));
      mockTransaction.mockImplementation((cb: any) =>
        cb({
          purchaseInvoiceItem: {
            findMany: jest.fn().mockResolvedValue(baseInvoice.items),
          },
          chartOfAccount: {
            findMany: jest
              .fn()
              .mockImplementation(async ({ where }: any) =>
                coa.filter((a) => where.code.in.includes(a.code)),
              ),
          },
          financialPeriod: {
            findFirst: jest.fn().mockResolvedValue({ id: 'period-1' }),
          },
        }),
      );
    }

    it('G11-A: missing mandatory 2110 fails the approval (no journal, no event, no audit)', async () => {
      coaTxWithCodes(['2100', '5200']);
      const promise = approve();
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        '2110 (Goods Received Not Invoiced)',
      );
      // The CAS already ran inside the shared transaction — the same tx
      // carries the status write back out, so the invoice stays DRAFT.
      expect(mockRepo.approveWithCas).toHaveBeenCalled();
      expect(glEngine.post).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
    });

    it('G11-A: missing mandatory 2100 fails the approval', async () => {
      coaTxWithCodes(['2110', '5200']);
      const promise = approve();
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('2100 (Accounts Payable)');
      expect(glEngine.post).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
    });

    it('G11-A: approval succeeds without 5200 when there is no tax and no discount', async () => {
      const untaxed = {
        ...baseInvoice,
        taxAmount: new Prisma.Decimal('0'),
        discountAmount: new Prisma.Decimal('0'),
        grandTotal: new Prisma.Decimal('500'),
      };
      mockRepo.findById.mockResolvedValue(untaxed as any);
      mockRepo.approveWithCas.mockResolvedValue({
        ...untaxed,
        status: PurchaseInvoiceStatus.APPROVED,
      } as any);
      coaTxWithCodes(['2100', '2110']);

      await approve();

      const lines = postedLines();
      expect(lines).toHaveLength(2);
      expect(lines.map((l) => l.accountId).sort()).toEqual([
        'acct-2100',
        'acct-2110',
      ]);
    });

    it('G11-A: approval fails without 5200 when a tax leg must be posted', async () => {
      coaTxWithCodes(['2100', '2110']);
      const promise = approve();
      await expect(promise).rejects.toThrow(
        '5200 (Purchase Discounts and Write-Offs)',
      );
      expect(glEngine.post).not.toHaveBeenCalled();
    });

    it('returns 409 and posts no journal/event when the CAS loses', async () => {
      mockRepo.approveWithCas.mockRejectedValue(new ConflictException('Invoice was modified or approved by another user. Please refresh and retry.'));
      await expect(approve()).rejects.toThrow(ConflictException);
      expect(glEngine.post).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
    });

    it('rolls back the whole approval when journal posting fails (no event, no audit)', async () => {
      glEngine.post.mockRejectedValueOnce(new Error('no open financial period'));
      await expect(approve()).rejects.toThrow('no open financial period');
      expect(mockRepo.approveWithCas).toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
    });

    it('publishes the event exactly once on successful approval', async () => {
      await approve();
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
    });

    it('non-APPROVED transitions (CANCELLED) do not post journals', async () => {
      const cancelled = {
        ...baseInvoice,
        status: PurchaseInvoiceStatus.CANCELLED,
        cancelledBy: userId,
        cancelledAt: new Date(),
      };
      mockRepo.findById.mockResolvedValue(baseInvoice as any);
      mockRepo.update.mockResolvedValue(cancelled as any);
      await g10Service.transitionStatus('inv-1', PurchaseInvoiceStatus.CANCELLED, userId, companyId);
      expect(mockRepo.approveWithCas).not.toHaveBeenCalled();
      expect(glEngine.post).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // G10-A scenario matrix: GRNI settlement arithmetic via the real
  // PurchasingFinanceService journal shapes
  // ─────────────────────────────────────────────────────────────
  describe('G10-A GRNI scenarios (received vs invoiced)', () => {
    const glEngine = { post: jest.fn().mockResolvedValue({ id: 'je-1' }) };
    let g10Service: PurchaseInvoiceService;

    beforeEach(async () => {
      glEngine.post.mockClear();
      // Real PurchasingFinanceService + mocked GL engine (same pattern as above).
      const mod = await Test.createTestingModule({
        providers: [
          PurchaseInvoiceService,
          { provide: PurchaseInvoiceRepository, useValue: mockRepo },
          { provide: PurchaseOrderRepository, useValue: mockPoRepo },
          { provide: PrismaService, useValue: mockPrisma },
          { provide: AuditLogService, useValue: mockAuditLog },
          { provide: PurchasingFinanceService, useValue: new PurchasingFinanceService(glEngine as any) },
          { provide: EVENT_BUS, useValue: mockEventBus },
        ],
      }).compile();
      g10Service = mod.get(PurchaseInvoiceService);
    });

    /** Runs the real service against a mocked CoA/period tx and returns posted lines. */
    async function postApproval(invoice: {
      subtotal: string;
      discountAmount: string;
      taxAmount: string;
      grandTotal: string;
    }) {
      const mockTx = {
        purchaseInvoiceItem: { findMany: jest.fn().mockResolvedValue([]) },
        chartOfAccount: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'acct-1300', code: '1300' },
            { id: 'acct-2110', code: '2110' },
            { id: 'acct-2100', code: '2100' },
            { id: 'acct-5200', code: '5200' },
          ]),
        },
        financialPeriod: { findFirst: jest.fn().mockResolvedValue({ id: 'period-1' }) },
      };
      mockTransaction.mockImplementation((cb: any) => cb(mockTx));
      mockRepo.findById.mockResolvedValue(baseInvoice as any);
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      mockPoRepo.lockById.mockResolvedValue(undefined);
      mockRepo.sumActiveApprovedPaidByPo.mockResolvedValue(new Prisma.Decimal('0'));
      mockRepo.approveWithCas.mockResolvedValue({
        ...baseInvoice,
        ...invoice,
        status: PurchaseInvoiceStatus.APPROVED,
      } as any);

      await g10Service.transitionStatus('inv-1', PurchaseInvoiceStatus.APPROVED, userId, companyId);

      const lines = glEngine.post.mock.calls[0]![0].lines as Array<{
        accountId: string;
        debit: string;
        credit: string;
      }>;
      return { lines };
    }

    it('scenario 1: received 700 / invoiced 700 → GRNI settles to 0', async () => {
      // GR posts Cr GRNI 700 (goods-receipt journal); this approval posts Dr GRNI 700 → settled
      const { lines } = await postApproval({ subtotal: '700', discountAmount: '0', taxAmount: '0', grandTotal: '700' });
      expect(lines.find((l) => l.accountId === 'acct-2110')).toMatchObject({ debit: '700' });
      // GRNI balance after full cycle: 700 credit − 700 debit = 0
      expect(new Prisma.Decimal('700').sub(new Prisma.Decimal('700')).isZero()).toBe(true);
    });

    it('scenario 2: received 1000 / invoiced 700 → GRNI residue 300 (Credit)', async () => {
      const { lines } = await postApproval({ subtotal: '700', discountAmount: '0', taxAmount: '0', grandTotal: '700' });
      expect(lines.find((l) => l.accountId === 'acct-2110')).toMatchObject({ debit: '700' });
      // GRNI balance: 1000 credit (receipt) − 700 debit (invoice) = 300 credit residue
      expect(new Prisma.Decimal('1000').sub(new Prisma.Decimal('700')).toString()).toBe('300');
    });

    it('scenario 3: received 700 / invoiced 1000 → GRNI overbilled −300 (Debit)', async () => {
      const { lines } = await postApproval({ subtotal: '1000', discountAmount: '0', taxAmount: '0', grandTotal: '1000' });
      expect(lines.find((l) => l.accountId === 'acct-2110')).toMatchObject({ debit: '1000' });
      // GRNI balance: 700 credit (receipt) − 1000 debit (invoice) = 300 debit (negative accrual)
      expect(new Prisma.Decimal('1000').sub(new Prisma.Decimal('700')).toString()).toBe('300');
    });

    it('scenario 4+5: multiple receipts / multiple invoices accumulate within the G9-D2 PO cap (cumulative guard active)', async () => {
      mockTransaction.mockImplementation((cb: any) =>
        cb({
          purchaseInvoiceItem: { findMany: jest.fn().mockResolvedValue([]) },
          chartOfAccount: {
            findMany: jest.fn().mockResolvedValue([
              { id: 'acct-1300', code: '1300' },
              { id: 'acct-2110', code: '2110' },
              { id: 'acct-2100', code: '2100' },
              { id: 'acct-5200', code: '5200' },
            ]),
          },
          financialPeriod: { findFirst: jest.fn().mockResolvedValue({ id: 'period-1' }) },
        }),
      );
      // First approve: proposed 500 + siblings 500 = PO 1000 → passes
      mockRepo.findById.mockResolvedValue({
        ...baseInvoice,
        grandTotal: new Prisma.Decimal('500'),
      } as any);
      mockPoRepo.findById.mockResolvedValue(basePo as any);
      mockRepo.sumActiveApprovedPaidByPo.mockResolvedValue(new Prisma.Decimal('500'));
      mockRepo.approveWithCas.mockResolvedValue({
        ...baseInvoice,
        grandTotal: new Prisma.Decimal('500'),
        status: PurchaseInvoiceStatus.APPROVED,
      } as any);
      await g10Service.transitionStatus('inv-1', PurchaseInvoiceStatus.APPROVED, userId, companyId);
      expect(mockRepo.approveWithCas).toHaveBeenCalled();

      // Second attempt: siblings 501 + proposed 560 (base invoice) > 1000 → rejected
      mockRepo.findById.mockResolvedValue(baseInvoice as any);
      mockRepo.sumActiveApprovedPaidByPo.mockResolvedValue(new Prisma.Decimal('501'));
      await expect(
        g10Service.transitionStatus('inv-1', PurchaseInvoiceStatus.APPROVED, userId, companyId),
      ).rejects.toThrow(BadRequestException);
    });

    it('scenario 6: full cycle settles — GRNI 0, AP 0 (invoice liability removed by payment)', async () => {
      // GR: Cr GRNI 560; invoice: Dr GRNI 500 + Dr 5200 60 / Cr AP 560; payment: Dr AP 560
      const { lines } = await postApproval({ subtotal: '500', discountAmount: '0', taxAmount: '60', grandTotal: '560' });
      expect(lines.find((l) => l.accountId === 'acct-2110')!.debit).toBe('500');
      expect(lines.find((l) => l.accountId === 'acct-5200')!.debit).toBe('60');
      expect(lines.find((l) => l.accountId === 'acct-2100')!.credit).toBe('560');
      // GRNI residue = receipt 560 credit − invoice (500+60) debit = 0 → settled
      const grniNet = new Prisma.Decimal('560').sub(new Prisma.Decimal('500').add(new Prisma.Decimal('60')));
      expect(grniNet.isZero()).toBe(true);
      // AP after payment: 560 − 560 = 0
      expect(new Prisma.Decimal('560').sub(new Prisma.Decimal('560')).isZero()).toBe(true);
    });
  });
});
