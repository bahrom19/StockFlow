import { BadRequestException, Injectable } from '@nestjs/common';
import { Currency, PaymentMethod, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

/** Monetary scale — matches Decimal(18,4) columns. */
const MONEY_SCALE = 4;

/** One remainder distribution step — one unit at Decimal(18,4) scale. */
const REMAINDER_STEP = new Decimal('0.0001');

/**
 * Locked fixed remainder-distribution order (G11-E5 §6). Deliberately NOT the
 * Prisma enum order (which lists GIFT_CARD before STORE_CREDIT) — the design
 * pins CASH first and STORE_CREDIT before GIFT_CARD, so the order is spelled
 * out explicitly instead of being derived from the enum.
 */
const REMAINDER_DISTRIBUTION_ORDER: PaymentMethod[] = [
  PaymentMethod.CASH,
  PaymentMethod.CARD,
  PaymentMethod.QR,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.MOBILE_WALLET,
  PaymentMethod.STORE_CREDIT,
  PaymentMethod.GIFT_CARD,
];

const ZERO = new Decimal(0);

/** G11-F2 — payment methods backed by spendable customer credit. Shared by
 * the allocation service and the refund-service ledger issuance. */
export const CREDIT_PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.STORE_CREDIT,
  PaymentMethod.GIFT_CARD,
];

export function isCreditMethod(method: PaymentMethod): boolean {
  return CREDIT_PAYMENT_METHODS.includes(method);
}

