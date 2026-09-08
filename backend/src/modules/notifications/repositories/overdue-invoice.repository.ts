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
 * (status IN (APPROVED, PAID), grandTotal - paidAmount > 0, deletedAt IS NULL,
 * dueDate < start of day) — the analytics service itself stays untouched.
 * Column-vs-column comparison (grandTotal - paidAmount > 0) is not expressible
 * in a Prisma `where`, hence the raw query, same as in the analytics service.
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
        (pi."grandTotal" - pi."paidAmount")::text AS "outstanding",
        FLOOR(
          EXTRACT(EPOCH FROM (${startOfToday}::timestamp - pi."dueDate")) / 86400
        )::int AS "daysOverdue"
      FROM "PurchaseInvoice" pi
      JOIN "Supplier" s ON s."id" = pi."supplierId"
      WHERE pi."companyId" = ${companyId}
        AND pi."deletedAt" IS NULL
        AND pi."status" IN ('APPROVED', 'PAID')
        AND (pi."grandTotal" - pi."paidAmount") > 0
        AND pi."dueDate" IS NOT NULL
        AND pi."dueDate" < ${startOfToday}
      ORDER BY pi."dueDate" ASC
    `;
  }
}
