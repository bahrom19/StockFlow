import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { GlEngineService } from '../../finance/services/gl-engine.service';

/**
 * Default Chart of Account codes for purchasing accounting.
 * These should match the accounts created during Chart of Accounts seeding.
 */
const ACCOUNT_CODES = {
  INVENTORY: '1300',
  ACCOUNTS_PAYABLE: '2100',
  GRNI: '2110',
  PURCHASE_DISCOUNT: '5200',
  COGS: '5000',
  INVENTORY_ADJUSTMENT: '5100',
} as const;

/**
 * G11-A: human-readable labels for the mandatory accounts, used in the
 * fail-fast diagnostic so an operator can identify the missing account
 * without looking up the code.
 */
const ACCOUNT_LABELS: Record<string, string> = {
  [ACCOUNT_CODES.INVENTORY]: 'Inventory',
  [ACCOUNT_CODES.ACCOUNTS_PAYABLE]: 'Accounts Payable',
  [ACCOUNT_CODES.GRNI]: 'Goods Received Not Invoiced',
  [ACCOUNT_CODES.PURCHASE_DISCOUNT]: 'Purchase Discounts and Write-Offs',
};

/** Logical account slots a purchasing journal can post to (G11-A). */
type PurchasingAccountKey =
  | 'inventory'
  | 'accountsPayable'
  | 'grni'
  | 'purchaseDiscount';

interface PurchasingAccountRequirement {
  key: PurchasingAccountKey;
  code: string;
}

/**
 * Handles automatic journal entry creation for purchasing operations.
 *
 * All journal entries are created via GlEngineService.post() to ensure:
 * - Posting validation (period, accounts, balance check)
 * - Account balance snapshot updates
 * - Audit logging
 * - JournalPostedEvent publishing
 *
 * Called by PurchaseOrderService, GoodsReceiptService,
 * and PurchaseReturnService inside their Prisma transactions.
 */
@Injectable()
export class PurchasingFinanceService {
  private readonly logger = new Logger(PurchasingFinanceService.name);

  constructor(private readonly glEngine: GlEngineService) {}

