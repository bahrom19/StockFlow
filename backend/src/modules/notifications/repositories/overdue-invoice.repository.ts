import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma';

/**
 * One overdue purchase invoice row for the daily notification scan.
 */
export interface OverdueInvoiceRow {
  companyId: string;
  invoiceId: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  dueDate: Date;
  currency: string;
  outstanding: string;
  daysOverdue: number;
}

/**
 * Company-wide overdue purchase-invoice read model for Notifications V1.
 *
 * Criteria mirror SupplierAnalyticsService.getPaymentAging() exactly
 * (status IN (APPROVED, PAID), grandTotal - SUM(active allocations) > 0,
 * deletedAt IS NULL, dueDate IS NOT NULL, daysOverdue >= 1) — the analytics
 * service itself stays untouched. Payment coverage uses the canonical
 * G9-B1 allocation source: SUM(SupplierPaymentAllocation.amount) where
 * deletedAt IS NULL — NOT the legacy PurchaseInvoice.paidAmount cache.
 * Column-vs-column comparison (grandTotal - allocatedAmount > 0) is not
 * expressible in a Prisma `where`, hence the raw query, same as in the
 * analytics service.
 */
@Injectable()
export class OverdueInvoiceRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findOverdueInvoices(
    companyId: string,
    startOfToday: Date,
  ): Promise<OverdueInvoiceRow[]> {
    return this.prismaService.$queryRaw<OverdueInvoiceRow[]>`
      SELECT
        pi."id" AS "invoiceId",
        pi."companyId",
        pi."invoiceNumber",
        pi."supplierId",
        s."name" AS "supplierName",
        pi."dueDate",
        pi."currency",
        (pi."grandTotal" - COALESCE(spa."allocatedAmount", 0))::text AS "outstanding",
        FLOOR(
          EXTRACT(EPOCH FROM (${startOfToday}::timestamp - pi."dueDate")) / 86400
        )::int AS "daysOverdue"
      FROM "PurchaseInvoice" pi
      LEFT JOIN (
        SELECT
          "purchaseInvoiceId",
          SUM(amount) AS "allocatedAmount"
        FROM "SupplierPaymentAllocation"
        WHERE "deletedAt" IS NULL
        GROUP BY "purchaseInvoiceId"
      ) spa ON spa."purchaseInvoiceId" = pi.id
      JOIN "Supplier" s ON s."id" = pi."supplierId"
      WHERE pi."companyId" = ${companyId}
        AND pi."deletedAt" IS NULL
        AND pi."status" IN ('APPROVED', 'PAID')
        AND (pi."grandTotal" - COALESCE(spa."allocatedAmount", 0)) > 0
        AND pi."dueDate" IS NOT NULL
        AND FLOOR(
          EXTRACT(EPOCH FROM (${startOfToday}::timestamp - pi."dueDate")) / 86400
        )::int >= 1
      ORDER BY pi."dueDate" ASC
    `;
  }
}
