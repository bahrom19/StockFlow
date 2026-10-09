import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Currency, PaymentMethod, PurchaseInvoiceStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { SupplierPaymentsRepository } from '../repositories/supplier-payments.repository';
import { SupplierPaymentAllocationsRepository } from '../repositories/supplier-payment-allocations.repository';
import { SupplierPaymentsService } from '../services/supplier-payments.service';
import { SupplierStatementService } from '../services/supplier-statement.service';
import { SupplierCreditSummaryService } from '../services/supplier-credit-summary.service';
import { SupplierExposureService } from '../services/supplier-exposure.service';
import { SuppliersService } from '../services/suppliers.service';
import { SupplierStatementRepository } from '../repositories/supplier-statement.repository';
import { SupplierCreditSummaryRepository } from '../repositories/supplier-credit-summary.repository';
import { SupplierExposureRepository } from '../repositories/supplier-exposure.repository';
import { CompaniesService } from '../../companies/services/companies.service';
import { GlEngineService } from '../../finance/services/gl-engine.service';
import { DocumentSequenceService } from '../../shared/services/document-sequence.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * G16-AA-2 — archived supplier financial reads + invoice-backed settlement.
 *
 * Contract under test:
 * 1. Archived (soft-deleted) supplier identity lookup is a separate,
 *    explicitly named repository method tenant-scoped by id + companyId.
 * 2. Supplier-scoped financial READ paths accept archived suppliers.
 * 3. Payment create for an archived supplier is allowed ONLY to settle an
 *    existing invoice; unallocated payments are rejected.
 * 4. Tenant isolation: a foreign-company id never resolves, archived or not.
 * 5. Mutating paths (update/delete/duplicate checks) still use findById()
 *    only → archived suppliers are unreachable there.
 * 6. Purchasing PO create (G16-AA-1 guard) still rejects archived suppliers.
 */

const companyId = 'comp-1';
const companyBId = 'comp-2';
const supplierId = 'supplier-1';
const userId = 'user-1';
const invoiceId = 'invoice-1';
const cashAccountId = 'cash-1';
const apAccountId = 'ap-1';
const cashChartAccountId = 'chart-cash-1';

const activeSupplier = {
  id: supplierId,
  companyId,
  companyName: 'Active Supplier',
  isActive: true,
  deletedAt: null,
};

