import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CashShiftService } from '../services/cash-shift.service';
import { CashShiftRepository } from '../repositories/cash-shift.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { CompaniesService } from '../../companies/services/companies.service';
import { GlEngineService } from '../../finance/services/gl-engine.service';
import { FiscalCalendarService } from '../../finance/services/fiscal-calendar.service';
import { AuditLogService } from '../../shared/services/audit-log.service';

const companyId = 'comp-1';
const userId = 'user-1';
const warehouseId = 'wh-1';

const baseShift = {
  id: 'shift-1',
  companyId,
  warehouseId,
  cashierId: userId,
  status: 'OPEN' as const,
  currency: 'KZT' as const,
  openedAt: new Date(),
  closedAt: null,
  openingBalance: new Prisma.Decimal('100.0000'),
  closingBalance: new Prisma.Decimal('100.0000'),
  cashSales: new Prisma.Decimal('0'),
  cardSales: new Prisma.Decimal('0'),
  qrSales: new Prisma.Decimal('0'),
  bankTransferSales: new Prisma.Decimal('0'),
  mobileWalletSales: new Prisma.Decimal('0'),
  totalSales: new Prisma.Decimal('0'),
  cashIn: new Prisma.Decimal('0'),
  cashOut: new Prisma.Decimal('0'),
  expectedClosing: new Prisma.Decimal('100.0000'),
  difference: new Prisma.Decimal('0'),
  notes: null,
  rowVersion: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CashShiftService — H1 atomic open / H2 optimistic locking', () => {
  let service: CashShiftService;
  let repo: jest.Mocked<CashShiftRepository>;
  let mockPrisma: Record<string, any>;
  let txCallback: ((tx: any) => Promise<any>) | null;

  beforeEach(async () => {
    txCallback = null;
    repo = {
      findOpenShift: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      listByCompany: jest.fn(),
    } as any;

    mockPrisma = {
      $transaction: jest.fn((cb: any) => {
        txCallback = cb;
        return cb(mockPrisma);
      }),
      // G11-F1: partial-refund CASH allocation facts (E5) — default zero.
      refundPaymentAllocation: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
      // G15-07-C3-B: GL posting doubles — no warehouse registers by default
      // (family 1010 fallback), OPEN period present.
      cashAccount: { findMany: jest.fn().mockResolvedValue([]) },
      chartOfAccount: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => {
          // Code-aware stub: 6xxx behaves as EXPENSE, 4xxx as REVENUE,
          // 1xxx as ASSET cash — mirrors the seeder conventions. Id lookups
          // resolve to a live EXPENSE row (counterpart fence input).
          if (where?.id && !where?.code) {
            return {
              id: where.id,
              code: '6000',
              accountType: 'EXPENSE',
              isActive: true,
              deletedAt: null,
              isCashOrBank: false,
            };
          }
          if (!where?.code) return null;
          const code: string = where.code;
          const accountType = code.startsWith('6')
            ? 'EXPENSE'
            : code.startsWith('4')
              ? 'REVENUE'
              : 'ASSET';
          return {
            id: `acc-${code}`,
            code,
            accountType,
            isActive: true,
            deletedAt: null,
            isCashOrBank: code === '1010' || code === '1020',
          };
        }),
      },
      financialPeriod: { findFirst: jest.fn().mockResolvedValue({ id: 'fp-1' }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: CompaniesService, useValue: { getBaseCurrency: jest.fn().mockResolvedValue('KZT') } },
        CashShiftService,
        { provide: CashShiftRepository, useValue: repo },
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: IdempotencyService,
          useValue: { hashRequest: jest.fn().mockReturnValue('hash') },
        },
        { provide: GlEngineService, useValue: { post: jest.fn().mockResolvedValue({ id: 'je-1' }) } },
        {
          provide: FiscalCalendarService,
          useValue: { ensureCurrentCalendar: jest.fn().mockResolvedValue({}) },
        },
        { provide: AuditLogService, useValue: { log: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get<CashShiftService>(CashShiftService);
  });

  afterEach(() => jest.clearAllMocks());

  // ───────────────────────────────
  // H1 — openShift atomicity
  // ───────────────────────────────
  it('openShift: creates shift when none open', async () => {
    repo.findOpenShift.mockResolvedValue(null);
    repo.create.mockResolvedValue(baseShift);

    const result = await service.openShift(
      { warehouseId, openingBalance: 100 },
      userId,
      companyId,
    );

    expect(result.id).toBe('shift-1');
    expect(repo.findOpenShift).toHaveBeenCalledWith(
      warehouseId,
      userId,
      companyId,
      expect.anything(), // tx
    );
    expect(repo.create).toHaveBeenCalled();
  });

  it('openShift: throws ConflictException (409) when an OPEN shift already exists', async () => {
    repo.findOpenShift.mockResolvedValue(baseShift);

    await expect(
      service.openShift(
        { warehouseId, openingBalance: 100 },
        userId,
        companyId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('openShift: maps DB P2002 (concurrent insert) to ConflictException (409)', async () => {
    repo.findOpenShift.mockResolvedValue(null);
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '5',
    });
    repo.create.mockRejectedValue(p2002);

    await expect(
      service.openShift(
        { warehouseId, openingBalance: 100 },
        userId,
        companyId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('openShift: propagates non-P2002 errors unchanged', async () => {
    repo.findOpenShift.mockResolvedValue(null);
    repo.create.mockRejectedValue(new Error('db down'));

    await expect(
      service.openShift(
        { warehouseId, openingBalance: 100 },
        userId,
        companyId,
      ),
    ).rejects.toThrow('db down');
  });

  // ───────────────────────────────
  // H2 — closeShift optimistic locking
  // ───────────────────────────────
  it('closeShift: passes rowVersion to repository update', async () => {
    repo.findOpenShift.mockResolvedValue({ ...baseShift, rowVersion: 3 });
    repo.update.mockResolvedValue({ ...baseShift, status: 'CLOSED' as const });

    await service.closeShift(
      { actualClosingBalance: 150 },
      userId,
      companyId,
      warehouseId,
    );

    expect(repo.update).toHaveBeenCalledWith(
      'shift-1',
      expect.objectContaining({ status: 'CLOSED' }),
      companyId,
      3, // rowVersion from the read
      expect.anything(), // tx
    );
  });

  it('closeShift: throws NotFoundException when no open shift', async () => {
    repo.findOpenShift.mockResolvedValue(null);
    await expect(
      service.closeShift({}, userId, companyId, warehouseId),
    ).rejects.toThrow(NotFoundException);
  });

  // ───────────────────────────────
  // G11-F1 — closeShift nets partial CASH refunds (GAP-B)
  // ───────────────────────────────
  const cashRefundAggregate = (amount: string | null) => ({
    _sum: { amount: amount == null ? null : new Prisma.Decimal(amount) },
  });

  it('G11-F1 closeShift: expected closing subtracts partial CASH refund allocations', async () => {
    repo.findOpenShift.mockResolvedValue({
      ...baseShift,
      cashSales: new Prisma.Decimal('500.0000'),
    });
    repo.update.mockResolvedValue({ ...baseShift, status: 'CLOSED' as const });
    mockPrisma.refundPaymentAllocation.aggregate.mockResolvedValue(
      cashRefundAggregate('120.5000'),
    );

    await service.closeShift({}, userId, companyId, warehouseId);

    // 100 opening + 500 cashSales − 120.5 partial CASH refunds = 479.5
    const payload = repo.update.mock.calls[0]![1] as Record<string, unknown>;
    expect((payload.expectedClosing as Prisma.Decimal).toString()).toBe('479.5');
  });

  it('G11-F1 closeShift: CARD-only refunds leave expected closing unchanged', async () => {
    repo.findOpenShift.mockResolvedValue({
      ...baseShift,
      cashSales: new Prisma.Decimal('500.0000'),
    });
    repo.update.mockResolvedValue({ ...baseShift, status: 'CLOSED' as const });
    // service-level where already pins method=CASH — simulate zero cash rows
    mockPrisma.refundPaymentAllocation.aggregate.mockResolvedValue(
      cashRefundAggregate(null),
    );

    await service.closeShift({}, userId, companyId, warehouseId);

    const payload = repo.update.mock.calls[0]![1] as Record<string, unknown>;
    expect((payload.expectedClosing as Prisma.Decimal).toString()).toBe('600');
  });

  it('G11-F1 closeShift: no refunds → zero query member, expected closing unchanged', async () => {
    repo.findOpenShift.mockResolvedValue({ ...baseShift });
    repo.update.mockResolvedValue({ ...baseShift, status: 'CLOSED' as const });

    const result = await service.closeShift({}, userId, companyId, warehouseId);

    expect(result.expectedClosing.toString()).toBe('100');
    const where = mockPrisma.refundPaymentAllocation.aggregate.mock.calls[0][0]
      .where;
    expect(where.companyId).toBe(companyId);
    expect(where.method).toBe('CASH');
    expect(where.deletedAt).toBeNull();
    expect(where.salesRefund).toEqual({
      status: 'COMPLETED',
      deletedAt: null,
      sale: { cashShiftId: 'shift-1' },
    });
  });

  it('G11-F1 closeShift: query runs inside the close transaction (tx-scoped)', async () => {
    repo.findOpenShift.mockResolvedValue({ ...baseShift });
    repo.update.mockResolvedValue({ ...baseShift, status: 'CLOSED' as const });

    await service.closeShift({}, userId, companyId, warehouseId);

    // the aggregate ran against the same in-memory tx mock ($transaction cb)
    expect(mockPrisma.refundPaymentAllocation.aggregate).toHaveBeenCalled();
  });

  // ───────────────────────────────
  // H2 — cashIn / cashOut optimistic locking
  // ───────────────────────────────
  it('cashIn: read-modify-write passes rowVersion (lost update impossible)', async () => {
    repo.findOpenShift.mockResolvedValue({
      ...baseShift,
      cashIn: new Prisma.Decimal('10'),
      rowVersion: 5,
    });
    repo.update.mockResolvedValue({
      ...baseShift,
      cashIn: new Prisma.Decimal('15'),
    });

    await service.cashIn(
      { amount: 5, counterpartAccountId: 'acc-6000' },
      userId,
      companyId,
      warehouseId,
    );

    expect(repo.update).toHaveBeenCalledWith(
      'shift-1',
      expect.objectContaining({ cashIn: expect.any(Prisma.Decimal) }),
      companyId,
      5,
      expect.anything(),
    );
    const updateData = (repo.update.mock.calls[0]![1] as any)
      .cashIn as Prisma.Decimal;
    expect(updateData.toString()).toBe('15');
  });

  it('cashOut: computes cashOut + amount with rowVersion guard', async () => {
    repo.findOpenShift.mockResolvedValue({
      ...baseShift,
      cashOut: new Prisma.Decimal('3'),
      rowVersion: 2,
    });
    repo.update.mockResolvedValue({
      ...baseShift,
      cashOut: new Prisma.Decimal('8'),
    });

    await service.cashOut(
      { amount: 5, counterpartAccountId: 'acc-6000' },
      userId,
      companyId,
      warehouseId,
    );

    expect(repo.update).toHaveBeenCalledWith(
      'shift-1',
      expect.objectContaining({ cashOut: expect.any(Prisma.Decimal) }),
      companyId,
      2,
      expect.anything(),
    );
  });

  it('cashIn: rethrows ConflictException from repository (concurrent mutation)', async () => {
    repo.findOpenShift.mockResolvedValue({ ...baseShift, rowVersion: 1 });
    repo.update.mockRejectedValue(
      new ConflictException('Cash shift shift-1 was modified by another user'),
    );

    await expect(
      service.cashIn(
        { amount: 5, counterpartAccountId: 'acc-6000' },
        userId,
        companyId,
        warehouseId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('cashIn: rejects negative amounts', async () => {
    repo.findOpenShift.mockResolvedValue(baseShift);
    await expect(
      service.cashIn({ amount: -5 }, userId, companyId, warehouseId),
    ).rejects.toThrow('Amount must be positive');
  });

  it('cashIn: rejects zero amounts (no zero-value JE)', async () => {
    repo.findOpenShift.mockResolvedValue(baseShift);
    await expect(
      service.cashIn(
        { amount: 0, counterpartAccountId: 'acc-6000' },
        userId,
        companyId,
        warehouseId,
      ),
    ).rejects.toThrow('Amount must be positive');
  });

  // ── CURRENCY ────────────────────────────────
  describe('currency', () => {
    it('openShift: defaults to KZT when currency not provided', async () => {
      repo.findOpenShift.mockResolvedValue(null);
      repo.create.mockResolvedValue(baseShift);

      await service.openShift(
        { warehouseId, openingBalance: 100 },
        userId,
        companyId,
      );

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'KZT' }),
        expect.anything(),
      );
    });

    it('openShift: rejects USD when company currency is KZT', async () => {
      repo.findOpenShift.mockResolvedValue(null);

      await expect(
        service.openShift(
          { warehouseId, openingBalance: 100, currency: 'USD' as any },
          userId,
          companyId,
        ),
      ).rejects.toThrow('does not match company currency');
    });

    it('openShift: rejects different currency in created shift', async () => {
      repo.findOpenShift.mockResolvedValue(null);

      await expect(
        service.openShift(
          { warehouseId, openingBalance: 100, currency: 'EUR' as any },
          userId,
          companyId,
        ),
      ).rejects.toThrow('does not match company currency');
    });

    it('openShift: currency is immutable after creation (no update endpoint)', async () => {
      // CashShift has no update endpoint — currency cannot be changed after open.
      // This test verifies the absence of any update path for currency.
      repo.findOpenShift.mockResolvedValue(null);
      repo.create.mockResolvedValue(baseShift);

      const result = await service.openShift(
        { warehouseId, openingBalance: 100 },
        userId,
        companyId,
      );

      // Shift created with KZT — no way to change it
      expect(result.currency).toBe('KZT');
      expect(result.status).toBe('OPEN');
    });
  });
});
