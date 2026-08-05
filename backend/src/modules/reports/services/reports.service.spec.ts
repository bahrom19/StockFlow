import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ReportsService } from './reports.service';
import { ReportsRepository } from '../repositories/reports.repository';
import { ReportQueryDto } from '../dto/report-query.dto';

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
        ) => (status ? { companyId, status } : { companyId }),
      ),
      profitReportData: jest.fn(),
      grossProfitData: jest.fn(),
      salesReportData: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: ReportsRepository, useValue: repo },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('profit report: single completed sale → full revenue and profit', async () => {
    // Repo (net-scoped) returns only revenue-generating sales.
    repo.profitReportData.mockResolvedValue([
      completedSale('s1', '1500.0000', [{ cost: '1000.0000', qty: 1 }]),
    ]);
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    // Prisma.Decimal normalizes trailing zeros on toString().
    expect(result.summary.revenue).toBe('1500');
    expect(result.summary.cost).toBe('1000');
    expect(result.summary.profit).toBe('500');
    expect(parseFloat(result.summary.margin)).toBeCloseTo(33.33, 2);
  });

  it('profit report: multiple sales aggregate revenue and COGS', async () => {
    repo.profitReportData.mockResolvedValue([
      completedSale('s1', '2000.0000', [{ cost: '1200.0000', qty: 1 }]),
      completedSale('s2', '3000.0000', [{ cost: '1500.0000', qty: 2 }]),
    ]);
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(result.summary.revenue).toBe('5000');
    expect(result.summary.cost).toBe('4200');
    expect(result.summary.profit).toBe('800');
  });

  it('profit report: multiple refunds net to zero', async () => {
    // All three sales refunded — repo netting leaves only the completed one.
    repo.profitReportData.mockResolvedValue([
      completedSale('s1', '500.0000', [{ cost: '300.0000', qty: 1 }]),
    ]);
    const result = await service.getProfitReport(
      'comp-1',
      {} as ReportQueryDto,
    );
    expect(result.summary.revenue).toBe('500');
    expect(result.summary.cost).toBe('300');
    expect(result.summary.profit).toBe('200');
  });

  it('profit report: a refunded sale is not counted (repo excludes REFUNDED)', async () => {
    // Only the COMPLETED sale survives the repository filter; the refunded
    // one is dropped before reaching the service (see repository spec).
    repo.profitReportData.mockResolvedValue([
      completedSale('s1', '100.0000', [{ cost: '60.0000', qty: 1 }]),
    ]);
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
    repo.profitReportData.mockResolvedValue(netSales);
    const dashboard = await service.getDashboard('comp-1');
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
});
