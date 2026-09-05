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
      cashShift: { findMany: jest.fn(), count: jest.fn() },
      company: { findUnique: jest.fn() },
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
});
