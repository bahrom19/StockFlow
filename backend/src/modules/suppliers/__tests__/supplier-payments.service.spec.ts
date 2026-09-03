import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PurchaseInvoiceStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SupplierPaymentsService } from '../services/supplier-payments.service';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { SupplierPaymentsRepository } from '../repositories/supplier-payments.repository';
import { GlEngineService } from '../../finance/services/gl-engine.service';
import { DocumentSequenceService } from '../../shared/services/document-sequence.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const companyId = 'comp-1';
const supplierId = 'supplier-1';
const userId = 'user-1';
const invoiceId = 'invoice-1';
const paymentId = 'pay-1';
const cashAccountId = 'cash-1';
const bankAccountId = 'bank-1';
const apAccountId = 'ap-1';
const cashChartAccountId = 'chart-cash-1';

const baseInvoice = {
  id: invoiceId,
  companyId,
  supplierId,
  invoiceNumber: 'INV-001',
  status: PurchaseInvoiceStatus.APPROVED,
  grandTotal: new Decimal('100000'),
  paidAmount: new Decimal('0'),
  rowVersion: 1,
  deletedAt: null,
};

const baseSupplier = {
  id: supplierId,
  companyId,
  companyName: 'Test Supplier',
  isActive: true,
  deletedAt: null,
};

