import { Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseInvoiceStatus, PurchaseReturnStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { SupplierPurchaseSummaryEntity, MonthlySpendEntity } from '../entities/supplier-purchase-summary.entity';
import { SupplierProductPurchaseEntity, SupplierProductPurchaseListEntity } from '../entities/supplier-product-purchase.entity';
import { SupplierReliabilityEntity, RecentDeliveryEntity } from '../entities/supplier-reliability.entity';
import { SupplierPriceHistoryEntity, PricePointEntity } from '../entities/supplier-price-history.entity';
import { SupplierPaymentAgingEntity, PaymentAgingBucketsEntity, OverdueInvoiceEntity } from '../entities/supplier-payment-aging.entity';

const INVOICE_STATUSES = [
  PurchaseInvoiceStatus.APPROVED,
  PurchaseInvoiceStatus.PAID,
];

const RETURN_STATUSES = [
  PurchaseReturnStatus.APPROVED,
  PurchaseReturnStatus.COMPLETED,
];

const DEFAULT_MONTHS = 12;

@Injectable()
export class SupplierAnalyticsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly suppliersRepo: SuppliersRepository,
  ) {}

  async getPurchaseSummary(
    supplierId: string,
    companyId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<SupplierPurchaseSummaryEntity> {
    // 1. Verify supplier belongs to company
    const supplier = await this.suppliersRepo.findById(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    // 2. Determine date range — default to last 12 months
    const now = new Date();
    const effectiveDateTo = dateTo ? new Date(dateTo) : now;
    const effectiveDateFrom = dateFrom
      ? new Date(dateFrom)
      : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // 3. Invoice aggregation (APPROVED + PAID only)
    const invoiceWhere = {
      supplierId,
      companyId,
      deletedAt: null,
      status: { in: INVOICE_STATUSES },
      invoiceDate: { gte: effectiveDateFrom, lte: effectiveDateTo },
    };

    const invoiceAgg = await this.prismaService.purchaseInvoice.aggregate({
      where: invoiceWhere,
      _sum: { grandTotal: true },
      _count: { id: true },
      _min: { invoiceDate: true },
      _max: { invoiceDate: true },
    });

    // 4. Item-level aggregation for quantity and weighted average
    const itemAgg = await this.prismaService.purchaseInvoiceItem.aggregate({
      where: {
        purchaseInvoice: invoiceWhere,
      },
      _sum: { quantity: true },
    });

    // Weighted average: total spend / total quantity
    // We need item-level spend — compute from items joined to qualifying invoices
    const itemSpendRows = await this.prismaService.purchaseInvoiceItem.groupBy({
      by: ['productId'],
      where: {
        purchaseInvoice: invoiceWhere,
      },
      _sum: {
        quantity: true,
        total: true,
      },
    });

    let totalItemSpend = new Decimal(0);
    let totalItemQty = 0;
    for (const row of itemSpendRows) {
      totalItemSpend = totalItemSpend.add(
        new Decimal(row._sum.total?.toString() ?? '0'),
      );
      totalItemQty += row._sum.quantity ?? 0;
    }

    const weightedAvg =
      totalItemQty > 0
        ? totalItemSpend.div(totalItemQty)
        : new Decimal(0);

    // 5. Returns aggregation (non-CANCELLED)
    const returnWhere = {
      supplierId,
      companyId,
      deletedAt: null,
      status: { not: PurchaseReturnStatus.CANCELLED },
      returnDate: { gte: effectiveDateFrom, lte: effectiveDateTo },
    };

    const returnAgg = await this.prismaService.purchaseReturn.aggregate({
      where: returnWhere,
      _sum: { grandTotal: true },
      _count: { id: true },
    });

    // 6. Monthly spend — use raw aggregation for month grouping
    const monthlyRows = await this.prismaService.$queryRaw<
      Array<{ month: string; amount: Decimal }>
    >`
      SELECT
        TO_CHAR(pi."invoiceDate", 'YYYY-MM') AS month,
        SUM(pi."grandTotal") AS amount
      FROM "PurchaseInvoice" pi
      WHERE pi."supplierId" = ${supplierId}
        AND pi."companyId" = ${companyId}
        AND pi."deletedAt" IS NULL
        AND pi."status" IN ('APPROVED', 'PAID')
        AND pi."invoiceDate" >= ${effectiveDateFrom}
        AND pi."invoiceDate" <= ${effectiveDateTo}
      GROUP BY TO_CHAR(pi."invoiceDate", 'YYYY-MM')
      ORDER BY month ASC
    `;

    const monthlySpend: MonthlySpendEntity[] = monthlyRows.map((row) => ({
      month: row.month,
      amount: new Decimal(row.amount).toString(),
    }));

    // 7. Current financial status (not period-scoped)
    const currentInvoiceAgg = await this.prismaService.purchaseInvoice.aggregate({
      where: {
        supplierId,
        companyId,
        deletedAt: null,
        status: { in: INVOICE_STATUSES },
      },
      _sum: { grandTotal: true },
    });

    const currentPaymentAgg = await this.prismaService.supplierPayment.aggregate({
      where: {
        supplierId,
        companyId,
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    const currentReturnAgg = await this.prismaService.purchaseReturn.aggregate({
      where: {
        supplierId,
        companyId,
        deletedAt: null,
        status: { not: PurchaseReturnStatus.CANCELLED },
      },
      _sum: { grandTotal: true },
    });

    const totalInvoiced = new Decimal(invoiceAgg._sum.grandTotal ?? 0);
    const totalReturned = new Decimal(returnAgg._sum.grandTotal ?? 0);
    const netPurchaseSpend = totalInvoiced.sub(totalReturned);

    const currentInvoiced = new Decimal(currentInvoiceAgg._sum.grandTotal ?? 0);
    const currentPaid = new Decimal(currentPaymentAgg._sum.amount ?? 0);
    const currentReturned = new Decimal(currentReturnAgg._sum.grandTotal ?? 0);
    const currentOutstanding = currentInvoiced.sub(currentPaid).sub(currentReturned);

    return {
      dateFrom: effectiveDateFrom.toISOString(),
      dateTo: effectiveDateTo.toISOString(),
      totalInvoiced: totalInvoiced.toString(),
      totalReturned: totalReturned.toString(),
      netPurchaseSpend: netPurchaseSpend.toString(),
      totalPurchasedQuantity: totalItemQty,
      weightedAverageUnitCost: weightedAvg.toString(),
      invoiceCount: invoiceAgg._count.id,
      returnCount: returnAgg._count.id,
      firstPurchaseDate: invoiceAgg._min.invoiceDate?.toISOString() ?? null,
      lastPurchaseDate: invoiceAgg._max.invoiceDate?.toISOString() ?? null,
      monthlySpend,
      currentTotalPaid: currentPaid.toString(),
      currentOutstanding: currentOutstanding.toString(),
    };
  }

  // ── Product Purchase Detail ────────────────────────────────

  private static readonly ALLOWED_SORT_FIELDS: Record<string, string> = {
    totalPurchaseSpend: '"totalPurchaseSpend"',
    totalPurchasedQuantity: '"totalPurchasedQuantity"',
    weightedAverageUnitCost: '"weightedAverageUnitCost"',
    lastPurchaseDate: '"lastPurchaseDate"',
    productName: '"productName"',
  };

  async getProductPurchases(
    supplierId: string,
    companyId: string,
    dateFrom?: string,
    dateTo?: string,
    page = 1,
    limit = 20,
    search?: string,
    sortBy = 'totalPurchaseSpend',
    sortOrder: 'asc' | 'desc' = 'desc',
  ): Promise<SupplierProductPurchaseListEntity> {
    // 1. Verify supplier
    const supplier = await this.suppliersRepo.findById(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    // 2. Date range
    const now = new Date();
    const effectiveDateTo = dateTo ? new Date(dateTo) : now;
    const effectiveDateFrom = dateFrom
      ? new Date(dateFrom)
      : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // 3. Whitelist sort
    const sortColumn = SupplierAnalyticsService.ALLOWED_SORT_FIELDS[sortBy]
      ?? SupplierAnalyticsService.ALLOWED_SORT_FIELDS['totalPurchaseSpend']!;
    const sortDir = sortOrder === 'asc' ? 'ASC' : 'DESC';

    // 4. Search filter
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const offset = (Math.max(1, page) - 1) * safeLimit;

    // 5. Main query — purchases per product
    const purchaseRows = await this.prismaService.$queryRaw<
      Array<{
        productId: string;
        productName: string;
        sku: string | null;
        totalPurchasedQuantity: bigint;
        totalPurchaseSpend: Decimal;
        totalSubtotal: Decimal;
        minUnitCost: Decimal;
        maxUnitCost: Decimal;
        invoiceCount: bigint;
        firstPurchaseDate: Date;
        lastPurchaseDate: Date;
      }>
    >`
      SELECT
        pii."productId",
        p."name" AS "productName",
        p."sku",
        SUM(pii."quantity") AS "totalPurchasedQuantity",
        SUM(pii."total") AS "totalPurchaseSpend",
        SUM(pii."subtotal") AS "totalSubtotal",
        MIN(pii."unitCost") AS "minUnitCost",
        MAX(pii."unitCost") AS "maxUnitCost",
        COUNT(DISTINCT pi."id") AS "invoiceCount",
        MIN(pi."invoiceDate") AS "firstPurchaseDate",
        MAX(pi."invoiceDate") AS "lastPurchaseDate"
      FROM "PurchaseInvoiceItem" pii
      JOIN "PurchaseInvoice" pi ON pii."purchaseInvoiceId" = pi.id
      JOIN "Product" p ON pii."productId" = p.id
      WHERE pi."supplierId" = ${supplierId}
        AND pi."companyId" = ${companyId}
        AND pi."deletedAt" IS NULL
        AND pi."status" IN ('APPROVED', 'PAID')
        AND pi."invoiceDate" >= ${effectiveDateFrom}
        AND pi."invoiceDate" <= ${effectiveDateTo}
        ${this.rawSearchClause(search)}
      GROUP BY pii."productId", p."name", p."sku"
      ORDER BY ${this.rawSortClause(sortColumn, sortDir)}
      LIMIT ${safeLimit} OFFSET ${offset}
    `;

    // 6. Count query
    const countRows = await this.prismaService.$queryRaw<
      Array<{ total: bigint }>
    >`
      SELECT COUNT(DISTINCT pii."productId") AS total
      FROM "PurchaseInvoiceItem" pii
      JOIN "PurchaseInvoice" pi ON pii."purchaseInvoiceId" = pi.id
      JOIN "Product" p ON pii."productId" = p.id
      WHERE pi."supplierId" = ${supplierId}
        AND pi."companyId" = ${companyId}
        AND pi."deletedAt" IS NULL
        AND pi."status" IN ('APPROVED', 'PAID')
        AND pi."invoiceDate" >= ${effectiveDateFrom}
        AND pi."invoiceDate" <= ${effectiveDateTo}
        ${this.rawSearchClause(search)}
    `;

    const total = Number(countRows[0]?.total ?? 0);

    // 7. Returns per product (same date range, same supplier/company)
    let returnMap = new Map<string, { qty: number; spend: Decimal }>();

    const returnRows = await this.prismaService.$queryRaw<
      Array<{
        productId: string;
        returnedQuantity: bigint;
        returnedSpend: Decimal;
      }>
    >`
      SELECT
        pri."productId",
        SUM(pri."quantity") AS "returnedQuantity",
        SUM(pri."total") AS "returnedSpend"
      FROM "PurchaseReturnItem" pri
      JOIN "PurchaseReturn" pr ON pri."purchaseReturnId" = pr.id
      WHERE pr."supplierId" = ${supplierId}
        AND pr."companyId" = ${companyId}
        AND pr."deletedAt" IS NULL
        AND pr."status" IN ('APPROVED', 'COMPLETED')
        AND pr."returnDate" >= ${effectiveDateFrom}
        AND pr."returnDate" <= ${effectiveDateTo}
      GROUP BY pri."productId"
    `;

    for (const row of returnRows) {
      returnMap.set(row.productId, {
        qty: Number(row.returnedQuantity),
        spend: new Decimal(row.returnedSpend?.toString() ?? '0'),
      });
    }

    // 8. Assemble response
    const items: SupplierProductPurchaseEntity[] = purchaseRows.map((row) => {
      const qty = Number(row.totalPurchasedQuantity);
      const spend = new Decimal(row.totalPurchaseSpend?.toString() ?? '0');
      const subtotal = new Decimal(row.totalSubtotal?.toString() ?? '0');
      const weightedAvg = qty > 0 ? subtotal.div(qty) : new Decimal(0);

      const ret = returnMap.get(row.productId);
      const retQty = ret?.qty ?? 0;
      const retSpend = ret?.spend ?? new Decimal(0);

      return {
        productId: row.productId,
        productName: row.productName,
        sku: row.sku,
        totalPurchasedQuantity: qty,
        totalPurchaseSpend: spend.toString(),
        weightedAverageUnitCost: weightedAvg.toString(),
        minUnitCost: new Decimal(row.minUnitCost?.toString() ?? '0').toString(),
        maxUnitCost: new Decimal(row.maxUnitCost?.toString() ?? '0').toString(),
        totalReturnedQuantity: retQty,
        totalReturnedSpend: retSpend.toString(),
        netPurchasedQuantity: qty - retQty,
        netPurchaseSpend: spend.sub(retSpend).toString(),
        invoiceCount: Number(row.invoiceCount),
        firstPurchaseDate: row.firstPurchaseDate?.toISOString() ?? null,
        lastPurchaseDate: row.lastPurchaseDate?.toISOString() ?? null,
      };
    });

    return { items, total, page, limit: safeLimit };
  }

  // ── Supplier Reliability ──────────────────────────────────

  async getReliability(
    supplierId: string,
    companyId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<SupplierReliabilityEntity> {
    // 1. Verify supplier
    const supplier = await this.suppliersRepo.findById(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    // 2. Date range — default to last 12 months
    const now = new Date();
    const effectiveDateTo = dateTo ? new Date(dateTo) : now;
    const effectiveDateFrom = dateFrom
      ? new Date(dateFrom)
      : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // 3. Total orders in range (by orderDate), including CANCELLED
    const orderAgg = await this.prismaService.purchaseOrder.aggregate({
      where: {
        supplierId,
        companyId,
        deletedAt: null,
        orderDate: { gte: effectiveDateFrom, lte: effectiveDateTo },
      },
      _count: { id: true },
    });
    const totalOrders = orderAgg._count.id;

    // 4. Orders by status for delivery metrics
    const statusRows = await this.prismaService.purchaseOrder.groupBy({
      by: ['status'],
      where: {
        supplierId,
        companyId,
        deletedAt: null,
        orderDate: { gte: effectiveDateFrom, lte: effectiveDateTo },
      },
      _count: { id: true },
    });

    const statusCounts = new Map<string, number>();
    for (const row of statusRows) {
      statusCounts.set(row.status, row._count.id);
    }

    const ordersReceived = statusCounts.get('RECEIVED') ?? 0;
    const ordersPartiallyReceived = statusCounts.get('PARTIALLY_RECEIVED') ?? 0;
    const ordersCancelled = statusCounts.get('CANCELLED') ?? 0;

    // 5. Canonical delivery data — first COMPLETED GoodsReceipt per PO
    //    Join through PurchaseOrder to ensure supplier/company scoping
    const deliveryRows = await this.prismaService.$queryRaw<
      Array<{
        orderId: string;
        orderNumber: string;
        orderDate: Date;
        expectedDate: Date | null;
        receiptDate: Date | null;
        receiptStatus: string | null;
        grandTotal: Decimal;
      }>
    >`
      SELECT
        po.id AS "orderId",
        po."orderNumber",
        po."orderDate",
        po."expectedDate",
        gr."receiptDate",
        gr.status AS "receiptStatus",
        po."grandTotal"
      FROM "PurchaseOrder" po
      LEFT JOIN LATERAL (
        SELECT gr."receiptDate", gr.status
        FROM "GoodsReceipt" gr
        WHERE gr."purchaseOrderId" = po.id
          AND gr.status = 'COMPLETED'
          AND gr."deletedAt" IS NULL
        ORDER BY gr."receiptDate" ASC
        LIMIT 1
      ) gr ON true
      WHERE po."supplierId" = ${supplierId}
        AND po."companyId" = ${companyId}
        AND po."deletedAt" IS NULL
        AND po."orderDate" >= ${effectiveDateFrom}
        AND po."orderDate" <= ${effectiveDateTo}
        AND po.status IN ('APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED')
      ORDER BY po."orderDate" DESC
    `;

    // 6. Compute delivery metrics
    let onTimeCount = 0;
    let deliveryCount = 0;
    let totalLeadTimeDays = 0;
    let minLeadTime: number | null = null;
    let maxLeadTime: number | null = null;
    const recentDeliveries: RecentDeliveryEntity[] = [];

    for (const row of deliveryRows) {
      const receiptDate = row.receiptDate;
      const orderDate = new Date(row.orderDate);
      const expectedDate = row.expectedDate ? new Date(row.expectedDate) : null;

      let leadTimeDays: number | null = null;
      let onTime: boolean | null = null;

      if (receiptDate) {
        const receipt = new Date(receiptDate);
        leadTimeDays = Math.round((receipt.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));
        deliveryCount++;
        totalLeadTimeDays += leadTimeDays;

        if (minLeadTime === null || leadTimeDays < minLeadTime) minLeadTime = leadTimeDays;
        if (maxLeadTime === null || leadTimeDays > maxLeadTime) maxLeadTime = leadTimeDays;

        if (expectedDate) {
          onTime = receipt <= expectedDate;
          if (onTime) onTimeCount++;
        }
      }

      // Collect recent deliveries (up to 10, already sorted by orderDate DESC)
      if (recentDeliveries.length < 10) {
        recentDeliveries.push({
          orderNumber: row.orderNumber,
          orderDate: new Date(row.orderDate).toISOString(),
          expectedDate: row.expectedDate ? new Date(row.expectedDate).toISOString() : null,
          receiptDate: receiptDate ? new Date(receiptDate).toISOString() : null,
          leadTimeDays,
          onTime,
          status: row.receiptStatus ?? 'PENDING',
          grandTotal: new Decimal(row.grandTotal?.toString() ?? '0').toString(),
        });
      }
    }

    // On-time rate: onTimeCount / (orders with expectedDate AND receipt)
    // We count orders where expectedDate exists AND receipt exists
    const onTimeDenominator = deliveryRows.filter(
      (r) => r.expectedDate != null && r.receiptDate != null,
    ).length;
    const onTimeDeliveryRate = onTimeDenominator > 0
      ? Math.round((onTimeCount / onTimeDenominator) * 1000) / 10
      : 0;

    const averageLeadTimeDays = deliveryCount > 0
      ? Math.round((totalLeadTimeDays / deliveryCount) * 10) / 10
      : 0;

    const totalReceipts = deliveryRows.filter((r) => r.receiptDate != null).length;

    const cancellationRate = totalOrders > 0
      ? Math.round((ordersCancelled / totalOrders) * 1000) / 10
      : 0;

    return {
      dateFrom: effectiveDateFrom.toISOString(),
      dateTo: effectiveDateTo.toISOString(),
      totalOrders,
      totalReceipts,
      onTimeDeliveryRate,
      averageLeadTimeDays,
      minLeadTimeDays: minLeadTime,
      maxLeadTimeDays: maxLeadTime,
      ordersReceived,
      ordersPartiallyReceived,
      ordersCancelled,
      cancellationRate,
      recentDeliveries,
    };
  }

  private rawSearchClause(search: string | undefined): string {
    if (!search) return '';
    const safe = search.replace(/'/g, "''");
    return `AND (p."name" ILIKE '%${safe}%' OR p."sku" ILIKE '%${safe}%')`;
  }

  // ── Supplier Price History ──────────────────────────────

  async getPriceHistory(
    supplierId: string,
    companyId: string,
    productId: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<SupplierPriceHistoryEntity> {
    // 1. Verify supplier belongs to company
    const supplier = await this.suppliersRepo.findById(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    // 2. Verify product belongs to company
    const product = await this.prismaService.product.findFirst({
      where: { id: productId, companyId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    // 3. Date range
    const now = new Date();
    const effectiveDateTo = dateTo ? new Date(dateTo) : now;
    const effectiveDateFrom = dateFrom
      ? new Date(dateFrom)
      : new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    // 4. Price points — chronological invoice history for this product from this supplier
    const priceRows = await this.prismaService.$queryRaw<
      Array<{
        invoiceDate: Date;
        invoiceNumber: string;
        unitCost: Decimal;
        quantity: bigint;
        total: Decimal;
      }>
    >`
      SELECT
        pi."invoiceDate",
        pi."invoiceNumber",
        pii."unitCost",
        pii."quantity",
        pii."total"
      FROM "PurchaseInvoiceItem" pii
      JOIN "PurchaseInvoice" pi ON pii."purchaseInvoiceId" = pi.id
      WHERE pi."supplierId" = ${supplierId}
        AND pi."companyId" = ${companyId}
        AND pi."deletedAt" IS NULL
        AND pi."status" IN ('APPROVED', 'PAID')
        AND pi."invoiceDate" >= ${effectiveDateFrom}
        AND pi."invoiceDate" <= ${effectiveDateTo}
        AND pii."productId" = ${productId}
      ORDER BY pi."invoiceDate" ASC
    `;

    // 5. Current quoted price from SupplierProduct
    const sp = await this.prismaService.supplierProduct.findFirst({
      where: {
        companyId,
        supplierId,
        productId,
        deletedAt: null,
      },
      select: { purchasePrice: true },
    });

    // 6. Compute aggregate metrics
    const pricePoints: PricePointEntity[] = priceRows.map((row) => ({
      invoiceDate: new Date(row.invoiceDate).toISOString(),
      invoiceNumber: row.invoiceNumber,
      unitCost: new Decimal(row.unitCost?.toString() ?? '0').toString(),
      quantity: Number(row.quantity),
      total: new Decimal(row.total?.toString() ?? '0').toString(),
    }));

    let averageUnitCost = new Decimal(0);
    let minUnitCost = new Decimal(0);
    let maxUnitCost = new Decimal(0);

    if (priceRows.length > 0) {
      const costs = priceRows.map((r) => new Decimal(r.unitCost?.toString() ?? '0'));
      const totalQty = priceRows.reduce((sum, r) => sum + Number(r.quantity), 0);
      const totalSpend = costs.reduce((sum, c, i) => sum.plus(c.mul(Number(priceRows[i]!.quantity))), new Decimal(0));
      averageUnitCost = totalQty > 0 ? totalSpend.div(totalQty) : new Decimal(0);
      minUnitCost = costs.reduce((min, c) => c.lessThan(min) ? c : min, costs[0]!);
      maxUnitCost = costs.reduce((max, c) => c.greaterThan(max) ? c : max, costs[0]!);
    }

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      dateFrom: effectiveDateFrom.toISOString(),
      dateTo: effectiveDateTo.toISOString(),
      currentQuotedPrice: sp?.purchasePrice?.toString() ?? null,
      averageUnitCost: averageUnitCost.toString(),
      minUnitCost: minUnitCost.toString(),
      maxUnitCost: maxUnitCost.toString(),
      pricePoints,
    };
  }

  // ── Supplier Payment Aging ──────────────────────────────

  async getPaymentAging(
    supplierId: string,
    companyId: string,
  ): Promise<SupplierPaymentAgingEntity> {
    // 1. Verify supplier belongs to company
    const supplier = await this.suppliersRepo.findById(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    // 2. Get all outstanding invoices for this supplier
    //    Only APPROVED/PAID with outstanding balance > 0
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const invoiceRows = await this.prismaService.$queryRaw<
      Array<{
        id: string;
        invoiceNumber: string;
        invoiceDate: Date;
        dueDate: Date | null;
        grandTotal: Decimal;
        paidAmount: Decimal;
      }>
    >`
      SELECT
        pi.id,
        pi."invoiceNumber",
        pi."invoiceDate",
        pi."dueDate",
        pi."grandTotal",
        pi."paidAmount"
      FROM "PurchaseInvoice" pi
      WHERE pi."supplierId" = ${supplierId}
        AND pi."companyId" = ${companyId}
        AND pi."deletedAt" IS NULL
        AND pi."status" IN ('APPROVED', 'PAID')
        AND (pi."grandTotal" - pi."paidAmount") > 0
      ORDER BY pi."dueDate" ASC NULLS LAST, pi."invoiceDate" ASC
    `;

    // 3. Compute aging buckets
    const agingBuckets = {
      current: new Decimal(0),
      days1_30: new Decimal(0),
      days31_60: new Decimal(0),
      days61_90: new Decimal(0),
      overdue90plus: new Decimal(0),
    };

    const overdueInvoices: OverdueInvoiceEntity[] = [];
    let invoiceCount = 0;
    let overdueCount = 0;

    for (const row of invoiceRows) {
      const grandTotal = new Decimal(row.grandTotal?.toString() ?? '0');
      const paidAmount = new Decimal(row.paidAmount?.toString() ?? '0');
      const outstanding = grandTotal.sub(paidAmount);

      if (outstanding.lte(0)) continue; // fully paid

      invoiceCount++;
      const dueDate = row.dueDate ? new Date(row.dueDate) : null;

      if (!dueDate) {
        // No due date — don't include in aging buckets
        // But still count as outstanding
        continue;
      }

      const diffMs = today.getTime() - dueDate.getTime();
      const daysOverdue = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

      if (daysOverdue <= 0) {
        // Not yet due
        agingBuckets.current = agingBuckets.current.add(outstanding);
      } else if (daysOverdue <= 30) {
        agingBuckets.days1_30 = agingBuckets.days1_30.add(outstanding);
      } else if (daysOverdue <= 60) {
        agingBuckets.days31_60 = agingBuckets.days31_60.add(outstanding);
      } else if (daysOverdue <= 90) {
        agingBuckets.days61_90 = agingBuckets.days61_90.add(outstanding);
      } else {
        agingBuckets.overdue90plus = agingBuckets.overdue90plus.add(outstanding);
      }

      // Collect overdue invoices (dueDate < today)
      if (daysOverdue > 0) {
        overdueCount++;
        overdueInvoices.push({
          invoiceId: row.id,
          invoiceNumber: row.invoiceNumber,
          invoiceDate: new Date(row.invoiceDate).toISOString(),
          dueDate: dueDate.toISOString(),
          grandTotal: grandTotal.toString(),
          paidAmount: paidAmount.toString(),
          outstanding: outstanding.toString(),
          daysOverdue,
        });
      }
    }

    // Sort overdue: daysOverdue DESC, then dueDate ASC
    overdueInvoices.sort((a, b) => {
      const diff = b.daysOverdue - a.daysOverdue;
      if (diff !== 0) return diff;
      return new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime();
    });

    const totalOutstanding = invoiceRows.reduce(
      (sum, row) => sum.plus(
        new Decimal(row.grandTotal?.toString() ?? '0').sub(
          new Decimal(row.paidAmount?.toString() ?? '0'),
        ),
      ),
      new Decimal(0),
    );

    return {
      totalOutstanding: totalOutstanding.toString(),
      aging: {
        current: agingBuckets.current.toString(),
        days1_30: agingBuckets.days1_30.toString(),
        days31_60: agingBuckets.days31_60.toString(),
        days61_90: agingBuckets.days61_90.toString(),
        overdue90plus: agingBuckets.overdue90plus.toString(),
      },
      overdueInvoices,
      invoiceCount,
      overdueCount,
    };
  }

  private rawSortClause(sortColumn: string, sortDir: string): string {
    // sortColumn is already from the whitelist — safe
    return `${sortColumn} ${sortDir}`;
  }
}
