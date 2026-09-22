import { Injectable, NotFoundException } from '@nestjs/common';
import { Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { SupplierStatementRepository } from '../repositories/supplier-statement.repository';
import { SupplierStatementQueryDto } from '../dto/supplier-statement-query.dto';
import {
  SupplierStatementAllocationDetailEntity,
  SupplierStatementCurrencyGroupEntity,
  SupplierStatementEntity,
  SupplierStatementEntryEntity,
  SupplierStatementEntryType,
  SupplierStatementTotalsEntity,
} from '../entities/supplier-statement.entity';

interface RawEntry {
  entryType: SupplierStatementEntryType;
  date: Date;
  reference: string;
  sourceEntityId: string;
  currency: Currency;
  amount: Decimal;
  debit: Decimal;
  credit: Decimal;
  status: string;
  paymentId?: string;
  // PAYMENT only: SUM(active allocations) — the canonical AP credit basis
  // (G9-A/B1). Computed once per payment and reused for the detail block.
  allocatedCredit?: Decimal;
}

const ENTRY_TYPE_RANK: Record<SupplierStatementEntryType, number> = {
  INVOICE: 0,
  PAYMENT: 1,
  RETURN: 2,
};

/**
 * Operational Supplier AP Statement service.
 *
 * Builds a deterministic, per-currency operational AP subledger from the
 * canonical operational sources. Running balance is:
 *
 *   runningBalance = openingBalance + Σ debit − Σ credit
 *
 * where INVOICE is a debit (AP increase) and PAYMENT/RETURN are credits
 * (AP decrease). PAYMENT credit is the CANONICAL allocation-based coverage
 * (G9-A/B1): SUM(active SupplierPaymentAllocation.amount for the payment),
 * NOT the full payment amount — an unallocated payment does not reduce AP.
 * entry.amount always keeps the full SupplierPayment.amount for display.
 * The statement never reads the legacy PurchaseInvoice.paidAmount
 * cache, and never mixes currencies in a single running balance.
 */
@Injectable()
export class SupplierStatementService {
  constructor(
    private readonly suppliersRepo: SuppliersRepository,
    private readonly statementRepo: SupplierStatementRepository,
  ) {}

  async getStatement(
    supplierId: string,
    companyId: string,
    query: SupplierStatementQueryDto,
  ): Promise<SupplierStatementEntity> {
    const supplier = await this.suppliersRepo.findById(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
    const currency = query.currency;
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;

    const [invoices, payments, returns] = await Promise.all([
      this.statementRepo.findInvoices(supplierId, companyId, dateFrom, dateTo, currency),
      this.statementRepo.findPayments(supplierId, companyId, dateFrom, dateTo, currency),
      this.statementRepo.findReturns(supplierId, companyId, dateFrom, dateTo, currency),
    ]);

    const paymentIds = payments.map((p) => p.id);
    const allocations =
      paymentIds.length > 0
        ? await this.statementRepo.findActiveAllocationsForPayments(
            paymentIds,
            supplierId,
            companyId,
          )
        : [];
    const allocByPayment = new Map<string, typeof allocations>();
    for (const alloc of allocations) {
      const list = allocByPayment.get(alloc.paymentId) ?? [];
      list.push(alloc);
      allocByPayment.set(alloc.paymentId, list);
    }

    const rawEntries: RawEntry[] = [
      ...invoices.map(
        (i): RawEntry => ({
          entryType: 'INVOICE',
          date: i.invoiceDate,
          reference: i.invoiceNumber,
          sourceEntityId: i.id,
          currency: i.currency,
          amount: i.grandTotal,
          debit: i.grandTotal,
          credit: new Decimal(0),
          status: i.status,
        }),
      ),
      ...payments.map(
        (p): RawEntry => {
          // G14-03-01: canonical AP credit = SUM(active allocations).
          // allocByPayment is the existing batched fetch (no extra query).
          const paymentAllocs = allocByPayment.get(p.id) ?? [];
          const allocated = paymentAllocs.reduce(
            (sum, a) => sum.add(a.amount),
            new Decimal(0),
          );
          return {
            entryType: 'PAYMENT',
            date: p.paymentDate,
            reference: p.paymentNumber,
            sourceEntityId: p.id,
            currency: p.currency,
            amount: p.amount,
            debit: new Decimal(0),
            credit: allocated,
            status: 'ACTIVE',
            paymentId: p.id,
            allocatedCredit: allocated,
          };
        },
      ),
      ...returns.map(
        (r): RawEntry => ({
          entryType: 'RETURN',
          date: r.returnDate,
          reference: r.returnNumber,
          sourceEntityId: r.id,
          currency: r.currency,
          amount: r.grandTotal,
          debit: new Decimal(0),
          credit: r.grandTotal,
          status: r.status,
        }),
      ),
    ];

    const targetCurrencies: Currency[] = currency
      ? [currency]
      : [...new Set(rawEntries.map((e) => e.currency))];

    const groups: SupplierStatementCurrencyGroupEntity[] = [];
    for (const cur of targetCurrencies) {
      const groupEntries = rawEntries.filter((e) => e.currency === cur);
      const opening =
        dateFrom !== undefined
          ? await this.computeOpening(supplierId, companyId, dateFrom, cur)
          : new Decimal(0);

      const ordered = [...groupEntries].sort((a, b) => this.compareEntries(a, b));

      let running = opening;
      const withRunning: SupplierStatementEntryEntity[] = ordered.map((e) => {
        running = running.add(e.debit).sub(e.credit);
        const entry: SupplierStatementEntryEntity = {
          entryType: e.entryType,
          date: e.date.toISOString(),
          reference: e.reference,
          sourceEntityId: e.sourceEntityId,
          supplierId,
          currency: cur,
          debit: e.debit.toString(),
          credit: e.credit.toString(),
          amount: e.amount.toString(),
          runningBalance: running.toString(),
          status: e.status,
        };
        if (e.entryType === 'PAYMENT' && e.paymentId) {
          const paymentAllocs = allocByPayment.get(e.paymentId) ?? [];
          // Reuse the credit already computed from the same batched data.
          const allocated = e.allocatedCredit ?? new Decimal(0);
          const detail: SupplierStatementAllocationDetailEntity[] = paymentAllocs.map(
            (a) => ({
              purchaseInvoiceId: a.purchaseInvoiceId ?? '',
              allocatedAmount: a.amount.toString(),
            }),
          );
          entry.allocations = detail;
          entry.allocatedAmount = allocated.toString();
          entry.unallocatedAmount = e.amount.sub(allocated).toString();
        }
        return entry;
      });

      const totalsDebit = ordered.reduce(
        (sum, e) => sum.add(e.debit),
        new Decimal(0),
      );
      const totalsCredit = ordered.reduce(
        (sum, e) => sum.add(e.credit),
        new Decimal(0),
      );
      const closing = opening.add(totalsDebit).sub(totalsCredit);
      const totals: SupplierStatementTotalsEntity = {
        debit: totalsDebit.toString(),
        credit: totalsCredit.toString(),
        net: totalsDebit.sub(totalsCredit).toString(),
      };

      const start = (page - 1) * limit;
      const pagedEntries = withRunning.slice(start, start + limit);

      groups.push({
        currency: cur,
        openingBalance: opening.toString(),
        entries: pagedEntries,
        closingBalance: closing.toString(),
        totals,
      });
    }

    const result: SupplierStatementEntity = {
      supplierId,
      dateFrom: dateFrom ? dateFrom.toISOString() : undefined,
      dateTo: dateTo ? dateTo.toISOString() : undefined,
      currencies: groups,
    };

    // Convenience single-currency projection when a currency filter is supplied.
    if (currency && groups.length > 0) {
      const g = groups[0]!;
      result.currency = g.currency;
      result.openingBalance = g.openingBalance;
      result.entries = g.entries;
      result.closingBalance = g.closingBalance;
      result.totals = g.totals;
    }

    return result;
  }

  private async computeOpening(
    supplierId: string,
    companyId: string,
    beforeDate: Date,
    currency: Currency,
  ): Promise<Decimal> {
    const opening = await this.statementRepo.getOpeningBalance(
      supplierId,
      companyId,
      beforeDate,
      currency,
    );
    // G14-03-01: the payment leg uses the same canonical allocation-based
    // credit as in-period entries. Reuses the existing batched repo reads
    // (no new query shape, no N+1): pre-date payments, then their active
    // allocations. The service-side date filter mirrors the repo's strict
    // `< beforeDate` opening predicate exactly (the repo dateRange is
    // inclusive `lte`, so the upper bound is shifted by 1ms).
    const exclusiveUpperBound = new Date(beforeDate.getTime() - 1);
    const prePayments = await this.statementRepo.findPayments(
      supplierId,
      companyId,
      undefined,
      exclusiveUpperBound,
      currency,
    );
    const strictlyBefore = prePayments.filter((p) => p.paymentDate < beforeDate);
    const prePaymentIds = strictlyBefore.map((p) => p.id);
    const preAllocs =
      prePaymentIds.length > 0
        ? await this.statementRepo.findActiveAllocationsForPayments(
            prePaymentIds,
            supplierId,
            companyId,
          )
        : [];
    const allocatedCredit = preAllocs.reduce(
      (sum, a) => sum.add(a.amount),
      new Decimal(0),
    );
    return opening.invoices.sub(allocatedCredit).sub(opening.returns);
  }

  /**
   * Deterministic ordering: business date ASC, then entryType (INVOICE, PAYMENT,
   * RETURN), then sourceEntityId ASC. Same data always yields the same statement.
   */
  private compareEntries(a: RawEntry, b: RawEntry): number {
    const timeDiff = a.date.getTime() - b.date.getTime();
    if (timeDiff !== 0) return timeDiff;
    const typeDiff = ENTRY_TYPE_RANK[a.entryType] - ENTRY_TYPE_RANK[b.entryType];
    if (typeDiff !== 0) return typeDiff;
    return a.sourceEntityId < b.sourceEntityId
      ? -1
      : a.sourceEntityId > b.sourceEntityId
        ? 1
        : 0;
  }
}

