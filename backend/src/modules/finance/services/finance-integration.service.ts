import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import {
  SaleCompletedEventPayload,
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
    let totalCost = new Decimal(0);
    for (const item of event.items) {
      const itemCost = new Decimal(item.costPrice).mul(item.quantity);
      totalCost = totalCost.add(itemCost);
    }

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
    const revenueAccountId = accountMap.get(
      DEFAULT_ACCOUNT_CODES.SALES_REVENUE,
    );
    const cogsAccountId = accountMap.get(
      DEFAULT_ACCOUNT_CODES.COST_OF_GOODS_SOLD,
    );
    const inventoryAccountId = accountMap.get(DEFAULT_ACCOUNT_CODES.INVENTORY);

    const entryDate = new Date();
    const description = `Refund — ${event.saleNumber}`;

    const lines: Array<PostJournalEntryInput['lines'][0]> = [];

    const totalRefund = new Decimal(event.total);

    // Reverse revenue: Debit Sales Revenue, Credit Cash
    if (revenueAccountId) {
      lines.push({
        accountId: revenueAccountId,
        debit: totalRefund.toString(),
        credit: '0',
        description: `Revenue reversal — ${description}`,
      });
    }

    if (cashAccountId) {
      lines.push({
        accountId: cashAccountId,
        debit: '0',
        credit: totalRefund.toString(),
        description: `Cash refund — ${description}`,
      });
    }

    // Reverse COGS: Debit Inventory, Credit COGS
    let totalCost = new Decimal(0);
    for (const item of event.items) {
      totalCost = totalCost.add(new Decimal(item.costPrice).mul(item.quantity));
    }

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
}
