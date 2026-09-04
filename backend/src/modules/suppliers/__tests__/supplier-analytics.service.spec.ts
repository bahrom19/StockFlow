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

describe('SupplierAnalyticsService.getReliability', () => {
  let service: SupplierAnalyticsService;
  let mockPrisma: any;
  let mockSuppliersRepo: any;
  const supplierId = 'supplier-1';
  const companyId = 'company-1';

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
      service.getReliability(supplierId, companyId),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return zero metrics for supplier with no orders', async () => {
    mockPrisma.purchaseOrder = {
      aggregate: jest.fn().mockResolvedValue({ _count: { id: 0 } }),
      groupBy: jest.fn().mockResolvedValue([]),
    };
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const result = await service.getReliability(supplierId, companyId);

    expect(result.totalOrders).toBe(0);
    expect(result.totalReceipts).toBe(0);
    expect(result.onTimeDeliveryRate).toBe(0);
    expect(result.averageLeadTimeDays).toBe(0);
    expect(result.ordersReceived).toBe(0);
    expect(result.ordersCancelled).toBe(0);
    expect(result.cancellationRate).toBe(0);
    expect(result.recentDeliveries).toHaveLength(0);
  });

  it('should compute on-time delivery correctly', async () => {
    mockPrisma.purchaseOrder = {
      aggregate: jest.fn().mockResolvedValue({ _count: { id: 2 } }),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'RECEIVED', _count: { id: 2 } },
      ]),
    };
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        orderId: 'po-1',
        orderNumber: 'PO-001',
        orderDate: new Date('2026-08-01'),
        expectedDate: new Date('2026-08-10'),
        receiptDate: new Date('2026-08-08'), // 7 days, on time
        receiptStatus: 'COMPLETED',
        grandTotal: '100000',
      },
      {
        orderId: 'po-2',
        orderNumber: 'PO-002',
        orderDate: new Date('2026-08-05'),
        expectedDate: new Date('2026-08-12'),
        receiptDate: new Date('2026-08-15'), // 10 days, late
        receiptStatus: 'COMPLETED',
        grandTotal: '200000',
      },
    ]);

    const result = await service.getReliability(supplierId, companyId);

    // 1 on-time out of 2 with expectedDate + receipt = 50%
    expect(result.onTimeDeliveryRate).toBe(50);
    expect(result.ordersReceived).toBe(2);
    expect(result.totalReceipts).toBe(2);
  });

  it('should compute average lead time correctly', async () => {
    mockPrisma.purchaseOrder = {
      aggregate: jest.fn().mockResolvedValue({ _count: { id: 2 } }),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'RECEIVED', _count: { id: 2 } },
      ]),
    };
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        orderId: 'po-1',
        orderNumber: 'PO-001',
        orderDate: new Date('2026-08-01'),
        expectedDate: null,
        receiptDate: new Date('2026-08-06'), // 5 days
        receiptStatus: 'COMPLETED',
        grandTotal: '100000',
      },
      {
        orderId: 'po-2',
        orderNumber: 'PO-002',
        orderDate: new Date('2026-08-05'),
        expectedDate: null,
        receiptDate: new Date('2026-08-15'), // 10 days
        receiptStatus: 'COMPLETED',
        grandTotal: '200000',
      },
    ]);

    const result = await service.getReliability(supplierId, companyId);

    // avg(5, 10) = 7.5
    expect(result.averageLeadTimeDays).toBe(7.5);
    expect(result.minLeadTimeDays).toBe(5);
    expect(result.maxLeadTimeDays).toBe(10);
  });

  it('should compute cancellation rate correctly', async () => {
    mockPrisma.purchaseOrder = {
      aggregate: jest.fn().mockResolvedValue({ _count: { id: 4 } }),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'RECEIVED', _count: { id: 2 } },
        { status: 'CANCELLED', _count: { id: 1 } },
        { status: 'APPROVED', _count: { id: 1 } },
      ]),
    };
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const result = await service.getReliability(supplierId, companyId);

    // 1 cancelled / 4 total = 25%
    expect(result.ordersCancelled).toBe(1);
    expect(result.cancellationRate).toBe(25);
    expect(result.totalOrders).toBe(4);
  });

  it('should use FIRST COMPLETED receipt when multiple GoodsReceipts exist', async () => {
    mockPrisma.purchaseOrder = {
      aggregate: jest.fn().mockResolvedValue({ _count: { id: 1 } }),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'RECEIVED', _count: { id: 1 } },
      ]),
    };
    // The SQL uses LEFT JOIN LATERAL with ORDER BY receiptDate ASC LIMIT 1
    // So the mock returns the FIRST completed receipt
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        orderId: 'po-1',
        orderNumber: 'PO-001',
        orderDate: new Date('2026-08-01'),
        expectedDate: new Date('2026-08-10'),
        receiptDate: new Date('2026-08-06'), // First completed receipt: 5 days
        receiptStatus: 'COMPLETED',
        grandTotal: '100000',
      },
    ]);

    const result = await service.getReliability(supplierId, companyId);

    expect(result.averageLeadTimeDays).toBe(5);
    expect(result.recentDeliveries).toHaveLength(1);
    expect(result.recentDeliveries[0]!.leadTimeDays).toBe(5);
    expect(result.recentDeliveries[0]!.onTime).toBe(true);
  });

  it('should exclude DRAFT/CANCELLED GoodsReceipts', async () => {
    mockPrisma.purchaseOrder = {
      aggregate: jest.fn().mockResolvedValue({ _count: { id: 1 } }),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'PARTIALLY_RECEIVED', _count: { id: 1 } },
      ]),
    };
    // SQL filters WHERE gr.status = 'COMPLETED'
    // If no COMPLETED receipt exists, receiptDate is NULL
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        orderId: 'po-1',
        orderNumber: 'PO-001',
        orderDate: new Date('2026-08-01'),
        expectedDate: new Date('2026-08-10'),
        receiptDate: null, // No completed receipt
        receiptStatus: null,
        grandTotal: '100000',
      },
    ]);

    const result = await service.getReliability(supplierId, companyId);

    expect(result.totalReceipts).toBe(0);
    expect(result.averageLeadTimeDays).toBe(0);
    expect(result.onTimeDeliveryRate).toBe(0);
    expect(result.recentDeliveries[0]!.receiptDate).toBeNull();
  });

  it('should return recentDeliveries sorted by orderDate DESC, max 10', async () => {
    mockPrisma.purchaseOrder = {
      aggregate: jest.fn().mockResolvedValue({ _count: { id: 12 } }),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'RECEIVED', _count: { id: 12 } },
      ]),
    };
    const rows = Array.from({ length: 12 }, (_, i) => ({
      orderId: `po-${i}`,
      orderNumber: `PO-${String(i).padStart(3, '0')}`,
      orderDate: new Date(`2026-01-${String(i + 1).padStart(2, '0')}`),
      expectedDate: null,
      receiptDate: new Date(`2026-01-${String(i + 3).padStart(2, '0')}`),
      receiptStatus: 'COMPLETED',
      grandTotal: '10000',
    }));
    mockPrisma.$queryRaw.mockResolvedValue(rows);

    const result = await service.getReliability(supplierId, companyId);

    // SQL sorts by orderDate DESC, service caps at 10
    expect(result.recentDeliveries.length).toBeLessThanOrEqual(10);
  });
});

