import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  SaleCompletedEventPayload,
  SalePartiallyRefundedEventPayload,
  SaleRefundedEventPayload,
} from '../../sales/interfaces/sale-event.interface';
import { FinancialPeriodsRepository } from '../repositories/financial-periods.repository';
import { GlEngineService, PostJournalEntryInput } from './gl-engine.service';

/**
 * Default Chart of Account codes for automatic sales accounting.
 * Companies can customise these by creating accounts with the same codes.
 */
const DEFAULT_ACCOUNT_CODES = {
  CASH: '1010', // Cash on hand
  BANK: '1020', // Bank accounts / card settlements
  ACCOUNTS_RECEIVABLE: '1200', // Accounts Receivable
  SALES_REVENUE: '4000', // Sales Revenue
  COST_OF_GOODS_SOLD: '5000', // Cost of Goods Sold
  INVENTORY: '1300', // Inventory
} as const;

@Injectable()
export class FinanceIntegrationService {
  private readonly logger = new Logger(FinanceIntegrationService.name);

  constructor(
    private readonly periodsRepository: FinancialPeriodsRepository,
    private readonly glEngine: GlEngineService,
  ) {}

  /**
   * Called when a Sale is completed.
   * Creates journal entries inside the SAME Prisma transaction.
   */
  async onSaleCompleted(
    event: SaleCompletedEventPayload,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const currentPeriod = await this.periodsRepository.findCurrent(
      event.companyId,
    );
    if (!currentPeriod) {
      throw new BadRequestException(
        `No open financial period for company ${event.companyId}. Cannot create accounting entries for sale ${event.saleNumber}.`,
      );
    }

    // Determine payment composition
    let cashAmount = new Decimal(0);
    let cardAmount = new Decimal(0);
    let creditAmount = new Decimal(0);
    let otherAmount = new Decimal(0);

    for (const payment of event.payments) {
      const amt = new Decimal(payment.amount);
      switch (payment.method) {
        case 'CASH':
          cashAmount = cashAmount.add(amt);
          break;
        case 'CARD':
        case 'QR':
        case 'BANK_TRANSFER':
        case 'MOBILE_WALLET':
          cardAmount = cardAmount.add(amt);
          break;
        case 'STORE_CREDIT':
        case 'GIFT_CARD':
          creditAmount = creditAmount.add(amt);
          break;
        default:
          otherAmount = otherAmount.add(amt);
      }
    }

    // Look up Chart of Account IDs
    const accountCodes = await tx.chartOfAccount.findMany({
      where: {
        companyId: event.companyId,
        code: { in: Object.values(DEFAULT_ACCOUNT_CODES) },
        isActive: true,
        deletedAt: null,
      },
    });

    const accountMap = new Map<string, string>();
    for (const acct of accountCodes) {
      accountMap.set(acct.code, acct.id);
    }

    const cashAccountId = accountMap.get(DEFAULT_ACCOUNT_CODES.CASH);
    const bankAccountId = accountMap.get(DEFAULT_ACCOUNT_CODES.BANK);
    const arAccountId = accountMap.get(
      DEFAULT_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    );
    const revenueAccountId = accountMap.get(
      DEFAULT_ACCOUNT_CODES.SALES_REVENUE,
    );
    const cogsAccountId = accountMap.get(
      DEFAULT_ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    );
    const inventoryAccountId = accountMap.get(DEFAULT_ACCOUNT_CODES.INVENTORY);

    const entryDate = new Date();
    const saleDescription = `Sale ${event.saleNumber}`;

    // Build journal lines
    const lines: Array<PostJournalEntryInput['lines'][0]> = [];

    // 1. Revenue recognition: Debit Cash/Bank/AR, Credit Sales Revenue
    const totalReceived = new Decimal(event.total);

    // Net cash received = cash tendered − change dispensed. Change is always
    // paid out of the cash drawer, so it reduces the cash line (never the
    // revenue line). If change exceeds cash tendered (partly drawn from the
    // drawer float), the excess is posted as a cash credit — the entry still
    // balances.
    const changeAmount = new Decimal(event.changeAmount);
    const cashNet = cashAmount.sub(changeAmount);

    // Debit side — one line per payment method
    if (cashNet.gt(0) && cashAccountId) {
      lines.push({
        accountId: cashAccountId,
        debit: cashNet.toString(),
        credit: '0',
        description: `Cash payment (net of change) — ${saleDescription}`,
      });
    } else if (cashNet.isNegative() && cashAccountId) {
      lines.push({
        accountId: cashAccountId,
        debit: '0',
        credit: cashNet.abs().toString(),
        description: `Change dispensed from float — ${saleDescription}`,
      });
    }

    if (cardAmount.gt(0)) {
      // If bank account exists, debit it for card/QR/transfer payments
      if (bankAccountId) {
        lines.push({
          accountId: bankAccountId,
          debit: cardAmount.toString(),
          credit: '0',
          description: `Card/QR/Bank payment — ${saleDescription}`,
        });
      } else if (cashAccountId) {
        // Fallback: use cash account
        lines.push({
          accountId: cashAccountId,
          debit: cardAmount.toString(),
          credit: '0',
          description: `Card/QR/Bank payment (via cash acct) — ${saleDescription}`,
        });
      }
    }

    if (creditAmount.gt(0) && arAccountId) {
      lines.push({
        accountId: arAccountId,
        debit: creditAmount.toString(),
        credit: '0',
        description: `Store credit / Gift card — ${saleDescription}`,
      });
    }

    if (otherAmount.gt(0) && cashAccountId) {
      lines.push({
        accountId: cashAccountId,
        debit: otherAmount.toString(),
        credit: '0',
        description: `Other payment — ${saleDescription}`,
      });
    }

    // Credit side — Sales Revenue
    if (revenueAccountId) {
      lines.push({
        accountId: revenueAccountId,
        debit: '0',
        credit: totalReceived.toString(),
        description: `Sales revenue — ${saleDescription}`,
      });
    }

    // 2. Cost of Goods Sold: Debit COGS, Credit Inventory
    //
    // G9-F2.2.1: canonical COGS comes from the immutable OUT CostLayers that
    // the Inventory sale-completed handler wrote in the SAME transaction
    // (referenceType='SALE', referenceId=saleId). Their totalCost already
    // includes the G9-F1 FALLBACK B, so it is the final accounting figure —
    // never recalculated here. Legacy SaleItem.costPrice is only a
    // compatibility fallback; FIFO and legacy amounts are never mixed.
    const outCostLayers = await tx.costLayer.findMany({
      where: {
        companyId: event.companyId,
        direction: 'OUT',
        referenceType: 'SALE',
        referenceId: event.saleId,
      },
    });

    const { totalCost } = this.resolveSaleCogs(event, outCostLayers);

    if (totalCost.gt(0) && cogsAccountId && inventoryAccountId) {
      lines.push({
        accountId: cogsAccountId,
        debit: totalCost.toString(),
        credit: '0',
        description: `COGS — ${saleDescription}`,
      });
      lines.push({
        accountId: inventoryAccountId,
        debit: '0',
        credit: totalCost.toString(),
        description: `Inventory reduction — ${saleDescription}`,
      });
    }

    // Route all journal creation through GlEngineService.post() for:
    // - Posting validation (period, accounts, balance check)
    // - Entry number generation
    // - Account balance snapshot updates
    // - Audit log
    // - JournalPostedEvent publishing
    await this.glEngine.post(
      {
        companyId: event.companyId,
        financialPeriodId: currentPeriod.id,
        entryDate,
        description: `Sales journal — ${saleDescription}`,
        referenceType: 'SALE',
        referenceId: event.saleId,
        createdBy: event.cashierId,
        lines,
      },
      tx,
    );
  }