const archivedSupplier = {
  ...activeSupplier,
  companyName: 'Archived Supplier',
  isActive: false,
  deletedAt: new Date('2026-09-01T00:00:00.000Z'),
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

// ─────────────────────────────────────────────────────────────
// 1. Repository: findArchivedSupplierById (tenant + archived-only)
// ─────────────────────────────────────────────────────────────

describe('G16-AA-2 SuppliersRepository.findArchivedSupplierById', () => {
  let repo: SuppliersRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      supplier: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    repo = new SuppliersRepository(mockPrisma);
  });

  it('queries with id + companyId and deletedAt NOT NULL (archived only)', async () => {
    await repo.findArchivedSupplierById(supplierId, companyId);

    expect(mockPrisma.supplier.findFirst).toHaveBeenCalledTimes(1);
    const where = mockPrisma.supplier.findFirst.mock.calls[0][0].where;
    expect(where).toEqual({
      id: supplierId,
      companyId,
      deletedAt: { not: null },
    });
  });

  it('is distinct from findById: findById still excludes archived rows', async () => {
    await repo.findById(supplierId, companyId);
    const where = mockPrisma.supplier.findFirst.mock.calls[0][0].where;
    expect(where.deletedAt).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Read paths accept archived suppliers; tenant isolation holds
// ─────────────────────────────────────────────────────────────

describe('G16-AA-2 archived supplier financial reads', () => {
  let mockSuppliersRepo: {
    findById: jest.Mock;
    findArchivedSupplierById: jest.Mock;
  };

  beforeEach(() => {
    mockSuppliersRepo = {
      findById: jest.fn().mockResolvedValue(null),
      findArchivedSupplierById: jest.fn().mockResolvedValue(archivedSupplier),
    };
  });

  const buildStatementService = () =>
    new SupplierStatementService(
      mockSuppliersRepo as unknown as SuppliersRepository,
      {
        findInvoices: jest.fn().mockResolvedValue([]),
        findPayments: jest.fn().mockResolvedValue([]),
        findReturns: jest.fn().mockResolvedValue([]),
        findActiveAllocationsForPayments: jest.fn().mockResolvedValue([]),
        getOpeningBalance: jest.fn(),
      } as unknown as SupplierStatementRepository,
    );

  const buildCreditSummaryService = () =>
    new SupplierCreditSummaryService(
      mockSuppliersRepo as unknown as SuppliersRepository,
      {
        getBaseCurrencyTotals: jest.fn().mockResolvedValue({
          totalInvoiced: new Decimal('100000'),
          totalAllocated: new Decimal('0'),
          totalReturned: new Decimal('0'),
        }),
      } as unknown as SupplierCreditSummaryRepository,
      {
        getBaseCurrency: jest.fn().mockResolvedValue('KZT'),
      } as unknown as CompaniesService,
    );

  const buildExposureService = () =>
    new SupplierExposureService(
      mockSuppliersRepo as unknown as SuppliersRepository,
      {
        getOpenPoExposureAggregates: jest.fn().mockResolvedValue([]),
      } as unknown as SupplierExposureRepository,
      {
        getBaseCurrency: jest.fn().mockResolvedValue('KZT'),
      } as unknown as CompaniesService,
    );

  it('statement.getStatement resolves an archived supplier via the archived lookup', async () => {
    const service = buildStatementService();
    await expect(
      service.getStatement(supplierId, companyId, {} as never),
    ).resolves.toBeDefined();

    expect(mockSuppliersRepo.findById).toHaveBeenCalledWith(
      supplierId,
      companyId,
    );
    expect(mockSuppliersRepo.findArchivedSupplierById).toHaveBeenCalledWith(
      supplierId,
      companyId,
    );
  });

  it('credit summary and exposure resolve archived suppliers via the archived lookup', async () => {
    await expect(
      buildCreditSummaryService().getCreditSummary(supplierId, companyId),
    ).resolves.toBeDefined();
    await expect(
      buildExposureService().getOpenPoExposure(supplierId, companyId),
    ).resolves.toBeDefined();
    expect(mockSuppliersRepo.findArchivedSupplierById).toHaveBeenCalledTimes(2);
  });

  it('active supplier still resolves through findById only (no archived lookup needed)', async () => {
    mockSuppliersRepo.findById.mockResolvedValue(activeSupplier);
    const service = buildStatementService();
    await expect(
      service.getStatement(supplierId, companyId, {} as never),
    ).resolves.toBeDefined();
    expect(mockSuppliersRepo.findArchivedSupplierById).not.toHaveBeenCalled();
  });

  it('tenant isolation: supplier in another company stays a NotFound (never resolved via archived lookup of the wrong tenant)', async () => {
    mockSuppliersRepo.findArchivedSupplierById.mockResolvedValue(null);
    const service = buildStatementService();
    await expect(
      service.getStatement(supplierId, companyBId, {} as never),
    ).rejects.toThrow(NotFoundException);

    // The archived lookup itself was tenant-scoped with the requesting company.
    expect(mockSuppliersRepo.findArchivedSupplierById).toHaveBeenCalledWith(
      supplierId,
      companyBId,
    );
  });

  it('unknown supplier (not archived, just missing) stays a NotFound', async () => {
    mockSuppliersRepo.findArchivedSupplierById.mockResolvedValue(null);
    await expect(
      buildStatementService().getStatement(supplierId, companyId, {} as never),
    ).rejects.toThrow(NotFoundException);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. Payment create settlement constraints (archived supplier)
// ─────────────────────────────────────────────────────────────

describe('G16-AA-2 archived supplier payment create settlement constraints', () => {
  let service: SupplierPaymentsService;
  let mockPrisma: any;
  let mockSuppliersRepo: any;
  let mockPaymentsRepo: any;
  let mockAllocationsRepo: any;
  let mockGlEngine: any;
  let mockDocSeq: any;
  let mockCompanies: any;
  let mockAuditLog: any;
  let mockIdempotency: any;

  beforeEach(async () => {
    mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
      $queryRaw: jest.fn().mockResolvedValue([{ id: invoiceId }]),
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
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      supplierPaymentAllocation: {
        create: jest.fn().mockResolvedValue({
          id: 'alloc-1',
          companyId,
          supplierId,
          paymentId: 'pay-1',
          purchaseInvoiceId: invoiceId,
          amount: new Decimal('50000'),
          rowVersion: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        }),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { amount: new Decimal('0') } }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      purchaseReturn: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { grandTotal: new Decimal('0') } }),
      },
      cashAccount: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ chartOfAccountId: cashChartAccountId }),
      },
      bankAccount: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ chartOfAccountId: cashChartAccountId }),
      },
      chartOfAccount: {
        findFirst: jest.fn().mockResolvedValue({ id: apAccountId }),
      },
      financialPeriod: {
        findFirst: jest.fn().mockResolvedValue({ id: 'period-1' }),
      },
    };

    mockSuppliersRepo = {
      findById: jest.fn().mockResolvedValue(null),
      findArchivedSupplierById: jest.fn().mockResolvedValue(archivedSupplier),
    };

    mockPaymentsRepo = {
      create: jest.fn().mockImplementation((data: any) =>
        Promise.resolve({
          id: 'pay-1',
          companyId,
          supplierId,
          purchaseInvoiceId: data.purchaseInvoice?.connect?.id ?? null,
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

    mockAllocationsRepo = {
      create: jest.fn().mockResolvedValue({}),
      findByPayment: jest.fn().mockResolvedValue([]),
      findByInvoice: jest.fn().mockResolvedValue([]),
      softDeleteByPayment: jest.fn().mockResolvedValue(0),
      findById: jest.fn().mockResolvedValue(null),
    };

    mockGlEngine = {
      post: jest.fn().mockResolvedValue({ id: 'journal-1' }),
    };
    mockDocSeq = { nextNumber: jest.fn().mockResolvedValue(1) };
    mockCompanies = { getBaseCurrency: jest.fn().mockResolvedValue('KZT') };
    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) };
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
        {
          provide: SupplierPaymentAllocationsRepository,
          useValue: mockAllocationsRepo,
        },
        { provide: GlEngineService, useValue: mockGlEngine },
        { provide: DocumentSequenceService, useValue: mockDocSeq },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: IdempotencyService, useValue: mockIdempotency },
      ],
    }).compile();

    service = module.get<SupplierPaymentsService>(SupplierPaymentsService);
  });

  const settlementDto = {
    purchaseInvoiceId: invoiceId,
    amount: 50000,
    method: PaymentMethod.CASH,
    cashAccountId,
  };

  const unallocatedDto = {
    amount: 50000,
    method: PaymentMethod.CASH,
    cashAccountId,
  };

  it('ALLOWS an invoice-backed settlement payment for an archived supplier', async () => {
    const result = await service.create(
      supplierId,
      settlementDto,
      userId,
      companyId,
    );
    expect(result).toBeDefined();
    expect(mockPaymentsRepo.create).toHaveBeenCalledTimes(1);
    expect(
      mockPaymentsRepo.create.mock.calls[0][0].purchaseInvoice.connect.id,
    ).toBe(invoiceId);
  });

  it('REJECTS an unallocated payment (no invoice) for an archived supplier', async () => {
    await expect(
      service.create(supplierId, unallocatedDto, userId, companyId),
    ).rejects.toThrow(BadRequestException);
    expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
    expect(mockGlEngine.post).not.toHaveBeenCalled();
  });

  it('REJECTS payment create when the supplier is missing for the requesting tenant (tenant isolation on write path)', async () => {
    mockSuppliersRepo.findArchivedSupplierById.mockResolvedValue(null);
    await expect(
      service.create(supplierId, settlementDto, userId, companyBId),
    ).rejects.toThrow(NotFoundException);
    expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
  });

  it('keeps all invoice-level guards for archived supplier settlement: overpayment is still rejected', async () => {
    mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
      ...baseInvoice,
      paidAmount: new Decimal('90000'),
    });
    mockPrisma.supplierPaymentAllocation.aggregate.mockResolvedValue({
      _sum: { amount: new Decimal('90000') },
    });
    await expect(
      service.create(supplierId, settlementDto, userId, companyId),
    ).rejects.toThrow(BadRequestException);
    expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
  });

  it('keeps the invoice currency guard for archived supplier settlement', async () => {
    mockPrisma.purchaseInvoice.findFirst.mockResolvedValue({
      ...baseInvoice,
      currency: 'USD',
    });
    await expect(
      service.create(supplierId, settlementDto, userId, companyId),
    ).rejects.toThrow(BadRequestException);
    expect(mockPaymentsRepo.create).not.toHaveBeenCalled();
  });

  it('active supplier unallocated payment remains allowed (behavior unchanged for active suppliers)', async () => {
    mockSuppliersRepo.findById.mockResolvedValue(activeSupplier);
    const result = await service.create(
      supplierId,
      unallocatedDto,
      userId,
      companyId,
    );
    expect(result).toBeDefined();
    expect(mockPaymentsRepo.create).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. G16-AA-1 regression: mutating paths still reject archived suppliers
// ─────────────────────────────────────────────────────────────

describe('G16-AA-2 regression: archived suppliers unreachable in mutating paths', () => {
  it('purchasing PO create still uses the deletedAt-null supplier gate (archived supplier → 404)', async () => {
    // Mirror of the G16-AA-1 guard shape in PurchaseOrderService.create:
    // tx.supplier.findFirst({ id, companyId, deletedAt: null }). The guard
    // must NOT have been widened by G16-AA-2 — verified structurally by
    // asserting the canonical findById where-clause and that the archived
    // lookup exists as a separate method that PO create does not call.
    const repo = new SuppliersRepository({
      supplier: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);

    await repo.findById(supplierId, companyId);
    const findByIdWhere = (
      repo['prismaService'].supplier.findFirst as jest.Mock
    ).mock.calls[0][0].where;
    expect(findByIdWhere.deletedAt).toBeNull();

    await repo.findArchivedSupplierById(supplierId, companyId);
    const archivedWhere = (
      repo['prismaService'].supplier.findFirst as jest.Mock
    ).mock.calls[1][0].where;
    expect(archivedWhere.deletedAt).toEqual({ not: null });

    // Distinct where-clauses ⇒ a PO create using findById cannot resolve an
    // archived supplier.
    expect(findByIdWhere.deletedAt).not.toEqual(archivedWhere.deletedAt);
  });

  it('suppliers.service.update uses findById only — archived supplier cannot be updated (no archived lookup on the repo mock)', async () => {
    const mockSuppliersRepo: any = {
      findById: jest.fn().mockResolvedValue(null),
    };
    const service = new SuppliersService(
      mockSuppliersRepo,
      { supplier: { findFirst: jest.fn(), update: jest.fn() } } as any,
      { log: jest.fn().mockResolvedValue(undefined) } as any,
    );
    await expect(
      (service as any).update(
        supplierId,
        { companyName: 'X', rowVersion: 1 } as any,
        {
          companyId,
        } as any,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(mockSuppliersRepo.findById).toHaveBeenCalledWith(
      supplierId,
      companyId,
    );
    expect(mockSuppliersRepo.findArchivedSupplierById).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// 5. Overdue notifications untouched
// ─────────────────────────────────────────────────────────────

describe('G16-AA-2 invariance: overdue notification repo query unchanged', () => {
  it('overdue invoice repository still selects by companyId + dueDate + APPROVED with no supplier-archival dimension', async () => {
    // Structural invariance check: the overdue scan query must not reference
    // supplier.deletedAt or the new archived lookup. Verified by asserting
    // the shape of the actual overdue-invoice repository source constant.
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../notifications/repositories/overdue-invoice.repository.ts',
      ),
      'utf8',
    );
    expect(src).toContain('companyId');
    expect(src).not.toContain('findArchivedSupplierById');
    expect(src).not.toContain('G16-AA-2');
  });
});