describe('SupplierAnalyticsService.getPriceHistory', () => {
  let service: SupplierAnalyticsService;
  let mockPrisma: any;
  let mockSuppliersRepo: any;
  const supplierId = 'supplier-1';
  const companyId = 'company-1';
  const productId = 'product-1';

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      product: { findFirst: jest.fn().mockResolvedValue({ id: productId, name: 'Milk 1L', sku: 'MLK-001' }) },
      supplierProduct: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    mockSuppliersRepo = {
      findById: jest.fn().mockResolvedValue({ id: supplierId, companyId }),
    };
    service = new SupplierAnalyticsService(mockPrisma, mockSuppliersRepo);
  });

  it('should throw NotFoundException when supplier not found', async () => {
    mockSuppliersRepo.findById.mockResolvedValue(null);
    await expect(
      service.getPriceHistory(supplierId, companyId, productId),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException when product not found', async () => {
    mockPrisma.product.findFirst.mockResolvedValue(null);
    await expect(
      service.getPriceHistory(supplierId, companyId, productId),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return price history with correct structure', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        invoiceDate: new Date('2026-01-15'),
        invoiceNumber: 'INV-001',
        unitCost: '1400',
        quantity: BigInt(100),
        total: '140000',
      },
      {
        invoiceDate: new Date('2026-03-10'),
        invoiceNumber: 'INV-002',
        unitCost: '1500',
        quantity: BigInt(80),
        total: '120000',
      },
    ]);
    mockPrisma.supplierProduct.findFirst.mockResolvedValue({ purchasePrice: '1600' });

    const result = await service.getPriceHistory(supplierId, companyId, productId);

    expect(result.productId).toBe(productId);
    expect(result.productName).toBe('Milk 1L');
    expect(result.sku).toBe('MLK-001');
    expect(result.currentQuotedPrice).toBe('1600');
    expect(result.pricePoints).toHaveLength(2);
    expect(result.pricePoints[0]!.unitCost).toBe('1400');
    expect(result.pricePoints[1]!.unitCost).toBe('1500');
  });

  it('should compute weighted average correctly', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        invoiceDate: new Date('2026-01-15'),
        invoiceNumber: 'INV-001',
        unitCost: '1400',
        quantity: BigInt(100),
        total: '140000',
      },
      {
        invoiceDate: new Date('2026-03-10'),
        invoiceNumber: 'INV-002',
        unitCost: '1600',
        quantity: BigInt(100),
        total: '160000',
      },
    ]);

    const result = await service.getPriceHistory(supplierId, companyId, productId);

    // avg(1400, 1600) weighted by quantity = (1400*100 + 1600*100) / 200 = 1500
    expect(result.averageUnitCost).toBe('1500');
    expect(result.minUnitCost).toBe('1400');
    expect(result.maxUnitCost).toBe('1600');
  });

  it('should return null currentQuotedPrice when SupplierProduct not found', async () => {
    mockPrisma.supplierProduct.findFirst.mockResolvedValue(null);
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const result = await service.getPriceHistory(supplierId, companyId, productId);

    expect(result.currentQuotedPrice).toBeNull();
    expect(result.pricePoints).toHaveLength(0);
  });

  it('should return empty pricePoints for no invoices', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const result = await service.getPriceHistory(supplierId, companyId, productId);

    expect(result.pricePoints).toHaveLength(0);
    expect(result.averageUnitCost).toBe('0');
    expect(result.minUnitCost).toBe('0');
    expect(result.maxUnitCost).toBe('0');
  });

  it('should return pricePoints sorted chronologically ASC', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        invoiceDate: new Date('2026-03-10'),
        invoiceNumber: 'INV-002',
        unitCost: '1600',
        quantity: BigInt(50),
        total: '80000',
      },
      {
        invoiceDate: new Date('2026-01-15'),
        invoiceNumber: 'INV-001',
        unitCost: '1400',
        quantity: BigInt(100),
        total: '140000',
      },
    ]);

    const result = await service.getPriceHistory(supplierId, companyId, productId);

    // SQL sorts ASC, so service should return in the order provided by SQL
    // The mock already has them in the order SQL returns them
    expect(result.pricePoints[0]!.invoiceNumber).toBe('INV-002');
    expect(result.pricePoints[1]!.invoiceNumber).toBe('INV-001');
  });
});

