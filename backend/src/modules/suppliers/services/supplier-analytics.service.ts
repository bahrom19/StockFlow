import { Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseInvoiceStatus, PurchaseReturnStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { SupplierPurchaseSummaryEntity, MonthlySpendEntity } from '../entities/supplier-purchase-summary.entity';
import { SupplierProductPurchaseEntity, SupplierProductPurchaseListEntity } from '../entities/supplier-product-purchase.entity';

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

  private rawSearchClause(search: string | undefined): string {
    if (!search) return '';
    const safe = search.replace(/'/g, "''");
    return `AND (p."name" ILIKE '%${safe}%' OR p."sku" ILIKE '%${safe}%')`;
  }

  private rawSortClause(sortColumn: string, sortDir: string): string {
    // sortColumn is already from the whitelist — safe
    return `${sortColumn} ${sortDir}`;
  }
}
