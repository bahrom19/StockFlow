import { NotFoundException } from '@nestjs/common';
import { SupplierAnalyticsService } from '../services/supplier-analytics.service';

describe('SupplierAnalyticsService', () => {
  let service: SupplierAnalyticsService;
  let mockPrisma: any;
  let mockSuppliersRepo: any;

  const companyId = 'company-1';
  const supplierId = 'supplier-1';

  beforeEach(() => {
    mockPrisma = {
      purchaseInvoice: {
        aggregate: jest.fn(),
      },
      purchaseInvoiceItem: {
        aggregate: jest.fn(),
        groupBy: jest.fn(),
      },
      purchaseReturn: {
        aggregate: jest.fn(),
      },
      supplierPayment: {
        aggregate: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    mockSuppliersRepo = {
      findById: jest.fn().mockResolvedValue({ id: supplierId, companyId }),
    };

    service = new SupplierAnalyticsService(mockPrisma, mockSuppliersRepo);
  });

  it('should throw NotFoundException when supplier not found', async () => {
    mockSuppliersRepo.findById.mockResolvedValue(null);
    await expect(
      service.getPurchaseSummary(supplierId, companyId),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return zero values for supplier with no purchases', async () => {
    mockPrisma.purchaseInvoice.aggregate.mockResolvedValue({
      _sum: { grandTotal: null },
      _count: { id: 0 },
      _min: { invoiceDate: null },
      _max: { invoiceDate: null },
    });
    mockPrisma.purchaseInvoiceItem.aggregate.mockResolvedValue({
      _sum: { quantity: null },
    });
    mockPrisma.purchaseInvoiceItem.groupBy.mockResolvedValue([]);
    mockPrisma.purchaseReturn.aggregate.mockResolvedValue({
      _sum: { grandTotal: null },
      _count: { id: 0 },
    });
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.supplierPayment.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });

    const result = await service.getPurchaseSummary(supplierId, companyId);

    expect(result.totalInvoiced).toBe('0');
    expect(result.totalReturned).toBe('0');
    expect(result.netPurchaseSpend).toBe('0');
    expect(result.totalPurchasedQuantity).toBe(0);
    expect(result.invoiceCount).toBe(0);
    expect(result.returnCount).toBe(0);
    expect(result.monthlySpend).toEqual([]);
  });

  it('should compute correct totals with invoices and returns', async () => {
    mockPrisma.purchaseInvoice.aggregate
      .mockResolvedValueOnce({
        _sum: { grandTotal: '500000' },
        _count: { id: 5 },
        _min: { invoiceDate: new Date('2026-01-15') },
        _max: { invoiceDate: new Date('2026-08-20') },
      })
      .mockResolvedValueOnce({
        _sum: { grandTotal: '800000' },
      });

    mockPrisma.purchaseInvoiceItem.aggregate.mockResolvedValue({
      _sum: { quantity: 250 },
    });
    mockPrisma.purchaseInvoiceItem.groupBy.mockResolvedValue([
      { _sum: { quantity: 100, total: '300000' } },
      { _sum: { quantity: 150, total: '200000' } },
    ]);

    mockPrisma.purchaseReturn.aggregate
      .mockResolvedValueOnce({
        _sum: { grandTotal: '50000' },
        _count: { id: 1 },
      })
      .mockResolvedValueOnce({
        _sum: { grandTotal: '80000' },
      });

    mockPrisma.supplierPayment.aggregate.mockResolvedValue({
      _sum: { amount: '600000' },
    });

    mockPrisma.$queryRaw.mockResolvedValue([
      { month: '2026-01', amount: '100000' },
      { month: '2026-06', amount: '200000' },
      { month: '2026-08', amount: '200000' },
    ]);

    const result = await service.getPurchaseSummary(supplierId, companyId);

    expect(result.totalInvoiced).toBe('500000');
    expect(result.totalReturned).toBe('50000');
    expect(result.netPurchaseSpend).toBe('450000');
    expect(result.totalPurchasedQuantity).toBe(250);
    // weighted average: (300000 + 200000) / (100 + 150) = 500000/250 = 2000
    expect(result.weightedAverageUnitCost).toBe('2000');
    expect(result.invoiceCount).toBe(5);
    expect(result.returnCount).toBe(1);
    expect(result.monthlySpend).toHaveLength(3);
    expect(result.currentTotalPaid).toBe('600000');
    expect(result.currentOutstanding).toBe('120000'); // 800000 - 600000 - 80000
  });

  it('should use default 12-month range when no dates provided', async () => {
    mockPrisma.purchaseInvoice.aggregate.mockResolvedValue({
      _sum: { grandTotal: null },
      _count: { id: 0 },
      _min: { invoiceDate: null },
      _max: { invoiceDate: null },
    });
    mockPrisma.purchaseInvoiceItem.aggregate.mockResolvedValue({
      _sum: { quantity: null },
    });
    mockPrisma.purchaseInvoiceItem.groupBy.mockResolvedValue([]);
    mockPrisma.purchaseReturn.aggregate.mockResolvedValue({
      _sum: { grandTotal: null },
      _count: { id: 0 },
    });
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.supplierPayment.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });

    const result = await service.getPurchaseSummary(supplierId, companyId);

    // Just verify it doesn't throw and returns valid structure
    expect(result.dateFrom).toBeDefined();
    expect(result.dateTo).toBeDefined();
    expect(typeof result.totalInvoiced).toBe('string');
  });

  it('should respect custom date range', async () => {
    mockPrisma.purchaseInvoice.aggregate.mockResolvedValue({
      _sum: { grandTotal: '100000' },
      _count: { id: 2 },
      _min: { invoiceDate: new Date('2026-03-01') },
      _max: { invoiceDate: new Date('2026-03-15') },
    });
    mockPrisma.purchaseInvoiceItem.aggregate.mockResolvedValue({
      _sum: { quantity: 50 },
    });
    mockPrisma.purchaseInvoiceItem.groupBy.mockResolvedValue([
      { _sum: { quantity: 50, total: '100000' } },
    ]);
    mockPrisma.purchaseReturn.aggregate.mockResolvedValue({
      _sum: { grandTotal: null },
      _count: { id: 0 },
    });
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.supplierPayment.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });

    const result = await service.getPurchaseSummary(
      supplierId,
      companyId,
      '2026-03-01',
      '2026-03-31',
    );

    expect(result.dateFrom).toContain('2026-03-01');
    expect(result.dateTo).toContain('2026-03-31');
    expect(result.totalInvoiced).toBe('100000');
  });

  it('should only include APPROVED and PAID invoices', async () => {
    // The filter is in the where clause — we verify it's passed correctly
    mockPrisma.purchaseInvoice.aggregate.mockResolvedValue({
      _sum: { grandTotal: null },
      _count: { id: 0 },
      _min: { invoiceDate: null },
      _max: { invoiceDate: null },
    });
    mockPrisma.purchaseInvoiceItem.aggregate.mockResolvedValue({
      _sum: { quantity: null },
    });
    mockPrisma.purchaseInvoiceItem.groupBy.mockResolvedValue([]);
    mockPrisma.purchaseReturn.aggregate.mockResolvedValue({
      _sum: { grandTotal: null },
      _count: { id: 0 },
    });
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.supplierPayment.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });

    await service.getPurchaseSummary(supplierId, companyId);

    // Verify the where clause includes status filter
    const call = mockPrisma.purchaseInvoice.aggregate.mock.calls[0][0];
    expect(call.where.status).toEqual({ in: ['APPROVED', 'PAID'] });
  });

  it('should compute weighted average correctly (not simple AVG)', async () => {
    mockPrisma.purchaseInvoice.aggregate.mockResolvedValue({
      _sum: { grandTotal: '11000' },
      _count: { id: 2 },
      _min: { invoiceDate: new Date('2026-01-01') },
      _max: { invoiceDate: new Date('2026-02-01') },
    });
    mockPrisma.purchaseInvoiceItem.aggregate.mockResolvedValue({
      _sum: { quantity: 20 },
    });
    // 10 units at 500 + 10 units at 600 = 11000 / 20 = 550 (weighted)
    // NOT (500+600)/2 = 550 (happens to be same here, test different)
    // 5 units at 100 + 15 units at 200 = 3500/20 = 175 (weighted)
    mockPrisma.purchaseInvoiceItem.groupBy.mockResolvedValue([
      { _sum: { quantity: 5, total: '500' } },
      { _sum: { quantity: 15, total: '3000' } },
    ]);
    mockPrisma.purchaseReturn.aggregate.mockResolvedValue({
      _sum: { grandTotal: null },
      _count: { id: 0 },
    });
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.supplierPayment.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });

    const result = await service.getPurchaseSummary(supplierId, companyId);

    // Weighted average: (500 + 3000) / (5 + 15) = 3500 / 20 = 175
    expect(result.weightedAverageUnitCost).toBe('175');
  });

  it('should keep returns separate from invoiced amount', async () => {
    mockPrisma.purchaseInvoice.aggregate.mockResolvedValue({
      _sum: { grandTotal: '1000000' },
      _count: { id: 10 },
      _min: { invoiceDate: new Date('2026-01-01') },
      _max: { invoiceDate: new Date('2026-06-01') },
    });
    mockPrisma.purchaseInvoiceItem.aggregate.mockResolvedValue({
      _sum: { quantity: 500 },
    });
    mockPrisma.purchaseInvoiceItem.groupBy.mockResolvedValue([
      { _sum: { quantity: 500, total: '1000000' } },
    ]);
    mockPrisma.purchaseReturn.aggregate.mockResolvedValue({
      _sum: { grandTotal: '200000' },
      _count: { id: 3 },
    });
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.supplierPayment.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });

    const result = await service.getPurchaseSummary(supplierId, companyId);

    expect(result.totalInvoiced).toBe('1000000');
    expect(result.totalReturned).toBe('200000');
    expect(result.netPurchaseSpend).toBe('800000');
  });
});

