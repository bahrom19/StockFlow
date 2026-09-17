import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { REVENUE_SALE_STATUSES, ReportsRepository } from './reports.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('ReportsRepository — revenue scoping (P1 net refunds)', () => {
  let repository: ReportsRepository;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPrisma: Record<string, any>;

  beforeEach(async () => {
    mockPrisma = {
      sale: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      saleItem: { aggregate: jest.fn(), groupBy: jest.fn() },
      stock: { findMany: jest.fn(), count: jest.fn() },
      customer: { count: jest.fn() },
      supplier: { count: jest.fn() },
      purchaseOrder: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      product: { findMany: jest.fn() },
      costLayer: { findMany: jest.fn() },
      cashShift: { findMany: jest.fn(), count: jest.fn() },
      company: { findUnique: jest.fn() },
      salesRefund: { findMany: jest.fn() },
      refundPaymentAllocation: { aggregate: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repository = module.get<ReportsRepository>(ReportsRepository);
  });

  it('REVENUE_SALE_STATUSES contains COMPLETED and PARTIALLY_REFUNDED only', () => {
    expect(REVENUE_SALE_STATUSES).toEqual(['COMPLETED', 'PARTIALLY_REFUNDED']);
  });

  it('grossProfitData scopes to revenue statuses and excludes REFUNDED', async () => {
    mockPrisma.sale.findMany.mockResolvedValue([]);
    await repository.grossProfitData('comp-1');
    const where = mockPrisma.sale.findMany.mock.calls[0][0].where;
    expect(where.companyId).toBe('comp-1');
    expect(where.status).toEqual({ in: ['COMPLETED', 'PARTIALLY_REFUNDED'] });
    expect(where.deletedAt).toBeNull();
  });

  it('profitReportData scopes to revenue statuses even when status passed', async () => {
    mockPrisma.sale.findMany.mockResolvedValue([]);
    const where: Prisma.SaleWhereInput = { companyId: 'comp-1' };
    await repository.profitReportData('comp-1', where);
    const calledWhere = mockPrisma.sale.findMany.mock.calls[0][0].where;
    expect(calledWhere.status).toEqual({
      in: ['COMPLETED', 'PARTIALLY_REFUNDED'],
    });
  });

  it('salesReportData passes through explicit status filter (no override)', async () => {
    mockPrisma.sale.findMany.mockResolvedValue([]);
    mockPrisma.sale.aggregate.mockResolvedValue({
      _sum: {},
      _count: { id: 0 },
      _avg: {},
    });
    mockPrisma.saleItem.aggregate.mockResolvedValue({ _sum: {} });
    const where: Prisma.SaleWhereInput = {
      companyId: 'comp-1',
      status: 'REFUNDED',
    };
    await repository.salesReportData(
      'comp-1',
      where,
      1,
      20,
      'createdAt',
      'desc',
    );
    const calledWhere = mockPrisma.sale.findMany.mock.calls[0][0].where;
    expect(calledWhere.status).toBe('REFUNDED');
  });

  it('completedSaleIds still filters COMPLETED only (register/top products)', async () => {
    mockPrisma.sale.findMany.mockResolvedValue([{ id: 's1' }]);
    const ids = await repository.completedSaleIds('comp-1');
    const where = mockPrisma.sale.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('COMPLETED');
    expect(ids).toEqual([{ id: 's1' }]);
  });

  it('buildSaleWhere adds currency when provided (sales/profit reports)', () => {
    const where = repository.buildSaleWhere(
      'comp-1',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'USD',
    );
    expect(where.currency).toBe('USD');
  });

  it('buildSaleWhere omits currency when not provided', () => {
    const where = repository.buildSaleWhere('comp-1');
    expect(where.currency).toBeUndefined();
  });

  it('buildPurchaseWhere adds currency when provided (purchasing report)', () => {
    const where = repository.buildPurchaseWhere(
      'comp-1',
      undefined,
      undefined,
      'USD',
    );
    expect(where.currency).toBe('USD');
  });

  it('buildCashShiftWhere adds currency when provided (cash shift report)', () => {
    const where = repository.buildCashShiftWhere(
      'comp-1',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'KZT',
    );
    expect(where.currency).toBe('KZT');
  });

  it('completedSaleIds adds currency filter when provided (top products)', async () => {
    mockPrisma.sale.findMany.mockResolvedValue([{ id: 's1' }]);
    await repository.completedSaleIds('comp-1', undefined, undefined, 'USD');
    const where = mockPrisma.sale.findMany.mock.calls[0][0].where;
    expect(where.currency).toBe('USD');
    expect(where.status).toBe('COMPLETED');
  });

  it('dashboardSummary scopes sales and purchase aggregates to a single currency', async () => {
    mockPrisma.sale.aggregate.mockResolvedValue({
      _sum: {},
      _count: { id: 0 },
    });
    mockPrisma.stock.findMany.mockResolvedValue([]);
    mockPrisma.customer.count.mockResolvedValue(0);
    mockPrisma.supplier.count.mockResolvedValue(0);
    mockPrisma.purchaseOrder.aggregate.mockResolvedValue({ _sum: {} });
    await repository.dashboardSummary(
      'comp-1',
      new Date('2026-01-01'),
      new Date('2026-01-02'),
      new Date('2026-01-01'),
      'USD',
    );
    // Three sale aggregates + one purchase aggregate all carry where.currency.
    const saleWheres = mockPrisma.sale.aggregate.mock.calls.map(
      (call: unknown[]) =>
        (call[0] as { where: Record<string, unknown> }).where,
    );
    expect(saleWheres).toHaveLength(3);
    for (const w of saleWheres) expect(w.currency).toBe('USD');
    const purchaseWhere = mockPrisma.purchaseOrder.aggregate.mock.calls[0][0]
      .where as Record<string, unknown>;
    expect(purchaseWhere.currency).toBe('USD');
  });

  it('grossProfitData scopes to a single currency', async () => {
    mockPrisma.sale.findMany.mockResolvedValue([]);
    await repository.grossProfitData('comp-1', 'KZT');
    const where = mockPrisma.sale.findMany.mock.calls[0][0].where;
    expect(where.currency).toBe('KZT');
    expect(where.status).toEqual({ in: ['COMPLETED', 'PARTIALLY_REFUNDED'] });
  });

  it('companyCurrency returns the company base currency and falls back to KZT', async () => {
    mockPrisma.company.findUnique.mockResolvedValue({ currency: 'USD' });
    await expect(repository.companyCurrency('comp-1')).resolves.toBe('USD');
    mockPrisma.company.findUnique.mockResolvedValue(null);
    await expect(repository.companyCurrency('comp-1')).resolves.toBe('KZT');
  });

  // ── Canonical FIFO COGS (G11-B) ─────────────────────────────────

  it('saleFifoCosts returns an empty map without querying for an empty dataset', async () => {
    const result = await repository.saleFifoCosts('comp-1', []);
    expect(result.size).toBe(0);
    expect(mockPrisma.costLayer.findMany).not.toHaveBeenCalled();
  });

  it('saleFifoCosts runs ONE grouped tenant-scoped query identical to the Finance GL read', async () => {
    mockPrisma.costLayer.findMany.mockResolvedValue([]);
    await repository.saleFifoCosts('comp-1', ['s1', 's2']);
    expect(mockPrisma.costLayer.findMany).toHaveBeenCalledTimes(1);
    const args = mockPrisma.costLayer.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      companyId: 'comp-1',
      direction: 'OUT',
      referenceType: 'SALE',
      referenceId: { in: ['s1', 's2'] },
    });
  });

  it('saleFifoCosts aggregates multiple OUT layers per sale (sum + count)', async () => {
    mockPrisma.costLayer.findMany.mockResolvedValue([
      { referenceId: 's1', totalCost: new Prisma.Decimal('40') },
      { referenceId: 's1', totalCost: new Prisma.Decimal('60') },
      { referenceId: 's2', totalCost: new Prisma.Decimal('25.5') },
    ]);
    const result = await repository.saleFifoCosts('comp-1', ['s1', 's2']);
    expect(result.get('s1')!.totalCost.toString()).toBe('100');
    expect(result.get('s1')!.layerCount).toBe(2);
    expect(result.get('s2')!.totalCost.toString()).toBe('25.5');
    expect(result.get('s2')!.layerCount).toBe(1);
  });

  it('grossProfitData selects sale id (CostLayer referenceId join key)', async () => {
    mockPrisma.sale.findMany.mockResolvedValue([]);
    await repository.grossProfitData('comp-1');
    const select = mockPrisma.sale.findMany.mock.calls[0][0].select;
    expect(select.id).toBe(true);
  });

  // ── G11-F1: canonical refund aggregation ────────────────────
  it('salesRefundTotals returns an empty map without querying for an empty dataset', async () => {
    const result = await repository.salesRefundTotals('comp-1', []);
    expect(result.size).toBe(0);
    expect(mockPrisma.salesRefund.findMany).not.toHaveBeenCalled();
  });

  it('salesRefundTotals runs ONE grouped tenant-scoped COMPLETED query', async () => {
    mockPrisma.salesRefund.findMany.mockResolvedValue([]);
    await repository.salesRefundTotals('comp-1', ['s1', 's2']);
    const call = mockPrisma.salesRefund.findMany.mock.calls[0][0];
    expect(call.where).toEqual({
      companyId: 'comp-1',
      saleId: { in: ['s1', 's2'] },
      status: 'COMPLETED',
      deletedAt: null,
    });
    expect(call.select.items).toBeDefined(); // fifoCost included in the same query
  });

  it('salesRefundTotals sums refund total and items.fifoCost per sale', async () => {
    mockPrisma.salesRefund.findMany.mockResolvedValue([
      {
        saleId: 's1',
        total: new Prisma.Decimal('300'),
        items: [
          { fifoCost: new Prisma.Decimal('33.3333') },
          { fifoCost: new Prisma.Decimal('66.6667') },
        ],
      },
      {
        saleId: 's1',
        total: new Prisma.Decimal('200.5'),
        items: [{ fifoCost: new Prisma.Decimal('120') }],
      },
    ]);
    const result = await repository.salesRefundTotals('comp-1', ['s1']);
    expect(result.get('s1')!.refundTotal.toString()).toBe('500.5');
    expect(result.get('s1')!.refundFifoCost.toString()).toBe('220');
  });

  it('salesRefundTotals: CANCELLED and deleted refunds never reach the query result', async () => {
    // The where-clause itself excludes them — assert the filter is present.
    mockPrisma.salesRefund.findMany.mockResolvedValue([]);
    await repository.salesRefundTotals('comp-1', ['s1']);
    const where = mockPrisma.salesRefund.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('COMPLETED');
    expect(where.deletedAt).toBeNull();
  });

  it('cashRefundedForShift aggregates only CASH allocations of COMPLETED refunds bound to the shift', async () => {
    mockPrisma.refundPaymentAllocation.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal('700') },
    });
    const result = await repository.cashRefundedForShift('shift-1', 'comp-1');
    expect(result.toString()).toBe('700');
    const where = mockPrisma.refundPaymentAllocation.aggregate.mock.calls[0][0]
      .where;
    expect(where.companyId).toBe('comp-1');
    expect(where.method).toBe('CASH');
    expect(where.deletedAt).toBeNull();
    expect(where.salesRefund.status).toBe('COMPLETED');
    expect(where.salesRefund.sale).toEqual({ cashShiftId: 'shift-1' });
  });

  it('cashRefundedForShift returns zero when no allocations exist', async () => {
    mockPrisma.refundPaymentAllocation.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });
    const result = await repository.cashRefundedForShift('shift-1', 'comp-1');
    expect(result.toString()).toBe('0');
  });
});
