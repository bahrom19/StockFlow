import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';
import { ReportsRepository } from '../repositories/reports.repository';
import { ReportQueryDto } from '../dto/report-query.dto';
import { LedgerQueryService } from '../../finance/services/ledger-query.service';

const dec = (v: string | number) => new Prisma.Decimal(v);

const completedSale = (
  id: string,
  total: string,
  items: { cost: string; qty: number }[],
  createdAt?: Date,
) => ({
  id,
  status: 'COMPLETED',
  total: dec(total),
  createdAt: createdAt ?? new Date('2026-01-15T10:00:00.000Z'),
  items: items.map((i) => ({
    costPrice: dec(i.cost),
    quantity: i.qty,
  })),
});

describe('ReportsService — net refunds (P1)', () => {
  let service: ReportsService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let repo: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ledgerQuery: Record<string, any>;

  beforeEach(async () => {
    repo = {
      buildSaleWhere: jest.fn(
        (
          companyId: string,
          _dateFrom?: Date,
          _dateTo?: Date,
          _warehouseId?: string,
          _cashierId?: string,
          _customerId?: string,
          status?: string,
          currency?: string,
        ) => ({
          companyId,
          ...(status ? { status } : {}),
          ...(currency ? { currency } : {}),
        }),
      ),
      companyCurrency: jest.fn().mockResolvedValue('KZT'),
      profitReportData: jest.fn(),
      grossProfitData: jest.fn(),
      salesReportData: jest.fn(),
      // G11-B: default no OUT layers → legacy costPrice fallback.
      saleFifoCosts: jest.fn().mockResolvedValue(new Map()),
      // G11-F1: default no completed refunds → zero deductions.
      salesRefundTotals: jest.fn().mockResolvedValue(new Map()),
      revenueSaleIds: jest.fn().mockResolvedValue([]),
      dashboardSummary: jest.fn(),
      completedSaleIds: jest.fn(),
      topProductsData: jest.fn(),
      productsByIds: jest.fn(),
      lowStockData: jest.fn(),
      inventoryValuationData: jest.fn(),
      customerList: jest.fn(),
      customerSaleAggs: jest.fn(),
      supplierList: jest.fn(),
      supplierPurchaseAggs: jest.fn(),
      purchasingReportData: jest.fn(),
      buildPurchaseWhere: jest.fn(() => ({})),
      cashShiftData: jest.fn(),
      buildCashShiftWhere: jest.fn(() => ({})),
    };

    // G15-06b-02: GL-backed P&L mock — provides getPnlReport with the same
    // interface as LedgerQueryService. Tests set up GL journal line aggregates
    // directly instead of operational Sale/CostLayer data.
    ledgerQuery = {
      getPnlReport: jest.fn().mockResolvedValue({
        revenue: dec(0),
        cogs: dec(0),
        expenses: dec(0),
        daily: {},
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: ReportsRepository, useValue: repo },
        { provide: LedgerQueryService, useValue: ledgerQuery },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('profit report: single completed sale → full revenue and profit', async () => {
    // G15-06b-02: GL-backed — getPnlReport returns GL aggregates directly.
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('1500'),
      cogs: dec('1000'),
      expenses: dec(0),
      daily: { '2026-01-15': { revenue: dec('1500'), cogs: dec('1000'), expenses: dec(0) } },
    });
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(result.summary.revenue).toBe('1500');
    expect(result.summary.cost).toBe('1000');
    expect(result.summary.profit).toBe('500');
    expect(parseFloat(result.summary.margin)).toBeCloseTo(33.33, 2);
  });

  it('profit report: multiple sales aggregate revenue and COGS', async () => {
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('5000'),
      cogs: dec('4200'),
      expenses: dec(0),
      daily: { '2026-01-15': { revenue: dec('5000'), cogs: dec('4200'), expenses: dec(0) } },
    });
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(result.summary.revenue).toBe('5000');
    expect(result.summary.cost).toBe('4200');
    expect(result.summary.profit).toBe('800');
  });

  it('profit report: multiple refunds net to zero', async () => {
    // G15-06b-02: Refund journals already reverse Revenue/COGS in the GL.
    // The GL balance is net of refunds — no separate deduction needed.
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('500'),
      cogs: dec('300'),
      expenses: dec(0),
      daily: { '2026-01-15': { revenue: dec('500'), cogs: dec('300'), expenses: dec(0) } },
    });
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(result.summary.revenue).toBe('500');
    expect(result.summary.cost).toBe('300');
    expect(result.summary.profit).toBe('200');
  });

  it('profit report: a refunded sale is not counted (repo excludes REFUNDED)', async () => {
    // G15-06b-02: Refunded sales produce reversal journals. GL revenue is net.
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('100'),
      cogs: dec('60'),
      expenses: dec(0),
      daily: { '2026-01-15': { revenue: dec('100'), cogs: dec('60'), expenses: dec(0) } },
    });
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(result.daily).toHaveLength(1);
    expect(result.daily[0]!.revenue).toBe('100');
    expect(result.summary.revenue).toBe('100');
  });

  it('dashboard grossRevenue equals profit report net revenue', async () => {
    repo.dashboardSummary.mockResolvedValue([
      { _sum: { total: null }, _count: { id: 0 } }, // today
      { _sum: { total: null }, _count: { id: 0 } }, // yesterday
      { _sum: { total: null }, _count: { id: 0 } }, // month
      0, // orderCount
      [], // stocks
      0, // customers
      0, // suppliers
      { _sum: { grandTotal: null } }, // purchases
    ]);
    const netSales = [
      completedSale('s1', '1500.0000', [{ cost: '1000.0000', qty: 1 }]),
    ];
    repo.grossProfitData.mockResolvedValue(netSales);
    // G15-06b-02: profit report now uses GL — mock getPnlReport to match dashboard.
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('1500'),
      cogs: dec('1000'),
      expenses: dec(0),
      daily: {},
    });
    const dashboard = await service.getDashboard(
      'comp-1',
      {} as ReportQueryDto,
    );
    const profit = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(dashboard.grossRevenue).toBe('1500');
    expect(dashboard.grossProfit).toBe('500');
    expect(dashboard.grossRevenue).toBe(profit.summary.revenue);
  });

  it('sales report adds revenue status scope when no explicit status filter', async () => {
    repo.salesReportData.mockResolvedValue([
      [],
      { _sum: {}, _count: { id: 0 }, _avg: {} },
      { _sum: {} },
    ]);
    await service.getSalesReport('comp-1', {} as ReportQueryDto);
    const where = repo.salesReportData.mock.calls[0][1];
    expect(where.status).toEqual({ in: ['COMPLETED', 'PARTIALLY_REFUNDED'] });
  });

  it('sales report respects explicit status filter', async () => {
    repo.salesReportData.mockResolvedValue([
      [],
      { _sum: {}, _count: { id: 0 }, _avg: {} },
      { _sum: {} },
    ]);
    await service.getSalesReport('comp-1', {
      status: 'REFUNDED',
    } as ReportQueryDto);
    const where = repo.salesReportData.mock.calls[0][1];
    expect(where.status).toBe('REFUNDED');
  });

  it('sales report payments breakdown is per-method (v1.2)', async () => {
    repo.salesReportData.mockResolvedValue([
      [
        {
          id: 's1',
          saleNumber: 'S-1',
          createdAt: new Date(),
          status: 'COMPLETED',
          total: dec('2400.0000'),
          paidAmount: dec('2400.0000'),
          items: [],
          payments: [
            { method: 'CASH', amount: dec('1000.0000') },
            { method: 'CARD', amount: dec('500.0000') },
            { method: 'QR', amount: dec('400.0000') },
            { method: 'BANK_TRANSFER', amount: dec('200.0000') },
            { method: 'MOBILE_WALLET', amount: dec('300.0000') },
          ],
        },
      ],
      {
        _sum: {
          total: dec('2400.0000'),
          subtotal: dec('2400.0000'),
          paidAmount: dec('2400.0000'),
          discount: dec('0'),
        },
        _count: { id: 1 },
        _avg: { total: dec('2400.0000') },
      },
      { _sum: {} },
    ]);
    const result = await service.getSalesReport('comp-1', {} as ReportQueryDto);
    const p = result.summary.payments;
    expect(p.cash).toBe('1000');
    expect(p.card).toBe('500');
    expect(p.qr).toBe('400');
    expect(p.bankTransfer).toBe('200');
    expect(p.mobileWallet).toBe('300');
    expect(p.other).toBe('0');
  });

  // ── Payment breakdown invariant: sum(payments) == revenue (v1.2 High fix) ──

  const salesReportRow = (over: {
    id: string;
    total: string;
    paidAmount: string;
    changeAmount?: string;
    payments: { method: string; amount: string }[];
  }) => ({
    id: over.id,
    saleNumber: `S-${over.id}`,
    createdAt: new Date(),
    status: 'COMPLETED',
    total: dec(over.total),
    paidAmount: dec(over.paidAmount),
    changeAmount: dec(over.changeAmount ?? '0'),
    items: [],
    payments: over.payments.map((p) => ({
      method: p.method,
      amount: dec(p.amount),
    })),
  });

  const salesReportMock = (rows: ReturnType<typeof salesReportRow>[]) => {
    const revenue = rows.reduce(
      (a, r) => a + parseFloat(r.total.toString()),
      0,
    );
    repo.salesReportData.mockResolvedValue([
      rows,
      {
        _sum: {
          total: dec(revenue),
          subtotal: dec(revenue),
          paidAmount: dec(revenue),
          discount: dec('0'),
        },
        _count: { id: rows.length },
        _avg: { total: dec(revenue) },
      },
      { _sum: {} },
    ]);
  };

  const paymentsSum = (p: {
    cash: string;
    card: string;
    qr: string;
    bankTransfer: string;
    mobileWallet: string;
    other: string;
  }) =>
    ['cash', 'card', 'qr', 'bankTransfer', 'mobileWallet', 'other'].reduce(
      (a, k) => a + parseFloat(p[k as keyof typeof p]),
      0,
    );

  it('payments: exact payment — cash unchanged, sum == revenue', async () => {
    salesReportMock([
      salesReportRow({
        id: 's1',
        total: '1500',
        paidAmount: '1500',
        changeAmount: '0',
        payments: [{ method: 'CASH', amount: '1500' }],
      }),
    ]);
    const result = await service.getSalesReport('comp-1', {} as ReportQueryDto);
    expect(result.summary.payments.cash).toBe('1500');
    expect(paymentsSum(result.summary.payments)).toBe(
      parseFloat(result.summary.revenue),
    );
  });

  it('payments: overpayment — cash is NET of change (High fix)', async () => {
    // total 900, cash tendered 1800, change 900 → reported cash must be 900.
    salesReportMock([
      salesReportRow({
        id: 's1',
        total: '900',
        paidAmount: '1800',
        changeAmount: '900',
        payments: [{ method: 'CASH', amount: '1800' }],
      }),
    ]);
    const result = await service.getSalesReport('comp-1', {} as ReportQueryDto);
    expect(result.summary.payments.cash).toBe('900');
    expect(result.summary.revenue).toBe('900');
    expect(paymentsSum(result.summary.payments)).toBe(
      parseFloat(result.summary.revenue),
    );
  });

  it('payments: mixed payment — each method counted, sum == revenue', async () => {
    salesReportMock([
      salesReportRow({
        id: 's1',
        total: '1900',
        paidAmount: '1900',
        changeAmount: '0',
        payments: [
          { method: 'CASH', amount: '1000' },
          { method: 'CARD', amount: '500' },
          { method: 'QR', amount: '400' },
        ],
      }),
    ]);
    const result = await service.getSalesReport('comp-1', {} as ReportQueryDto);
    const p = result.summary.payments;
    expect(p.cash).toBe('1000');
    expect(p.card).toBe('500');
    expect(p.qr).toBe('400');
    expect(paymentsSum(p)).toBe(parseFloat(result.summary.revenue));
  });

  it('payments: mixed payment with overpayment — only cash is netted', async () => {
    // total 900, paid CASH 1000 + CARD 800, change 900 → cash 100, card 800.
    salesReportMock([
      salesReportRow({
        id: 's1',
        total: '900',
        paidAmount: '1800',
        changeAmount: '900',
        payments: [
          { method: 'CASH', amount: '1000' },
          { method: 'CARD', amount: '800' },
        ],
      }),
    ]);
    const result = await service.getSalesReport('comp-1', {} as ReportQueryDto);
    const p = result.summary.payments;
    expect(p.cash).toBe('100');
    expect(p.card).toBe('800');
    expect(paymentsSum(p)).toBe(parseFloat(result.summary.revenue));
  });

  it('payments: change drawn from float (no cash tendered) — invariant still holds', async () => {
    // CARD 500 paid / 400 total / 100 change → cash bucket = 0 − 100 = −100
    // (change dispensed from drawer float, mirroring sales.service.ts).
    // Algebraic invariant: sum(payments) = paidAmount − change = total = revenue.
    salesReportMock([
      salesReportRow({
        id: 's1',
        total: '400',
        paidAmount: '500',
        changeAmount: '100',
        payments: [{ method: 'CARD', amount: '500' }],
      }),
    ]);
    const result = await service.getSalesReport('comp-1', {} as ReportQueryDto);
    const p = result.summary.payments;
    expect(p.cash).toBe('-100');
    expect(p.card).toBe('500');
    expect(paymentsSum(p)).toBe(parseFloat(result.summary.revenue));
  });

  it('payments: refund after overpayment — invariant holds on remaining revenue', async () => {
    // The REFUNDED sale is excluded by the repository (net revenue scope);
    // the surviving overpayment sale must still balance.
    salesReportMock([
      salesReportRow({
        id: 's2',
        total: '900',
        paidAmount: '1800',
        changeAmount: '900',
        payments: [{ method: 'CASH', amount: '1800' }],
      }),
    ]);
    const result = await service.getSalesReport('comp-1', {} as ReportQueryDto);
    expect(result.summary.payments.cash).toBe('900');
    expect(paymentsSum(result.summary.payments)).toBe(
      parseFloat(result.summary.revenue),
    );
  });

  it('sales report summary uses the net aggregate values', async () => {
    repo.salesReportData.mockResolvedValue([
      [
        {
          id: 's1',
          saleNumber: 'S-1',
          createdAt: new Date(),
          status: 'COMPLETED',
          total: dec('1500.0000'),
          paidAmount: dec('1500.0000'),
          items: [
            {
              costPrice: dec('1000.0000'),
              quantity: 1,
              total: dec('1500.0000'),
              productId: 'p1',
            },
          ],
          payments: [{ method: 'CASH', amount: dec('1500.0000') }],
        },
      ],
      {
        _sum: {
          total: dec('1500.0000'),
          subtotal: dec('1500.0000'),
          paidAmount: dec('1500.0000'),
          discount: dec('0'),
        },
        _count: { id: 1 },
        _avg: { total: dec('1500.0000') },
      },
      { _sum: { quantity: 1, costPrice: dec('1000.0000') } },
    ]);
    const result = await service.getSalesReport('comp-1', {} as ReportQueryDto);
    expect(result.summary.revenue).toBe('1500');
    expect(result.summary.profit).toBe('500');
    expect(result.summary.count).toBe(1);
  });

  // ── Multi-currency scoping (Currency-4) ─────────────────────────

  it('sales report: currency=KZT forwards the filter and keeps revenue status scope', async () => {
    repo.salesReportData.mockResolvedValue([
      [],
      { _sum: {}, _count: { id: 0 }, _avg: {} },
      { _sum: {} },
    ]);
    await service.getSalesReport(
      'comp-1',
      { currency: 'KZT' } as ReportQueryDto,
    );
    const where = repo.salesReportData.mock.calls[0][1];
    expect(where.currency).toBe('KZT');
    expect(where.status).toEqual({ in: ['COMPLETED', 'PARTIALLY_REFUNDED'] });
  });

  it('sales report: currency=USD forwards the filter', async () => {
    repo.salesReportData.mockResolvedValue([
      [],
      { _sum: {}, _count: { id: 0 }, _avg: {} },
      { _sum: {} },
    ]);
    await service.getSalesReport(
      'comp-1',
      { currency: 'USD' } as ReportQueryDto,
    );
    const where = repo.salesReportData.mock.calls[0][1];
    expect(where.currency).toBe('USD');
  });

  it('profit report: currency filter reaches getPnlReport (no mixed-currency total)', async () => {
    // G15-06b-02: GL-backed P&L receives date range filters.
    // Currency filtering is now resolved at the GL level.
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec(0),
      cogs: dec(0),
      expenses: dec(0),
      daily: {},
    });
    await service.getProfitReport(
      'comp-1',
      { currency: 'KZT' } as ReportQueryDto,
    );
    expect(ledgerQuery.getPnlReport).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'comp-1' }),
    );
  });

  it('dashboard: explicit currency=USD drives dashboardSummary and grossProfitData', async () => {
    repo.dashboardSummary.mockResolvedValue([
      { _sum: { total: dec('100.00') }, _count: { id: 1 } },
      { _sum: { total: null }, _count: { id: 0 } },
      { _sum: { total: null }, _count: { id: 0 } },
      1,
      [],
      0,
      0,
      { _sum: { grandTotal: null } },
    ]);
    repo.grossProfitData.mockResolvedValue([]);
    const dashboard = await service.getDashboard(
      'comp-1',
      { currency: 'USD' } as ReportQueryDto,
    );
    expect(dashboard.todaySales.revenue).toBe('100');
    expect(repo.dashboardSummary.mock.calls[0][4]).toBe('USD');
    expect(repo.grossProfitData.mock.calls[0][1]).toBe('USD');
  });

  it('dashboard: omitted currency resolves to the company base currency', async () => {
    (repo.companyCurrency as jest.Mock).mockResolvedValueOnce('USD');
    repo.dashboardSummary.mockResolvedValue([
      { _sum: { total: null }, _count: { id: 0 } },
      { _sum: { total: null }, _count: { id: 0 } },
      { _sum: { total: null }, _count: { id: 0 } },
      0,
      [],
      0,
      0,
      { _sum: { grandTotal: null } },
    ]);
    repo.grossProfitData.mockResolvedValue([]);
    const dashboard = await service.getDashboard(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(dashboard).toBeDefined();
    expect(repo.dashboardSummary.mock.calls[0][4]).toBe('USD');
  });

  it('purchasing report: currency filter reaches buildPurchaseWhere', async () => {
    repo.purchasingReportData.mockResolvedValue([
      [],
      { _sum: {}, _count: { id: 0 } },
      [],
    ]);
    await service.getPurchasingReport(
      'comp-1',
      { currency: 'USD' } as ReportQueryDto,
    );
    expect(repo.buildPurchaseWhere).toHaveBeenCalledWith(
      'comp-1',
      undefined,
      undefined,
      'USD',
    );
  });

  it('cash shift report: currency filter reaches buildCashShiftWhere', async () => {
    repo.cashShiftData.mockResolvedValue([[], 0]);
    await service.getCashShiftReport(
      'comp-1',
      { currency: 'KZT' } as ReportQueryDto,
    );
    expect(repo.buildCashShiftWhere).toHaveBeenCalledWith(
      'comp-1',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'KZT',
    );
  });

  // ── Canonical FIFO COGS (G11-B) ─────────────────────────────────

  const fifoSale = (
    id: string,
    total: string,
    items: { cost: string; qty: number }[],
  ) => ({
    ...completedSale(id, total, items),
    items: items.map((i) => ({
      costPrice: dec(i.cost),
      quantity: i.qty,
    })),
  });

  const fifoMock = (layers: Record<string, string[]>) => {
    // Map<saleId, layer totals[]> → repo.saleFifoCosts contract shape.
    repo.saleFifoCosts.mockImplementation(
      (
        _companyId: string,
        saleIds: string[],
      ): Map<string, { totalCost: Prisma.Decimal; layerCount: number }> => {
        const map = new Map<
          string,
          { totalCost: Prisma.Decimal; layerCount: number }
        >();
        for (const saleId of saleIds) {
          const totals = layers[saleId];
          if (!totals?.length) continue;
          map.set(saleId, {
            totalCost: totals
              .map((t) => dec(t))
              .reduce((a, t) => a.add(t), dec(0)),
            layerCount: totals.length,
          });
        }
        return map;
      },
    );
  };

  it('GL-backed P&L: revenue, COGS, and expenses are correctly aggregated', async () => {
    // G15-06b-02: GL aggregates — revenue from REVENUE accounts, COGS from
    // 5xxx EXPENSE accounts, operating expenses from 6xxx EXPENSE accounts.
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('1500'),
      cogs: dec('70'),
      expenses: dec('200'),
      daily: { '2026-01-15': { revenue: dec('1500'), cogs: dec('70'), expenses: dec('200') } },
    });
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(result.summary.revenue).toBe('1500');
    expect(result.summary.cost).toBe('70');
    expect(result.summary.expenses).toBe('200');
    expect(result.summary.profit).toBe('1430');
    expect(result.summary.netProfit).toBe('1230');
  });

  it('GL-backed P&L: manual revenue journal appears in GL totals', async () => {
    // G15-06b-02: Manual Dr Cash / Cr Revenue journal is already in the GL
    // when POSTED — no special operational handling needed.
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('2500'),  // 1500 sale + 1000 manual journal
      cogs: dec('1000'),
      expenses: dec(0),
      daily: { '2026-01-15': { revenue: dec('2500'), cogs: dec('1000'), expenses: dec(0) } },
    });
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(result.summary.revenue).toBe('2500');
    expect(result.summary.cost).toBe('1000');
    expect(result.summary.profit).toBe('1500');
  });

  it('GL-backed P&L: manual expense journal appears in GL expenses', async () => {
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('3000'),
      cogs: dec('1200'),
      expenses: dec('500'),  // Manual Dr Expense / Cr Cash
      daily: { '2026-01-15': { revenue: dec('3000'), cogs: dec('1200'), expenses: dec('500') } },
    });
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(result.summary.revenue).toBe('3000');
    expect(result.summary.cost).toBe('1200');
    expect(result.summary.expenses).toBe('500');
    expect(result.summary.netProfit).toBe('1300');
  });

  it('GL-backed P&L: manual COGS journal (Dr COGS / Cr Inventory) appears in cost', async () => {
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('2000'),
      cogs: dec('900'),   // 700 operational + 200 manual
      expenses: dec(0),
      daily: { '2026-01-15': { revenue: dec('2000'), cogs: dec('900'), expenses: dec(0) } },
    });
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(result.summary.cost).toBe('900');
    expect(result.summary.profit).toBe('1100');
  });

  it('GL-backed P&L: DRAFT journals excluded from GL aggregation', async () => {
    // G15-06b-02: only POSTED entries appear in the GL. A DRAFT manual
    // revenue journal does not affect the P&L until posted.
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('1500'),  // Only the posted sale, DRAFT excluded
      cogs: dec('1000'),
      expenses: dec(0),
      daily: { '2026-01-15': { revenue: dec('1500'), cogs: dec('1000'), expenses: dec(0) } },
    });
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(result.summary.revenue).toBe('1500');
  });

  it('GL-backed P&L: refund does not double-count (GL is sole source)', async () => {
    // G15-06b-02: Refund journals already reverse Revenue and COGS in the GL.
    // The GL balance is the net position — no operational refund subtraction.
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('500'),   // 1500 sale - 1000 refund reversal = 500 net
      cogs: dec('300'),      // 1000 COGS - 700 refund reversal = 300 net
      expenses: dec(0),
      daily: { '2026-01-15': { revenue: dec('500'), cogs: dec('300'), expenses: dec(0) } },
    });
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(result.summary.revenue).toBe('500');
    expect(result.summary.cost).toBe('300');
    expect(result.summary.profit).toBe('200');
  });

  it('GL-backed P&L: profit buckets (daily) carry GL aggregates', async () => {
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('1500'),
      cogs: dec('70'),
      expenses: dec(0),
      daily: { '2026-01-15': { revenue: dec('1500'), cogs: dec('70'), expenses: dec(0) } },
    });
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(Object.keys(result.daily)).toHaveLength(1);
    expect(result.daily[0]!.revenue).toBe('1500');
    expect(result.daily[0]!.cost).toBe('70');
    expect(result.daily[0]!.profit).toBe('1430');
    expect(result.summary.cost).toBe('70');
  });

  it('canonical COGS: sales report profit and margin flow from FIFO cost (TEST 6)', async () => {
    fifoMock({ s1: ['70'] });
    repo.salesReportData.mockResolvedValue([
      [
        {
          id: 's1',
          saleNumber: 'S-1',
          createdAt: new Date(),
          status: 'COMPLETED',
          total: dec('1500.0000'),
          paidAmount: dec('1500.0000'),
          items: [
            {
              costPrice: dec('100.0000'),
              quantity: 1,
              total: dec('1500.0000'),
              productId: 'p1',
            },
          ],
          payments: [],
        },
      ],
      {
        _sum: {
          total: dec('1500.0000'),
          subtotal: dec('1500.0000'),
          paidAmount: dec('1500.0000'),
          discount: dec('0'),
        },
        _count: { id: 1 },
        _avg: { total: dec('1500.0000') },
      },
      { _sum: { quantity: 1, costPrice: dec('100.0000') } },
    ]);
    const result = await service.getSalesReport('comp-1', {} as ReportQueryDto);
    expect(result.summary.profit).toBe('1430');
    // margin = 1430/1500 × 100 = 95.33…
    expect(parseFloat(result.summary.margin)).toBeCloseTo(95.33, 2);
    // FIFO resolution was requested for the current page's sale ids.
    expect(repo.saleFifoCosts).toHaveBeenCalledWith('comp-1', ['s1']);
  });

  it('canonical COGS: dashboard gross profit uses FIFO basis, revenue filter preserved (TEST 5)', async () => {
    fifoMock({ s1: ['70'] });
    repo.dashboardSummary.mockResolvedValue([
      { _sum: { total: null }, _count: { id: 0 } },
      { _sum: { total: null }, _count: { id: 0 } },
      { _sum: { total: null }, _count: { id: 0 } },
      0,
      [],
      0,
      0,
      { _sum: { grandTotal: null } },
    ]);
    repo.grossProfitData.mockResolvedValue([
      fifoSale('s1', '1500.0000', [{ cost: '100.0000', qty: 1 }]),
    ]);
    const dashboard = await service.getDashboard(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(dashboard.grossRevenue).toBe('1500');
    expect(dashboard.grossProfit).toBe('1430');
    // Revenue/status filter unchanged (G11-B touches COGS source only).
    expect(repo.grossProfitData).toHaveBeenCalledWith('comp-1', 'KZT');
    expect(repo.saleFifoCosts).toHaveBeenCalledWith('comp-1', ['s1']);
  });

  it('GL-backed P&L: multi-product sale resolves each sale by its own GL COGS', async () => {
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('4500'),
      cogs: dec('300'),   // 70 from s1 + 230 from s2
      expenses: dec(0),
      daily: { '2026-01-15': { revenue: dec('4500'), cogs: dec('300'), expenses: dec(0) } },
    });
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(result.summary.cost).toBe('300');
  });

  // ── G15-06b-02: GL-backed refund invariants ─────────────────────
  it('GL-backed P&L: refund reversal journals are reflected in GL balance', async () => {
    // G15-06b-02: Refund journals (Dr 4000 Revenue / Cr AR) and
    // (Dr Inventory / Cr 5000 COGS) reduce GL balances automatically.
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('600'),    // 1000 sale − 400 refund reversal
      cogs: dec('360'),       // 600 COGS − 240 refund reversal
      expenses: dec(0),
      daily: { '2026-01-15': { revenue: dec('600'), cogs: dec('360'), expenses: dec(0) } },
    });
    const result = await service.getProfitReport('comp-1', {} as ReportQueryDto);
    expect(result.summary.revenue).toBe('600');
    expect(result.summary.cost).toBe('360');
    expect(result.summary.profit).toBe('240');
    const dayRow = result.daily.find(
      (d: { date: string }) => d.date === '2026-01-15',
    );
    expect(dayRow!.revenue).toBe('600');
    expect(dayRow!.cost).toBe('360');
  });

  it('GL-backed P&L: no refunds → GL balance equals gross values', async () => {
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('1000'),
      cogs: dec('600'),
      expenses: dec(0),
      daily: { '2026-01-15': { revenue: dec('1000'), cogs: dec('600'), expenses: dec(0) } },
    });
    const result = await service.getProfitReport('comp-1', {} as ReportQueryDto);
    expect(result.summary.revenue).toBe('1000');
    expect(result.summary.cost).toBe('600');
  });

  it('G11-F1: sales report summary revenue/profit are netted', async () => {
    repo.salesReportData.mockResolvedValue([
      [
        {
          id: 's1',
          saleNumber: 'S-1',
          createdAt: new Date(),
          status: 'PARTIALLY_REFUNDED',
          total: dec('1000.0000'),
          paidAmount: dec('1000.0000'),
          changeAmount: dec('0'),
          items: [
            { quantity: 1, total: dec('1000.0000'), costPrice: dec('0.0000') },
          ],
          payments: [],
        },
      ],
      { _sum: { total: dec('1000.0000') }, _count: { id: 1 }, _avg: {} },
      { _sum: { quantity: 1, costPrice: dec('0') } },
    ]);
    repo.salesRefundTotals.mockResolvedValue(
      new Map([['s1', { refundTotal: dec('250.0000'), refundFifoCost: dec('100.0000') }]]),
    );
    const result = await service.getSalesReport('comp-1', {} as ReportQueryDto);
    expect(result.summary.revenue).toBe('750'); // 1000 − 250
    // profit = netRevenue − (grossCost − refundFifo)
    expect(Number(result.summary.profit)).toBe(750 - (0 - 100));
  });

  it('G11-F1: no refunds → all reports equal gross values (no regression)', async () => {
    ledgerQuery.getPnlReport.mockResolvedValue({
      revenue: dec('1000'),
      cogs: dec('600'),
      expenses: dec(0),
      daily: { '2026-01-15': { revenue: dec('1000'), cogs: dec('600'), expenses: dec(0) } },
    });
    const result = await service.getProfitReport('comp-1', {} as ReportQueryDto);
    expect(result.summary.revenue).toBe('1000');
    expect(result.summary.cost).toBe('600');
  });

  it('G11-F1: dashboard grossRevenue/grossProfit are netted', async () => {
    repo.dashboardSummary.mockResolvedValue([
      { _sum: { total: dec('300') }, _count: { id: 1 } }, // today
      { _sum: { total: null }, _count: { id: 0 } }, // yesterday
      { _sum: { total: null }, _count: { id: 0 } }, // month
      0,
      [],
      0,
      0,
      { _sum: { grandTotal: null } },
    ]);
    repo.grossProfitData.mockResolvedValue([
      completedSale('s1', '2000.0000', [{ cost: '1200.0000', qty: 1 }]),
    ]);
    repo.revenueSaleIds.mockResolvedValue(['s1']);
    repo.salesRefundTotals.mockImplementation(
      async (_c: string, ids: string[]) =>
        ids.includes('s1')
          ? new Map([['s1', { refundTotal: dec('500.0000'), refundFifoCost: dec('300.0000') }]])
          : new Map(),
    );
    const result = await service.getDashboard('comp-1', {} as ReportQueryDto);
    // grossRevenue 2000−500; grossProfit (2000−500)−(1200−300)
    expect(result.grossRevenue).toBe('1500');
    expect(result.grossProfit).toBe('600');
    // today bucket: 300 (COMPLETED aggregate) − 500 (refund on s1 in window)
    expect(result.todaySales.revenue).toBe('-200');
  });

  it('G11-F1: dashboard daily buckets include PARTIALLY_REFUNDED sales (revenue statuses)', async () => {
    repo.dashboardSummary.mockResolvedValue([
      { _sum: { total: dec('700') }, _count: { id: 2 } },
      { _sum: { total: null }, _count: { id: 0 } },
      { _sum: { total: null }, _count: { id: 0 } },
      0,
      [],
      0,
      0,
      { _sum: { grandTotal: null } },
    ]);
    repo.revenueSaleIds.mockResolvedValue([]); // no partial sales in window
    repo.grossProfitData.mockResolvedValue([]);
    const result = await service.getDashboard('comp-1', {} as ReportQueryDto);
    expect(result.todaySales.revenue).toBe('700');
    // bucket query must scope to revenue statuses, not COMPLETED only
    expect(repo.revenueSaleIds).toHaveBeenCalled();
  });
});