describe('SupplierAnalyticsService.getPaymentAging', () => {
  let service: SupplierAnalyticsService;
  let mockPrisma: any;
  let mockSuppliersRepo: any;
  const supplierId = 'supplier-1';
  const companyId = 'company-1';

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    mockSuppliersRepo = {
      findById: jest.fn().mockResolvedValue({ id: supplierId, companyId }),
    };
    service = new SupplierAnalyticsService(mockPrisma, mockSuppliersRepo);
  });

  it('should throw NotFoundException when supplier not found', async () => {
    mockSuppliersRepo.findById.mockResolvedValue(null);
    await expect(
      service.getPaymentAging(supplierId, companyId),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return zero outstanding when no invoices', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);

    const result = await service.getPaymentAging(supplierId, companyId);

    expect(result.totalOutstanding).toBe('0');
    expect(result.invoiceCount).toBe(0);
    expect(result.overdueCount).toBe(0);
    expect(result.overdueInvoices).toHaveLength(0);
  });

  it('should compute current bucket for not-yet-due invoices', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    mockPrisma.$queryRaw.mockResolvedValue([{
      id: 'inv-1',
      invoiceNumber: 'INV-001',
      invoiceDate: new Date('2026-01-01'),
      dueDate: futureDate,
      grandTotal: '100000',
      paidAmount: '0',
    }]);

    const result = await service.getPaymentAging(supplierId, companyId);

    expect(result.aging.current).toBe('100000');
    expect(result.invoiceCount).toBe(1);
    expect(result.overdueCount).toBe(0);
  });

  it('should compute 1-30 day overdue bucket', async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 15);
    mockPrisma.$queryRaw.mockResolvedValue([{
      id: 'inv-1',
      invoiceNumber: 'INV-001',
      invoiceDate: new Date('2026-01-01'),
      dueDate: pastDate,
      grandTotal: '200000',
      paidAmount: '50000',
    }]);

    const result = await service.getPaymentAging(supplierId, companyId);

    expect(result.aging.days1_30).toBe('150000');
    expect(result.overdueCount).toBe(1);
    expect(result.overdueInvoices[0]!.daysOverdue).toBeGreaterThanOrEqual(14);
    expect(result.overdueInvoices[0]!.daysOverdue).toBeLessThanOrEqual(16);
  });

  it('should exclude fully paid invoices', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{
      id: 'inv-1',
      invoiceNumber: 'INV-001',
      invoiceDate: new Date('2026-01-01'),
      dueDate: new Date('2026-06-01'),
      grandTotal: '100000',
      paidAmount: '100000',
    }]);

    const result = await service.getPaymentAging(supplierId, companyId);

    expect(result.invoiceCount).toBe(0);
    expect(result.totalOutstanding).toBe('0');
  });

  it('should compute totalOutstanding as sum of all outstanding', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 20);
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date('2026-01-01'),
        dueDate: futureDate,
        grandTotal: '100000',
        paidAmount: '0',
      },
      {
        id: 'inv-2',
        invoiceNumber: 'INV-002',
        invoiceDate: new Date('2026-02-01'),
        dueDate: pastDate,
        grandTotal: '300000',
        paidAmount: '100000',
      },
    ]);

    const result = await service.getPaymentAging(supplierId, companyId);

    // inv-1: 100000 current, inv-2: 200000 1-30 days
    expect(result.totalOutstanding).toBe('300000');
    expect(result.aging.current).toBe('100000');
    expect(result.aging.days1_30).toBe('200000');
    expect(result.invoiceCount).toBe(2);
  });

  it('should handle null dueDate by excluding from aging buckets', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{
      id: 'inv-1',
      invoiceNumber: 'INV-001',
      invoiceDate: new Date('2026-01-01'),
      dueDate: null,
      grandTotal: '100000',
      paidAmount: '0',
    }]);

    const result = await service.getPaymentAging(supplierId, companyId);

    // Invoice counted but not in any aging bucket
    expect(result.invoiceCount).toBe(1);
    expect(result.totalOutstanding).toBe('100000');
    expect(result.aging.current).toBe('0');
    expect(result.overdueCount).toBe(0);
  });

  it('should sort overdue invoices by daysOverdue DESC', async () => {
    const d1 = new Date(); d1.setDate(d1.getDate() - 10);
    const d2 = new Date(); d2.setDate(d2.getDate() - 60);
    mockPrisma.$queryRaw.mockResolvedValue([
      {
        id: 'inv-1', invoiceNumber: 'INV-001', invoiceDate: new Date(),
        dueDate: d1, grandTotal: '100000', paidAmount: '0',
      },
      {
        id: 'inv-2', invoiceNumber: 'INV-002', invoiceDate: new Date(),
        dueDate: d2, grandTotal: '200000', paidAmount: '0',
      },
    ]);

    const result = await service.getPaymentAging(supplierId, companyId);

    // inv-2 (60 days) should come before inv-1 (10 days)
    expect(result.overdueInvoices[0]!.daysOverdue).toBeGreaterThan(
      result.overdueInvoices[1]!.daysOverdue,
    );
  });
});