function toDecimal(
  value: string | number | Decimal | null | undefined,
): Decimal {
  if (value == null) return ZERO;
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

/** One computed per-method refund allocation fact (never persisted with amount <= 0). */
export interface RefundAllocationFact {
  method: PaymentMethod;
  amount: Decimal;
}

/**
 * The Sale facts the allocation needs. Structural (not the full Prisma Sale)
 * so callers may pass the loaded aggregate directly and tests need no full-row
 * fixture; the caller is responsible for having tenant-validated the Sale.
 */
export interface RefundAllocationSaleContext {
  id: string;
  saleNumber: string;
  companyId: string;
  total: Decimal | string;
  changeAmount: Decimal | string | null;
  currency: Currency;
}

export interface CreateRefundAllocationsParams {
  /** The (already tenant-validated) Sale being partially refunded. */
  sale: RefundAllocationSaleContext;
  /** The SalesRefund the allocation belongs to (rows are insert-only facts). */
  salesRefundId: string;
  /** Server-computed total of THIS refund (never cumulative). */
  refundTotal: Decimal;
  /** Acting user — persisted on every allocation row. */
  userId: string;
}

/**
 * G11-E5 — Refund Payment Allocation (bucket-level v1).
 *
 * Deterministically splits a SalesRefund.total across the original Sale's
 * payment methods so the GL can credit the same accounts the original sale
 * debited (CASH → 1010, CARD/QR/BANK_TRANSFER/MOBILE_WALLET → 1020,
 * STORE_CREDIT/GIFT_CARD → 1200) instead of the E4 interim
 * "everything to Cash" default.
 *
 * Locked design properties:
 * - Granularity is PaymentMethod-level (bucket). Multiple Payment rows of the
 *   same method are aggregated; paymentId is deliberately absent in v1.
 * - Pure Decimal arithmetic; no floating point anywhere.
 * - Proportional first pass with ROUND_DOWN, then a capacity-guarded,
 *   fixed-order remainder distribution in 0.0001 steps; remainder must reach
 *   exactly zero or the operation FAILS FAST (no silent normalization).
 * - Σ(allocations) == refund.total is asserted before persistence.
 * - Cumulative cap per method: previous refunds' allocations + this refund's
 *   allocation <= effective method bucket (fail fast on violation).
 * - Rows are insert-only historical facts created inside the caller's refund
 *   transaction (no transaction of its own → atomic with the refund). There
 *   is deliberately no rowVersion: rows are never updated.
 * - Tenant safety: every query is company-scoped; Payment ownership is
 *   derived from the already-validated Sale (Payment has no companyId by
 *   design — G11-E5 does not change the Payment model).
 */
@Injectable()
export class RefundPaymentAllocationService {
  /**
   * Compute, validate and persist the allocation rows for one refund. Must be
   * called inside the SalesRefund transaction, after the SalesRefund row is
   * created and before the Sale CAS update, so a rollback removes everything.
   */
  async createForRefund(
    tx: Prisma.TransactionClient,
    params: CreateRefundAllocationsParams,
  ): Promise<RefundAllocationFact[]> {
    const { sale, salesRefundId, refundTotal, userId } = params;

    // 0. The refund total itself must be a positive monetary fact (§8) — the
    // refund service never produces non-positive totals, so a violation here
    // means corrupted upstream facts: FAIL FAST, never persist allocations.
    if (refundTotal.lte(0)) {
      throw new BadRequestException(
        `Refund total must be positive for sale ${sale.saleNumber} (got ${refundTotal.toString()}); refusing to allocate.`,
      );
    }

    // 1. Immutable Payment rows of the original Sale (tenant-safe via Sale —
    // the caller loaded the Sale with companyId, so saleId is already scoped).
    const payments = await tx.payment.findMany({
      where: { saleId: sale.id },
    });

    // 2. Effective per-method buckets. G11-D semantics: change is always paid
    // out of the cash drawer, so the CASH bucket is clamped:
    // cashEffective = max(0, cashRaw - changeAmount). All other methods keep
    // their full received amounts.
    const effective = this.computeEffectiveBuckets(
      payments,
      toDecimal(sale.changeAmount),
    );

    // 3. Invariant: Σ effective buckets == Sale.total (Decimal). A violation
    // means the sale's payment facts are inconsistent (e.g. change drawn from
    // the drawer float) — FAIL FAST, never silently normalize.
    const saleTotal = toDecimal(sale.total);
    if (saleTotal.lte(0)) {
      throw new BadRequestException(
        `Sale ${sale.saleNumber} has a non-positive total ${saleTotal.toString()}; cannot compute a payment allocation.`,
      );
    }
    const effectiveTotal = [...effective.values()].reduce(
      (acc, amount) => acc.add(amount),
      ZERO,
    );
    if (!effectiveTotal.equals(saleTotal)) {
      throw new BadRequestException(
        `Payment buckets of sale ${sale.saleNumber} do not reconcile: effective total ${effectiveTotal.toString()} != sale total ${saleTotal.toString()}. Refund payment allocation refused.`,
      );
    }

    // 4. Cumulative allocations of the sale's PREVIOUS refunds per method
    // (insert-only facts; never mutated). Defensive cap check: historical
    // facts must already be within capacity.
    const saleRefunds = await tx.salesRefund.findMany({
      where: { saleId: sale.id, companyId: sale.companyId },
      select: { id: true },
    });
    const previous = new Map<PaymentMethod, Decimal>();
    if (saleRefunds.length > 0) {
      const previousRows = await tx.refundPaymentAllocation.findMany({
        where: {
          companyId: sale.companyId,
          salesRefundId: { in: saleRefunds.map((r) => r.id) },
          deletedAt: null,
        },
      });
      for (const row of previousRows) {
        previous.set(
          row.method,
          (previous.get(row.method) ?? ZERO).add(toDecimal(row.amount)),
        );
      }
    }
    for (const [method, allocated] of previous) {
      const capacity = effective.get(method) ?? ZERO;
      if (allocated.gt(capacity)) {
        throw new BadRequestException(
          `Cumulative refund allocation for ${method} (${allocated.toString()}) exceeds the effective payment bucket (${capacity.toString()}) of sale ${sale.saleNumber}.`,
        );
      }
    }

    // 5. Proportional first pass — ROUND DOWN to 4 decimals. Pure Decimal.
    const allocations = new Map<PaymentMethod, Decimal>();
    for (const [method, bucket] of effective) {
      const share = refundTotal
        .mul(bucket)
        .div(saleTotal)
        .toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_DOWN);
      if (share.gt(0)) allocations.set(method, share);
    }

    // 6. Remainder distribution — fixed order, 0.0001 steps, never exceeding a
    // bucket's remaining capacity. Cycles until the remainder is exactly zero;
    // a full cycle without progress FAILS FAST (boundary-overflow guard).
    let remainder = refundTotal.sub(
      [...allocations.values()].reduce((acc, amount) => acc.add(amount), ZERO),
    );
    if (remainder.lt(0)) {
      throw new BadRequestException(
        `First-pass refund allocation for sale ${sale.saleNumber} exceeds the refund total — refusing to allocate.`,
      );
    }
    while (remainder.gt(0)) {
      let distributedThisCycle = ZERO;
      for (const method of REMAINDER_DISTRIBUTION_ORDER) {
        if (remainder.lt(REMAINDER_STEP)) break;
        const current = allocations.get(method) ?? ZERO;
        const capacity = (effective.get(method) ?? ZERO)
          .sub(previous.get(method) ?? ZERO)
          .sub(current);
        if (capacity.gte(REMAINDER_STEP)) {
          allocations.set(method, current.add(REMAINDER_STEP));
          remainder = remainder.sub(REMAINDER_STEP);
          distributedThisCycle = distributedThisCycle.add(REMAINDER_STEP);
        }
      }
      if (distributedThisCycle.equals(0)) {
        throw new BadRequestException(
          `Cannot distribute the refund allocation remainder (${remainder.toString()}) for sale ${sale.saleNumber}: every payment bucket is at capacity.`,
        );
      }
    }

    // 7. Facts → validation → rows. Zero amounts are omitted (never persisted);
    // anything invalid FAILS FAST before a single row is written.
    const facts: RefundAllocationFact[] = [...allocations.entries()]
      .filter(([, amount]) => amount.gt(0))
      .map(([method, amount]) => ({ method, amount }));

    const allocatedTotal = facts.reduce(
      (acc, fact) => acc.add(fact.amount),
      ZERO,
    );
    if (!allocatedTotal.equals(refundTotal)) {
      throw new BadRequestException(
        `Refund allocation does not conserve the refund total: allocated ${allocatedTotal.toString()} != refund total ${refundTotal.toString()} (sale ${sale.saleNumber}).`,
      );
    }
    for (const fact of facts) {
      if (fact.amount.lte(0)) {
        throw new BadRequestException(
          `Refund allocation for ${fact.method} must be positive (got ${fact.amount.toString()}).`,
        );
      }
      const capacity = effective.get(fact.method) ?? ZERO;
      const cumulative = (previous.get(fact.method) ?? ZERO).add(fact.amount);
      if (cumulative.gt(capacity)) {
        throw new BadRequestException(
          `Refund allocation for ${fact.method} (${cumulative.toString()} cumulative) would exceed the effective payment bucket (${capacity.toString()}) of sale ${sale.saleNumber}.`,
        );
      }
    }

    // 8. Persist insert-only rows inside the caller's transaction — atomic
    // with the SalesRefund (rollback removes both). Currency is the Sale
    // currency (== SalesRefund.currency by construction; no FX in G11-E).
    if (facts.length > 0) {
      await tx.refundPaymentAllocation.createMany({
        data: facts.map((fact) => ({
          companyId: sale.companyId,
          salesRefundId,
          method: fact.method,
          amount: fact.amount,
          currency: sale.currency,
          createdBy: userId,
        })),
      });
    }

    return facts;
  }

  /**
   * Aggregate the Sale's immutable Payment rows into per-method effective
   * buckets, clamping CASH by the dispensed change (G11-D semantics: change is
   * always paid from the cash drawer, so it can never be refunded as cash
   * beyond what the drawer actually took in).
   */
  private computeEffectiveBuckets(
    payments: Array<{ method: PaymentMethod; amount: Decimal }>,
    changeAmount: Decimal,
  ): Map<PaymentMethod, Decimal> {
    const effective = new Map<PaymentMethod, Decimal>();
    for (const payment of payments) {
      effective.set(
        payment.method,
        (effective.get(payment.method) ?? ZERO).add(toDecimal(payment.amount)),
      );
    }
    const cashRaw = effective.get(PaymentMethod.CASH);
    if (cashRaw !== undefined) {
      effective.set(PaymentMethod.CASH, Decimal.max(ZERO, cashRaw.sub(changeAmount)));
    }
    return effective;
  }
}
