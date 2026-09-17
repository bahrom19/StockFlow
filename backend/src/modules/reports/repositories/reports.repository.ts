import { Injectable } from '@nestjs/common';
import { Prisma, SaleStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

/**
 * Statuses that generate net revenue for reporting purposes.
 *
 * A `REFUNDED` sale is a full reversal — its revenue and COGS must not be
 * counted (the cash-flow, journals and cost layers are already reversed by
 * the refund workflow). `DRAFT`/`PENDING`/`CANCELLED` sales are not revenue.
 *
 * `PARTIALLY_REFUNDED` stays in the revenue set: the Sale model has no
 * refunded-amount column, so the full sale value is the only amount that can
 * be reported until a refundedAmount field is introduced (P1 reporting-only
 * fix — accounting, GL and costing are untouched).
 */
export const REVENUE_SALE_STATUSES: SaleStatus[] = [
  SaleStatus.COMPLETED,
  SaleStatus.PARTIALLY_REFUNDED,
];

/**
 * ReportsRepository — database logic only.
 * Returns raw Prisma results. No profit/margin calculations, no time-series rollups.
 * All business logic lives in ReportsService.
 */
@Injectable()
export class ReportsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  // ── Dashboard ──────────────────────────────────────────────────

  /// Base company currency — the default monetary filter for every money
  /// report when the caller does not pass an explicit `currency`.
  companyCurrency(companyId: string) {
    return this.prismaService.company
      .findUnique({
        where: { id: companyId },
        select: { currency: true },
      })
      .then((company) => company?.currency ?? 'KZT');
  }

  async dashboardSummary(
    companyId: string,
    todayStart: Date,
    todayEnd: Date,
    monthStart: Date,
    currency?: string,
  ) {
    return Promise.all([
      this.salesSumAgg(companyId, todayStart, todayEnd, currency),
      this.salesSumAgg(
        companyId,
        new Date(todayStart.getTime() - 86400000),
        todayStart,
        currency,
      ),
      this.salesSumAgg(companyId, monthStart, todayEnd, currency),
      this.prismaService.sale.count({ where: { companyId, deletedAt: null } }),
      this.stockValueAgg(companyId),
      this.prismaService.customer.count({
        where: { companyId, deletedAt: null, isActive: true },
      }),
      this.prismaService.supplier.count({
        where: { companyId, deletedAt: null, isActive: true },
      }),
      this.purchaseTotalAgg(companyId, currency),
    ]);
  }

  private salesSumAgg(
    companyId: string,
    from: Date,
    to: Date,
    currency?: string,
  ) {
    const where: Prisma.SaleWhereInput = {
      companyId,
      createdAt: { gte: from, lte: to },
      status: { in: REVENUE_SALE_STATUSES },
      deletedAt: null,
    };
    if (currency) where.currency = currency as Prisma.EnumCurrencyFilter;
    return this.prismaService.sale.aggregate({
      where,
      _sum: { total: true, paidAmount: true },
      _count: { id: true },
    });
  }

  /**
   * Ids of revenue-generating sales in a window (G11-F1): the dashboard
   * daily buckets previously counted COMPLETED sales only, so a partially
   * refunded sale vanished from its day. Buckets now scope to the same
   * revenue statuses as every other report; the service nets the bucket by
   * the canonical refund facts.
   */
  revenueSaleIds(
    companyId: string,
    from: Date,
    to: Date,
    currency?: string,
  ): Promise<string[]> {
    const where: Prisma.SaleWhereInput = {
      companyId,
      createdAt: { gte: from, lte: to },
      status: { in: REVENUE_SALE_STATUSES },
      deletedAt: null,
    };
    if (currency) where.currency = currency as Prisma.EnumCurrencyFilter;
    return this.prismaService.sale
      .findMany({ where, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));
  }

  private stockValueAgg(companyId: string) {
    return this.prismaService.stock.findMany({
      where: { companyId },
      include: { product: { select: { costPrice: true } } },
    });
  }

  private purchaseTotalAgg(companyId: string, currency?: string) {
    const where: Prisma.PurchaseOrderWhereInput = {
      companyId,
      deletedAt: null,
      status: 'RECEIVED',
    };
    if (currency)
      where.currency = currency as Prisma.EnumCurrencyFilter;
    return this.prismaService.purchaseOrder.aggregate({
      where,
      _sum: { grandTotal: true },
    });
  }

  grossProfitData(companyId: string, currency?: string) {
    const where: Prisma.SaleWhereInput = {
      companyId,
      status: { in: REVENUE_SALE_STATUSES },
      deletedAt: null,
    };
    if (currency) where.currency = currency as Prisma.EnumCurrencyFilter;
    return this.prismaService.sale.findMany({
      where,
      select: {
        // id is the CostLayer.referenceId join key for canonical FIFO COGS.
        id: true,
        total: true,
        items: { select: { costPrice: true, quantity: true } },
      },
    });
  }

  // ── Canonical refund facts (G11-F1) ─────────────────────────────

  /**
   * Canonical per-sale refund deduction for every revenue/COGS report
   * (G11-F1, closes GAP-A).
   *
   * ONE grouped query over the immutable E2 refund facts — never a query per
   * sale (no N+1), same shape as {@link saleFifoCosts}.
   *
   * Semantics (locked):
   * - only `status = COMPLETED` refunds deduct (a CANCELLED refund never
   *   reduces revenue);
   * - soft-deleted refunds are excluded (`deletedAt: null`);
   * - tenant-scoped: `companyId` is mandatory, never refundId alone;
   * - `Sale.status = REFUNDED` never enters the revenue set, so its refunds
   *   are never fetched by callers (no double-deduction of full refunds).
   *
   * Returns Map<saleId, { refundTotal, refundFifoCost }>; a sale absent from
   * the map has no completed refunds (zero deduction).
   */
  async salesRefundTotals(
    companyId: string,
    saleIds: string[],
  ): Promise<
    Map<string, { refundTotal: Prisma.Decimal; refundFifoCost: Prisma.Decimal }>
  > {
    const totals = new Map<
      string,
      { refundTotal: Prisma.Decimal; refundFifoCost: Prisma.Decimal }
    >();
    if (saleIds.length === 0) return totals;

    const refunds = await this.prismaService.salesRefund.findMany({
      where: {
        companyId,
        saleId: { in: saleIds },
        status: 'COMPLETED',
        deletedAt: null,
      },
      select: {
        saleId: true,
        total: true,
        items: { select: { fifoCost: true } },
      },
    });

    for (const refund of refunds) {
      const existing = totals.get(refund.saleId);
      const fifoSum = refund.items.reduce(
        (acc, item) => acc.add(item.fifoCost),
        new Prisma.Decimal(0),
      );
      totals.set(refund.saleId, {
        refundTotal: (existing?.refundTotal ?? new Prisma.Decimal(0)).add(
          refund.total,
        ),
        refundFifoCost: (existing?.refundFifoCost ?? new Prisma.Decimal(0)).add(
          fifoSum,
        ),
      });
    }
    return totals;
  }

  /**
   * Cash refunded within a shift window for the expected-closing netting
   * (G11-F1, closes GAP-B). ONE grouped query over the E5 allocation facts;
   * only `method = CASH` rows count (CARD/QR/BANK/MOBILE/STORE_CREDIT/
   * GIFT_CARD never affect the drawer), only COMPLETED non-deleted refunds.
   * Legacy full refunds (G11-D) have NO allocation rows — they were netted at
   * refund time — so this member is structurally zero for them and the
   * close-time netting cannot double-count them.
   */
  cashRefundedForShift(shiftId: string, companyId: string) {
    return this.prismaService.refundPaymentAllocation
      .aggregate({
        where: {
          companyId,
          method: 'CASH',
          deletedAt: null,
          salesRefund: {
            status: 'COMPLETED',
            deletedAt: null,
            sale: { cashShiftId: shiftId },
          },
        },
        _sum: { amount: true },
      })
      .then((agg) => agg._sum.amount ?? new Prisma.Decimal(0));
  }

  // ── Canonical FIFO COGS (G11-B) ─────────────────────────────────
  /**
   * Batched canonical COGS read for a report dataset: ONE grouped CostLayer
   * query — never a query per sale (no N+1).
   *
   * The where-clause fetches exactly the rows the Finance GL reads in
   * onSaleCompleted/onSaleRefunded (companyId + direction 'OUT' +
   * referenceType 'SALE' + referenceId = saleId), so per-sale coverage and
   * totals are semantically equivalent to Finance's resolveSaleCogs input.
   *
   * Returns Map<saleId, { totalCost: Σ OUT.totalCost, layerCount }>.
   * A sale absent from the map has zero OUT layers (legacy fallback case).
   */
  async saleFifoCosts(
    companyId: string,
    saleIds: string[],
  ): Promise<Map<string, { totalCost: Prisma.Decimal; layerCount: number }>> {
    const costs = new Map<
      string,
      { totalCost: Prisma.Decimal; layerCount: number }
    >();
    if (saleIds.length === 0) return costs;

    const outLayers = await this.prismaService.costLayer.findMany({
      where: {
        companyId,
        direction: 'OUT',
        referenceType: 'SALE',
        referenceId: { in: saleIds },
      },
      select: { referenceId: true, totalCost: true },
    });

    for (const layer of outLayers) {
      const saleId = layer.referenceId ?? '';
      const existing = costs.get(saleId);
      costs.set(saleId, {
        totalCost: (existing?.totalCost ?? new Prisma.Decimal(0)).add(
          layer.totalCost,
        ),
        layerCount: (existing?.layerCount ?? 0) + 1,
      });
    }
    return costs;
  }

  // ── Sales Report ────────────────────────────────────────────────

  salesReportData(
    companyId: string,
    where: Prisma.SaleWhereInput,
    page: number,
    limit: number,
    sortBy: string,
    sortOrder: 'asc' | 'desc',
  ) {
    return Promise.all([
      this.prismaService.sale.findMany({
        where,
        include: {
          items: {
            select: {
              quantity: true,
              total: true,
              costPrice: true,
              productId: true,
            },
          },
          payments: { select: { method: true, amount: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.sale.aggregate({
        where,
        _sum: { total: true, subtotal: true, paidAmount: true, discount: true },
        _count: { id: true },
        _avg: { total: true },
      }),
      this.prismaService.saleItem.aggregate({
        where: { sale: { ...where, companyId } },
        _sum: { quantity: true, costPrice: true },
      }),
    ]);
  }

  // ── Top Products ────────────────────────────────────────────────

  topProductsData(companyId: string, saleIds: string[], top: number) {
    if (saleIds.length === 0) return Promise.resolve([]);
    return this.prismaService.saleItem.groupBy({
      by: ['productId'],
      where: { saleId: { in: saleIds } },
      _sum: { quantity: true, total: true, costPrice: true },
      orderBy: { _sum: { total: 'desc' } },
      take: top,
    });
  }

  completedSaleIds(
    companyId: string,
    dateFrom?: Date,
    dateTo?: Date,
    currency?: string,
  ): Promise<{ id: string }[]> {
    const where: Prisma.SaleWhereInput = {
      companyId,
      status: 'COMPLETED',
      deletedAt: null,
    };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }
    if (currency) where.currency = currency as Prisma.EnumCurrencyFilter;
    return this.prismaService.sale.findMany({ where, select: { id: true } });
  }

  productsByIds(ids: string[], companyId: string) {
    return this.prismaService.product.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true, name: true, sku: true },
    });
  }

  // ── Low Stock ───────────────────────────────────────────────────

  lowStockData(
    companyId: string,
    warehouseId?: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const where: Prisma.StockWhereInput = { companyId, quantity: { lte: 5 } };
    if (warehouseId) where.warehouseId = warehouseId;
    return Promise.all([
      this.prismaService.stock.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
        },
        orderBy: [{ quantity: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.stock.count({ where }),
    ]);
  }

  // ── Inventory Valuation ─────────────────────────────────────────

  inventoryValuationData(
    companyId: string,
    warehouseId?: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const where: Prisma.StockWhereInput = { companyId, quantity: { gt: 0 } };
    if (warehouseId) where.warehouseId = warehouseId;
    return Promise.all([
      this.prismaService.stock.findMany({
        where,
        include: {
          product: {
            select: { id: true, name: true, sku: true, costPrice: true },
          },
        },
        orderBy: { quantity: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.stock.count({ where }),
    ]);
  }

  // ── Customer Report ─────────────────────────────────────────────

  customerList(
    companyId: string,
    search?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const where: Prisma.CustomerWhereInput = { companyId, deletedAt: null };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    return Promise.all([
      this.prismaService.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.customer.count({ where }),
    ]);
  }

  customerSaleAggs(
    companyId: string,
    customerIds: string[],
    dateFrom?: Date,
    dateTo?: Date,
    currency?: string,
  ) {
    const where: Prisma.SaleWhereInput = {
      companyId,
      customerId: { in: customerIds },
      status: 'COMPLETED',
      deletedAt: null,
    };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }
    if (currency) where.currency = currency as Prisma.EnumCurrencyFilter;
    return this.prismaService.sale.groupBy({
      by: ['customerId'],
      where,
      _count: { id: true },
      _sum: { total: true },
      _avg: { total: true },
      _max: { createdAt: true },
    });
  }

  // ── Supplier Report ─────────────────────────────────────────────

  supplierList(
    companyId: string,
    search?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const where: Prisma.SupplierWhereInput = { companyId, deletedAt: null };
    if (search) {
      where.OR = [
        { companyName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    return Promise.all([
      this.prismaService.supplier.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.supplier.count({ where }),
    ]);
  }

  supplierPurchaseAggs(
    companyId: string,
    supplierIds: string[],
    dateFrom?: Date,
    dateTo?: Date,
    currency?: string,
  ) {
    const where: Prisma.PurchaseOrderWhereInput = {
      companyId,
      supplierId: { in: supplierIds },
      deletedAt: null,
    };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }
    if (currency)
      where.currency = currency as Prisma.EnumCurrencyFilter;
    return this.prismaService.purchaseOrder.groupBy({
      by: ['supplierId'],
      where,
      _count: { id: true },
      _sum: { grandTotal: true },
      _max: { createdAt: true },
    });
  }

  // ── Purchasing Report ───────────────────────────────────────────

  purchasingReportData(
    companyId: string,
    where: Prisma.PurchaseOrderWhereInput,
    page: number,
    limit: number,
  ) {
    return Promise.all([
      this.prismaService.purchaseOrder.findMany({
        where,
        include: { supplier: { select: { companyName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.purchaseOrder.aggregate({
        where,
        _sum: { grandTotal: true },
        _count: { id: true },
      }),
      this.prismaService.purchaseOrder.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
    ]);
  }

  // ── Cash Shift Report ───────────────────────────────────────────

  cashShiftData(
    companyId: string,
    where: Prisma.CashShiftWhereInput,
    page: number,
    limit: number,
  ) {
    return Promise.all([
      this.prismaService.cashShift.findMany({
        where,
        include: {
          cashier: { select: { firstName: true, lastName: true, email: true } },
          warehouse: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.cashShift.count({ where }),
    ]);
  }

  // ── Profit Report ───────────────────────────────────────────────

  profitReportData(companyId: string, where: Prisma.SaleWhereInput) {
    // P1: only revenue-generating statuses count — REFUNDED/DRAFT/PENDING/
    // CANCELLED sales are excluded so the Profit Report shows net revenue.
    // An explicit caller-provided status filter (e.g. status=REFUNDED drill-
    // down) is respected; the profit endpoint currently forwards none.
    const netWhere = where.status
      ? where
      : { ...where, status: { in: REVENUE_SALE_STATUSES } };
    return this.prismaService.sale.findMany({
      where: netWhere,
      include: {
        items: { select: { costPrice: true, total: true, quantity: true } },
      },
    });
  }

  // ── Build where clauses ─────────────────────────────────────────

  buildSaleWhere(
    companyId: string,
    dateFrom?: Date,
    dateTo?: Date,
    warehouseId?: string,
    cashierId?: string,
    customerId?: string,
    status?: string,
    currency?: string,
  ): Prisma.SaleWhereInput {
    const where: Prisma.SaleWhereInput = { companyId, deletedAt: null };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }
    if (warehouseId) where.warehouseId = warehouseId;
    if (cashierId) where.cashierId = cashierId;
    if (customerId) where.customerId = customerId;
    if (status) where.status = status as Prisma.EnumSaleStatusFilter['equals'];
    if (currency) where.currency = currency as Prisma.EnumCurrencyFilter;
    return where;
  }

  buildPurchaseWhere(
    companyId: string,
    dateFrom?: Date,
    dateTo?: Date,
    currency?: string,
  ): Prisma.PurchaseOrderWhereInput {
    const where: Prisma.PurchaseOrderWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }
    if (currency)
      where.currency = currency as Prisma.EnumCurrencyFilter;
    return where;
  }

  buildCashShiftWhere(
    companyId: string,
    warehouseId?: string,
    cashierId?: string,
    status?: string,
    dateFrom?: Date,
    dateTo?: Date,
    currency?: string,
  ): Prisma.CashShiftWhereInput {
    const where: Prisma.CashShiftWhereInput = { companyId };
    if (warehouseId) where.warehouseId = warehouseId;
    if (cashierId) where.cashierId = cashierId;
    if (status) where.status = status as 'OPEN' | 'CLOSED';
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }
    if (currency) where.currency = currency as Prisma.EnumCurrencyFilter;
    return where;
  }
}