  /**
   * G9-F2.2.1 (approved architecture): resolve the canonical COGS amount for a
   * completed sale.
   *
   * Primary source — the OUT CostLayers the Inventory handler created in the
   * SAME transaction (referenceType='SALE', referenceId=saleId). A multi-item
   * sale legitimately produces N layers (one per item), so layer count is
   * compared against the SaleItem count:
   *
   * - no OUT layers  → legacy compatibility fallback:
   *                    Σ(item.costPrice × quantity), warn-logged;
   * - full coverage  → SUM(OUT.totalCost) exclusively (FIFO only);
   * - partial (0 < found < expected) → anomaly: error-logged and FULL legacy
   *                    basis used — FIFO and legacy amounts are NEVER mixed.
   *                    Impossible under G9-F2.1 atomicity (all layers commit or
   *                    roll back with the sale); surfaced for ops follow-up.
   */
  private resolveSaleCogs(
    event: Pick<SaleCompletedEventPayload, 'saleId' | 'items'>,
    outCostLayers: Array<{ totalCost: Decimal }>,
  ): { totalCost: Decimal; source: 'FIFO_OUT' | 'LEGACY_COST_PRICE' } {
    const legacyTotal = (): Decimal => {
      let total = new Decimal(0);
      for (const item of event.items) {
        total = total.add(new Decimal(item.costPrice).mul(item.quantity));
      }
      return total;
    };

    if (outCostLayers.length === 0) {
      this.logger.warn(
        `FIFO COGS fallback for sale ${event.saleId}: reason="no OUT cost layers" — using legacy SaleItem.costPrice basis`,
      );
      return { totalCost: legacyTotal(), source: 'LEGACY_COST_PRICE' };
    }

    if (outCostLayers.length < event.items.length) {
      this.logger.error(
        `FIFO COGS anomaly for sale ${event.saleId}: foundOutLayers=${outCostLayers.length}, expectedSaleItems=${event.items.length} — partial OUT coverage. Using FULL legacy SaleItem.costPrice basis; FIFO and legacy are never mixed.`,
      );
      return { totalCost: legacyTotal(), source: 'LEGACY_COST_PRICE' };
    }

    let total = new Decimal(0);
    for (const layer of outCostLayers) {
      total = total.add(new Decimal(layer.totalCost.toString()));
    }
    return { totalCost: total, source: 'FIFO_OUT' };
  }

