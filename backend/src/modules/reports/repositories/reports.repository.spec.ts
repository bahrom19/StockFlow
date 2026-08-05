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
});
