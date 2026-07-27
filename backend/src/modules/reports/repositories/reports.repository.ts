import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

/**
 * ReportsRepository — database logic only.
 * Returns raw Prisma results. No profit/margin calculations, no time-series rollups.
 * All business logic lives in ReportsService.
 */
@Injectable()
export class ReportsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  // ── Dashboard ──────────────────────────────────────────────────

  async dashboardSummary(
    companyId: string,
    todayStart: Date,
    todayEnd: Date,
    monthStart: Date,
  ) {
    return Promise.all([
      this.salesSumAgg(companyId, todayStart, todayEnd),
      this.salesSumAgg(
        companyId,
        new Date(todayStart.getTime() - 86400000),
        todayStart,
      ),
      this.salesSumAgg(companyId, monthStart, todayEnd),
      this.prismaService.sale.count({ where: { companyId, deletedAt: null } }),
      this.stockValueAgg(companyId),
      this.prismaService.customer.count({
        where: { companyId, deletedAt: null, isActive: true },
      }),
      this.prismaService.supplier.count({
        where: { companyId, deletedAt: null, isActive: true },
      }),
      this.purchaseTotalAgg(companyId),
    ]);
  }

  private salesSumAgg(companyId: string, from: Date, to: Date) {
    return this.prismaService.sale.aggregate({
      where: {
        companyId,
        createdAt: { gte: from, lte: to },
        status: 'COMPLETED',
        deletedAt: null,
      },
      _sum: { total: true, paidAmount: true },
      _count: { id: true },
    });
  }

  private stockValueAgg(companyId: string) {
    return this.prismaService.stock.findMany({
      where: { companyId },
      include: { product: { select: { costPrice: true } } },
    });
  }

  private purchaseTotalAgg(companyId: string) {
    return this.prismaService.purchaseOrder.aggregate({
      where: { companyId, deletedAt: null, status: 'RECEIVED' },
      _sum: { grandTotal: true },
    });
  }

  grossProfitData(companyId: string) {
    return this.prismaService.sale.findMany({
      where: { companyId, status: 'COMPLETED', deletedAt: null },
      select: {
        total: true,
        items: { select: { costPrice: true, quantity: true } },
      },
    });
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
    return this.prismaService.sale.findMany({
      where,
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
    return where;
  }

  buildPurchaseWhere(
    companyId: string,
    dateFrom?: Date,
    dateTo?: Date,
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
    return where;
  }

  buildCashShiftWhere(
    companyId: string,
    warehouseId?: string,
    cashierId?: string,
    status?: string,
    dateFrom?: Date,
    dateTo?: Date,
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
    return where;
  }
}