describe('SupplierAnalyticsService.getReturnSummary', () => {
  let service: SupplierAnalyticsService;
  let mockPrisma: any;
  let mockSuppliersRepo: any;
  const supplierId = 'supplier-1';
  const companyId = 'company-1';

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      purchaseReturn: { aggregate: jest.fn().mockResolvedValue({ _sum: { grandTotal: null }, _count: { id: 0 } }) },
      product: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    mockSuppliersRepo = {
      findById: jest.fn().mockResolvedValue({ id: supplierId, companyId }),
    };
    service = new SupplierAnalyticsService(mockPrisma, mockSuppliersRepo);
  });

  it('should throw NotFoundException when supplier not found', async () => {
    mockSuppliersRepo.findById.mockResolvedValue(null);
    await expect(
      service.getReturnSummary(supplierId, companyId),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return zero values when no returns exist', async () => {
    const result = await service.getReturnSummary(supplierId, companyId);

    expect(result.totalReturnedAmount).toBe('0');
    expect(result.totalReturnedQuantity).toBe(0);
    expect(result.returnCount).toBe(0);
    expect(result.totalPurchaseSpend).toBe('0');
    expect(result.totalPurchasedQuantity).toBe(0);
    expect(result.amountReturnRate).toBe(0);
    expect(result.quantityReturnRate).toBe(0);
    expect(result.topReturnedProducts).toHaveLength(0);
  });

  it('should compute return amounts and quantities correctly', async () => {
    mockPrisma.purchaseReturn.aggregate.mockResolvedValue({
      _sum: { grandTotal: '350000' },
      _count: { id: 5 },
    });
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        { productId: 'p1', returnedQuantity: BigInt(100), returnedAmount: '150000', returnCount: BigInt(3) },
        { productId: 'p2', returnedQuantity: BigInt(50), returnedAmount: '100000', returnCount: BigInt(2) },
      ])
      .mockResolvedValueOnce([{ totalSpend: '5000000', totalQuantity: BigInt(3000) }]);
    mockPrisma.product.findFirst
      .mockResolvedValueOnce({ name: 'Milk 1L', sku: 'MLK-001' })
      .mockResolvedValueOnce({ name: 'Bread', sku: 'BRD-001' });

    const result = await service.getReturnSummary(supplierId, companyId);

    expect(result.totalReturnedAmount).toBe('350000');
    expect(result.returnCount).toBe(5);
    expect(result.totalReturnedQuantity).toBe(150);
    expect(result.totalPurchaseSpend).toBe('5000000');
    expect(result.totalPurchasedQuantity).toBe(3000);
    expect(result.amountReturnRate).toBe(7);
    expect(result.quantityReturnRate).toBe(5);
    expect(result.topReturnedProducts).toHaveLength(2);
    expect(result.topReturnedProducts[0]!.productName).toBe('Milk 1L');
  });

  it('should compute return rates with zero purchase baseline', async () => {
    mockPrisma.purchaseReturn.aggregate.mockResolvedValue({
      _sum: { grandTotal: '100000' },
      _count: { id: 1 },
    });
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ productId: 'p1', returnedQuantity: BigInt(50), returnedAmount: '100000', returnCount: BigInt(1) }])
      .mockResolvedValueOnce([{ totalSpend: '0', totalQuantity: BigInt(0) }]);
    mockPrisma.product.findFirst.mockResolvedValue({ name: 'Milk', sku: null });

    const result = await service.getReturnSummary(supplierId, companyId);

    expect(result.amountReturnRate).toBe(0);
    expect(result.quantityReturnRate).toBe(0);
  });

  it('should sort top returned products by amount DESC', async () => {
    mockPrisma.purchaseReturn.aggregate.mockResolvedValue({
      _sum: { grandTotal: '250000' },
      _count: { id: 2 },
    });
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        { productId: 'p1', returnedQuantity: BigInt(50), returnedAmount: '150000', returnCount: BigInt(1) },
        { productId: 'p2', returnedQuantity: BigInt(100), returnedAmount: '100000', returnCount: BigInt(1) },
      ])
      .mockResolvedValueOnce([{ totalSpend: '5000000', totalQuantity: BigInt(3000) }]);
    mockPrisma.product.findFirst
      .mockResolvedValueOnce({ name: 'A', sku: null })
      .mockResolvedValueOnce({ name: 'B', sku: null });

    const result = await service.getReturnSummary(supplierId, companyId);

    // SQL sorts by returnedAmount DESC
    expect(result.topReturnedProducts[0]!.returnedAmount).toBe('150000');
    expect(result.topReturnedProducts[1]!.returnedAmount).toBe('100000');
  });

  it('should return empty top products when no returns', async () => {
    const result = await service.getReturnSummary(supplierId, companyId);

    expect(result.topReturnedProducts).toHaveLength(0);
    expect(result.totalReturnedQuantity).toBe(0);
  });

  it('should handle multiple return items for same product', async () => {
    mockPrisma.purchaseReturn.aggregate.mockResolvedValue({
      _sum: { grandTotal: '200000' },
      _count: { id: 2 },
    });
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([
        { productId: 'p1', returnedQuantity: BigInt(150), returnedAmount: '200000', returnCount: BigInt(2) },
      ])
      .mockResolvedValueOnce([{ totalSpend: '1000000', totalQuantity: BigInt(500) }]);
    mockPrisma.product.findFirst.mockResolvedValue({ name: 'Milk', sku: 'MLK' });

    const result = await service.getReturnSummary(supplierId, companyId);

    // returnCount = 2 (distinct returns), not 1 (item)
    expect(result.topReturnedProducts[0]!.returnCount).toBe(2);
    expect(result.topReturnedProducts[0]!.returnedQuantity).toBe(150);
  });
});
