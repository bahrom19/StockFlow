import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CustomerCreditTransactionDirection,
  CustomerCreditTransaction as PrismaCustomerCreditTransaction,
  Currency,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

export type PrismaTx = Prisma.TransactionClient;

/** Facts a caller must supply for a spend. Structural (not a full Prisma
 * Sale) so tests need no full-row fixture; the caller is responsible for
 * having tenant-validated the sale and its currency. */
export interface CreditSpendFacts {
  saleId: string;
  customerId: string;
  currency: Currency;
  amount: Prisma.Decimal;
  createdBy: string;
}

export interface RefundIssuanceFacts {
  allocationId: string;
  refundId: string;
  customerId: string;
  currency: Currency;
  amount: Prisma.Decimal;
  createdBy: string;
}

export interface ManualAdjustmentFacts {
  customerId: string;
  currency: Currency;
  amount: Prisma.Decimal;
  direction: 'ISSUED' | 'ADJUSTED';
  reason: string;
  createdBy: string;
}

export interface CreditBalanceTotals {
  balance: Prisma.Decimal;
  issuedTotal: Prisma.Decimal;
  spentTotal: Prisma.Decimal;
  adjustedTotal: Prisma.Decimal;
}

/**
 * G11-F2 — persistence for the customer credit ledger (insert-only facts).
 *
 * The repository owns ALL raw Prisma access: creation of ledger facts,
 * balance aggregation, history and the atomic never-negative spend
 * (`INSERT … SELECT … WHERE balance >= amount`). Every query is
 * company-scoped; spend/issuance/adjustment run inside the CALLER's
 * transaction (a tx client is always passed) — the transaction belongs to
 * the domain operation (sale completion / refund / adjustment), never to
 * the ledger.
 */
@Injectable()
export class CustomerCreditLedgerRepository {
  constructor(private readonly prismaService: PrismaService) {}

  /** Payment methods that consume the customer credit ledger. */
  static readonly CREDIT_METHODS: PaymentMethod[] = [
    PaymentMethod.STORE_CREDIT,
    PaymentMethod.GIFT_CARD,
  ];

  /** Signed amount of a ledger row: ISSUED +, SPENT −, ADJUSTED −. */
  private static signed(
    direction: 'ISSUED' | 'SPENT' | 'ADJUSTED',
    amount: Prisma.Decimal,
  ): Prisma.Decimal {
    if (direction === 'SPENT') {
      return amount.neg();
    }
    if (direction === 'ADJUSTED') {
      return amount.neg();
    }
    return amount; // ISSUED
  }

  /**
   * Atomic never-negative spend (G11-F2 §8, remediation F2-3).
   *
   * Delegates to {@link insertWithBalanceGuard}: a transaction-scoped
   * `pg_advisory_xact_lock(hashtext(companyId:customerId:currency))`
   * serializes concurrent spend/negative-adjustment callers for the exact
   * customer+currency, then the single-statement
   * `INSERT … SELECT … WHERE current_balance >= amount` decides from the
   * committed ledger. Under READ COMMITTED the second concurrent caller
   * blocks on the advisory lock and re-evaluates the predicate only AFTER
   * the first transaction commits — the READ COMMITTED read-predicate race
   * found in the audit cannot occur.
   *
   * @returns the created SPENT row, or null when the balance was
   *          insufficient (caller decides the failure semantics).
   */
  async atomicSpend(
    tx: PrismaTx,
    companyId: string,
    facts: CreditSpendFacts,
  ): Promise<PrismaCustomerCreditTransaction | null> {
    return CustomerCreditLedgerRepository.insertWithBalanceGuard<PrismaCustomerCreditTransaction>(
      tx,
      companyId,
      facts.customerId,
      facts.currency,
      'SPENT',
      facts.amount.toFixed(4),
      'SALE_PAYMENT',
      facts.saleId,
      facts.createdBy,
      null,
    );
  }

