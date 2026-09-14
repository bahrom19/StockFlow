import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

/**
 * One aggregated row per (supplier, currency) currency group.
 *
 * Monetary aggregates are cast `::text` in SQL (same convention as the AP
 * aging read model) so no JavaScript floating-point arithmetic ever touches
 * the values; they are passed through to the response as Decimal-safe
 * strings.
 */
export interface SupplierExposureCurrencyRow {
  supplierId: string;
  currency: string;
  openPoCount: number;
  committedOpenPo: string;
  uninvoicedOpenPo: string;
}

/**
 * G9-D3: read-only data access for the Supplier Open-PO Exposure read model.
 *
 * Canonical metric (per Purchase Order):
 *   uninvoiced = max(po.grandTotal − Σ(active APPROVED/PAID invoice
 *                                      grandTotal for that PO), 0)
 *
 * The G9-D2 overrun guard already enforces
 * `Σ approved/paid invoices ≤ po.grandTotal`, but the GREATEST(..., 0) floor
 * is kept as defence-in-depth for legacy/corrupt data.
 *
 * Included PO statuses (committed or received obligation):
 *   APPROVED, ORDERED, PARTIALLY_RECEIVED, RECEIVED
 * Excluded: DRAFT, PENDING (no committed order), CANCELLED (terminal) and
 * soft-deleted POs. RECEIVED POs keep their uninvoiced remainder as exposure
 * until an invoice covers it.
 *
 * Tenant safety: the outer query is scoped by supplierId + companyId, and
 * the invoice-derived aggregation carries its own `companyId` boundary which
 * is re-joined to the PO (`inv.companyId = po.companyId`) — the tenant
 * isolation is visible directly in the query structure, not inferred from
 * UUID global uniqueness.
 *
 * Sources deliberately NOT used: PurchaseOrder.paidAmount and
 * PurchaseInvoice.paidAmount (legacy caches, never canonical), and
 * GoodsReceipt monetary values (receipt-time costs may drift from PO costs).
 *
 * Currency: results are grouped by `po.currency` defensively. No FX
 * conversion is performed and different currency groups are never mixed
 * arithmetically; the service layer applies the G9-D1 base-currency contract.
 *
 * Single grouped query — no N+1. Read-only; nothing is persisted.
 */
@Injectable()
export class SupplierExposureRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async getOpenPoExposureAggregates(
    supplierId: string,
    companyId: string,
  ): Promise<SupplierExposureCurrencyRow[]> {
    const rows = await this.prismaService.$queryRaw<
      Array<{
        supplierId: string;
        currency: string;
        openPoCount: number;
        committedOpenPo: string;
        uninvoicedOpenPo: string;
      }>
    >`
      SELECT
        po."supplierId" AS "supplierId",
        po.currency AS currency,
        COUNT(*)::int AS "openPoCount",
        SUM(po."grandTotal")::text AS "committedOpenPo",
        SUM(
          GREATEST(
            po."grandTotal" - COALESCE(inv."invoicedTotal", 0),
            0
          )
        )::text AS "uninvoicedOpenPo"
      FROM "PurchaseOrder" po
      LEFT JOIN (
        SELECT
          pi."purchaseOrderId",
          pi."companyId",
          SUM(pi."grandTotal") AS "invoicedTotal"
        FROM "PurchaseInvoice" pi
        WHERE pi."companyId" = ${companyId}
          AND pi."deletedAt" IS NULL
          AND pi.status IN ('APPROVED', 'PAID')
        GROUP BY pi."purchaseOrderId", pi."companyId"
      ) inv
        ON inv."purchaseOrderId" = po.id
        AND inv."companyId" = po."companyId"
      WHERE po."supplierId" = ${supplierId}
        AND po."companyId" = ${companyId}
        AND po."deletedAt" IS NULL
        AND po.status IN ('APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED')
      GROUP BY po."supplierId", po.currency
    `;

    return rows.map((row) => ({
      supplierId: row.supplierId,
      currency: row.currency,
      openPoCount: row.openPoCount,
      committedOpenPo: row.committedOpenPo,
      uninvoicedOpenPo: row.uninvoicedOpenPo,
    }));
  }
}
