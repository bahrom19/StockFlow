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
    const accounts = await this.getAccountIds(params.companyId, tx);
    if (!accounts) return;

    const totalAmount = params.items.reduce((sum, item) => {
      return sum.add(new Decimal(item.unitCost).mul(item.quantity));
    }, new Decimal(0));

    if (totalAmount.isZero()) return;

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
   * Debit:  Accounts Payable (liability decrease)
   * Credit: Inventory (asset decrease)
   */
  async createPurchaseReturnJournal(
    params: {
      companyId: string;
      returnNumber: string;
      returnDate: Date;
      items: Array<{ productId: string; quantity: number; unitCost: string }>;
      createdBy: string;
    },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const accounts = await this.getAccountIds(params.companyId, tx);
    if (!accounts) return;

    const totalAmount = params.items.reduce((sum, item) => {
      return sum.add(new Decimal(item.unitCost).mul(item.quantity));
    }, new Decimal(0));

    if (totalAmount.isZero()) return;

    const description = `Purchase return: ${params.returnNumber}`;

    await this.glEngine.post(
      {
        companyId: params.companyId,
        financialPeriodId: await this.getOpenPeriodId(tx, params.companyId),
        entryDate: params.returnDate,
        description,
        referenceType: 'PURCHASE_RETURN',
        referenceId: params.returnNumber,
        createdBy: params.createdBy,
        lines: [
          {
            accountId: accounts.accountsPayable,
            debit: totalAmount.toString(),
            credit: '0',
            description: `Return to supplier: ${params.returnNumber}`,
          },
          {
            accountId: accounts.inventory,
            debit: '0',
            credit: totalAmount.toString(),
            description: `Inventory decrease: ${params.returnNumber}`,
          },
        ],
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
    const accounts = await this.getAccountIds(params.companyId, tx);
    if (!accounts) return;

    const subtotal = new Decimal(params.subtotal);
    const discountAmount = new Decimal(params.discountAmount);
    const taxAmount = new Decimal(params.taxAmount);
    const grandTotal = new Decimal(params.grandTotal);

    if (grandTotal.isZero()) return;

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

  private async getAccountIds(
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<{
    inventory: string;
    grni: string;
    accountsPayable: string;
    purchaseDiscount: string;
  } | null> {
    const accounts = await tx.chartOfAccount.findMany({
      where: {
        companyId,
        code: {
          in: [
            ACCOUNT_CODES.INVENTORY,
            ACCOUNT_CODES.ACCOUNTS_PAYABLE,
            ACCOUNT_CODES.GRNI,
            ACCOUNT_CODES.PURCHASE_DISCOUNT,
          ],
        },
        isActive: true,
        deletedAt: null,
      },
    });

    const map = new Map(accounts.map((a) => [a.code, a.id]));
    const inventory = map.get(ACCOUNT_CODES.INVENTORY);
    const accountsPayable = map.get(ACCOUNT_CODES.ACCOUNTS_PAYABLE);
    const grni = map.get(ACCOUNT_CODES.GRNI);
    const purchaseDiscount = map.get(ACCOUNT_CODES.PURCHASE_DISCOUNT);

    if (!inventory || !accountsPayable || !grni || !purchaseDiscount) {
      this.logger.warn(
        `Chart of Accounts not configured for company ${companyId} — skipping journal`,
      );
      return null;
    }

    return { inventory, grni, accountsPayable, purchaseDiscount };
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