  /** Shared guard for the never-negative balance invariant (remediation
   * F2-2/F2-3, R2-1 P1 fix). TWO separate awaited statements on the SAME
   * transaction-bound client (`tx`), never a single multi-statement
   * `$queryRaw` — a parameterized multi-statement string cannot execute
   * over PostgreSQL's extended protocol (`cannot insert multiple commands
   * into a prepared statement`), and a single-statement CTE variant would
   * take its READ COMMITTED snapshot BEFORE the lock wait, so the balance
   * predicate could read a stale ledger. Here:
   *
   *  Statement 1  `SELECT pg_advisory_xact_lock(hashtext(key))`
   *    → exclusive, transaction-scoped lock over the deterministic
   *    (companyId, customerId, currency) key; blocks until every concurrent
   *    balance mutation for the same key commits/rolls back.
   *  Statement 2  `INSERT … SELECT … WHERE balance >= amount RETURNING *`
   *    → starts only AFTER statement 1 returns, so under READ COMMITTED it
   *    takes a FRESH per-statement snapshot that includes the committed
   *    mutations of the transactions the lock waited on; the predicate
   *    therefore decides from the up-to-date ledger. Zero rows → null.
   *
   * `pg_advisory_xact_lock` is held until COMMIT/ROLLBACK of the caller's
   * transaction and released automatically (including on error paths) —
   * no second connection, no nested transaction, no commit in between. */
  private static async insertWithBalanceGuard<T>(
    tx: PrismaTx,
    companyId: string,
    customerId: string,
    currency: Currency,
    direction: 'SPENT' | 'ADJUSTED',
    amount: string,
    referenceType: 'SALE_PAYMENT' | 'MANUAL_ADJUSTMENT',
    referenceId: string,
    createdBy: string,
    reason: string | null,
    /** Pre-generated row id — lets a MANUAL_ADJUSTMENT row self-reference
     * (referenceId = own id) in the guarded INSERT itself. null → DB generates. */
    explicitId: string | null = null,
  ): Promise<T | null> {
    // Statement 1 — serialization point: exclusive transaction-scoped
    // advisory lock on the deterministic (companyId, customerId, currency)
    // key. Awaits until concurrent mutators of the same key finish; the
    // lock itself is released only at the caller's COMMIT/ROLLBACK.
    await tx.$queryRaw<unknown[]>`
      SELECT pg_advisory_xact_lock(hashtext(
        ${companyId} || ':' || ${customerId} || ':' || ${currency}
      )) AS acquired;
    `;

    // Statement 2 — guarded insert on a FRESH READ COMMITTED snapshot
    // (taken now, after the lock wait), so the balance predicate sees every
    // mutation committed by the transactions this statement waited for.
    const rows: T[] = await tx.$queryRaw<T[]>`
      INSERT INTO "CustomerCreditTransaction"
        ("id", "companyId", "customerId", "direction", "amount", "currency",
         "referenceType", "referenceId", "createdBy", "reason",
         "createdAt", "updatedAt")
      SELECT
        COALESCE(${explicitId}, gen_random_uuid()::text)::uuid,
        ${companyId}::uuid,
        ${customerId}::uuid,
        ${direction}::"CustomerCreditTransactionDirection",
        ${amount}::decimal(18,4),
        ${currency}::"Currency",
        ${referenceType},
        ${referenceId}::uuid,
        ${createdBy}::uuid,
        ${reason},
        NOW(),
        NOW()
      WHERE (
        SELECT COALESCE(SUM(
          CASE
            WHEN t."direction" = 'ISSUED'  THEN t."amount"
            ELSE -t."amount"
          END), 0)
        FROM "CustomerCreditTransaction" t
        WHERE t."companyId"  = ${companyId}::uuid
          AND t."customerId" = ${customerId}::uuid
          AND t."currency"   = ${currency}::"Currency"
          AND t."deletedAt"  IS NULL
      ) >= ${amount}::decimal(18,4)
      RETURNING *;
    `;
    return rows[0] ?? null;
  }

  /** One ledger row per eligible refund allocation (never aggregated). */
  async issueRefundCredit(
    tx: PrismaTx,
    companyId: string,
    facts: RefundIssuanceFacts,
  ): Promise<PrismaCustomerCreditTransaction> {
    return tx.customerCreditTransaction.create({
      data: {
        companyId,
        customerId: facts.customerId,
        direction: CustomerCreditTransactionDirection.ISSUED,
        amount: facts.amount,
        currency: facts.currency,
        referenceType: 'REFUND_ALLOCATION',
        referenceId: facts.allocationId,
        createdBy: facts.createdBy,
      },
    });
  }