describe('SupplierPaymentsService', () => {
  let service: SupplierPaymentsService;
  let mockPrisma: any;
  let mockSuppliersRepo: any;
  let mockPaymentsRepo: any;
  let mockGlEngine: any;
  let mockDocSeq: any;

  beforeEach(async () => {
    mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
      purchaseInvoice: {
        findFirst: jest.fn().mockResolvedValue({ ...baseInvoice }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { grandTotal: new Decimal('100000') },
          _count: { id: 1 },
        }),
      },
      supplierPayment: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: new Decimal('0') },
          _count: { id: 0 },
        }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      purchaseReturn: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { grandTotal: new Decimal('0') },
        }),
      },
      cashAccount: {
        findFirst: jest.fn().mockResolvedValue({ chartOfAccountId: cashChartAccountId }),
      },
      bankAccount: {
        findFirst: jest.fn().mockResolvedValue({ chartOfAccountId: cashChartAccountId }),
      },
      chartOfAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: apAccountId }),
      },
      financialPeriod: {
        findFirst: jest.fn().mockResolvedValue({ id: 'period-1' }),
      },
    };

    mockSuppliersRepo = {
      findById: jest.fn().mockResolvedValue(baseSupplier),
    };

    mockPaymentsRepo = {
      create: jest.fn().mockImplementation((data: any) =>
        Promise.resolve({
          id: paymentId,
          ...data,
          amount: new Decimal(data.amount || '50000'),
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }),
      ),
      findAllBySupplier: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findById: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
      softDelete: jest.fn().mockResolvedValue({}),
    };

    mockGlEngine = {
      post: jest.fn().mockResolvedValue({ id: 'journal-1', entryNumber: 1, status: 'POSTED', totalDebit: '50000', totalCredit: '50000' }),
    };

    mockDocSeq = {
      nextNumber: jest.fn().mockResolvedValue(1),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierPaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SuppliersRepository, useValue: mockSuppliersRepo },
        { provide: SupplierPaymentsRepository, useValue: mockPaymentsRepo },
        { provide: GlEngineService, useValue: mockGlEngine },
        { provide: DocumentSequenceService, useValue: mockDocSeq },
      ],
    }).compile();

    service = module.get<SupplierPaymentsService>(SupplierPaymentsService);
  });

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  describe('create', () => {
    it('should create a CASH payment successfully', async () => {
      const result = await service.create(
        supplierId,
        {
          purchaseInvoiceId: invoiceId,
          amount: 50000,
          method: 'CASH' as any,
          cashAccountId,
        },
        userId,
        companyId,
      );

      expect(result).toBeDefined();
      expect(mockGlEngine.post).toHaveBeenCalledTimes(1);
      expect(mockPaymentsRepo.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.purchaseInvoice.updateMany).toHaveBeenCalledTimes(1);
    });

    it('should reject overpayment', async () => {
      await expect(
        service.create(
          supplierId,
          {
            purchaseInvoiceId: invoiceId,
            amount: 150000,
            method: 'CASH' as any,
            cashAccountId,
          },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-KZT currency', async () => {
      await expect(
        service.create(
          supplierId,
          {
            purchaseInvoiceId: invoiceId,
            amount: 50000,
            method: 'CASH' as any,
            cashAccountId,
            currency: 'USD' as any,
          },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject CASH without cashAccountId', async () => {
      await expect(
        service.create(
          supplierId,
          {
            purchaseInvoiceId: invoiceId,
            amount: 50000,
            method: 'CASH' as any,
          },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject BANK_TRANSFER without bankAccountId', async () => {
      await expect(
        service.create(
          supplierId,
          {
            purchaseInvoiceId: invoiceId,
            amount: 50000,
            method: 'BANK_TRANSFER' as any,
          },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject payment for DRAFT invoice', async () => {
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        status: 'DRAFT',
      });

      await expect(
        service.create(
          supplierId,
          {
            purchaseInvoiceId: invoiceId,
            amount: 50000,
            method: 'CASH' as any,
            cashAccountId,
          },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark invoice as PAID when fully paid', async () => {
      const result = await service.create(
        supplierId,
        {
          purchaseInvoiceId: invoiceId,
          amount: 100000,
          method: 'CASH' as any,
          cashAccountId,
        },
        userId,
        companyId,
      );

      expect(result).toBeDefined();
      const updateCall = mockPrisma.purchaseInvoice.updateMany.mock.calls[0][0];
      expect(updateCall.data.status).toBe(PurchaseInvoiceStatus.PAID);
    });

    it('should reject if supplier not found', async () => {
      mockSuppliersRepo.findById.mockResolvedValue(null);

      await expect(
        service.create(
          supplierId,
          {
            purchaseInvoiceId: invoiceId,
            amount: 50000,
            method: 'CASH' as any,
            cashAccountId,
          },
          userId,
          companyId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // VOID
  // ─────────────────────────────────────────────

  describe('void', () => {
    it('should void payment and create reversal journal', async () => {
      mockPaymentsRepo.findById.mockResolvedValue({
        id: paymentId,
        supplierId,
        companyId,
        purchaseInvoiceId: invoiceId,
        paymentNumber: 'PAY-000001',
        amount: new Decimal('50000'),
        method: 'CASH',
        cashAccountId,
        bankAccountId: null,
        deletedAt: null,
      });
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        paidAmount: new Decimal('50000'),
      });

      await service.void(paymentId, supplierId, companyId, userId);

      expect(mockPaymentsRepo.softDelete).toHaveBeenCalledTimes(1);
      expect(mockGlEngine.post).toHaveBeenCalledTimes(1);
      expect(mockPrisma.purchaseInvoice.updateMany).toHaveBeenCalledTimes(1);

      // Verify reversal journal is Dr Cash/Bank, Cr AP
      const journalCall = mockGlEngine.post.mock.calls[0][0];
      expect(journalCall.lines[0].debit).toBe('50000');
      expect(journalCall.lines[0].credit).toBe('0');
      expect(journalCall.lines[1].debit).toBe('0');
      expect(journalCall.lines[1].credit).toBe('50000');
    });

    it('should reject void of non-existent payment', async () => {
      mockPaymentsRepo.findById.mockResolvedValue(null);

      await expect(
        service.void(paymentId, supplierId, companyId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should restore invoice to APPROVED after full payment void', async () => {
      mockPaymentsRepo.findById.mockResolvedValue({
        id: paymentId,
        supplierId,
        companyId,
        purchaseInvoiceId: invoiceId,
        paymentNumber: 'PAY-000001',
        amount: new Decimal('100000'),
        method: 'CASH',
        cashAccountId,
        bankAccountId: null,
        deletedAt: null,
      });
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        status: PurchaseInvoiceStatus.PAID,
        paidAmount: new Decimal('100000'),
      });

      await service.void(paymentId, supplierId, companyId, userId);

      const updateCall = mockPrisma.purchaseInvoice.updateMany.mock.calls[0][0];
      expect(updateCall.data.status).toBe(PurchaseInvoiceStatus.APPROVED);
    });
  });

  // ─────────────────────────────────────────────
  // PATCH
  // ─────────────────────────────────────────────

  describe('patch', () => {
    it('should update notes and reference', async () => {
      mockPaymentsRepo.findById.mockResolvedValue({
        id: paymentId,
        supplierId,
        companyId,
        deletedAt: null,
      });
      mockPaymentsRepo.update.mockResolvedValue({
        id: paymentId,
        notes: 'Updated note',
        reference: 'REF-002',
      });

      const result = await service.patch(paymentId, supplierId, companyId, {
        notes: 'Updated note',
        reference: 'REF-002',
      });

      expect(result).toBeDefined();
      expect(mockPaymentsRepo.update).toHaveBeenCalledWith(
        paymentId,
        supplierId,
        companyId,
        expect.objectContaining({ notes: 'Updated note', reference: 'REF-002' }),
      );
    });

    it('should reject patch of non-existent payment', async () => {
      mockPaymentsRepo.findById.mockResolvedValue(null);

      await expect(
        service.patch(paymentId, supplierId, companyId, { notes: 'test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // LIST
  // ─────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated payments', async () => {
      const result = await service.findAll(supplierId, companyId, 1, 10);

      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });

    it('should throw for non-existent supplier', async () => {
      mockSuppliersRepo.findById.mockResolvedValue(null);

      await expect(
        service.findAll(supplierId, companyId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // FINANCE SUMMARY
  // ─────────────────────────────────────────────

  describe('getFinanceSummary', () => {
    it('should return finance summary', async () => {
      const result = await service.getFinanceSummary(supplierId, companyId);

      expect(result).toHaveProperty('totalInvoiced');
      expect(result).toHaveProperty('totalPaid');
      expect(result).toHaveProperty('outstanding');
      expect(result).toHaveProperty('invoiceCount');
      expect(result).toHaveProperty('paymentCount');
    });

    it('should throw for non-existent supplier', async () => {
      mockSuppliersRepo.findById.mockResolvedValue(null);

      await expect(
        service.getFinanceSummary(supplierId, companyId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