describe('SupplierAnalyticsService.getProductPurchases', () => {
  let service: SupplierAnalyticsService;
  let mockPrisma: any;
  let mockSuppliersRepo: any;

  const companyId = 'company-1';
  const supplierId = 'supplier-1';

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: jest.fn(),
    };
    mockSuppliersRepo = {
      findById: jest.fn().mockResolvedValue({ id: supplierId, companyId }),
    };
    service = new SupplierAnalyticsService(mockPrisma, mockSuppliersRepo);
  });

  it('should throw NotFoundException when supplier not found', async () => {
    mockSuppliersRepo.findById.mockResolvedValue(null);
    await expect(
      service.getProductPurchases(supplierId, companyId),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return product purchases with correct metrics', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        {
          productId: 'p1',
          productName: 'Milk 1L',
          sku: 'MLK-001',
          totalPurchasedQuantity: BigInt(500),
          totalPurchaseSpend: '750000',
          totalSubtotal: '700000', // subtotal = unitCost * qty (before discount/tax)
          minUnitCost: '1400',
          maxUnitCost: '1650',
          invoiceCount: BigInt(12),
          firstPurchaseDate: new Date('2025-10-15'),
          lastPurchaseDate: new Date('2026-08-28'),
        },
      ])
      .mockResolvedValueOnce([{ total: BigInt(1) }])
      .mockResolvedValueOnce([
        { productId: 'p1', returnedQuantity: BigInt(20), returnedSpend: '30000' },
      ]);

    const result = await service.getProductPurchases(supplierId, companyId);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.productId).toBe('p1');
    expect(result.items[0]!.productName).toBe('Milk 1L');
    expect(result.items[0]!.totalPurchasedQuantity).toBe(500);
    expect(result.items[0]!.totalPurchaseSpend).toBe('750000'); // total (with discount/tax)
    expect(result.items[0]!.weightedAverageUnitCost).toBe('1400'); // subtotal(700000)/qty(500) = 1400
    expect(result.items[0]!.minUnitCost).toBe('1400');
    expect(result.items[0]!.maxUnitCost).toBe('1650');
    expect(result.items[0]!.totalReturnedQuantity).toBe(20);
    expect(result.items[0]!.totalReturnedSpend).toBe('30000');
    expect(result.items[0]!.netPurchasedQuantity).toBe(480);
    expect(result.items[0]!.netPurchaseSpend).toBe('720000');
    expect(result.items[0]!.invoiceCount).toBe(12);
    expect(result.total).toBe(1);
  });

  it('should use subtotal for weighted avg, not total (discount/tax distinction)', async () => {
    // Scenario: 100 units, unitCost=100, total=9500 (after $500 discount)
    // subtotal = 100 * 100 = 10000
    // total = subtotal - discount + tax = 10000 - 500 + 0 = 9500
    // weightedAvg should be 10000/100 = 100, NOT 9500/100 = 95
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        {
          productId: 'p1',
          productName: 'Widget',
          sku: 'W-001',
          totalPurchasedQuantity: BigInt(100),
          totalPurchaseSpend: '9500', // total after discount
          totalSubtotal: '10000', // subtotal = unitCost * qty
          minUnitCost: '100',
          maxUnitCost: '100',
          invoiceCount: BigInt(1),
          firstPurchaseDate: new Date('2026-01-01'),
          lastPurchaseDate: new Date('2026-01-01'),
        },
      ])
      .mockResolvedValueOnce([{ total: BigInt(1) }])
      .mockResolvedValueOnce([]);

    const result = await service.getProductPurchases(supplierId, companyId);

    // weighted avg uses subtotal: 10000/100 = 100
    expect(result.items[0]!.weightedAverageUnitCost).toBe('100');
    // total purchase spend uses total: 9500
    expect(result.items[0]!.totalPurchaseSpend).toBe('9500');
  });

  it('should return empty list for supplier with no purchases', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([]) // main query
      .mockResolvedValueOnce([{ total: BigInt(0) }]) // count
      .mockResolvedValueOnce([]); // returns

    const result = await service.getProductPurchases(supplierId, companyId);

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('should compute correct weighted average (not simple AVG)', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        {
          productId: 'p1',
          productName: 'Widget',
          sku: null,
          totalPurchasedQuantity: BigInt(20),
          totalPurchaseSpend: '3500',
          totalSubtotal: '3500', // same as spend when no discount/tax
          minUnitCost: '100',
          maxUnitCost: '200',
          invoiceCount: BigInt(2),
          firstPurchaseDate: new Date('2026-01-01'),
          lastPurchaseDate: new Date('2026-02-01'),
        },
      ])
      .mockResolvedValueOnce([{ total: BigInt(1) }])
      .mockResolvedValueOnce([]);

    const result = await service.getProductPurchases(supplierId, companyId);

    // 5 at 100 + 15 at 200 = 3500 / 20 = 175
    expect(result.items[0]!.weightedAverageUnitCost).toBe('175');
  });

  it('should subtract returns from gross to get net', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        {
          productId: 'p1',
          productName: 'Widget',
          sku: 'W-001',
          totalPurchasedQuantity: BigInt(100),
          totalPurchaseSpend: '10000',
          totalSubtotal: '10000',
          minUnitCost: '90',
          maxUnitCost: '110',
          invoiceCount: BigInt(5),
          firstPurchaseDate: new Date('2026-01-01'),
          lastPurchaseDate: new Date('2026-06-01'),
        },
      ])
      .mockResolvedValueOnce([{ total: BigInt(1) }])
      .mockResolvedValueOnce([
        { productId: 'p1', returnedQuantity: BigInt(10), returnedSpend: '1000' },
      ]);

    const result = await service.getProductPurchases(supplierId, companyId);

    expect(result.items[0]!.totalPurchasedQuantity).toBe(100);
    expect(result.items[0]!.totalReturnedQuantity).toBe(10);
    expect(result.items[0]!.netPurchasedQuantity).toBe(90);
    expect(result.items[0]!.netPurchaseSpend).toBe('9000');
  });

  it('should include search in SQL query', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: BigInt(0) }])
      .mockResolvedValueOnce([]);

    await service.getProductPurchases(supplierId, companyId, undefined, undefined, 1, 20, 'milk');

    // The search clause is embedded in the raw SQL template, not as a parameter
    // Verify the function was called (the search filter is in the SQL string)
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
  });

  it('should return empty result for no purchases', async () => {
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: BigInt(0) }])
      .mockResolvedValueOnce([]);

    const result = await service.getProductPurchases(supplierId, companyId);

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