  /** Manual adjustment (remediation F2-2). A negative adjustment (ADJUSTED
   * write-off) must never overdraw the balance, even when two adjustments
   * race — so ADJUSTED inserts run through the SAME guard as spend: the
   * transaction-scoped advisory lock serializes them and the
   * `INSERT … SELECT … WHERE balance >= amount` predicate decides from the
   * committed ledger. Returns the created row, or **null** when the balance
   * was insufficient (the caller maps null to the failure semantics —
   * same contract as {@link atomicSpend}).
   *
   * A positive adjustment (ISSUED top-up) only ever increases the balance
   * and cannot race to a negative result, so it is a plain insert that
   * always returns a row.
   *
   * `referenceId` is the row's own id: the UUID is generated
   * application-side so the row can self-reference in ONE guarded INSERT
   * while staying unique under the @@unique idempotency guard. */
  async createManualAdjustment(
    tx: PrismaTx,
    companyId: string,
    facts: ManualAdjustmentFacts,
  ): Promise<PrismaCustomerCreditTransaction | null> {
    const amount = facts.amount.toFixed(4);

    if (facts.direction === CustomerCreditTransactionDirection.ADJUSTED) {
      // Self-reference in ONE guarded INSERT: the id is generated
      // application-side and used both as the row id and its referenceId.
      const id = randomUUID();
      return CustomerCreditLedgerRepository.insertWithBalanceGuard<PrismaCustomerCreditTransaction>(
        tx,
        companyId,
        facts.customerId,
        facts.currency,
        'ADJUSTED',
        amount,
        'MANUAL_ADJUSTMENT',
        id,
        facts.createdBy,
        facts.reason,
        id,
      );
    }

    const id = randomUUID();
    return tx.customerCreditTransaction.create({
      data: {
        companyId,
        customerId: facts.customerId,
        direction: CustomerCreditTransactionDirection.ISSUED,
        amount,
        currency: facts.currency,
        referenceType: 'MANUAL_ADJUSTMENT',
        referenceId: id,
        createdBy: facts.createdBy,
        reason: facts.reason,
      },
    });
  }

  /** Aggregated balance + totals per currency. When `currency` is omitted
   * every currency with any ledger activity is returned. */
  async getBalances(
    companyId: string,
    customerId: string,
    currency?: Currency,
  ): Promise<Map<string, CreditBalanceTotals>> {
    const where: Prisma.CustomerCreditTransactionWhereInput = {
      companyId,
      customerId,
      deletedAt: null,
      ...(currency ? { currency } : {}),
    };
    const rows = await this.prismaService.customerCreditTransaction.groupBy({
      by: ['currency', 'direction'],
      where,
      _sum: { amount: true },
    });

    const result = new Map<string, CreditBalanceTotals>();
    const ensure = (cur: string): CreditBalanceTotals => {
      let entry = result.get(cur);
      if (!entry) {
        entry = {
          balance: new Prisma.Decimal(0),
          issuedTotal: new Prisma.Decimal(0),
          spentTotal: new Prisma.Decimal(0),
          adjustedTotal: new Prisma.Decimal(0),
        };
        result.set(cur, entry);
      }
      return entry;
    };

    for (const row of rows) {
      const totals = ensure(row.currency);
      const sum = row._sum.amount ?? new Prisma.Decimal(0);
      if (row.direction === CustomerCreditTransactionDirection.ISSUED) {
        totals.issuedTotal = totals.issuedTotal.add(sum);
        totals.balance = totals.balance.add(sum);
      } else if (row.direction === CustomerCreditTransactionDirection.SPENT) {
        totals.spentTotal = totals.spentTotal.add(sum);
        totals.balance = totals.balance.sub(sum);
      } else {
        totals.adjustedTotal = totals.adjustedTotal.add(sum);
        totals.balance = totals.balance.sub(sum);
      }
    }
    return result;
  }

  /** Paginated transaction history. */
  async getTransactions(
    companyId: string,
    customerId: string,
    params: {
      page: number;
      limit: number;
      direction?: CustomerCreditTransactionDirection;
      currency?: Currency;
      from?: Date;
      to?: Date;
    },
  ): Promise<{
    items: PrismaCustomerCreditTransaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const where: Prisma.CustomerCreditTransactionWhereInput = {
      companyId,
      customerId,
      deletedAt: null,
      ...(params.direction ? { direction: params.direction } : {}),
      ...(params.currency ? { currency: params.currency } : {}),
      ...(params.from || params.to
        ? {
            createdAt: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.customerCreditTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prismaService.customerCreditTransaction.count({ where }),
    ]);
    return { items, total, page: params.page, limit: params.limit };
  }

  /** Tenant-safe customer ownership check (CRM convention: 404, not 403). */
  async findCustomerCompany(
    tx: PrismaTx | PrismaService,
    customerId: string,
    companyId: string,
  ): Promise<{ id: string } | null> {
    const client = tx as Pick<PrismaService, 'customer'>;
    return client.customer.findFirst({
      where: { id: customerId, companyId },
      select: { id: true },
    });
  }
}