  /**
   * Create journal entries for a goods receipt.
   *
   * Debit:  Inventory (asset increase)
   * Credit: Goods Received Not Invoiced (accrual)
   */
  async createGoodsReceiptJournal(
    params: {
      companyId: string;
      warehouseId: string;
      receiptNumber: string;
      receiptDate: Date;
      items: Array<{ productId: string; quantity: number; unitCost: string }>;
      createdBy: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const totalAmount = params.items.reduce((sum, item) => {
      return sum.add(new Decimal(item.unitCost).mul(item.quantity));
    }, new Decimal(0));

    // G11-A: a zero-value receipt posts nothing, so it must never depend on
    // the CoA (same contract as the invoice/return early-return paths).
    if (totalAmount.isZero()) return;

    // G11-A: per-operation account gate. A goods receipt posts ONLY
    // 1300 (Inventory, debit) and 2110 (GRNI, credit) — AP (2100) is credited
    // on invoice approval and 5200 is never touched here, so neither account
    // may block a receipt. Missing/inactive mandatory accounts now fail fast
    // (whole transaction rolls back) instead of silently committing a
    // receipt whose stock moved without any GL entry.
    const accounts = await this.resolveAccounts(params.companyId, tx, [
      { key: 'inventory', code: ACCOUNT_CODES.INVENTORY },
      { key: 'grni', code: ACCOUNT_CODES.GRNI },
    ]);

    const description = `Goods receipt: ${params.receiptNumber}`;

    // G10-A: receipts accrue against GRNI (Goods Received Not Invoiced),
    // NOT against AP. AP is credited only when the purchase invoice is
    // approved (createInvoiceJournal), keeping GL AP invoice-based and
    // aligned with the G9 operational AP definition.
    await this.glEngine.post(
      {
        companyId: params.companyId,
        financialPeriodId: await this.getOpenPeriodId(tx, params.companyId),
        entryDate: params.receiptDate,
        description,
        referenceType: 'GOODS_RECEIPT',
        referenceId: params.receiptNumber,
        createdBy: params.createdBy,
        lines: [
          {
            accountId: accounts.inventory,
            debit: totalAmount.toString(),
            credit: '0',
            description: `Inventory increase: ${params.receiptNumber}`,
          },
          {
            accountId: accounts.grni,
            debit: '0',
            credit: totalAmount.toString(),
            description: `Goods received not invoiced: ${params.receiptNumber}`,
          },
        ],
      },
      tx,
    );
  }

  /**
   * Create journal entries for a purchase return.
   *
   * Debit:  Accounts Payable (liability decrease at the DECLARED supplier
   *         return value)
   * Credit: Inventory (asset decrease at the ACTUAL FIFO consumed cost)
   * Dr/Cr:  Purchase Discounts and Write-Offs (explicit cost-variance leg
   *         when declared AP value ≠ FIFO cost: credit when the supplier
   *         return value exceeds the FIFO cost — the excess supplier credit
   *         reduces purchase cost — and debit when the FIFO cost exceeds the
   *         supplier credit — a write-off)
   *
   * G9-F4: `fifoCostItems` carries the canonical Inventory relief (the sum
   * returned by CostingService.consumeFifoLayers for the same return, same
   * transaction). When omitted, the declared item cost basis is used so
   * legacy/non-costed flows keep their historical journal shape.
   */
  async createPurchaseReturnJournal(
    params: {
      companyId: string;
      returnNumber: string;
      returnDate: Date;
      items: Array<{ productId: string; quantity: number; unitCost: string }>;
      fifoCostItems?: Array<{
        productId: string;
        quantity: number;
        totalCost: string;
      }>;
      createdBy: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const declaredTotal = params.items.reduce((sum, item) => {
      return sum.add(new Decimal(item.unitCost).mul(item.quantity));
    }, new Decimal(0));

    // G9-F4: canonical Inventory relief = actual FIFO consumed cost when a
    // FIFO basis is provided; otherwise the declared basis (legacy shape).
    let inventoryCredit: Decimal;
    if (params.fifoCostItems && params.fifoCostItems.length > 0) {
      inventoryCredit = params.fifoCostItems.reduce(
        (sum, item) => sum.add(new Decimal(item.totalCost)),
        new Decimal(0),
      );
    } else {
      inventoryCredit = declaredTotal;
    }
    const variance = declaredTotal.sub(inventoryCredit);

    // G11-A: a return with no economic value posts nothing, so it must never
    // depend on the CoA (same contract as the GR/invoice early-return paths).
    if (declaredTotal.isZero() && inventoryCredit.isZero()) return;

    // G11-A: per-operation account gate. A return posts ONLY 2100 (AP debit at
    // the declared supplier value) and 1300 (Inventory credit at the FIFO
    // relief). 2110 (GRNI) is never touched by a return, so a missing GRNI
    // account must not block it. 5200 is required ONLY when a variance leg is
    // actually produced (declared basis ≠ FIFO basis), preserving the existing
    // conditional semantics of zero-variance returns.
    const requirements: PurchasingAccountRequirement[] = [
      { key: 'accountsPayable', code: ACCOUNT_CODES.ACCOUNTS_PAYABLE },
      { key: 'inventory', code: ACCOUNT_CODES.INVENTORY },
    ];
    if (!variance.isZero()) {
      requirements.push({
        key: 'purchaseDiscount',
        code: ACCOUNT_CODES.PURCHASE_DISCOUNT,
      });
    }
    const accounts = await this.resolveAccounts(
      params.companyId,
      tx,
      requirements,
    );

    const description = `Purchase return: ${params.returnNumber}`;

    const lines: Array<{
      accountId: string;
      debit: string;
      credit: string;
      description?: string;
    }> = [
      {
        accountId: accounts.accountsPayable,
        debit: declaredTotal.toString(),
        credit: '0',
        description: `Return to supplier: ${params.returnNumber}`,
      },
    ];
    if (!inventoryCredit.isZero()) {
      lines.push({
        accountId: accounts.inventory,
        debit: '0',
        credit: inventoryCredit.toString(),
        description: `Inventory decrease (FIFO cost): ${params.returnNumber}`,
      });
    }
    // Explicit cost-variance leg on the approved variance account (5200).
    // Balance identity: Dr AP(declared) = Cr Inventory(FIFO) + variance
    //   => variance > 0 (declared > FIFO) → CREDIT (excess supplier credit
    //      reduces purchase cost); variance < 0 → DEBIT (write-off).
    // Skipped when the two bases agree (current G10-A zero-line convention).
    if (!variance.isZero()) {
      lines.push({
        accountId: accounts.purchaseDiscount,
        debit: variance.lt(0) ? variance.abs().toString() : '0',
        credit: variance.gt(0) ? variance.toString() : '0',
        description: `Purchase return cost variance: ${params.returnNumber}`,
      });
    }

    await this.glEngine.post(
      {
        companyId: params.companyId,
        financialPeriodId: await this.getOpenPeriodId(tx, params.companyId),
        entryDate: params.returnDate,
        description,
        referenceType: 'PURCHASE_RETURN',
        referenceId: params.returnNumber,
        createdBy: params.createdBy,
        lines,
      },
      tx,
    );
  }

  /**
   * Create journal entries for purchase invoice approval (G10-A).
   *
   * Debit:  GRNI (settle the goods-received accrual at invoice subtotal)
   * Debit:  Purchase Discounts & Write-Offs (purchase tax — expense;
   *         dedicated tax subsystem is deferred)
   * Credit: Purchase Discounts & Write-Offs (purchase discount recognized;
   *         credit reduces the debit-normal expense account)
   * Credit: Accounts Payable (grandTotal — GL AP becomes invoice-based)
   *
   * Balanced by the invoice identity:
   *   grandTotal = subtotal - discountAmount + taxAmount
   *   => subtotal + taxAmount = grandTotal + discountAmount
   *
   * Zero-value lines are skipped. If the invoice total exceeds the received
   * value, GRNI goes negative (accepted, visible overbilling accrual); the
   * reverse leaves a positive GRNI residue until further receipts/invoices.
   */
  async createInvoiceJournal(
    params: {
      companyId: string;
      invoiceNumber: string;
      invoiceDate: Date;
      subtotal: string;
      discountAmount: string;
      taxAmount: string;
      grandTotal: string;
      createdBy: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const subtotal = new Decimal(params.subtotal);
    const discountAmount = new Decimal(params.discountAmount);
    const taxAmount = new Decimal(params.taxAmount);
    const grandTotal = new Decimal(params.grandTotal);

    // G11-A: a zero-total invoice posts nothing, so it must never depend on
    // the CoA (same contract as the GR/return early-return paths).
    if (grandTotal.isZero()) return;

    // G11-A: per-operation account gate. Invoice approval posts 2110 (GRNI
    // settlement, debit) and 2100 (AP credit) unconditionally; 5200 carries the
    // purchase tax/discount legs and is therefore required ONLY when such a
    // line is actually produced. 1300 (Inventory) is never touched here —
    // inventory is capitalized by the goods receipt (G10-A).
    const requirements: PurchasingAccountRequirement[] = [
      { key: 'grni', code: ACCOUNT_CODES.GRNI },
      { key: 'accountsPayable', code: ACCOUNT_CODES.ACCOUNTS_PAYABLE },
    ];
    if (!taxAmount.isZero() || !discountAmount.isZero()) {
      requirements.push({
        key: 'purchaseDiscount',
        code: ACCOUNT_CODES.PURCHASE_DISCOUNT,
      });
    }
    const accounts = await this.resolveAccounts(
      params.companyId,
      tx,
      requirements,
    );

    const description = `Purchase invoice: ${params.invoiceNumber}`;

    const lines: Array<{
      accountId: string;
      debit: string;
      credit: string;
      description?: string;
    }> = [];

    if (!subtotal.isZero()) {
      lines.push({
        accountId: accounts.grni,
        debit: subtotal.toString(),
        credit: '0',
        description: `GRNI settlement: ${params.invoiceNumber}`,
      });
    }
    if (!taxAmount.isZero()) {
      lines.push({
        accountId: accounts.purchaseDiscount,
        debit: taxAmount.toString(),
        credit: '0',
        description: `Purchase tax: ${params.invoiceNumber}`,
      });
    }
    if (!discountAmount.isZero()) {
      lines.push({
        accountId: accounts.purchaseDiscount,
        debit: '0',
        credit: discountAmount.toString(),
        description: `Purchase discount: ${params.invoiceNumber}`,
      });
    }
    lines.push({
      accountId: accounts.accountsPayable,
      debit: '0',
      credit: grandTotal.toString(),
      description: `Supplier invoice: ${params.invoiceNumber}`,
    });

    await this.glEngine.post(
      {
        companyId: params.companyId,
        financialPeriodId: await this.getOpenPeriodId(tx, params.companyId),
        entryDate: params.invoiceDate,
        description,
        referenceType: 'PURCHASE_INVOICE',
        referenceId: params.invoiceNumber,
        createdBy: params.createdBy,
        lines,
      },
      tx,
    );
  }

  /**
   * G11-A: resolve ONLY the accounts the requested journal actually posts to.
   *
   * The previous implementation required ALL FOUR purchasing accounts for
   * every journal and returned `null` when any of them was missing/inactive,
   * which let callers commit the document (and move stock) without any GL
   * entry and without an error. Requirements are now declared per operation
   * by the caller, and a missing mandatory account fails fast so the
   * surrounding transaction rolls back.
   *
   * The lookup stays tenant-scoped (companyId) and requires an active,
   * non-soft-deleted account — G11-A does not change account policy beyond
   * failing loudly.
   */
  private async resolveAccounts(
    companyId: string,
    tx: Prisma.TransactionClient,
    requirements: ReadonlyArray<PurchasingAccountRequirement>,
  ): Promise<Record<PurchasingAccountKey, string>> {
    const accounts = await tx.chartOfAccount.findMany({
      where: {
        companyId,
        code: { in: requirements.map((requirement) => requirement.code) },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, code: true },
    });

    const byCode = new Map(
      accounts.map((account) => [account.code, account.id]),
    );
    const missing = requirements.filter(
      (requirement) => !byCode.has(requirement.code),
    );

    if (missing.length > 0) {
      const missingList = missing
        .map(
          (requirement) =>
            `${requirement.code} (${ACCOUNT_LABELS[requirement.code] ?? requirement.code})`,
        )
        .join(', ');

      // Stable, greppable diagnostic — the message prefix is part of the
      // G11-A contract (asserted in unit tests and used by operators).
      this.logger.error(
        `Chart of Accounts not configured for company ${companyId} — missing mandatory account(s): ${missingList}`,
      );

      throw new BadRequestException(
        `Chart of Accounts not configured for company ${companyId} — missing mandatory account(s): ${missingList}`,
      );
    }

    const resolved = {} as Record<PurchasingAccountKey, string>;
    for (const requirement of requirements) {
      resolved[requirement.key] = byCode.get(requirement.code)!;
    }

    return resolved;
  }

  private async getOpenPeriodId(
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<string> {
    const period = await tx.financialPeriod.findFirst({
      where: { companyId, status: 'OPEN' },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    });

    if (!period) {
      throw new BadRequestException(
        `No open financial period found for company ${companyId}`,
      );
    }

    return period.id;
  }
}
