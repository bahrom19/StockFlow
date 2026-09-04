import { Injectable, NotFoundException } from '@nestjs/common';
import { PurchaseInvoiceStatus, PurchaseReturnStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { SupplierPurchaseSummaryEntity, MonthlySpendEntity } from '../entities/supplier-purchase-summary.entity';

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
}
