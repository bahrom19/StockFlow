import { Injectable } from '@nestjs/common';
import { Currency, Prisma, PurchaseInvoiceStatus, PurchaseReturnStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';

export interface StatementInvoiceRow {
  id: string;
  invoiceNumber: string;
  invoiceDate: Date;
  grandTotal: Decimal;
  currency: Currency;
  status: PurchaseInvoiceStatus;
}

export interface StatementPaymentRow {
  id: string;
  paymentNumber: string;
  paymentDate: Date;
  amount: Decimal;
  currency: Currency;
}

export interface StatementReturnRow {
  id: string;
  returnNumber: string;
  returnDate: Date;
  grandTotal: Decimal;
  currency: Currency;
  status: PurchaseReturnStatus;
}

export interface StatementAllocationRow {
  paymentId: string;
  purchaseInvoiceId: string | null;
  amount: Decimal;
}

export interface OpeningBalanceRow {
  invoices: Decimal;
  payments: Decimal;
  returns: Decimal;
}

/**
 * Data access for the operational Supplier AP Statement.
 *
 * The statement is an OPERATIONAL AP subledger — it reads the canonical
 * operational sources (PurchaseInvoice / SupplierPayment /
 * SupplierPaymentAllocation / PurchaseReturn) directly and is NOT derived
 * from the general ledger. It never reads the legacy PurchaseInvoice.paidAmount
 * cache as a source of balance.
 *
 * Tenant safety: every source is scoped by BOTH supplierId and companyId, and
 * soft-deleted rows (deletedAt IS NULL) are excluded.
 */
@Injectable()
export class SupplierStatementRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private dateRange(
    dateFrom?: Date,
    dateTo?: Date,
  ): Prisma.DateTimeFilter | undefined {
    if (!dateFrom && !dateTo) return undefined;
    return {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  async findInvoices(
    supplierId: string,
    companyId: string,
    dateFrom?: Date,
    dateTo?: Date,
    currency?: Currency,
  ): Promise<StatementInvoiceRow[]> {
    const where: Prisma.PurchaseInvoiceWhereInput = {
      supplierId,
      companyId,
      deletedAt: null,
      status: {
        in: [PurchaseInvoiceStatus.APPROVED, PurchaseInvoiceStatus.PAID],
      },
      invoiceDate: this.dateRange(dateFrom, dateTo),
      ...(currency ? { currency } : {}),
    };
    return this.prismaService.purchaseInvoice.findMany({
      where,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        grandTotal: true,
        currency: true,
        status: true,
      },
    });
  }

  async findPayments(
    supplierId: string,
    companyId: string,
    dateFrom?: Date,
    dateTo?: Date,
    currency?: Currency,
  ): Promise<StatementPaymentRow[]> {
    const where: Prisma.SupplierPaymentWhereInput = {
      supplierId,
      companyId,
      deletedAt: null,
      paymentDate: this.dateRange(dateFrom, dateTo),
      ...(currency ? { currency } : {}),
    };
    return this.prismaService.supplierPayment.findMany({
      where,
      select: {
        id: true,
        paymentNumber: true,
        paymentDate: true,
        amount: true,
        currency: true,
      },
    });
  }

  async findReturns(
    supplierId: string,
    companyId: string,
    dateFrom?: Date,
    dateTo?: Date,
    currency?: Currency,
  ): Promise<StatementReturnRow[]> {
    const where: Prisma.PurchaseReturnWhereInput = {
      supplierId,
      companyId,
      deletedAt: null,
      status: {
        in: [PurchaseReturnStatus.APPROVED, PurchaseReturnStatus.COMPLETED],
      },
      isCancelled: false,
      returnDate: this.dateRange(dateFrom, dateTo),
      ...(currency ? { currency } : {}),
    };
    return this.prismaService.purchaseReturn.findMany({
      where,
      select: {
        id: true,
        returnNumber: true,
        returnDate: true,
        grandTotal: true,
        currency: true,
        status: true,
      },
    });
  }

  /**
   * Batch-fetch active (deletedAt IS NULL) allocations for a set of payments.
   * This avoids N+1 — one query for all payments in the statement period.
   */
  async findActiveAllocationsForPayments(
    paymentIds: string[],
    supplierId: string,
    companyId: string,
  ): Promise<StatementAllocationRow[]> {
    if (paymentIds.length === 0) return [];
    return this.prismaService.supplierPaymentAllocation.findMany({
      where: {
        paymentId: { in: paymentIds },
        supplierId,
        companyId,
        deletedAt: null,
      },
      select: { paymentId: true, purchaseInvoiceId: true, amount: true },
    });
  }

  /**
   * Sum of qualifying movements strictly BEFORE a statement start date,
   * scoped to a single currency. Used to compute the opening balance for a
   * date-bounded statement.
   */
  async getOpeningBalance(
    supplierId: string,
    companyId: string,
    beforeDate: Date,
    currency?: Currency,
  ): Promise<OpeningBalanceRow> {
    const invoiceAgg = await this.prismaService.purchaseInvoice.aggregate({
      where: {
        supplierId,
        companyId,
        deletedAt: null,
        status: {
          in: [PurchaseInvoiceStatus.APPROVED, PurchaseInvoiceStatus.PAID],
        },
        invoiceDate: { lt: beforeDate },
        ...(currency ? { currency } : {}),
      },
      _sum: { grandTotal: true },
    });
    const paymentAgg = await this.prismaService.supplierPayment.aggregate({
      where: {
        supplierId,
        companyId,
        deletedAt: null,
        paymentDate: { lt: beforeDate },
        ...(currency ? { currency } : {}),
      },
      _sum: { amount: true },
    });
    const returnAgg = await this.prismaService.purchaseReturn.aggregate({
      where: {
        supplierId,
        companyId,
        deletedAt: null,
        status: {
          in: [PurchaseReturnStatus.APPROVED, PurchaseReturnStatus.COMPLETED],
        },
        isCancelled: false,
        returnDate: { lt: beforeDate },
        ...(currency ? { currency } : {}),
      },
      _sum: { grandTotal: true },
    });
    return {
      invoices: invoiceAgg._sum.grandTotal ?? new Decimal(0),
      payments: paymentAgg._sum.amount ?? new Decimal(0),
      returns: returnAgg._sum.grandTotal ?? new Decimal(0),
    };
  }
}
