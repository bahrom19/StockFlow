import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Currency,
  CustomerCreditTransactionDirection,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import {
  CustomerCreditLedgerRepository,
  PrismaTx,
} from '../repositories/customer-credit-ledger.repository';
import {
  CustomerCreditBalanceEntity,
  CustomerCreditTransactionEntity,
} from '../entities/customer-credit-transaction.entity';
import { CustomerCreditTransactionMapper } from '../mappers/customer-credit-transaction.mapper';

/** Structural payment fact (Prisma Payment row or event payload entry). */
export interface CreditPaymentLike {
  method: string;
  amount: Decimal | string;
}

/**
 * G11-F2 — customer credit ledger domain service.
 *
 * The ledger is a pure subledger over insert-only fact rows; GL account 1200
 * stays the accounting control account and is NEVER written from here.
 * Authoritative balance = Σ(ISSUED) − Σ(SPENT) − Σ(ADJUSTED) per
 * (customer, currency). No FX: a credit balance is spendable only against a
 * sale of the SAME currency.
 *
 * Domain operations (`spend`, `issueRefundCredit`) are transaction-bound to
 * the caller: they take the caller's Prisma transaction client and never
 * open their own transaction, so a sale-completion or refund rollback
 * removes any ledger rows written inside it (atomicity, no orphans).
 */
@Injectable()
export class CustomerCreditLedgerService {
  constructor(
    private readonly repository: CustomerCreditLedgerRepository,
    private readonly auditLog: AuditLogService,
    private readonly prismaService: PrismaService,
  ) {}

  /** Aggregated, never-negative spend inside the CALLER's transaction.
   *
   * Enforces (in order):
   * 1. the sale has a customer (a credit payment without a customer is a
   *    contract violation — fail fast);
   * 2. the sale currency balance covers the aggregated credit amount — the
   *    final guard is the repository's single-statement INSERT…SELECT…
   *    WHERE balance >= amount, so two concurrent completions cannot both
   *    succeed past the remaining balance;
   * 3. exactly ONE aggregated SPENT row per sale (multiple payments of the
   *    same/both credit methods are summed; CASH/CARD/etc. never touch the
   *    ledger).
   *
   * @returns the created SPENT row, or null when no credit payment exists.
   * @throws BadRequestException on insufficient balance (→ whole sale tx
   *         rolls back; zero orphan rows).
   */
  async spend(
    tx: PrismaTx,
    facts: {
      companyId: string;
      saleId: string;
      customerId: string | null;
      currency: Currency;
      payments: CreditPaymentLike[];
      createdBy: string;
    },
  ): Promise<CustomerCreditTransactionEntity | null> {
    const creditAmount = facts.payments
      .filter((p) =>
        (CustomerCreditLedgerRepository.CREDIT_METHODS as string[]).includes(
          p.method,
        ),
      )
      .reduce<Decimal>(
        (acc, p) => acc.add(new Decimal(p.amount.toString())),
        new Decimal(0),
      );
    if (creditAmount.isZero()) return null;

    if (!facts.customerId) {
      throw new BadRequestException(
        `Sale ${facts.saleId} uses customer credit payment methods (STORE_CREDIT/GIFT_CARD) but has no customer`,
      );
    }

    const created = await this.repository.atomicSpend(tx, facts.companyId, {
      saleId: facts.saleId,
      customerId: facts.customerId,
      currency: facts.currency,
      amount: creditAmount,
      createdBy: facts.createdBy,
    });
    if (!created) {
      throw new BadRequestException(
        `Insufficient customer credit balance (${facts.currency}) for sale ${facts.saleId}`,
      );
    }
    return CustomerCreditTransactionMapper.toEntity(created);
  }

  /** Refund-credit issuance inside the CALLER's transaction: one ISSUED row
   * per eligible RefundPaymentAllocation (STORE_CREDIT / GIFT_CARD), never
   * aggregated, amounts exactly equal to the allocation rows (G11-F2 §11).
   * The customer is mandatory — a credit refund without a customer is a
   * contract violation and fails the whole refund transaction. */
  async issueRefundCredit(
    tx: PrismaTx,
    facts: {
      companyId: string;
      customerId: string | null;
      currency: Currency;
      allocations: Array<{ id: string; method: PaymentMethod; amount: Decimal }>;
      createdBy: string;
    },
  ): Promise<CustomerCreditTransactionEntity[]> {
    const eligible = facts.allocations.filter((a) =>
      (CustomerCreditLedgerRepository.CREDIT_METHODS as string[]).includes(
        a.method,
      ),
    );
    if (eligible.length === 0) return [];

    if (!facts.customerId) {
      throw new BadRequestException(
        'Refund contains STORE_CREDIT/GIFT_CARD allocation but the sale has no customer',
      );
    }

    const created: CustomerCreditTransactionEntity[] = [];
    for (const allocation of eligible) {
      const row = await this.repository.issueRefundCredit(tx, facts.companyId, {
        allocationId: allocation.id,
        refundId: allocation.id, // unique-guard context; the row is 1:1 with the allocation
        customerId: facts.customerId,
        currency: facts.currency,
        amount: allocation.amount,
        createdBy: facts.createdBy,
      });
      created.push(CustomerCreditTransactionMapper.toEntity(row));
    }
    return created;
  }

