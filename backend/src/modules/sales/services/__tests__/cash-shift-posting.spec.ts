import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CashShiftService } from '../cash-shift.service';
import { CashShiftRepository } from '../../repositories/cash-shift.repository';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import { IdempotencyService } from '../../../../infrastructure/idempotency/idempotency.service';
import { CompaniesService } from '../../../companies/services/companies.service';
import { GlEngineService } from '../../../finance/services/gl-engine.service';
import { FiscalCalendarService } from '../../../finance/services/fiscal-calendar.service';
import { AuditLogService } from '../../../shared/services/audit-log.service';

const companyId = 'comp-1';
const userId = 'user-1';
const warehouseId = 'wh-1';

const shiftRow = (over: Record<string, any> = {}) => ({
  id: 'shift-1',
  companyId,
  warehouseId,
  cashierId: userId,
  status: 'OPEN' as const,
  currency: 'KZT' as const,
  openedAt: new Date(),
  closedAt: null,
  openingBalance: new Prisma.Decimal('100'),
  closingBalance: new Prisma.Decimal('100'),
  cashSales: new Prisma.Decimal('0'),
  cardSales: new Prisma.Decimal('0'),
  qrSales: new Prisma.Decimal('0'),
  bankTransferSales: new Prisma.Decimal('0'),
  mobileWalletSales: new Prisma.Decimal('0'),
  totalSales: new Prisma.Decimal('0'),
  cashIn: new Prisma.Decimal('0'),
  cashOut: new Prisma.Decimal('0'),
  expectedClosing: new Prisma.Decimal('100'),
  difference: new Prisma.Decimal('0'),
  notes: null,
  rowVersion: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const chartRow = (
  id: string,
  code: string,
  accountType: string,
  extra: Record<string, any> = {},
) => ({
  id,
  code,
  accountType,
  isActive: true,
  deletedAt: null,
  isCashOrBank: code === '1010' || code === '1020',
  ...extra,
});

describe('CashShiftService.posting — G15-07-C3-B', () => {
  let service: CashShiftService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let tx: Record<string, any>;
  let glPost: jest.Mock;
  let calendar: { ensureCurrentCalendar: jest.Mock };
  let auditLog: { log: jest.Mock };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let idempotency: Record<string, any>;

  beforeEach(async () => {
    tx = {
      cashAccount: { findMany: jest.fn().mockResolvedValue([]) },
      chartOfAccount: { findFirst: jest.fn() },
      financialPeriod: {
        findFirst: jest.fn().mockResolvedValue({ id: 'fp-1' }),
      },
      refundPaymentAllocation: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
    };
    // Default chart stub: family/system codes resolve as live rows with
    // seeder-consistent types; id lookups resolve as live EXPENSE rows.
    tx.chartOfAccount.findFirst.mockImplementation(async ({ where }: any) => {
      if (where?.id && !where?.code) {
        return chartRow(where.id, '6000', 'EXPENSE');
      }
      if (!where?.code) return null;
      const code: string = where.code;
      const accountType = code.startsWith('6')
        ? 'EXPENSE'
        : code.startsWith('4')
          ? 'REVENUE'
          : code.startsWith('2')
            ? 'LIABILITY'
            : code.startsWith('3')
              ? 'EQUITY'
              : 'ASSET';
      return chartRow(`acc-${code}`, code, accountType);
    });

    repo = {
      findOpenShift: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      listByCompany: jest.fn(),
    };
    glPost = jest
      .fn()
      .mockResolvedValue({ id: 'je-1', entryNumber: 3, status: 'POSTED' });
    calendar = { ensureCurrentCalendar: jest.fn().mockResolvedValue({}) };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    idempotency = {
      reserve: jest
        .fn()
        .mockResolvedValue({ type: 'created', requestHash: 'h' }),
      complete: jest.fn().mockResolvedValue(undefined),
      hashRequest: jest.fn((p: unknown) => JSON.stringify(p)),
    };
    const mockPrisma = { $transaction: jest.fn(async (fn: any) => fn(tx)) };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        CashShiftService,
        { provide: CashShiftRepository, useValue: repo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: IdempotencyService, useValue: idempotency },
        {
          provide: CompaniesService,
          useValue: { getBaseCurrency: jest.fn().mockResolvedValue('KZT') },
        },
        { provide: GlEngineService, useValue: { post: glPost } },
        { provide: FiscalCalendarService, useValue: calendar },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();

    service = mod.get(CashShiftService);
  });

  const openShift = (over: Record<string, any> = {}) => {
    const row = shiftRow(over);
    repo.findOpenShift.mockResolvedValue(row);
    repo.update.mockImplementation(async (_id: string, data: any) => ({
      ...row,
      ...data,
    }));
    return row;
  };

  const linesOf = () => glPost.mock.calls[0][0].lines as Array<any>;
  const dto = (over: Record<string, any> = {}) => ({
    amount: 50,
    reason: 'float top-up',
    counterpartAccountId: 'acc-6000',
    ...over,
  });

  // ── CASH_IN ────────────────────────────────────────────────────────

  it('cashIn posts Dr drawer / Cr counterpart, balanced, linked, audited', async () => {
    openShift();

    const result = await service.cashIn(
      dto(),
      userId,
      companyId,
      warehouseId,
      'key-1',
    );

    expect(glPost).toHaveBeenCalledTimes(1);
    const input = glPost.mock.calls[0][0];
    expect(input.companyId).toBe(companyId);
    expect(input.financialPeriodId).toBe('fp-1');
    expect(input.entryDate).toBeInstanceOf(Date);
    expect(input.referenceType).toBe('CASH_SHIFT');
    expect(input.referenceId).toBe('shift-1');
    expect(input.description).toContain('float top-up');
    expect(input.description).toContain('key-1');
    const lines = linesOf();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual(
      expect.objectContaining({ accountId: 'acc-1010', debit: '50.0000' }),
    );
    expect(lines[1]).toEqual(
      expect.objectContaining({ accountId: 'acc-6000', credit: '50.0000' }),
    );
    expect(calendar.ensureCurrentCalendar).toHaveBeenCalledWith(
      companyId,
      tx,
    );
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId,
        userId,
        entityType: 'CashShift',
        entityId: 'shift-1',
        action: 'CASH_IN',
      }),
      tx,
    );
    const after = auditLog.log.mock.calls[0][0].after;
    expect(after.journalEntryId).toBe('je-1');
    expect(after.reason).toBe('float top-up');
    expect(result.cashIn.toString()).toBe('50');
  });

  it.each([
    ['missing counterpart', {}],
    ['ASSET counterpart', { counterpartAccountId: 'acc-1300' }],
    ['LIABILITY counterpart', { counterpartAccountId: 'acc-2100' }],
    ['EQUITY counterpart', { counterpartAccountId: 'acc-3000' }],
    ['3200 retained earnings', { counterpartAccountId: 'acc-3200' }],
    ['cash register account', { counterpartAccountId: 'acc-1010' }],
  ])('cashIn fails closed: %s', async (_label, over) => {
    openShift();
    tx.chartOfAccount.findFirst.mockImplementation(async ({ where }: any) => {
      if (!where?.id) return null;
      const map: Record<string, any> = {
        'acc-1300': chartRow('acc-1300', '1300', 'ASSET'),
        'acc-2100': chartRow('acc-2100', '2100', 'LIABILITY'),
        'acc-3000': chartRow('acc-3000', '3000', 'EQUITY'),
        'acc-3200': chartRow('acc-3200', '3200', 'EQUITY'),
        'acc-1010': chartRow('acc-1010', '1010', 'ASSET', {
          isCashOrBank: true,
        }),
      };
      return map[where.id] ?? null;
    });

    await expect(
      service.cashIn(
        dto({ counterpartAccountId: (over as any).counterpartAccountId }),
        userId,
        companyId,
        warehouseId,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(glPost).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('cashIn rejects foreign/dead counterpart and zero amount', async () => {
    openShift();
    // Counterpart id-lookups miss, but the 1010 family fallback resolves,
    // so the failure under test is the counterpart lookup itself.
    tx.chartOfAccount.findFirst.mockImplementation(async ({ where }: any) => {
      if (where?.id) return null;
      if (where?.code)
        return chartRow(`acc-${where.code}`, where.code, 'ASSET');
      return null;
    });

    await expect(
      service.cashIn(dto(), userId, companyId, warehouseId),
    ).rejects.toThrow(/not available/);
    await expect(
      service.cashIn(dto({ amount: 0 }), userId, companyId, warehouseId),
    ).rejects.toThrow(/positive/);
    expect(glPost).not.toHaveBeenCalled();
  });

  it('cashIn uses the linked drawer chart when the register is linked', async () => {
    openShift();
    tx.cashAccount.findMany.mockResolvedValue([
      {
        id: 'reg-1',
        currency: 'KZT',
        chartOfAccountId: 'acc-drawer',
      },
    ]);
    tx.chartOfAccount.findFirst.mockImplementation(async ({ where }: any) => {
      if (where?.id === 'acc-drawer')
        return chartRow('acc-drawer', '1001', 'ASSET');
      if (where?.id) return chartRow(where.id, '6000', 'EXPENSE');
      if (where?.code) return chartRow(`acc-${where.code}`, where.code, 'ASSET');
      return null;
    });

    await service.cashIn(dto(), userId, companyId, warehouseId, 'k');

    expect(linesOf()[0].accountId).toBe('acc-drawer');
  });

  // ── CASH_OUT ───────────────────────────────────────────────────────

  it('cashOut posts Dr counterpart / Cr drawer', async () => {
    openShift();

    await service.cashOut(dto(), userId, companyId, warehouseId);

    const lines = linesOf();
    expect(lines[0]).toEqual(
      expect.objectContaining({ accountId: 'acc-6000', debit: '50.0000' }),
    );
    expect(lines[1]).toEqual(
      expect.objectContaining({ accountId: 'acc-1010', credit: '50.0000' }),
    );
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CASH_OUT' }),
      tx,
    );
  });

  it('cashOut fails closed without counterpart and propagates GL failure', async () => {
    openShift();

    await expect(
      service.cashOut(
        { amount: 10, reason: 'x' },
        userId,
        companyId,
        warehouseId,
      ),
    ).rejects.toThrow(/explicit counterpart/);
    expect(repo.update).not.toHaveBeenCalled();

    glPost.mockRejectedValueOnce(new Error('period closed'));
    await expect(
      service.cashOut(dto(), userId, companyId, warehouseId),
    ).rejects.toThrow('period closed');
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  // ── SHORTAGE / OVERAGE ─────────────────────────────────────────────

  const closeWith = async (actual: number | undefined) => {
    openShift();
    await service.closeShift(
      actual === undefined ? {} : { actualClosingBalance: actual },
      userId,
      companyId,
      warehouseId,
    );
  };

  it('shortage posts exactly one JE: Dr 6200 / Cr drawer', async () => {
    await closeWith(90); // expected 100 → shortage 10

    expect(glPost).toHaveBeenCalledTimes(1);
    const input = glPost.mock.calls[0][0];
    expect(input.referenceType).toBe('CASH_SHIFT');
    expect(input.referenceId).toBe('shift-1');
    expect(linesOf()).toEqual([
      expect.objectContaining({ accountId: 'acc-6200', debit: '10.0000' }),
      expect.objectContaining({ accountId: 'acc-1010', credit: '10.0000' }),
    ]);
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SHORTAGE', entityId: 'shift-1' }),
      tx,
    );
    expect(auditLog.log.mock.calls[0][0].after.journalEntryId).toBe('je-1');
  });

  it('overage posts exactly one JE: Dr drawer / Cr 4210', async () => {
    await closeWith(115); // expected 100 → overage 15

    expect(glPost).toHaveBeenCalledTimes(1);
    expect(linesOf()).toEqual([
      expect.objectContaining({ accountId: 'acc-1010', debit: '15.0000' }),
      expect.objectContaining({ accountId: 'acc-4210', credit: '15.0000' }),
    ]);
    expect(auditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'OVERAGE' }),
      tx,
    );
  });

  it('zero difference closes with no JE and no audit', async () => {
    await closeWith(undefined); // actual = expected → 0

    expect(glPost).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('second close finds no OPEN shift: no duplicate JE', async () => {
    await closeWith(90);
    expect(glPost).toHaveBeenCalledTimes(1);
    repo.findOpenShift.mockResolvedValue(null);

    await expect(
      service.closeShift({}, userId, companyId, warehouseId),
    ).rejects.toThrow(NotFoundException);
    expect(glPost).toHaveBeenCalledTimes(1);
  });

  it('missing 6200 fails the close deterministically', async () => {
    openShift();
    tx.chartOfAccount.findFirst.mockImplementation(async ({ where }: any) => {
      if (where?.code === '6200') return null;
      if (where?.code) return chartRow(`acc-${where.code}`, where.code, 'ASSET');
      return null;
    });

    await expect(closeWith(90)).rejects.toThrow(/6200/);
    expect(glPost).not.toHaveBeenCalled();
  });

  // ── LIFECYCLE / EXCLUSION ──────────────────────────────────────────

  it('open creates no JE', async () => {
    repo.findOpenShift.mockResolvedValue(null);
    repo.create.mockImplementation(async (data: any) => ({
      ...shiftRow(),
      ...data,
    }));

    await service.openShift(
      { warehouseId, openingBalance: 100 },
      userId,
      companyId,
    );

    expect(glPost).not.toHaveBeenCalled();
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('sale buckets and refund netting never produce a CASH_SHIFT JE', async () => {
    // A shift heavy with sale buckets whose recomputed expectation matches
    // the actual count (100 + 500 cashSales = 600): buckets flow through
    // E4/E5, so close posts nothing.
    openShift({
      cashSales: new Prisma.Decimal('500'),
      cardSales: new Prisma.Decimal('200'),
    });
    repo.update.mockImplementation(async (_id: string, data: any) => ({
      ...shiftRow(),
      ...data,
    }));

    await service.closeShift(
      { actualClosingBalance: 600 },
      userId,
      companyId,
      warehouseId,
    );

    expect(glPost).not.toHaveBeenCalled();
  });

  // ── REGISTER RESOLUTION ────────────────────────────────────────────

  it('zero registers fall back to 1010; N registers fail closed', async () => {
    openShift();
    await service.cashIn(dto(), userId, companyId, warehouseId);
    expect(linesOf()[0].accountId).toBe('acc-1010');

    glPost.mockClear();
    tx.cashAccount.findMany.mockResolvedValue([
      { id: 'r1', currency: 'KZT', chartOfAccountId: null },
      { id: 'r2', currency: 'KZT', chartOfAccountId: null },
    ]);
    await expect(
      service.cashIn(dto(), userId, companyId, warehouseId),
    ).rejects.toThrow(/ambiguous/);
    expect(glPost).not.toHaveBeenCalled();
  });

  it('linked dead chart falls back to 1010; currency mismatch rejects', async () => {
    openShift();
    tx.cashAccount.findMany.mockResolvedValue([
      { id: 'reg-1', currency: 'KZT', chartOfAccountId: 'acc-dead' },
    ]);
    tx.chartOfAccount.findFirst.mockImplementation(async ({ where }: any) => {
      if (where?.id === 'acc-dead') return null;
      if (where?.id) return chartRow(where.id, '6000', 'EXPENSE');
      if (where?.code) return chartRow(`acc-${where.code}`, where.code, 'ASSET');
      return null;
    });
    await service.cashIn(dto(), userId, companyId, warehouseId);
    expect(linesOf()[0].accountId).toBe('acc-1010');

    tx.cashAccount.findMany.mockResolvedValue([
      { id: 'reg-1', currency: 'USD', chartOfAccountId: null },
    ]);
    await expect(
      service.cashIn(dto(), userId, companyId, warehouseId),
    ).rejects.toThrow(/currency/);
  });

  it('missing 1010 with no registers fails closed', async () => {
    openShift();
    tx.chartOfAccount.findFirst.mockResolvedValue(null);

    await expect(
      service.cashIn(dto(), userId, companyId, warehouseId),
    ).rejects.toThrow(/1010/);
    expect(glPost).not.toHaveBeenCalled();
  });

  // ── SECURITY / OFFLINE / PERIOD ────────────────────────────────────

  it('tenant isolation: shift lookup and chart lookups carry companyId', async () => {
    openShift();
    await service.cashIn(dto(), userId, companyId, warehouseId);

    expect(repo.findOpenShift).toHaveBeenCalledWith(
      warehouseId,
      userId,
      companyId,
      tx,
    );
    for (const call of tx.chartOfAccount.findFirst.mock.calls) {
      expect(call[0].where.companyId).toBe(companyId);
    }
    expect(glPost.mock.calls[0][0].companyId).toBe(companyId);
  });

  it('idempotency: same key replays without re-executing; mismatch conflicts', async () => {
    openShift();
    const stored = { cashIn: '50' };
    idempotency.reserve.mockResolvedValue({
      type: 'replayed',
      status: 200,
      body: stored,
    });

    const result = await service.cashIn(dto(), userId, companyId, warehouseId, 'k');
    expect(result).toEqual(stored);
    expect(glPost).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();

    idempotency.reserve.mockRejectedValue(
      new UnprocessableEntityException('different payload'),
    );
    await expect(
      service.cashIn(dto(), userId, companyId, warehouseId, 'k'),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('request hash covers amount/reason/counterpart/warehouse/user', async () => {
    openShift();
    await service.cashIn(dto(), userId, companyId, warehouseId, 'k');

    expect(idempotency.hashRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 50,
        reason: 'float top-up',
        counterpartAccountId: 'acc-6000',
        warehouseId,
        userId,
      }),
    );
  });

  it('CLOSED period fails closed with no partial mutation', async () => {
    openShift();
    tx.financialPeriod.findFirst.mockResolvedValue(null);

    await expect(
      service.cashIn(dto(), userId, companyId, warehouseId),
    ).rejects.toThrow(/No OPEN financial period/);
    expect(glPost).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