  /**
   * Called when a Sale is refunded.
   * Reverses the original journal entry and creates inventory restore entries.
   */
  async onSaleRefunded(
    event: SaleRefundedEventPayload,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const currentPeriod = await this.periodsRepository.findCurrent(
      event.companyId,
    );
    if (!currentPeriod) {
      throw new BadRequestException(
        `No open financial period for company ${event.companyId}. Cannot create reversal entries for refund of sale ${event.saleNumber}.`,
      );
    }

    const accountCodes = await tx.chartOfAccount.findMany({
      where: {
        companyId: event.companyId,
        code: { in: Object.values(DEFAULT_ACCOUNT_CODES) },
        isActive: true,
        deletedAt: null,
      },
    });

    const accountMap = new Map<string, string>();
    for (const acct of accountCodes) {
      accountMap.set(acct.code, acct.id);
    }

    const cashAccountId = accountMap.get(DEFAULT_ACCOUNT_CODES.CASH);
    const bankAccountId = accountMap.get(DEFAULT_ACCOUNT_CODES.BANK);
    const arAccountId = accountMap.get(
      DEFAULT_ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    );
    const revenueAccountId = accountMap.get(
      DEFAULT_ACCOUNT_CODES.SALES_REVENUE,
    );
    const cogsAccountId = accountMap.get(
      DEFAULT_ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    );
    const inventoryAccountId = accountMap.get(DEFAULT_ACCOUNT_CODES.INVENTORY);

    // G11-D: determine payment composition from the event payload.
    // The refund event carries the same payment records as the completion
    // event, so the handler can reconstruct the original payment-side
    // account mapping without any event-contract or model changes.
    let cashAmount = new Decimal(0);
    let cardAmount = new Decimal(0);
    let creditAmount = new Decimal(0);
    let otherAmount = new Decimal(0);

    for (const payment of event.payments) {
      const amt = new Decimal(payment.amount);
      switch (payment.method) {
        case 'CASH':
          cashAmount = cashAmount.add(amt);
          break;
        case 'CARD':
        case 'QR':
        case 'BANK_TRANSFER':
        case 'MOBILE_WALLET':
          cardAmount = cardAmount.add(amt);
          break;
        case 'STORE_CREDIT':
        case 'GIFT_CARD':
          creditAmount = creditAmount.add(amt);
          break;
        default:
          otherAmount = otherAmount.add(amt);
      }
    }

    const entryDate = new Date();
    const description = `Refund — ${event.saleNumber}`;

    const lines: Array<PostJournalEntryInput['lines'][0]> = [];

    const totalRefund = new Decimal(event.total);

    // Reverse revenue: Debit Sales Revenue
    if (revenueAccountId) {
      lines.push({
        accountId: revenueAccountId,
        debit: totalRefund.toString(),
        credit: '0',
        description: `Revenue reversal — ${description}`,
      });
    }

    // G11-D: payment-side reversal mirrors the original sale completion
    // journal structure. Each payment method's credit targets the same
    // account the original sale debited, so Cash/Bank/AR balances are
    // correctly restored.
    //
    // cashNet = cashAmount − changeAmount.  changeAmount is not in the
    // refund event payload, but by construction:
    //   cashNet + cardAmount + creditAmount + otherAmount = totalRefund
    // so: cashNet = totalRefund − cardAmount − creditAmount − otherAmount.
    const cashNet = totalRefund
      .sub(cardAmount)
      .sub(creditAmount)
      .sub(otherAmount);

    // Cash: credit when positive, debit when change exceeded cash tendered
    if (cashNet.gt(0) && cashAccountId) {
      lines.push({
        accountId: cashAccountId,
        debit: '0',
        credit: cashNet.toString(),
        description: `Cash refund — ${description}`,
      });
    } else if (cashNet.isNegative() && cashAccountId) {
      lines.push({
        accountId: cashAccountId,
        debit: cashNet.abs().toString(),
        credit: '0',
        description: `Change drawn from float — ${description}`,
      });
    }

    // Card / QR / Bank transfer / Mobile wallet → Bank 1020
    if (cardAmount.gt(0)) {
      if (bankAccountId) {
        lines.push({
          accountId: bankAccountId,
          debit: '0',
          credit: cardAmount.toString(),
          description: `Card/QR/Bank refund — ${description}`,
        });
      } else if (cashAccountId) {
        lines.push({
          accountId: cashAccountId,
          debit: '0',
          credit: cardAmount.toString(),
          description: `Card/QR/Bank refund (via cash acct) — ${description}`,
        });
      }
    }

    // Store credit / Gift card → AR 1200
    if (creditAmount.gt(0) && arAccountId) {
      lines.push({
        accountId: arAccountId,
        debit: '0',
        credit: creditAmount.toString(),
        description: `Store credit / Gift card refund — ${description}`,
      });
    }

    // Other / unknown methods → Cash 1010
    if (otherAmount.gt(0) && cashAccountId) {
      lines.push({
        accountId: cashAccountId,
        debit: '0',
        credit: otherAmount.toString(),
        description: `Other payment refund — ${description}`,
      });
    }

    // Reverse COGS: Debit Inventory, Credit COGS
    //
    // G9-F3: the reversal uses the SAME canonical costing ladder as sale
    // completion (resolveSaleCogs): when the sale's OUT CostLayers fully
    // cover the sale items, the reversal is priced at SUM(OUT.totalCost) —
    // the exact value the Inventory refund handler restores through IN
    // layers. Otherwise (legacy sale with no OUT layers, or partial-coverage
    // anomaly) the full legacy Σ(item.costPrice × quantity) basis is used;
    // FIFO and legacy amounts are never mixed.
    const outCostLayers = await tx.costLayer.findMany({
      where: {
        companyId: event.companyId,
        direction: 'OUT',
        referenceType: 'SALE',
        referenceId: event.saleId,
      },
    });
    const { totalCost } = this.resolveSaleCogs(event, outCostLayers);

    if (totalCost.gt(0) && cogsAccountId && inventoryAccountId) {
      lines.push({
        accountId: inventoryAccountId,
        debit: totalCost.toString(),
        credit: '0',
        description: `Inventory restore — ${description}`,
      });
      lines.push({
        accountId: cogsAccountId,
        debit: '0',
        credit: totalCost.toString(),
        description: `COGS reversal — ${description}`,
      });
    }

    await this.glEngine.post(
      {
        companyId: event.companyId,
        financialPeriodId: currentPeriod.id,
        entryDate,
        description: `Sales refund journal — ${description}`,
        referenceType: 'REFUND',
        referenceId: event.saleId,
        createdBy: event.cashierId,
        lines,
      },
      tx,
    );
  }

