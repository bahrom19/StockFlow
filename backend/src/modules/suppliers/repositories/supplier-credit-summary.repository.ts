import { Injectable } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PurchaseInvoiceStatus, PurchaseReturnStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

export interface SupplierCreditTotals {
  totalInvoiced: Decimal;
  totalAllocated: Decimal;
  totalReturned: Decimal;
}

/**
 * G9-D1: read-only data access for the Supplier Credit Summary.
 *
 * ISOLATED calculation path — deliberately does NOT reuse
 * getFinanceSummary/getPaymentAging aggregates, because those aggregate
 * grandTotals without a currency filter. Every aggregate here is restricted
 * to the COMPANY BASE CURRENCY (credit utilization must never mix
 * currencies), while the global canonical AP formula stays untouched.
 *
 * Canonical supplier AP (G9-A/B1 semantics), base currency only:
 *   Σ PurchaseInvoice.grandTotal (APPROVED|PAID, deletedAt IS NULL,
 *                                  currency = base)
 * − Σ SupplierPaymentAllocation.amount (deletedAt IS NULL, linked invoice
 *                                  in base currency; supplier-level
 *                                  allocations with no invoice included —
 *                                  payments are always recorded in the
 *                                  company base currency)
 * − Σ PurchaseReturn.grandTotal (APPROVED|COMPLETED, deletedAt IS NULL,
 *                                  currency = base)
 *
 * Unallocated payments (no allocation rows) intentionally do NOT reduce
 * outstanding — same as the canonical allocation model.
 * The legacy PurchaseInvoice.paidAmount cache is never read here.
 */
@Injectable()
export class SupplierCreditSummaryRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async getBaseCurrencyTotals(
    supplierId: string,
    companyId: string,
    baseCurrency: Currency,
  ): Promise<SupplierCreditTotals> {
    const [invoiceAgg, allocationAgg, returnAgg] = await Promise.all([
      this.prismaService.purchaseInvoice.aggregate({
        where: {
          supplierId,
          companyId,
          deletedAt: null,
          status: {
            in: [PurchaseInvoiceStatus.APPROVED, PurchaseInvoiceStatus.PAID],
          },
          // G9-D1: base currency ONLY — non-base invoices are excluded,
          // no FX conversion is performed.
          currency: baseCurrency,
        },
        _sum: { grandTotal: true },
      }),
      this.prismaService.supplierPaymentAllocation.aggregate({
        where: {
          supplierId,
          companyId,
          deletedAt: null,
          // Count only allocations tied to base-currency invoices
          // (or supplier-level allocations without an invoice — payments
          // are always recorded in the company base currency, G3-2).
          OR: [
            { purchaseInvoice: { currency: baseCurrency } },
            { purchaseInvoiceId: null },
          ],
        },
        _sum: { amount: true },
      }),
      this.prismaService.purchaseReturn.aggregate({
        where: {
          supplierId,
          companyId,
          deletedAt: null,
          // Only APPROVED/COMPLETED returns reduce AP — DRAFT/CANCELLED
          // must not (canonical return accounting, unchanged).
          // G15-02-B: voided COMPLETED returns (isCancelled) must not reduce AP.
          status: {
            in: [PurchaseReturnStatus.APPROVED, PurchaseReturnStatus.COMPLETED],
          },
          isCancelled: false,
          currency: baseCurrency,
        },
        _sum: { grandTotal: true },
      }),
    ]);

    return {
      totalInvoiced: new Decimal(invoiceAgg._sum.grandTotal ?? 0),
      totalAllocated: new Decimal(allocationAgg._sum.amount ?? 0),
      totalReturned: new Decimal(returnAgg._sum.grandTotal ?? 0),
    };
  }
}