  /** Manual adjustment (ledger-only in F2). Positive amount → ISSUED
   * top-up; negative amount → ADJUSTED write-off. The never-negative
   * invariant for write-offs is enforced by the repository's DB-level guard
   * (transaction-scoped advisory lock + INSERT…SELECT…WHERE balance >=
   * amount) — the same authoritative mechanism as spend — so concurrent
   * write-offs cannot overdraw (remediation F2-2). Audited within the same
   * transaction. */
  async adjust(
    dto: { amount: string; currency: string; reason: string },
    customerId: string,
    companyId: string,
    userId: string,
  ): Promise<CustomerCreditTransactionEntity> {
    const amount = new Decimal(dto.amount);
    if (amount.isZero()) {
      throw new BadRequestException('Adjustment amount must not be zero');
    }
    if (!amount.isFinite() || amount.isNegative()) {
      if (amount.isNegative()) {
        // negative → ADJUSTED write-off; amount stored positive
      } else {
        throw new BadRequestException('Adjustment amount must be a finite number');
      }
    }
    const currency = dto.currency as Currency;
    const isWriteOff = amount.isNegative();
    const absoluteAmount = amount.abs();

    return this.prismaService.$transaction(async (tx) => {
      const customer = await this.repository.findCustomerCompany(
        tx,
        customerId,
        companyId,
      );
      if (!customer) {
        // Tenant-safe: a foreign customer is indistinguishable from a
        // non-existent one (CRM convention: 404).
        throw new NotFoundException(`Customer ${customerId} not found`);
      }

      // No application-level balance pre-check here: the repository's
      // DB-level guard (advisory lock + INSERT…SELECT…WHERE balance >=
      // amount) is the single authoritative enforcement point — a
      // read-then-check before it would be both redundant and racy.
      const row = await this.repository.createManualAdjustment(tx, companyId, {
        customerId,
        currency,
        amount: absoluteAmount,
        direction: isWriteOff
          ? CustomerCreditTransactionDirection.ADJUSTED
          : CustomerCreditTransactionDirection.ISSUED,
        reason: dto.reason,
        createdBy: userId,
      });
      if (!row) {
        throw new BadRequestException(
          `Insufficient credit balance (${currency}) for adjustment: requested ${absoluteAmount.toFixed(4)}`,
        );
      }

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'CustomerCreditTransaction',
          entityId: row.id,
          action: isWriteOff ? 'ADJUSTED' : 'ISSUED',
          before: null,
          after: {
            customerId,
            amount: absoluteAmount.toString(),
            currency,
            reason: dto.reason,
          },
        },
        tx,
      );

      return CustomerCreditTransactionMapper.toEntity(row);
    });
  }

  /** Balances (all currencies, or one). Balances can never be negative for
   * a healthy ledger; a negative value would surface a data anomaly and is
   * returned as-is rather than silently clamped. */
  async getBalances(
    customerId: string,
    companyId: string,
    currency?: string,
  ): Promise<CustomerCreditBalanceEntity[]> {
    await this.assertCustomer(customerId, companyId);
    const map = await this.repository.getBalances(
      companyId,
      customerId,
      currency as Currency | undefined,
    );
    if (map.size === 0) {
      // Zero-activity customer: a single zero balance for the requested
      // currency (or KZT default) keeps the API contract simple.
      const cur = currency ?? Currency.KZT;
      return [this.zeroBalance(customerId, cur)];
    }
    return [...map.entries()].map(([cur, totals]) =>
      this.toBalanceEntity(customerId, cur, totals),
    );
  }

  /** Paginated transaction history. */
  async getTransactions(
    customerId: string,
    companyId: string,
    query: {
      page?: number;
      limit?: number;
      direction?: 'ISSUED' | 'SPENT' | 'ADJUSTED';
      currency?: string;
      from?: string;
      to?: string;
    },
  ): Promise<{
    items: CustomerCreditTransactionEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.assertCustomer(customerId, companyId);
    const result = await this.repository.getTransactions(
      companyId,
      customerId,
      {
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        direction: query.direction as
          | CustomerCreditTransactionDirection
          | undefined,
        currency: query.currency as Currency | undefined,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
      },
    );
    return {
      items: CustomerCreditTransactionMapper.toEntityList(result.items),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  private async assertCustomer(
    customerId: string,
    companyId: string,
  ): Promise<void> {
    const customer = await this.repository.findCustomerCompany(
      this.prismaService,
      customerId,
      companyId,
    );
    if (!customer) {
      // Tenant-safe: foreign customer == non-existent (CRM convention).
      throw new NotFoundException(`Customer ${customerId} not found`);
    }
  }

  private zeroBalance(
    customerId: string,
    currency: string,
  ): CustomerCreditBalanceEntity {
    return {
      customerId,
      currency,
      balance: '0.0000',
      issuedTotal: '0.0000',
      spentTotal: '0.0000',
      adjustedTotal: '0.0000',
    };
  }

  private toBalanceEntity(
    customerId: string,
    currency: string,
    totals: {
      balance: Decimal;
      issuedTotal: Decimal;
      spentTotal: Decimal;
      adjustedTotal: Decimal;
    },
  ): CustomerCreditBalanceEntity {
    return {
      customerId,
      currency,
      balance: totals.balance.toFixed(4),
      issuedTotal: totals.issuedTotal.toFixed(4),
      spentTotal: totals.spentTotal.toFixed(4),
      adjustedTotal: totals.adjustedTotal.toFixed(4),
    };
  }
}