  /**
   * G11-E4: called when a PARTIAL refund (or a final refund after partials)
   * has been durably recorded as SalesRefund facts (`sale.partially_refunded`).
   *
   * Locked design (F1–F10):
   * - ONE journal per SalesRefund: referenceType='REFUND', referenceId=refundId
   *   (NEVER saleId — a sale may have many refunds, each posts exactly its own
   *   amount; the legacy full-refund journal keeps saleId untouched).
   * - CURRENT refund only: amounts come from THIS refund's event payload,
   *   never cumulative and never re-stating previous partials.
   * - Revenue reversal: Dr Revenue 4000 = event.total.
   * - Payment-side interim rule (until G11-E6 allocation exists): the partial
   *   event carries no payment allocation, so the credit defaults to the
   *   G11-D default bucket — Cr Cash 1010 = event.total. Balanced by
   *   construction; replaced by E6's per-method allocation later.
   * - FIFO/COGS: Dr Inventory 1300 / Cr COGS 5000 = Σ items[].fifoCost from
   *   the payload (SalesRefundItem.fifoCost is the canonical refund cost).
   *   CostLayer OUT is NEVER queried here and product.costPrice is never
   *   used — no re-FIFO, no legacy fallback.
   * - Required accounts (1010/4000/5000/1300) are company-scoped and
   *   fail-fast when missing (skip would post a silently unbalanced or
   *   incomplete journal).
   * - Must run inside the caller's transaction (tx) — same transactional
   *   model as the legacy refund path; glEngine.post receives tx directly.
   */
  async onSalePartiallyRefunded(
    event: SalePartiallyRefundedEventPayload,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const currentPeriod = await this.periodsRepository.findCurrent(
      event.companyId,
    );
    if (!currentPeriod) {
      throw new BadRequestException(
        `No open financial period for company ${event.companyId}. Cannot create journal entries for partial refund ${event.refundNumber} of sale ${event.saleNumber}.`,
      );
    }

    const accountCodes = await tx.chartOfAccount.findMany({
      where: {
        companyId: event.companyId,
        code: { in: Object.values(DEFAULT_ACCOUNT_CODES) },
        isActive: true,
        deletedAt: null,
      },
    });

    const accountMap = new Map<string, string>();
    for (const acct of accountCodes) {
      accountMap.set(acct.code, acct.id);
    }

    const cashAccountId = accountMap.get(DEFAULT_ACCOUNT_CODES.CASH);
    const revenueAccountId = accountMap.get(
      DEFAULT_ACCOUNT_CODES.SALES_REVENUE,
    );
    const cogsAccountId = accountMap.get(
      DEFAULT_ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    );
    const inventoryAccountId = accountMap.get(DEFAULT_ACCOUNT_CODES.INVENTORY);

    // F9: required accounts must exist — fail fast rather than posting an
    // incomplete or silently unbalanced journal.
    const missing: string[] = [];
    if (!revenueAccountId) missing.push(DEFAULT_ACCOUNT_CODES.SALES_REVENUE);
    if (!cashAccountId) missing.push(DEFAULT_ACCOUNT_CODES.CASH);
    if (!cogsAccountId) missing.push(DEFAULT_ACCOUNT_CODES.COST_OF_GOODS_SOLD);
    if (!inventoryAccountId) missing.push(DEFAULT_ACCOUNT_CODES.INVENTORY);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required Chart of Accounts for partial refund ${event.refundNumber}: ${missing.join(', ')}. Cannot post journal.`,
      );
    }

    const refundTotal = new Decimal(event.total);
    const fifoTotal = event.items.reduce(
      (acc, item) => acc.add(new Decimal(item.fifoCost)),
      new Decimal(0),
    );

    const entryDate = new Date();
    const description = `Partial refund — ${event.saleNumber} (${event.refundNumber})`;

    const lines: Array<PostJournalEntryInput['lines'][0]> = [
      // F3: reverse revenue for THIS refund only.
      {
        accountId: revenueAccountId!,
        debit: refundTotal.toString(),
        credit: '0',
        description: `Revenue reversal — ${description}`,
      },
      // F4: interim payment-side default bucket (E6 will allocate per method).
      {
        accountId: cashAccountId!,
        debit: '0',
        credit: refundTotal.toString(),
        description: `Refund payout — ${description}`,
      },
    ];

    // F5: restore inventory value at the canonical refund cost from the
    // payload. CostLayer OUT is intentionally never consulted.
    if (fifoTotal.gt(0)) {
      lines.push({
        accountId: inventoryAccountId!,
        debit: fifoTotal.toString(),
        credit: '0',
        description: `Inventory restore — ${description}`,
      });
      lines.push({
        accountId: cogsAccountId!,
        debit: '0',
        credit: fifoTotal.toString(),
        description: `COGS reversal — ${description}`,
      });
    }

    // F6: balanced by construction — Dr (refundTotal + fifoTotal) ==
    // Cr (refundTotal + fifoTotal); PostingValidation enforces at runtime.
    await this.glEngine.post(
      {
        companyId: event.companyId,
        financialPeriodId: currentPeriod.id,
        entryDate,
        description: `Sales partial refund journal — ${description}`,
        // F1/F7: identity is the REFUND, not the sale.
        referenceType: 'REFUND',
        referenceId: event.refundId,
        createdBy: event.createdBy,
        lines,
      },
      tx,
    );
  }
}
