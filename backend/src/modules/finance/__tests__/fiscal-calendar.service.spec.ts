import { Test, TestingModule } from '@nestjs/testing';
import { FinancialPeriodStatus, Prisma } from '@prisma/client';
import { FiscalCalendarService } from '../services/fiscal-calendar.service';

describe('FiscalCalendarService', () => {
  let service: FiscalCalendarService;
  let mockTx: Record<string, any>;

  const companyId = 'comp-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FiscalCalendarService],
    }).compile();

    service = module.get<FiscalCalendarService>(FiscalCalendarService);

    mockTx = {
      fiscalYear: {
        upsert: jest.fn().mockImplementation(({ where }) => {
          const cid = where?.companyId_year?.companyId ?? companyId;
          const yr = where?.companyId_year?.year ?? 2026;
          return Promise.resolve({
            id: `fy-${cid}-${yr}`,
            companyId: cid,
            year: yr,
            name: String(yr),
            startDate: new Date(`${yr}-01-01T00:00:00.000Z`),
            endDate: new Date(`${yr}-12-31T23:59:59.999Z`),
            isClosed: false,
            closedAt: null,
            closedBy: null,
            retainedEarningsAccountId: null,
            rowVersion: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }),
      },
      financialPeriod: {
        upsert: jest.fn().mockImplementation(({ where }) => {
          const cid = where?.companyId_year_month?.companyId ?? companyId;
          const yr = where?.companyId_year_month?.year ?? 2026;
          const mo = where?.companyId_year_month?.month ?? 9;
          return Promise.resolve({
            id: `fp-${cid}-${yr}-${mo}`,
            companyId: cid,
            name: `${yr}-${String(mo).padStart(2, '0')}`,
            year: yr,
            month: mo,
            startDate: new Date(Date.UTC(yr, mo - 1, 1)),
            endDate: new Date(Date.UTC(yr, mo, 0, 23, 59, 59, 999)),
            status: FinancialPeriodStatus.OPEN,
            openedBy: null,
            openedAt: new Date(),
            closedBy: null,
            closedAt: null,
            notes: 'Auto-provisioned by FiscalCalendarService',
            rowVersion: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }),
      },
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  // ─── 1. New company: both created ──────────────────────────────
  it('should create FiscalYear and OPEN FinancialPeriod for a new company', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') });

    const result = await service.ensureCurrentCalendar(
      companyId,
      mockTx as unknown as Prisma.TransactionClient,
    );

    expect(result.fiscalYear).toBeDefined();
    expect(result.financialPeriod).toBeDefined();
    expect(result.isPostable).toBe(true);
    expect(result.financialPeriod.status).toBe(FinancialPeriodStatus.OPEN);

    expect(mockTx.fiscalYear.upsert).toHaveBeenCalledTimes(1);
    expect(mockTx.financialPeriod.upsert).toHaveBeenCalledTimes(1);
  });

  // ─── 2. Existing FiscalYear missing → created ──────────────────
  it('should create FiscalYear when missing', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') });

    const result = await service.ensureCurrentCalendar(
      companyId,
      mockTx as unknown as Prisma.TransactionClient,
    );

    const fyCall = mockTx.fiscalYear.upsert.mock.calls[0][0];
    expect(fyCall.where).toEqual({ companyId_year: { companyId, year: 2026 } });
    expect(fyCall.create.year).toBe(2026);
    expect(fyCall.create.companyId).toBe(companyId);
    expect(result.fiscalYear).toBeDefined();
  });

  // ─── 3. Existing FinancialPeriod missing → created ─────────────
  it('should create FinancialPeriod when missing', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') });

    const result = await service.ensureCurrentCalendar(
      companyId,
      mockTx as unknown as Prisma.TransactionClient,
    );

    const fpCall = mockTx.financialPeriod.upsert.mock.calls[0][0];
    expect(fpCall.where).toEqual({
      companyId_year_month: { companyId, year: 2026, month: 9 },
    });
    expect(fpCall.create.status).toBe(FinancialPeriodStatus.OPEN);
    expect(fpCall.create.year).toBe(2026);
    expect(fpCall.create.month).toBe(9);
    expect(result.financialPeriod).toBeDefined();
  });

  // ─── 4. Both exist and OPEN → no duplicates, isPostable=true ───
  it('should return existing OPEN period with isPostable=true', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') });

    mockTx.financialPeriod.upsert.mockResolvedValueOnce({
      id: 'fp-existing',
      companyId,
      name: '2026-09',
      year: 2026,
      month: 9,
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T23:59:59.999Z'),
      status: FinancialPeriodStatus.OPEN,
      openedBy: null,
      openedAt: new Date(),
      closedBy: null,
      closedAt: null,
      notes: null,
      rowVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.ensureCurrentCalendar(
      companyId,
      mockTx as unknown as Prisma.TransactionClient,
    );

    expect(result.isPostable).toBe(true);
    expect(result.financialPeriod.id).toBe('fp-existing');
    expect(result.financialPeriod.status).toBe(FinancialPeriodStatus.OPEN);
  });

  // ─── 5. CLOSED period → no reopen, isPostable=false ────────────
  it('should NOT reopen a CLOSED period and return isPostable=false', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') });

    mockTx.financialPeriod.upsert.mockResolvedValueOnce({
      id: 'fp-closed',
      companyId,
      name: '2026-09',
      year: 2026,
      month: 9,
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T23:59:59.999Z'),
      status: FinancialPeriodStatus.CLOSED,
      openedBy: null,
      openedAt: new Date(),
      closedBy: 'user-1',
      closedAt: new Date(),
      notes: null,
      rowVersion: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.ensureCurrentCalendar(
      companyId,
      mockTx as unknown as Prisma.TransactionClient,
    );

    expect(result.isPostable).toBe(false);
    expect(result.financialPeriod.status).toBe(FinancialPeriodStatus.CLOSED);

    // Verify upsert update branch is empty (no status change)
    const fpCall = mockTx.financialPeriod.upsert.mock.calls[0][0];
    expect(fpCall.update).toEqual({});
  });

  // ─── 6. CLOSING period → no unsafe reopening, isPostable=false ─
  it('should NOT reopen a CLOSING period and return isPostable=false', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') });

    mockTx.financialPeriod.upsert.mockResolvedValueOnce({
      id: 'fp-closing',
      companyId,
      name: '2026-09',
      year: 2026,
      month: 9,
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-30T23:59:59.999Z'),
      status: FinancialPeriodStatus.CLOSING,
      openedBy: null,
      openedAt: new Date(),
      closedBy: null,
      closedAt: null,
      notes: null,
      rowVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.ensureCurrentCalendar(
      companyId,
      mockTx as unknown as Prisma.TransactionClient,
    );

    expect(result.isPostable).toBe(false);
    expect(result.financialPeriod.status).toBe(FinancialPeriodStatus.CLOSING);
  });

  // ─── 7. Month rollover → new period ────────────────────────────
  it('should create a new period on month rollover', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-01T00:00:00.001Z') });

    mockTx.financialPeriod.upsert.mockResolvedValueOnce({
      id: 'fp-oct',
      companyId,
      name: '2026-10',
      year: 2026,
      month: 10,
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-31T23:59:59.999Z'),
      status: FinancialPeriodStatus.OPEN,
      openedBy: null,
      openedAt: new Date(),
      closedBy: null,
      closedAt: null,
      notes: null,
      rowVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.ensureCurrentCalendar(
      companyId,
      mockTx as unknown as Prisma.TransactionClient,
    );

    expect(result.financialPeriod.month).toBe(10);
    expect(result.financialPeriod.name).toBe('2026-10');
    expect(result.isPostable).toBe(true);

    const fpCall = mockTx.financialPeriod.upsert.mock.calls[0][0];
    expect(fpCall.where).toEqual({
      companyId_year_month: { companyId, year: 2026, month: 10 },
    });
  });

  // ─── 8. Year rollover → new FiscalYear + period ────────────────
  it('should create a new FiscalYear on year rollover', async () => {
    jest.useFakeTimers({ now: new Date('2027-01-01T00:00:00.001Z') });

    mockTx.fiscalYear.upsert.mockResolvedValueOnce({
      id: 'fy-2027',
      companyId,
      year: 2027,
      name: '2027',
      startDate: new Date('2027-01-01T00:00:00.000Z'),
      endDate: new Date('2027-12-31T23:59:59.999Z'),
      isClosed: false,
      closedAt: null,
      closedBy: null,
      retainedEarningsAccountId: null,
      rowVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockTx.financialPeriod.upsert.mockResolvedValueOnce({
      id: 'fp-2027-01',
      companyId,
      name: '2027-01',
      year: 2027,
      month: 1,
      startDate: new Date('2027-01-01T00:00:00.000Z'),
      endDate: new Date('2027-01-31T23:59:59.999Z'),
      status: FinancialPeriodStatus.OPEN,
      openedBy: null,
      openedAt: new Date(),
      closedBy: null,
      closedAt: null,
      notes: null,
      rowVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.ensureCurrentCalendar(
      companyId,
      mockTx as unknown as Prisma.TransactionClient,
    );

    expect(result.fiscalYear.year).toBe(2027);
    expect(result.financialPeriod.year).toBe(2027);
    expect(result.financialPeriod.month).toBe(1);
    expect(result.isPostable).toBe(true);

    const fyCall = mockTx.fiscalYear.upsert.mock.calls[0][0];
    expect(fyCall.where).toEqual({ companyId_year: { companyId, year: 2027 } });
  });

  // ─── 9. Same-month concurrency ─────────────────────────────────
  it('should handle concurrent calls for same month — exactly one period', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') });

    const [r1, r2] = await Promise.all([
      service.ensureCurrentCalendar(companyId, mockTx as unknown as Prisma.TransactionClient),
      service.ensureCurrentCalendar(companyId, mockTx as unknown as Prisma.TransactionClient),
    ]);

    // Both calls use upsert — DB uniqueness ensures exactly one row
    expect(mockTx.financialPeriod.upsert).toHaveBeenCalledTimes(2);
    // Both resolve to the same canonical period
    expect(r1.financialPeriod.id).toBe(r2.financialPeriod.id);
    expect(r1.financialPeriod.year).toBe(r2.financialPeriod.year);
    expect(r1.financialPeriod.month).toBe(r2.financialPeriod.month);
  });

  // ─── 10. Same-year concurrency ─────────────────────────────────
  it('should handle concurrent calls for same year — exactly one FiscalYear', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') });

    const [r1, r2] = await Promise.all([
      service.ensureCurrentCalendar(companyId, mockTx as unknown as Prisma.TransactionClient),
      service.ensureCurrentCalendar(companyId, mockTx as unknown as Prisma.TransactionClient),
    ]);

    expect(mockTx.fiscalYear.upsert).toHaveBeenCalledTimes(2);
    expect(r1.fiscalYear.id).toBe(r2.fiscalYear.id);
    expect(r1.fiscalYear.year).toBe(r2.fiscalYear.year);
  });

  // ─── 11. Multi-instance-equivalent concurrency ──────────────────
  it('should keep DB as final authority under equivalent multi-instance concurrency', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') });

    // Simulate two instances calling simultaneously
    const results = await Promise.all([
      service.ensureCurrentCalendar('comp-a', mockTx as unknown as Prisma.TransactionClient),
      service.ensureCurrentCalendar('comp-b', mockTx as unknown as Prisma.TransactionClient),
    ]);

    // Different companies → different rows
    expect(results[0].fiscalYear.companyId).toBe('comp-a');
    expect(results[1].fiscalYear.companyId).toBe('comp-b');
  });

  // ─── 12. UTC boundary ──────────────────────────────────────────
  it('should use UTC year/month at 23:59:59 vs 00:00:00 boundary', async () => {
    // 2026-09-30T23:59:59Z → UTC month = September
    jest.useFakeTimers({ now: new Date('2026-09-30T23:59:59.999Z') });

    const before = await service.ensureCurrentCalendar(
      companyId,
      mockTx as unknown as Prisma.TransactionClient,
    );
    expect(before.financialPeriod.month).toBe(9);
    expect(before.financialPeriod.year).toBe(2026);

    jest.useRealTimers();

    // 2026-10-01T00:00:00Z → UTC month = October
    jest.useFakeTimers({ now: new Date('2026-10-01T00:00:00.000Z') });

    // Simulate a new FiscalYear + period for October
    mockTx.fiscalYear.upsert.mockResolvedValueOnce({
      id: 'fy-1',
      companyId,
      year: 2026,
      name: '2026',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T23:59:59.999Z'),
      isClosed: false,
      closedAt: null,
      closedBy: null,
      retainedEarningsAccountId: null,
      rowVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockTx.financialPeriod.upsert.mockResolvedValueOnce({
      id: 'fp-oct',
      companyId,
      name: '2026-10',
      year: 2026,
      month: 10,
      startDate: new Date('2026-10-01T00:00:00.000Z'),
      endDate: new Date('2026-10-31T23:59:59.999Z'),
      status: FinancialPeriodStatus.OPEN,
      openedBy: null,
      openedAt: new Date(),
      closedBy: null,
      closedAt: null,
      notes: null,
      rowVersion: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const after = await service.ensureCurrentCalendar(
      companyId,
      mockTx as unknown as Prisma.TransactionClient,
    );
    expect(after.financialPeriod.month).toBe(10);
    expect(after.financialPeriod.year).toBe(2026);
  });

  // ─── 13. Tenant isolation ──────────────────────────────────────
  it('should not allow company A to affect company B calendar', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') });

    const r1 = await service.ensureCurrentCalendar(
      'comp-a',
      mockTx as unknown as Prisma.TransactionClient,
    );
    const r2 = await service.ensureCurrentCalendar(
      'comp-b',
      mockTx as unknown as Prisma.TransactionClient,
    );

    const fpCall1 = mockTx.financialPeriod.upsert.mock.calls[0][0];
    const fpCall2 = mockTx.financialPeriod.upsert.mock.calls[1][0];

    expect(fpCall1.where.companyId_year_month.companyId).toBe('comp-a');
    expect(fpCall2.where.companyId_year_month.companyId).toBe('comp-b');
    expect(r1.financialPeriod.companyId).toBe('comp-a');
    expect(r2.financialPeriod.companyId).toBe('comp-b');
  });

  // ─── 14. FiscalYear name and date fields ───────────────────────
  it('should set correct FiscalYear name and UTC date boundaries', async () => {
    jest.useFakeTimers({ now: new Date('2026-06-15T10:00:00Z') });

    await service.ensureCurrentCalendar(
      companyId,
      mockTx as unknown as Prisma.TransactionClient,
    );

    const fyCall = mockTx.fiscalYear.upsert.mock.calls[0][0];
    expect(fyCall.create.name).toBe('2026');
    expect(fyCall.create.startDate).toEqual(new Date(Date.UTC(2026, 0, 1)));
    expect(fyCall.create.endDate).toEqual(
      new Date(Date.UTC(2026, 11, 31, 23, 59, 59, 999)),
    );
  });

  // ─── 15. FinancialPeriod date boundaries ────────────────────────
  it('should set correct FinancialPeriod UTC date boundaries', async () => {
    jest.useFakeTimers({ now: new Date('2026-03-15T10:00:00Z') });

    await service.ensureCurrentCalendar(
      companyId,
      mockTx as unknown as Prisma.TransactionClient,
    );

    const fpCall = mockTx.financialPeriod.upsert.mock.calls[0][0];
    expect(fpCall.create.startDate).toEqual(new Date(Date.UTC(2026, 2, 1)));
    expect(fpCall.create.endDate).toEqual(
      new Date(Date.UTC(2026, 3, 0, 23, 59, 59, 999)),
    );
    expect(fpCall.create.name).toBe('2026-03');
  });

  // ─── 16. Uses caller's tx, not its own transaction ─────────────
  it('should use the provided transaction client, not create its own', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-15T12:00:00Z') });

    await service.ensureCurrentCalendar(
      companyId,
      mockTx as unknown as Prisma.TransactionClient,
    );

    // Both upserts must have been called on the SAME mock tx
    expect(mockTx.fiscalYear.upsert).toHaveBeenCalledTimes(1);
    expect(mockTx.financialPeriod.upsert).toHaveBeenCalledTimes(1);
  });
});
