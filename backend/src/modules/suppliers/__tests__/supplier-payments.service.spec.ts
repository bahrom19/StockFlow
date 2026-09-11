import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Currency, PaymentMethod, PurchaseInvoiceStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SupplierPaymentsService } from '../services/supplier-payments.service';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { SupplierPaymentsRepository } from '../repositories/supplier-payments.repository';
import { GlEngineService } from '../../finance/services/gl-engine.service';
import { DocumentSequenceService } from '../../shared/services/document-sequence.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CompaniesService } from '../../companies/services/companies.service';

const companyId = 'comp-1';
const companyBId = 'comp-2';
const supplierId = 'supplier-1';
const supplierBId = 'supplier-2';
const userId = 'user-1';
const invoiceId = 'invoice-1';
const paymentId = 'pay-1';
const cashAccountId = 'cash-1';
const bankAccountId = 'bank-1';
const apAccountId = 'ap-1';
const cashChartAccountId = 'chart-cash-1';
const bankChartAccountId = 'chart-bank-1';

const baseInvoice = {
  id: invoiceId,
  companyId,
  supplierId,
  invoiceNumber: 'INV-001',
  status: PurchaseInvoiceStatus.APPROVED,
  grandTotal: new Decimal('100000'),
  paidAmount: new Decimal('0'),
  currency: 'KZT' as Currency,
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

const cashPaymentDto = {
  purchaseInvoiceId: invoiceId,
  amount: 50000,
  method: PaymentMethod.CASH,
  cashAccountId,
};

// Realistic full SupplierPayment row for the entity mapper (void/patch tests).
const voidedPaymentRow = {
  id: paymentId,
  companyId,
  supplierId,
  purchaseInvoiceId: invoiceId,
  paymentNumber: 'PAY-000001',
  paymentDate: new Date('2026-09-01T00:00:00.000Z'),
  amount: new Decimal('50000'),
  method: PaymentMethod.CASH,
  cashAccountId,
  bankAccountId: null,
  currency: 'KZT' as Currency,
  reference: null,
  notes: null,
  createdBy: userId,
  rowVersion: 0,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
  deletedAt: null,
};

describe('SupplierPaymentsService', () => {
  let service: SupplierPaymentsService;
  let mockPrisma: any;
  let mockSuppliersRepo: any;
  let mockPaymentsRepo: any;
  let mockGlEngine: any;
  let mockDocSeq: any;
  let mockCompanies: any;
  let mockAuditLog: any;
  let mockIdempotency: any;

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
      // Returns a realistic full SupplierPayment row for the entity mapper.
      create: jest.fn().mockImplementation((data: any) =>
        Promise.resolve({
          id: paymentId,
          companyId,
          supplierId,
          purchaseInvoiceId: data.purchaseInvoice?.connect?.id ?? invoiceId,
          paymentNumber: data.paymentNumber,
          paymentDate: data.paymentDate ?? new Date(),
          amount: new Decimal(data.amount ?? '50000'),
          method: data.method,
          currency: data.currency ?? 'KZT',
          reference: data.reference ?? null,
          notes: data.notes ?? null,
          createdBy: userId,
          rowVersion: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }),
      ),
      findAllBySupplier: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findById: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      softDelete: jest.fn().mockResolvedValue({}),
    };

    mockGlEngine = {
      post: jest.fn().mockResolvedValue({ id: 'journal-1', entryNumber: 1, status: 'POSTED', totalDebit: '50000', totalCredit: '50000' }),
    };

    mockDocSeq = {
      nextNumber: jest.fn().mockResolvedValue(1),
    };

    mockCompanies = {
      getBaseCurrency: jest.fn().mockResolvedValue('KZT'),
    };

    // G3-3: audit log mock.
    mockAuditLog = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    // G3-1: idempotency mock. Default reserve() creates a fresh reservation,
    // so `work` runs inside the (mocked) transaction — legacy behaviour.
    mockIdempotency = {
      hashRequest: jest.fn().mockReturnValue('hash-1'),
      reserve: jest
        .fn()
        .mockResolvedValue({ type: 'created', requestHash: 'hash-1' }),
      complete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: CompaniesService, useValue: mockCompanies },
        SupplierPaymentsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SuppliersRepository, useValue: mockSuppliersRepo },
        { provide: SupplierPaymentsRepository, useValue: mockPaymentsRepo },
        { provide: GlEngineService, useValue: mockGlEngine },
        { provide: DocumentSequenceService, useValue: mockDocSeq },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: IdempotencyService, useValue: mockIdempotency },
      ],
    }).compile();

    service = module.get<SupplierPaymentsService>(SupplierPaymentsService);
  });

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  describe('create', () => {
    it('should create a CASH payment successfully (company KZT + invoice KZT, G3-9 #1)', async () => {
      const result = await service.create(
        supplierId,
        cashPaymentDto,
        userId,
        companyId,
      );

      expect(result).toBeDefined();
      expect(mockPaymentsRepo.create).toHaveBeenCalledTimes(1);

      // Payment row is recorded in company currency with the exact amount.
      const createData = mockPaymentsRepo.create.mock.calls[0][0];
      expect(createData.currency).toBe('KZT');
      expect(createData.amount).toBe('50000');
      expect(createData.paymentNumber).toBe('PAY-000001');
      expect(createData.method).toBe(PaymentMethod.CASH);

      // No idempotency key → legacy path: reservation layer untouched.
      expect(mockIdempotency.reserve).not.toHaveBeenCalled();
      expect(mockIdempotency.complete).not.toHaveBeenCalled();

      // Invoice mutation: paidAmount 0 -> 50000, status stays APPROVED.
      expect(mockPrisma.purchaseInvoice.updateMany).toHaveBeenCalledTimes(1);
      const updateCall = mockPrisma.purchaseInvoice.updateMany.mock.calls[0][0];
      expect(updateCall.data.paidAmount).toBe('50000');
      expect(updateCall.data.status).toBeUndefined();
    });

    it('should reject overpayment', async () => {
      await expect(
        service.create(
          supplierId,
          { ...cashPaymentDto, amount: 150000 },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
      expect(mockGlEngine.post).not.toHaveBeenCalled();
      expect(mockPrisma.purchaseInvoice.updateMany).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
    });

    it('should reject payment currency different from company currency (company KZT + payment RUB, G3-9 #3)', async () => {
      await expect(
        service.create(
          supplierId,
          { ...cashPaymentDto, currency: Currency.RUB },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);

      // G3-9 #4: rejected payment leaves no trace.
      expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
      expect(mockGlEngine.post).not.toHaveBeenCalled();
      expect(mockPrisma.purchaseInvoice.updateMany).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
    });

    it('should reject invoice currency different from company currency (company KZT + invoice RUB, G3-2/G3-9 #2)', async () => {
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        currency: 'RUB',
      });

      await expect(
        service.create(supplierId, cashPaymentDto, userId, companyId),
      ).rejects.toThrow(BadRequestException);

      // G3-9 #4: no payment, no GL, no paidAmount mutation, no audit.
      expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
      expect(mockGlEngine.post).not.toHaveBeenCalled();
      expect(mockPrisma.purchaseInvoice.updateMany).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
    });

    it('should reject CASH without cashAccountId', async () => {
      await expect(
        service.create(
          supplierId,
          { ...cashPaymentDto, cashAccountId: undefined },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
      expect(mockGlEngine.post).not.toHaveBeenCalled();
    });

    it('should reject BANK_TRANSFER without bankAccountId', async () => {
      await expect(
        service.create(
          supplierId,
          {
            purchaseInvoiceId: invoiceId,
            amount: 50000,
            method: PaymentMethod.BANK_TRANSFER,
          },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject payment for DRAFT invoice', async () => {
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        status: 'DRAFT' as any,
      });

      await expect(
        service.create(supplierId, cashPaymentDto, userId, companyId),
      ).rejects.toThrow(BadRequestException);
      expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
      expect(mockGlEngine.post).not.toHaveBeenCalled();
    });

    it('should mark invoice as PAID when fully paid', async () => {
      const result = await service.create(
        supplierId,
        { ...cashPaymentDto, amount: 100000 },
        userId,
        companyId,
      );

      expect(result).toBeDefined();
      const updateCall = mockPrisma.purchaseInvoice.updateMany.mock.calls[0][0];
      expect(updateCall.data.paidAmount).toBe('100000');
      expect(updateCall.data.status).toBe(PurchaseInvoiceStatus.PAID);
    });

    it('should reject if supplier not found', async () => {
      mockSuppliersRepo.findById.mockResolvedValue(null);

      await expect(
        service.create(supplierId, cashPaymentDto, userId, companyId),
      ).rejects.toThrow(NotFoundException);
      expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
      expect(mockGlEngine.post).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // VOID
  // ─────────────────────────────────────────────

  describe('void', () => {
    it('should void payment and create reversal journal (G3-5: Dr Cash / Cr AP + referenceType)', async () => {
      mockPaymentsRepo.findById.mockResolvedValue({ ...voidedPaymentRow });
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        paidAmount: new Decimal('50000'),
      });

      await service.void(paymentId, supplierId, companyId, userId);

      expect(mockPaymentsRepo.softDelete).toHaveBeenCalledTimes(1);
      expect(mockGlEngine.post).toHaveBeenCalledTimes(1);
      expect(mockPrisma.purchaseInvoice.updateMany).toHaveBeenCalledTimes(1);

      // G3-5: reversal journal — Dr Cash/Bank / Cr AP, referenceType
      // SUPPLIER_PAYMENT_REVERSAL, referenceId = payment id.
      const journalCall = mockGlEngine.post.mock.calls[0][0];
      expect(journalCall.referenceType).toBe('SUPPLIER_PAYMENT_REVERSAL');
      expect(journalCall.referenceId).toBe(paymentId);
      expect(journalCall.companyId).toBe(companyId);
      expect(journalCall.createdBy).toBe(userId);
      expect(journalCall.lines[0].debit).toBe('50000');
      expect(journalCall.lines[0].credit).toBe('0');
      expect(journalCall.lines[1].debit).toBe('0');
      expect(journalCall.lines[1].credit).toBe('50000');

      // G3-3: VOIDED audit in the same transaction.
      expect(mockAuditLog.log).toHaveBeenCalledTimes(1);
      const auditCall = mockAuditLog.log.mock.calls[0][0];
      expect(auditCall.companyId).toBe(companyId);
      expect(auditCall.userId).toBe(userId);
      expect(auditCall.entityType).toBe('SupplierPayment');
      expect(auditCall.entityId).toBe(paymentId);
      expect(auditCall.action).toBe('VOIDED');
      expect(auditCall.before.paidAmountBefore).toBe('50000');
      expect(auditCall.after.paidAmountAfter).toBe('0');
    });

    it('should reject void of non-existent payment', async () => {
      mockPaymentsRepo.findById.mockResolvedValue(null);

      await expect(
        service.void(paymentId, supplierId, companyId, userId),
      ).rejects.toThrow(NotFoundException);
      expect(mockPaymentsRepo.softDelete).not.toHaveBeenCalled();
      expect(mockGlEngine.post).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
    });

    it('should restore invoice to APPROVED after full payment void', async () => {
      mockPaymentsRepo.findById.mockResolvedValue({
        ...voidedPaymentRow,
        amount: new Decimal('100000'),
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

    it('should reject void when paidAmount would become negative', async () => {
      mockPaymentsRepo.findById.mockResolvedValue({ ...voidedPaymentRow });
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        paidAmount: new Decimal('30000'),
      });

      await expect(
        service.void(paymentId, supplierId, companyId, userId),
      ).rejects.toThrow(BadRequestException);
      expect(mockPaymentsRepo.softDelete).toHaveBeenCalledTimes(1);
      expect(mockGlEngine.post).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // PATCH
  // ─────────────────────────────────────────────

  describe('patch (G3-4/G3-11 optimistic locking)', () => {
    it('should update notes and reference with correct rowVersion (G3-11 #1)', async () => {
      mockPaymentsRepo.findById.mockResolvedValue({ ...voidedPaymentRow });
      mockPaymentsRepo.update.mockResolvedValue({
        ...voidedPaymentRow,
        rowVersion: 1,
        notes: 'Updated note',
        reference: 'REF-002',
      });

      const result = await service.patch(paymentId, supplierId, companyId, {
        rowVersion: 0,
        notes: 'Updated note',
        reference: 'REF-002',
      });

      expect(result).toBeDefined();
      // G3-11 #2: repo update received the DTO rowVersion.
      expect(mockPaymentsRepo.update).toHaveBeenCalledWith(
        paymentId,
        supplierId,
        companyId,
        0,
        expect.objectContaining({ notes: 'Updated note', reference: 'REF-002' }),
      );
    });

    it('should reject patch with stale rowVersion (G3-11 #3)', async () => {
      mockPaymentsRepo.findById.mockResolvedValue({ ...voidedPaymentRow });
      // Repo CAS fails — the stored rowVersion no longer matches.
      mockPaymentsRepo.update.mockRejectedValue(
        new ConflictException(
          'Supplier payment was modified by another user. Please refresh and retry.',
        ),
      );

      await expect(
        service.patch(paymentId, supplierId, companyId, {
          rowVersion: 0,
          reference: 'REF-STALE',
        }),
      ).rejects.toThrow(ConflictException);
      // G3-11 #4: stale PATCH never returns mutated data.
      expect(mockPaymentsRepo.update).toHaveBeenCalledTimes(1);
    });

    it('should reject patch of non-existent payment (G3-11 #5)', async () => {
      mockPaymentsRepo.findById.mockResolvedValue(null);

      await expect(
        service.patch(paymentId, supplierId, companyId, {
          rowVersion: 0,
          notes: 'test',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPaymentsRepo.update).not.toHaveBeenCalled();
    });

    it('should reject patch of payment from another tenant (G3-11 #5)', async () => {
      // findById is scoped (id + supplierId + companyId) — a cross-tenant
      // payment is indistinguishable from a non-existent one.
      mockPaymentsRepo.findById.mockResolvedValue(null);

      await expect(
        service.patch(paymentId, supplierBId, companyBId, {
          rowVersion: 0,
          notes: 'test',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPaymentsRepo.update).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // GL POSTING — CREATE (G3-5)
  // ─────────────────────────────────────────────

  describe('GL posting on create (G3-5)', () => {
    it('should post journal Dr AP / Cr Cash with substantial parameters (CASH)', async () => {
      await service.create(supplierId, cashPaymentDto, userId, companyId);

      expect(mockGlEngine.post).toHaveBeenCalledTimes(1);
      const journalCall = mockGlEngine.post.mock.calls[0][0];

      // Dr AP (2100), Cr Cash chart account.
      expect(journalCall.lines[0].accountId).toBe(apAccountId);
      expect(journalCall.lines[0].debit).toBe('50000');
      expect(journalCall.lines[0].credit).toBe('0');
      expect(journalCall.lines[1].debit).toBe('0');
      expect(journalCall.lines[1].credit).toBe('50000');
      expect(journalCall.lines[1].accountId).toBe(cashChartAccountId);

      // Source document + invocation parameters.
      expect(journalCall.referenceType).toBe('SUPPLIER_PAYMENT');
      expect(journalCall.referenceId).toBe(paymentId);
      expect(journalCall.companyId).toBe(companyId);
      expect(journalCall.createdBy).toBe(userId);
      expect(journalCall.financialPeriodId).toBe('period-1');
      expect(journalCall.description).toContain('PAY-000001');

      // Document sequence consumed inside the same transaction.
      expect(mockDocSeq.nextNumber).toHaveBeenCalledWith(
        companyId,
        'SUPPLIER_PAYMENT',
        mockPrisma,
      );
    });

    it('should post journal Cr Bank chart account for BANK_TRANSFER', async () => {
      mockPrisma.bankAccount.findFirst.mockResolvedValue({
        chartOfAccountId: bankChartAccountId,
      });

      await service.create(
        supplierId,
        {
          purchaseInvoiceId: invoiceId,
          amount: 70000,
          method: PaymentMethod.BANK_TRANSFER,
          bankAccountId,
        },
        userId,
        companyId,
      );

      const journalCall = mockGlEngine.post.mock.calls[0][0];
      expect(journalCall.lines[0].accountId).toBe(apAccountId);
      expect(journalCall.lines[0].debit).toBe('70000');
      expect(journalCall.lines[1].accountId).toBe(bankChartAccountId);
      expect(journalCall.lines[1].credit).toBe('70000');
      expect(journalCall.referenceType).toBe('SUPPLIER_PAYMENT');
      expect(journalCall.referenceId).toBe(paymentId);
    });

    it('should NOT post journal when create is rejected (currency mismatch)', async () => {
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        currency: 'RUB',
      });

      await expect(
        service.create(supplierId, cashPaymentDto, userId, companyId),
      ).rejects.toThrow(BadRequestException);
      expect(mockGlEngine.post).not.toHaveBeenCalled();
    });

    it('should NOT post journal when invoice CAS fails (concurrent modification)', async () => {
      mockPrisma.purchaseInvoice.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.create(supplierId, cashPaymentDto, userId, companyId),
      ).rejects.toThrow(ConflictException);
      expect(mockPaymentsRepo.create).toHaveBeenCalledTimes(1);
      expect(mockGlEngine.post).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
    });

    it('should write CREATED audit with full operation context (G3-3/G3-10)', async () => {
      await service.create(supplierId, cashPaymentDto, userId, companyId);

      expect(mockAuditLog.log).toHaveBeenCalledTimes(1);
      const auditCall = mockAuditLog.log.mock.calls[0][0];
      expect(auditCall.companyId).toBe(companyId);
      expect(auditCall.userId).toBe(userId);
      expect(auditCall.entityType).toBe('SupplierPayment');
      expect(auditCall.entityId).toBe(paymentId);
      expect(auditCall.action).toBe('CREATED');
      expect(auditCall.before).toBeNull();
      expect(auditCall.after.paymentNumber).toBe('PAY-000001');
      expect(auditCall.after.supplierId).toBe(supplierId);
      expect(auditCall.after.purchaseInvoiceId).toBe(invoiceId);
      expect(auditCall.after.amount).toBe('50000');
      expect(auditCall.after.currency).toBe('KZT');
      expect(auditCall.after.method).toBe(PaymentMethod.CASH);
    });
  });

  // ─────────────────────────────────────────────
  // IDEMPOTENCY (G3-1 / G3-8)
  // ─────────────────────────────────────────────

  describe('idempotency (G3-1/G3-8)', () => {
    const idempotencyKey = 'key-K';

    it('should route keyed POST through reserve/complete (G3-8 Test 1: first POST creates payment)', async () => {
      const result = await service.create(
        supplierId,
        cashPaymentDto,
        userId,
        companyId,
        idempotencyKey,
      );

      expect(result).toBeDefined();
      expect(mockPaymentsRepo.create).toHaveBeenCalledTimes(1);
      // Reservation created inside the same transaction, then completed.
      expect(mockIdempotency.reserve).toHaveBeenCalledTimes(1);
      expect(mockIdempotency.reserve.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          companyId,
          idempotencyKey,
          endpoint: 'supplier-payment-create',
          requestHash: 'hash-1',
        }),
      );
      expect(mockIdempotency.complete).toHaveBeenCalledWith(
        mockPrisma,
        companyId,
        idempotencyKey,
        201,
        expect.objectContaining({ id: paymentId }),
      );
    });

    it('should replay stored response for the same key (G3-8 Test 2/3: no second payment)', async () => {
      mockIdempotency.reserve.mockResolvedValue({
        type: 'replayed',
        status: 201,
        body: { id: paymentId, paymentNumber: 'PAY-000001', amount: '50000' },
      });

      const result = await service.create(
        supplierId,
        cashPaymentDto,
        userId,
        companyId,
        idempotencyKey,
      );

      // Replay semantics: stored body returned, business `work` NOT re-run.
      expect(result).toEqual(
        expect.objectContaining({ id: paymentId, paymentNumber: 'PAY-000001' }),
      );
      expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
      expect(mockPrisma.purchaseInvoice.updateMany).not.toHaveBeenCalled();
      expect(mockGlEngine.post).not.toHaveBeenCalled();
      expect(mockAuditLog.log).not.toHaveBeenCalled();
      expect(mockIdempotency.complete).not.toHaveBeenCalled();
    });

    it('should throw 409 when another request holds the reservation (G3-8 Test 3)', async () => {
      mockIdempotency.reserve.mockResolvedValue({ type: 'pending' });

      await expect(
        service.create(
          supplierId,
          cashPaymentDto,
          userId,
          companyId,
          idempotencyKey,
        ),
      ).rejects.toThrow(ConflictException);
      expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
      expect(mockGlEngine.post).not.toHaveBeenCalled();
      expect(mockIdempotency.complete).not.toHaveBeenCalled();
    });

    it('should scope the key by tenant — Company A key does not replay for Company B (G3-8 Test 4)', async () => {
      await service.create(
        supplierId,
        cashPaymentDto,
        userId,
        companyId,
        idempotencyKey,
      );
      // Company A: reserve() received Company A's companyId.
      expect(mockIdempotency.reserve.mock.calls[0][1].companyId).toBe(companyId);

      // Company B replay path: same key, reservation scoped to Company B.
      mockIdempotency.reserve.mockClear();
      mockIdempotency.reserve.mockResolvedValue({
        type: 'replayed',
        status: 201,
        body: { id: 'company-b-payment' },
      });
      mockSuppliersRepo.findById.mockResolvedValue({
        ...baseSupplier,
        id: supplierBId,
        companyId: companyBId,
      });

      await service.create(
        supplierBId,
        cashPaymentDto,
        userId,
        companyBId,
        idempotencyKey,
      );

      expect(mockIdempotency.reserve.mock.calls[0][1].companyId).toBe(companyBId);
    });

    it('should not persist reservation when `work` throws (G3-8 Test 5: rollback semantics)', async () => {
      // Business failure: invoice CAS conflict inside `work`.
      mockPrisma.purchaseInvoice.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.create(
          supplierId,
          cashPaymentDto,
          userId,
          companyId,
          idempotencyKey,
        ),
      ).rejects.toThrow(ConflictException);

      // Reservation was created (inside the tx) but complete() was never
      // reached — in the real transaction both roll back together.
      expect(mockIdempotency.reserve).toHaveBeenCalledTimes(1);
      expect(mockIdempotency.complete).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // CONCURRENCY (G3-6)
  // ─────────────────────────────────────────────

  describe('concurrency (G3-6: 70k + 70k against outstanding 100k)', () => {
    it('should allow the first payment and reject the second with 409 (full rollback)', async () => {
      // Payment A: 70000 against paidAmount 0 → CAS succeeds.
      mockPrisma.purchaseInvoice.updateMany.mockResolvedValueOnce({ count: 1 });

      const paymentA = await service.create(
        supplierId,
        { ...cashPaymentDto, amount: 70000 },
        userId,
        companyId,
      );
      expect(paymentA).toBeDefined();

      // Payment B: concurrent — the stored invoice rowVersion no longer
      // matches, CAS returns count 0 → 409 and full rollback.
      mockPrisma.purchaseInvoice.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.create(
          supplierId,
          { ...cashPaymentDto, amount: 70000 },
          userId,
          companyId,
        ),
      ).rejects.toThrow(ConflictException);

      // Payment B: create attempted inside its (rolled back) transaction.
      expect(mockPaymentsRepo.create).toHaveBeenCalledTimes(2);
      expect(mockGlEngine.post).toHaveBeenCalledTimes(1); // only payment A
      expect(mockAuditLog.log).toHaveBeenCalledTimes(1); // only payment A

      // Payment A CAS: paidAmount 0 -> 70000 with rowVersion check.
      const casA = mockPrisma.purchaseInvoice.updateMany.mock.calls[0][0];
      expect(casA.where.rowVersion).toBe(1);
      expect(casA.data.paidAmount).toBe('70000');
    });

    it('should reject the second payment before any write when overpayment (sequential 70k + 70k)', async () => {
      // First payment 70k: paidAmount 0 -> 70000.
      mockPrisma.purchaseInvoice.updateMany.mockResolvedValueOnce({ count: 1 });

      await service.create(
        supplierId,
        { ...cashPaymentDto, amount: 70000 },
        userId,
        companyId,
      );

      // Second payment 70k: CAS reads paidAmount 70000 → 140000 > 100000
      // → 400 before the payment row is created.
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        paidAmount: new Decimal('70000'),
      });
      mockPrisma.purchaseInvoice.updateMany.mockResolvedValueOnce({ count: 1 });

      await expect(
        service.create(
          supplierId,
          { ...cashPaymentDto, amount: 70000 },
          userId,
          companyId,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockPaymentsRepo.create).toHaveBeenCalledTimes(1);
      expect(mockGlEngine.post).toHaveBeenCalledTimes(1);
      expect(mockAuditLog.log).toHaveBeenCalledTimes(1);

      // Final state: paidAmount = 70000, outstanding = 30000.
      const casA = mockPrisma.purchaseInvoice.updateMany.mock.calls[0][0];
      expect(casA.data.paidAmount).toBe('70000');
    });
  });

  // ─────────────────────────────────────────────
  // TENANT ISOLATION (G3-7)
  // ─────────────────────────────────────────────

  describe('tenant isolation (G3-7)', () => {
    it('should reject Company A creating a payment for Supplier B', async () => {
      // Supplier lookup is scoped (id + companyId) → Supplier B not found
      // for Company A.
      mockSuppliersRepo.findById.mockResolvedValue(null);

      await expect(
        service.create(supplierBId, cashPaymentDto, userId, companyId),
      ).rejects.toThrow(NotFoundException);
      expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
      expect(mockGlEngine.post).not.toHaveBeenCalled();
    });

    it('should reject Company A creating a payment for Invoice B', async () => {
      // Invoice lookup is scoped (id + companyId + supplierId) → Invoice B
      // not found for Company A.
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(null);

      await expect(
        service.create(supplierId, cashPaymentDto, userId, companyId),
      ).rejects.toThrow(NotFoundException);
      expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
      expect(mockGlEngine.post).not.toHaveBeenCalled();
      expect(mockPrisma.purchaseInvoice.updateMany).not.toHaveBeenCalled();
    });

    it('should scope the invoice CAS by companyId (no cross-tenant paidAmount mutation)', async () => {
      await service.create(supplierId, cashPaymentDto, userId, companyId);

      const casCall = mockPrisma.purchaseInvoice.updateMany.mock.calls[0][0];
      expect(casCall.where.companyId).toBe(companyId);
      expect(casCall.where.id).toBe(invoiceId);
      expect(casCall.where.rowVersion).toBe(1);
    });

    it('should scope the GL journal and idempotency reservation by companyId', async () => {
      await service.create(
        supplierId,
        cashPaymentDto,
        userId,
        companyId,
        'key-K',
      );

      expect(mockGlEngine.post.mock.calls[0][0].companyId).toBe(companyId);
      expect(mockIdempotency.reserve.mock.calls[0][1].companyId).toBe(companyId);
      expect(mockAuditLog.log.mock.calls[0][0].companyId).toBe(companyId);
    });

    it('should reject Company A voiding Payment B (tenant-scoped findById)', async () => {
      mockPaymentsRepo.findById.mockResolvedValue(null);

      await expect(
        service.void(paymentId, supplierBId, companyBId, userId),
      ).rejects.toThrow(NotFoundException);
      expect(mockPaymentsRepo.softDelete).not.toHaveBeenCalled();
      expect(mockGlEngine.post).not.toHaveBeenCalled();
    });

    it('should scope void softDelete and restore CAS by tenant', async () => {
      mockPaymentsRepo.findById.mockResolvedValue({ ...voidedPaymentRow });
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        paidAmount: new Decimal('50000'),
      });

      await service.void(paymentId, supplierId, companyId, userId);

      // softDelete CAS is scoped (id + supplierId + companyId).
      const softDeleteCall = mockPaymentsRepo.softDelete.mock.calls[0];
      expect(softDeleteCall[0]).toBe(paymentId);
      expect(softDeleteCall[1]).toBe(supplierId);
      expect(softDeleteCall[2]).toBe(companyId);
      // Void restore CAS is scoped by companyId.
      const casCall = mockPrisma.purchaseInvoice.updateMany.mock.calls[0][0];
      expect(casCall.where.companyId).toBe(companyId);
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
      // GAP-1: explicit company base currency label on the finance summary
      expect(result).toHaveProperty('currency');
      expect(result.currency).toBe('KZT');
    });

    it('should throw for non-existent supplier', async () => {
      mockSuppliersRepo.findById.mockResolvedValue(null);

      await expect(
        service.getFinanceSummary(supplierId, companyId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
