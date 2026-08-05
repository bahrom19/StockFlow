import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ReportQueryDto } from '../dto/report-query.dto';
import {
  REVENUE_SALE_STATUSES,
  ReportsRepository,
} from '../repositories/reports.repository';

@Injectable()
export class ReportsService {
  constructor(private readonly repo: ReportsRepository) {}

  // ── Dashboard ──────────────────────────────────────────────────

  async getDashboard(companyId: string) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      todayRaw,
      yesterdayRaw,
      monthRaw,
      orderCount,
      stocks,
      customerCount,
      supplierCount,
      purchaseAgg,
    ] = await this.repo.dashboardSummary(
      companyId,
      todayStart,
      todayEnd,
      monthStart,
    );

    let inventoryValue = new Prisma.Decimal(0);
    for (const s of stocks) {
      if (s.product.costPrice) {
        inventoryValue = inventoryValue.add(
          new Prisma.Decimal(s.product.costPrice.toString()).mul(s.quantity),
        );
      }
    }

    const lowStock = stocks.filter(
      (s) => s.quantity > 0 && s.quantity <= 5,
    ).length;

    // Gross revenue & profit (all completed sales — no date filter)
    const grossData = await this.repo.grossProfitData(companyId);
    let grossRevenue = new Prisma.Decimal(0);
    let grossCost = new Prisma.Decimal(0);
    for (const sale of grossData) {
      grossRevenue = grossRevenue.add(
        new Prisma.Decimal(sale.total.toString()),
      );
      for (const item of sale.items ?? []) {
        grossCost = grossCost.add(
          new Prisma.Decimal(item.costPrice.toString()).mul(item.quantity),
        );
      }
    }
    const grossProfit = grossRevenue.sub(grossCost);
    const todayTotal = todayRaw._sum.total ?? new Prisma.Decimal(0);
    const todayCount = todayRaw._count.id;
    const avgReceipt =
      todayCount > 0
        ? todayTotal.div(new Prisma.Decimal(todayCount))
        : new Prisma.Decimal(0);

    return {
      todaySales: {
        revenue: todayTotal.toString(),
        count: todayCount,
        averageReceipt: avgReceipt.toString(),
      },
      yesterdaySales: {
        revenue: yesterdayRaw._sum.total?.toString() ?? '0.0000',
        count: yesterdayRaw._count.id,
      },
      monthSales: {
        revenue: monthRaw._sum.total?.toString() ?? '0.0000',
        count: monthRaw._count.id,
      },
      ordersCount: orderCount,
      grossRevenue: grossRevenue.toString(),
      grossProfit: grossProfit.toString(),
      inventoryValue: inventoryValue.toString(),
      lowStockProducts: lowStock,
      outOfStockProducts: stocks.filter((s) => s.quantity === 0).length,
      customerCount,
      supplierCount,
      purchaseTotal: purchaseAgg._sum.grandTotal?.toString() ?? '0.0000',
    };
  }

  // ── Sales Report ────────────────────────────────────────────────

  async getSalesReport(companyId: string, query: ReportQueryDto) {
    const {
      dateFrom,
      dateTo,
      warehouseId,
      cashierId,
      customerId,
      status,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const where = this.repo.buildSaleWhere(
      companyId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined,
      warehouseId,
      cashierId,
      customerId,
      status,
    );
    // P1: when the caller does not explicitly filter by status, scope the
    // Sales Report to revenue-generating sales so its summary stays
    // consistent with the Dashboard and the Profit Report (refunds are
    // excluded — they are reversed in the journals and cost layers).
    if (!status) {
      where.status = { in: REVENUE_SALE_STATUSES };
    }
    const [sales, agg, itemAgg] = await this.repo.salesReportData(
      companyId,
      where,
      page,
      limit,
      sortBy,
      sortOrder,
    );

    let productsSold = 0;
    let totalCost = new Prisma.Decimal(0);
    for (const sale of sales) {
      for (const item of sale.items ?? []) {
        productsSold += item.quantity;
        totalCost = totalCost.add(
          new Prisma.Decimal(item.costPrice.toString()).mul(item.quantity),
        );
      }
    }

    // v1.2: per-method payment breakdown. Cash/Card/QR/Bank/Wallet are counted
    // explicitly; everything else (legacy GIFT_CARD / STORE_CREDIT) is "other".
    let cashTotal = new Prisma.Decimal(0);
    let cardTotal = new Prisma.Decimal(0);
    let qrTotal = new Prisma.Decimal(0);
    let bankTotal = new Prisma.Decimal(0);
    let walletTotal = new Prisma.Decimal(0);
    let otherTotal = new Prisma.Decimal(0);
    for (const sale of sales) {
      // Cash is reported NET of change dispensed (cashTendered − change),
      // mirroring sales.service.ts (cashSalesNet = alloc.cash − changeAmount).
      // This keeps  cash+card+qr+bank+wallet == revenue  in every report.
      const changeAmount = sale.changeAmount
        ? new Prisma.Decimal(sale.changeAmount.toString())
        : new Prisma.Decimal(0);
      let cashForSale = new Prisma.Decimal(0);
      for (const p of sale.payments ?? []) {
        const amt = new Prisma.Decimal(p.amount.toString());
        switch (p.method) {
          case 'CASH':
            cashForSale = cashForSale.add(amt);
            break;
          case 'CARD':
            cardTotal = cardTotal.add(amt);
            break;
          case 'QR':
            qrTotal = qrTotal.add(amt);
            break;
          case 'BANK_TRANSFER':
            bankTotal = bankTotal.add(amt);
            break;
          case 'MOBILE_WALLET':
            walletTotal = walletTotal.add(amt);
            break;
          default:
            otherTotal = otherTotal.add(amt);
        }
      }
      cashTotal = cashTotal.add(cashForSale).sub(changeAmount);
    }

    const revenue = agg._sum.total ?? new Prisma.Decimal(0);
    const profit = revenue.sub(totalCost);
    const margin = revenue.gt(0)
      ? profit.div(revenue).mul(100)
      : new Prisma.Decimal(0);
    const avgReceipt = agg._avg.total ?? new Prisma.Decimal(0);

    return {
      sales: sales.map((s) => ({
        id: s.id,
        saleNumber: s.saleNumber,
        createdAt: s.createdAt,
        status: s.status,
        total: s.total.toString(),
        paidAmount: s.paidAmount.toString(),
      })),
      summary: {
        revenue: revenue.toString(),
        profit: profit.toString(),
        margin: margin.toString(),
        averageReceipt: avgReceipt.toString(),
        productsSold,
        count: agg._count.id,
        payments: {
          cash: cashTotal.toString(),
          card: cardTotal.toString(),
          qr: qrTotal.toString(),
          bankTransfer: bankTotal.toString(),
          mobileWallet: walletTotal.toString(),
          other: otherTotal.toString(),
        },
      },
      total: agg._count.id,
      page,
      limit,
    };
  }

  // ── Top Products ────────────────────────────────────────────────

  async getTopProducts(companyId: string, query: ReportQueryDto) {
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
    const top = query.top ?? 10;

    const saleIds = (
      await this.repo.completedSaleIds(companyId, dateFrom, dateTo)
    ).map((s) => s.id);
    if (saleIds.length === 0) return { items: [], total: 0 };

    const grouped = await this.repo.topProductsData(companyId, saleIds, top);
    const productIds = grouped.map((i) => i.productId);
    const products = await this.repo.productsByIds(productIds, companyId);
    const productMap = new Map(products.map((p) => [p.id, p]));

    return {
      items: grouped.map((i) => {
        const product = productMap.get(i.productId);
        const revenue = i._sum.total ?? new Prisma.Decimal(0);
        const cost = i._sum.costPrice ?? new Prisma.Decimal(0);
        const profit = revenue.sub(cost);
        const margin = revenue.gt(0)
          ? profit.div(revenue).mul(100)
          : new Prisma.Decimal(0);
        return {
          productId: i.productId,
          productName: product?.name ?? 'Deleted',
          sku: product?.sku ?? '',
          quantitySold: i._sum.quantity ?? 0,
          revenue: revenue.toString(),
          profit: profit.toString(),
          margin: margin.toString(),
        };
      }),
      total: grouped.length,
    };
  }

  // ── Low Stock ───────────────────────────────────────────────────

  async getLowStock(companyId: string, query: ReportQueryDto) {
    const [items, total] = await this.repo.lowStockData(
      companyId,
      query.warehouseId,
      query.page,
      query.limit,
    );
    return {
      items: items.map((s) => ({
        productId: s.product.id,
        productName: s.product.name,
        sku: s.product.sku,
        currentStock: s.quantity,
        minQuantity: s.minQuantity,
        warehouseId: s.warehouse.id,
        warehouseName: s.warehouse.name,
        status: s.quantity === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      })),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    };
  }

  // ── Inventory Valuation ─────────────────────────────────────────

  async getInventoryValuation(companyId: string, query: ReportQueryDto) {
    const [items, total] = await this.repo.inventoryValuationData(
      companyId,
      query.warehouseId,
      query.page,
      query.limit,
    );
    let grandTotal = new Prisma.Decimal(0);
    const mapped = items.map((s) => {
      const costPrice = new Prisma.Decimal(
        s.product.costPrice?.toString() ?? '0',
      );
      const value = costPrice.mul(s.quantity);
      grandTotal = grandTotal.add(value);
      return {
        productId: s.product.id,
        productName: s.product.name,
        sku: s.product.sku,
        quantity: s.quantity,
        averageCost: costPrice.toString(),
        inventoryValue: value.toString(),
      };
    });
    return {
      items: mapped,
      totalValue: grandTotal.toString(),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    };
  }

  // ── Customer Report ─────────────────────────────────────────────

  async getCustomerReport(companyId: string, query: ReportQueryDto) {
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
    const [customers, total] = await this.repo.customerList(
      companyId,
      query.search,
      query.page,
      query.limit,
    );

    const customerIds = customers.map((c) => c.id);
    const aggs =
      customerIds.length > 0
        ? await this.repo.customerSaleAggs(
            companyId,
            customerIds,
            dateFrom,
            dateTo,
          )
        : [];
    const aggMap = new Map(aggs.map((a) => [a.customerId, a]));

    return {
      items: customers.map((c) => {
        const agg = aggMap.get(c.id);
        return {
          customerId: c.id,
          name:
            [c.firstName, c.lastName].filter(Boolean).join(' ') ||
            c.companyName ||
            'Unknown',
          email: c.email,
          phone: c.phone,
          orders: agg?._count.id ?? 0,
          revenue: agg?._sum.total?.toString() ?? '0.0000',
          averageReceipt: agg?._avg.total?.toString() ?? '0.0000',
          lastPurchase: agg?._max.createdAt ?? null,
        };
      }),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  // ── Supplier Report ─────────────────────────────────────────────

  async getSupplierReport(companyId: string, query: ReportQueryDto) {
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
    const [suppliers, total] = await this.repo.supplierList(
      companyId,
      query.search,
      query.page,
      query.limit,
    );

    const supplierIds = suppliers.map((s) => s.id);
    const aggs =
      supplierIds.length > 0
        ? await this.repo.supplierPurchaseAggs(
            companyId,
            supplierIds,
            dateFrom,
            dateTo,
          )
        : [];
    const aggMap = new Map(aggs.map((a) => [a.supplierId, a]));

    return {
      items: suppliers.map((s) => {
        const agg = aggMap.get(s.id);
        return {
          supplierId: s.id,
          companyName: s.companyName,
          email: s.email,
          phone: s.phone,
          purchaseOrders: agg?._count.id ?? 0,
          purchaseTotal: agg?._sum.grandTotal?.toString() ?? '0.0000',
          lastPurchase: agg?._max.createdAt ?? null,
        };
      }),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  // ── Purchasing Report ───────────────────────────────────────────

  async getPurchasingReport(companyId: string, query: ReportQueryDto) {
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
    const where = this.repo.buildPurchaseWhere(companyId, dateFrom, dateTo);
    const [orders, agg, statusCounts] = await this.repo.purchasingReportData(
      companyId,
      where,
      query.page ?? 1,
      query.limit ?? 20,
    );

    return {
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        supplierName: o.supplier.companyName,
        status: o.status,
        grandTotal: o.grandTotal.toString(),
        createdAt: o.createdAt,
      })),
      summary: {
        totalOrders: agg._count.id,
        totalValue: agg._sum.grandTotal?.toString() ?? '0.0000',
        byStatus: Object.fromEntries(
          statusCounts.map((s) => [s.status, s._count.id]),
        ),
      },
      total: agg._count.id,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  // ── Cash Shift Report ───────────────────────────────────────────

  async getCashShiftReport(companyId: string, query: ReportQueryDto) {
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
    const where = this.repo.buildCashShiftWhere(
      companyId,
      query.warehouseId,
      query.cashierId,
      query.status,
      dateFrom,
      dateTo,
    );
    const [shifts, total] = await this.repo.cashShiftData(
      companyId,
      where,
      query.page ?? 1,
      query.limit ?? 20,
    );

    return {
      items: shifts.map((s) => ({
        id: s.id,
        status: s.status,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        warehouseName: s.warehouse.name,
        cashierName:
          [s.cashier.firstName, s.cashier.lastName].filter(Boolean).join(' ') ||
          s.cashier.email,
        openingBalance: s.openingBalance.toString(),
        closingBalance: s.closingBalance.toString(),
        cashSales: s.cashSales.toString(),
        cardSales: s.cardSales.toString(),
        qrSales: s.qrSales.toString(),
        bankTransferSales: s.bankTransferSales.toString(),
        mobileWalletSales: s.mobileWalletSales.toString(),
        totalSales: s.totalSales.toString(),
        cashIn: s.cashIn.toString(),
        cashOut: s.cashOut.toString(),
        expectedClosing: s.expectedClosing.toString(),
        difference: s.difference.toString(),
        notes: s.notes,
      })),
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  // ── Profit Report ───────────────────────────────────────────────

  async getProfitReport(companyId: string, query: ReportQueryDto) {
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
    const where = this.repo.buildSaleWhere(companyId, dateFrom, dateTo);
    const sales = await this.repo.profitReportData(companyId, where);

    let revenue = new Prisma.Decimal(0);
    let cost = new Prisma.Decimal(0);
    const daily: Record<
      string,
      { revenue: Prisma.Decimal; cost: Prisma.Decimal }
    > = {};
    const weekly: Record<
      string,
      { revenue: Prisma.Decimal; cost: Prisma.Decimal }
    > = {};
    const monthly: Record<
      string,
      { revenue: Prisma.Decimal; cost: Prisma.Decimal }
    > = {};

    for (const sale of sales) {
      const saleTotal = new Prisma.Decimal(sale.total.toString());
      revenue = revenue.add(saleTotal);
      let saleCost = new Prisma.Decimal(0);
      for (const item of sale.items ?? []) {
        saleCost = saleCost.add(
          new Prisma.Decimal(item.costPrice.toString()).mul(item.quantity),
        );
      }
      cost = cost.add(saleCost);

      const dayKey = sale.createdAt.toISOString().slice(0, 10);
      const date = new Date(sale.createdAt);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().slice(0, 10);
      const monthKey = sale.createdAt.toISOString().slice(0, 7);

      if (!daily[dayKey])
        daily[dayKey] = {
          revenue: new Prisma.Decimal(0),
          cost: new Prisma.Decimal(0),
        };
      daily[dayKey].revenue = daily[dayKey].revenue.add(saleTotal);
      daily[dayKey].cost = daily[dayKey].cost.add(saleCost);
      if (!weekly[weekKey])
        weekly[weekKey] = {
          revenue: new Prisma.Decimal(0),
          cost: new Prisma.Decimal(0),
        };
      weekly[weekKey].revenue = weekly[weekKey].revenue.add(saleTotal);
      weekly[weekKey].cost = weekly[weekKey].cost.add(saleCost);
      if (!monthly[monthKey])
        monthly[monthKey] = {
          revenue: new Prisma.Decimal(0),
          cost: new Prisma.Decimal(0),
        };
      monthly[monthKey].revenue = monthly[monthKey].revenue.add(saleTotal);
      monthly[monthKey].cost = monthly[monthKey].cost.add(saleCost);
    }

    const grossProfit = revenue.sub(cost);
    const margin = revenue.gt(0)
      ? grossProfit.div(revenue).mul(100)
      : new Prisma.Decimal(0);
    const fmt = (r: Prisma.Decimal, c: Prisma.Decimal) => ({
      revenue: r.toString(),
      cost: c.toString(),
      profit: r.sub(c).toString(),
      margin: r.gt(0) ? r.sub(c).div(r).mul(100).toString() : '0.0000',
    });

    return {
      summary: fmt(revenue, cost),
      daily: Object.entries(daily)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({ date: k, ...fmt(v.revenue, v.cost) })),
      weekly: Object.entries(weekly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({ week: k, ...fmt(v.revenue, v.cost) })),
      monthly: Object.entries(monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({ month: k, ...fmt(v.revenue, v.cost) })),
    };
  }
}
