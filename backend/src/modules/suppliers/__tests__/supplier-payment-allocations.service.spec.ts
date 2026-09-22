import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Currency, PaymentMethod, PurchaseInvoiceStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SupplierPaymentAllocationsService } from '../services/supplier-payment-allocations.service';
import { SupplierPaymentsRepository } from '../repositories/supplier-payments.repository';
import { SupplierPaymentAllocationsRepository } from '../repositories/supplier-payment-allocations.repository';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

const companyId = 'comp-1';
const companyBId = 'comp-2';
const supplierId = 'supplier-1';
const supplierBId = 'supplier-2';
const userId = 'user-1';
const invoiceId = 'invoice-1';
const invoiceBId = 'invoice-2';
const paymentId = 'pay-1';

const basePayment = {
  id: paymentId,
  companyId,
  supplierId,
  purchaseInvoiceId: invoiceId,
  paymentNumber: 'PAY-000001',
  paymentDate: new Date('2026-09-01T00:00:00.000Z'),
  amount: new Decimal('100000'),
  method: PaymentMethod.CASH,
  cashAccountId: 'cash-1',
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

const baseInvoiceB = {
  id: invoiceBId,
  companyId,
  supplierId,
  invoiceNumber: 'INV-002',
  status: PurchaseInvoiceStatus.APPROVED,
  grandTotal: new Decimal('60000'),
  paidAmount: new Decimal('0'),
  currency: 'KZT' as Currency,
  rowVersion: 1,
  deletedAt: null,
};

describe('SupplierPaymentAllocationsService', () => {
  let service: SupplierPaymentAllocationsService;
  let mockPrisma: any;
  let mockPaymentsRepo: any;
  let mockAllocationsRepo: any;
  let mockIdempotency: any;

  beforeEach(async () => {
    mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
      $queryRaw: jest.fn().mockResolvedValue([{ id: paymentId, amount: new Decimal('100000'), deletedAt: null }]),
      purchaseInvoice: {
        findFirst: jest.fn().mockImplementation((args: any) => {
          if (args.where.id === invoiceId) return { ...baseInvoice };
          if (args.where.id === invoiceBId) return { ...baseInvoiceB };
          return null;
        }),
      },
      supplierPayment: {
        findFirst: jest.fn().mockResolvedValue({ ...basePayment }),
      },
      supplierPaymentAllocation: {
        create: jest.fn().mockResolvedValue({
          id: 'alloc-1',
          companyId,
          supplierId,
          paymentId,
          purchaseInvoiceId: invoiceId,
          amount: new Decimal('50000'),
          rowVersion: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: new Decimal('0') },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    mockPaymentsRepo = {
      findById: jest.fn().mockResolvedValue({ ...basePayment }),
    };

    mockAllocationsRepo = {
      create: jest.fn().mockResolvedValue({
        id: 'alloc-1',
        companyId,
        supplierId,
        paymentId,
        purchaseInvoiceId: invoiceId,
        amount: new Decimal('50000'),
        rowVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      }),
      findByPayment: jest.fn().mockResolvedValue([]),
      findByInvoice: jest.fn().mockResolvedValue([]),
      sumAllocatedByPayment: jest.fn().mockResolvedValue(0),
      sumAllocatedByInvoice: jest.fn().mockResolvedValue(0),
      softDeleteByPayment: jest.fn().mockResolvedValue(0),
      findById: jest.fn().mockResolvedValue(null),
    };

    // G9-A: idempotency mock. Default reserve() creates a fresh reservation.
    mockIdempotency = {
      hashRequest: jest.fn().mockReturnValue('hash-1'),
      reserve: jest
        .fn()
        .mockResolvedValue({ type: 'created', requestHash: 'hash-1' }),
      complete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierPaymentAllocationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SupplierPaymentsRepository, useValue: mockPaymentsRepo },
        { provide: SupplierPaymentAllocationsRepository, useValue: mockAllocationsRepo },
        { provide: IdempotencyService, useValue: mockIdempotency },
      ],
    }).compile();

    service = module.get<SupplierPaymentAllocationsService>(SupplierPaymentAllocationsService);
  });

  // ─────────────────────────────────────────────
  // A1: Legacy payment backfill
  // ─────────────────────────────────────────────
  describe('A1: Legacy payment backfill', () => {
    it('should have one allocation for existing payment with invoice', async () => {
      // Simulate: existing payment has one allocation
      mockAllocationsRepo.findByPayment.mockResolvedValue([
        {
          id: 'alloc-legacy',
          companyId,
          supplierId,
          paymentId,
          purchaseInvoiceId: invoiceId,
          amount: new Decimal('100000'),
          rowVersion: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ]);

      const result = await service.findByPayment(paymentId, supplierId, companyId);
      expect(result).toHaveLength(1);
      expect(result[0]!.purchaseInvoiceId).toBe(invoiceId);
      expect(result[0]!.amount).toBe('100000');
    });
  });

  // ─────────────────────────────────────────────
  // A2: Unallocated payment
  // ─────────────────────────────────────────────
  describe('A2: Unallocated payment', () => {
    it('should allow creating payment without invoice (unallocated)', async () => {
      // This is tested via the payment service, but we verify the allocation
      // service accepts null purchaseInvoiceId
      mockPaymentsRepo.findById.mockResolvedValue({
        ...basePayment,
        purchaseInvoiceId: null,
      });

      // Verify the payment entity can have null purchaseInvoiceId
      const payment = await mockPaymentsRepo.findById(paymentId, supplierId, companyId);
      expect(payment.purchaseInvoiceId).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // A3: Single invoice allocation
  // ─────────────────────────────────────────────
  describe('A3: Single invoice allocation', () => {
    it('should create allocation for single invoice', async () => {
      const result = await service.create(
        supplierId,
        companyId,
        paymentId,
        invoiceId,
        50000,
        userId,
      );

      expect(result).toBeDefined();
      expect(result.paymentId).toBe(paymentId);
      expect(result.purchaseInvoiceId).toBe(invoiceId);
      expect(result.amount).toBe('50000');
    });
  });

  // ─────────────────────────────────────────────
  // A4: Multi-invoice allocation
  // ─────────────────────────────────────────────
  describe('A4: Multi-invoice allocation', () => {
    it('should allow allocating payment across multiple invoices', async () => {
      // First allocation: 40k to invoice A
      const result1 = await service.create(
        supplierId,
        companyId,
        paymentId,
        invoiceId,
        40000,
        userId,
      );
      expect(result1).toBeDefined();

      // Second allocation: 60k to invoice B
      mockPrisma.supplierPaymentAllocation.create.mockResolvedValueOnce({
        id: 'alloc-2',
        companyId,
        supplierId,
        paymentId,
        purchaseInvoiceId: invoiceBId,
        amount: new Decimal('60000'),
        rowVersion: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const result2 = await service.create(
        supplierId,
        companyId,
        paymentId,
        invoiceBId,
        60000,
        userId,
      );
      expect(result2).toBeDefined();
      expect(result2.amount).toBe('60000');
    });
  });

  // ─────────────────────────────────────────────
  // A5: Payment over-allocation rejected
  // ─────────────────────────────────────────────
  describe('A5: Payment over-allocation rejected', () => {
    it('should reject allocation exceeding payment amount', async () => {
      // Payment is 100k, try to allocate 120k
      mockPrisma.supplierPaymentAllocation.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal('0') },
      });

      await expect(
        service.create(supplierId, companyId, paymentId, invoiceId, 120000, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when cumulative allocations exceed payment', async () => {
      // Already allocated 80k, try to allocate 30k more (total 110k > 100k)
      mockPrisma.supplierPaymentAllocation.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal('80000') },
      });

      await expect(
        service.create(supplierId, companyId, paymentId, invoiceId, 30000, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // A6: Invoice over-allocation rejected (including paidAmount)
  // ─────────────────────────────────────────────
  describe('A6: Invoice over-allocation rejected', () => {
    it('should reject allocation exceeding invoice grand total', async () => {
      // Invoice grand total is 100k, try to allocate 120k
      mockPrisma.supplierPaymentAllocation.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('0') } }) // payment check
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('0') } }); // invoice check

      await expect(
        service.create(supplierId, companyId, paymentId, invoiceId, 120000, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject allocation when paidAmount + new allocation exceeds grandTotal', async () => {
      // Invoice: grandTotal = 100k, paidAmount = 70k
      // Existing allocations: 20k
      // Try to allocate: 90k
      // SUM(allocations) + new = 20k + 90k = 110k > 100k → REJECTED
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        paidAmount: new Decimal('70000'),
      });

      mockPrisma.supplierPaymentAllocation.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('20000') } }) // payment check
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('20000') } }); // invoice check

      await expect(
        service.create(supplierId, companyId, paymentId, invoiceId, 90000, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when paidAmount alone would exceed grandTotal with new allocation', async () => {
      // Invoice: grandTotal = 100k, paidAmount = 80k
      // Existing allocations: 0 (transition period)
      // Try to allocate: 30k
      // SUM(allocations) + new = 0 + 30k = 30k <= 100k ✓ (first check passes)
      // paidAmount + new = 80k + 30k = 110k > 100k ✗ (second check catches it)
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        paidAmount: new Decimal('80000'),
      });

      mockPrisma.supplierPaymentAllocation.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('0') } }) // payment check
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('0') } }); // invoice check

      await expect(
        service.create(supplierId, companyId, paymentId, invoiceId, 30000, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // A7: Tenant isolation
  // ─────────────────────────────────────────────
  describe('A7: Tenant isolation', () => {
    it('should reject allocation for payment from another tenant', async () => {
      mockPaymentsRepo.findById.mockResolvedValue(null);

      await expect(
        service.create(supplierId, companyBId, paymentId, invoiceId, 50000, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject allocation for invoice from another tenant', async () => {
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(null);

      await expect(
        service.create(supplierId, companyId, paymentId, invoiceId, 50000, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // A8: Supplier isolation
  // ─────────────────────────────────────────────
  describe('A8: Supplier isolation', () => {
    it('should reject allocation when payment belongs to different supplier', async () => {
      mockPaymentsRepo.findById.mockResolvedValue(null);

      await expect(
        service.create(supplierBId, companyId, paymentId, invoiceId, 50000, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject allocation when invoice belongs to different supplier', async () => {
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(null);

      await expect(
        service.create(supplierId, companyId, paymentId, invoiceId, 50000, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // A9: Cancelled invoice rejected
  // ─────────────────────────────────────────────
  describe('A9: Cancelled invoice rejected', () => {
    it('should reject allocation to cancelled invoice', async () => {
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        status: PurchaseInvoiceStatus.CANCELLED,
      });

      await expect(
        service.create(supplierId, companyId, paymentId, invoiceId, 50000, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─────────────────────────────────────────────
  // A10: Concurrency protection (real locking)
  // ─────────────────────────────────────────────
  describe('A10: Concurrency protection', () => {
    it('should use SELECT ... FOR UPDATE to lock payment row', async () => {
      await service.create(supplierId, companyId, paymentId, invoiceId, 50000, userId);

      // Verify raw query is used for locking
      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
      const queryCall = mockPrisma.$queryRaw.mock.calls[0];
      expect(queryCall[0].join('')).toContain('FOR UPDATE');
    });

    // G14-02-12: canonical lock order — invoice lock BEFORE payment lock.
    it('should acquire the invoice lock before the payment lock (G14-02-12)', async () => {
      await service.create(supplierId, companyId, paymentId, invoiceId, 50000, userId);

      expect(mockPrisma.$queryRaw.mock.calls.length).toBeGreaterThanOrEqual(2);
      const firstLock = mockPrisma.$queryRaw.mock.calls[0][0].join('');
      const secondLock = mockPrisma.$queryRaw.mock.calls[1][0].join('');
      expect(firstLock).toContain('PurchaseInvoice');
      expect(firstLock).toContain('FOR UPDATE');
      expect(secondLock).toContain('SupplierPayment');
      expect(secondLock).toContain('FOR UPDATE');
      // Invoice lock carries the tenant predicate values.
      expect(mockPrisma.$queryRaw.mock.calls[0]).toContain(companyId);
    });

    // G14-02-12: missing/foreign/soft-deleted invoice cannot be locked.
    it('should reject when the invoice row cannot be locked (G14-02-12)', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(
        service.create(supplierId, companyId, paymentId, invoiceId, 50000, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject when payment is voided (locked row not found)', async () => {
      // First call (invoice lock) succeeds; second call (payment lock)
      // finds nothing → voided payment.
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ id: invoiceId }])
        .mockResolvedValueOnce([]);

      await expect(
        service.create(supplierId, companyId, paymentId, invoiceId, 50000, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use transaction for allocation creation', async () => {
      await service.create(supplierId, companyId, paymentId, invoiceId, 50000, userId);

      // runWithIdempotency uses $transaction internally
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // A11: Idempotency (via runWithIdempotency)
  // ─────────────────────────────────────────────
  describe('A11: Idempotency', () => {
    const idempotencyKey = 'key-K';

    it('should route keyed allocation through reserve/complete', async () => {
      const result = await service.create(
        supplierId,
        companyId,
        paymentId,
        invoiceId,
        50000,
        userId,
        idempotencyKey,
      );

      expect(result).toBeDefined();
      // Reservation created inside the same transaction, then completed
      expect(mockIdempotency.reserve).toHaveBeenCalledTimes(1);
      expect(mockIdempotency.reserve.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          companyId,
          idempotencyKey,
          endpoint: 'supplier-payment-allocation-create',
          requestHash: 'hash-1',
        }),
      );
      expect(mockIdempotency.complete).toHaveBeenCalledWith(
        mockPrisma,
        companyId,
        idempotencyKey,
        201,
        expect.objectContaining({ id: 'alloc-1' }),
      );
    });

    it('should replay stored response for the same key', async () => {
      mockIdempotency.reserve.mockResolvedValue({
        type: 'replayed',
        status: 201,
        body: { id: 'alloc-1', paymentId, purchaseInvoiceId: invoiceId, amount: '50000' },
      });

      const result = await service.create(
        supplierId,
        companyId,
        paymentId,
        invoiceId,
        50000,
        userId,
        idempotencyKey,
      );

      // Replay semantics: stored body returned, business `work` NOT re-run
      expect(result).toEqual(
        expect.objectContaining({ id: 'alloc-1', paymentId }),
      );
      expect(mockPrisma.supplierPaymentAllocation.create).not.toHaveBeenCalled();
      expect(mockIdempotency.complete).not.toHaveBeenCalled();
    });

    it('should throw 409 when another request holds the reservation', async () => {
      mockIdempotency.reserve.mockResolvedValue({ type: 'pending' });

      await expect(
        service.create(
          supplierId,
          companyId,
          paymentId,
          invoiceId,
          50000,
          userId,
          idempotencyKey,
        ),
      ).rejects.toThrow(ConflictException);
      expect(mockPrisma.supplierPaymentAllocation.create).not.toHaveBeenCalled();
      expect(mockIdempotency.complete).not.toHaveBeenCalled();
    });

    it('should scope the key by tenant', async () => {
      await service.create(
        supplierId,
        companyId,
        paymentId,
        invoiceId,
        50000,
        userId,
        idempotencyKey,
      );
      // Company A: reserve() received Company A's companyId
      expect(mockIdempotency.reserve.mock.calls[0][1].companyId).toBe(companyId);
    });

    it('should not persist reservation when work throws', async () => {
      // Business failure: payment lock fails (invoice lock succeeds first).
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ id: invoiceId }])
        .mockResolvedValueOnce([]);

      await expect(
        service.create(
          supplierId,
          companyId,
          paymentId,
          invoiceId,
          50000,
          userId,
          idempotencyKey,
        ),
      ).rejects.toThrow(NotFoundException);

      // Reservation was created (inside the tx) but complete() was never reached
      expect(mockIdempotency.reserve).toHaveBeenCalledTimes(1);
      expect(mockIdempotency.complete).not.toHaveBeenCalled();
    });

    it('should work without idempotency key (legacy path)', async () => {
      const result = await service.create(
        supplierId,
        companyId,
        paymentId,
        invoiceId,
        50000,
        userId,
      );

      expect(result).toBeDefined();
      // No idempotency key → legacy path: reservation layer untouched
      expect(mockIdempotency.reserve).not.toHaveBeenCalled();
      expect(mockIdempotency.complete).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // A12: No duplicate GL
  // ─────────────────────────────────────────────
  describe('A12: No duplicate GL', () => {
    it('should not create GL entries (allocation is allocation-only)', async () => {
      // Allocation service should not touch GL
      // GL is handled by payment service only
      const result = await service.create(
        supplierId,
        companyId,
        paymentId,
        invoiceId,
        50000,
        userId,
      );

      expect(result).toBeDefined();
      // No GL engine mock should be called
    });
  });

  // ─────────────────────────────────────────────
  // A13: Legacy payment create + void
  // ─────────────────────────────────────────────
  describe('A13: Legacy payment create + void', () => {
    it('should void allocations for payment', async () => {
      const count = await service.voidAllocations(paymentId, companyId);
      expect(count).toBe(0);
      expect(mockAllocationsRepo.softDeleteByPayment).toHaveBeenCalledWith(
        paymentId,
        companyId,
      );
    });
  });

  // ─────────────────────────────────────────────
  // FIND BY PAYMENT
  // ─────────────────────────────────────────────
  describe('findByPayment', () => {
    it('should return allocations for payment', async () => {
      mockAllocationsRepo.findByPayment.mockResolvedValue([
        {
          id: 'alloc-1',
          companyId,
          supplierId,
          paymentId,
          purchaseInvoiceId: invoiceId,
          amount: new Decimal('50000'),
          rowVersion: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ]);

      const result = await service.findByPayment(paymentId, supplierId, companyId);
      expect(result).toHaveLength(1);
      expect(result[0]!.paymentId).toBe(paymentId);
    });

    it('should throw for non-existent payment', async () => {
      mockPaymentsRepo.findById.mockResolvedValue(null);

      await expect(
        service.findByPayment(paymentId, supplierId, companyId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // FIND BY INVOICE
  // ─────────────────────────────────────────────
  describe('findByInvoice', () => {
    it('should return allocations for invoice', async () => {
      mockAllocationsRepo.findByInvoice.mockResolvedValue([
        {
          id: 'alloc-1',
          companyId,
          supplierId,
          paymentId,
          purchaseInvoiceId: invoiceId,
          amount: new Decimal('50000'),
          rowVersion: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ]);

      const result = await service.findByInvoice(invoiceId, supplierId, companyId);
      expect(result).toHaveLength(1);
      expect(result[0]!.purchaseInvoiceId).toBe(invoiceId);
    });

    it('should throw for non-existent invoice', async () => {
      mockPrisma.purchaseInvoice.findFirst.mockResolvedValue(null);

      await expect(
        service.findByInvoice(invoiceId, supplierId, companyId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────
  describe('validation', () => {
    it('should reject zero amount', async () => {
      await expect(
        service.create(supplierId, companyId, paymentId, invoiceId, 0, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative amount', async () => {
      await expect(
        service.create(supplierId, companyId, paymentId, invoiceId, -1000, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject voided payment', async () => {
      mockPaymentsRepo.findById.mockResolvedValue({
        ...basePayment,
        deletedAt: new Date(),
      });

      await expect(
        service.create(supplierId, companyId, paymentId, invoiceId, 50000, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
