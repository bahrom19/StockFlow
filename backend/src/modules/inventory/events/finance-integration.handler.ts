import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { EventHandler } from '../../../common/events';
import {
  GlEngineService,
  PostJournalEntryInput,
} from '../../finance/services/gl-engine.service';
import { PrismaService } from '../../../common/prisma';

/**
 * Default Chart of Account codes for inventory accounting.
 */
const ACCOUNT_CODES = {
  INVENTORY: '1300',
  COGS: '5000',
  INVENTORY_ADJUSTMENT: '5100',
  WRITE_OFF: '5200',
} as const;

export interface AdjustmentJournalPayload {
  productId: string;
  companyId: string;
  warehouseId: string;
  quantity: number;
  beforeQuantity: number;
  afterQuantity: number;
  reason: string;
  adjustedBy: string;
  referenceType?: string;
  referenceId?: string;
  unitCost?: string;
  totalCost?: string;
}

/**
 * Handles inventory adjustments by creating journal entries in Finance.
 * Subscribes to `inventory.adjusted` events.
 *
 * Creates:
 * - Debit: Inventory Adjustment Expense
 * - Credit: Inventory
 * (for positive adjustments, reverse direction)
 */
@Injectable()
export class InventoryFinanceHandler implements EventHandler {
  private readonly logger = new Logger(InventoryFinanceHandler.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly glEngine: GlEngineService,
  ) {}

  async handle(
    event: { eventName: string; payload: AdjustmentJournalPayload },
    context?: Record<string, any>,
  ): Promise<void> {
    const tx = context?.transactionClient;

    if (!tx) {
      this.logger.warn('No transaction context — skipping journal creation');
      return;
    }

    const payload = event.payload;

    const accounts = await tx.chartOfAccount.findMany({
      where: {
        companyId: payload.companyId,
        code: { in: Object.values(ACCOUNT_CODES) },
        isActive: true,
        deletedAt: null,
      },
    });

    const accountMap = new Map<string, string>();
    for (const acct of accounts) {
      accountMap.set(acct.code, acct.id);
    }

    const inventoryAccountId = accountMap.get(ACCOUNT_CODES.INVENTORY);
    const adjustmentAccountId = accountMap.get(
      ACCOUNT_CODES.INVENTORY_ADJUSTMENT,
    );

    if (!inventoryAccountId || !adjustmentAccountId) {
      this.logger.warn(
        'Chart of Accounts not configured for inventory — skipping journal',
      );
      return;
    }

    const financialPeriod = await tx.financialPeriod.findFirst({
      where: { companyId: payload.companyId, status: 'OPEN' },
      orderBy: { startDate: 'desc' },
    });

    if (!financialPeriod) {
      this.logger.warn('No open financial period — skipping journal');
      return;
    }

    const diff = payload.afterQuantity - payload.beforeQuantity;
    const unitCost = payload.unitCost
      ? new Decimal(payload.unitCost)
      : new Decimal(0);
    const amount = unitCost.mul(Math.abs(diff));

    // Zero-value adjustments (e.g. product without a cost price) have nothing
    // to post — skip rather than fail the whole inventory transaction.
    if (amount.isZero()) {
      this.logger.warn(
        `Zero amount for inventory adjustment (product ${payload.productId}) — skipping journal`,
      );
      return;
    }

    const isIncrease = diff > 0;
    const description = `Inventory adjustment: ${payload.reason ?? 'manual'}`;

    const lines: PostJournalEntryInput['lines'] = [
      {
        accountId: isIncrease ? inventoryAccountId : adjustmentAccountId,
        debit: isIncrease ? amount.toString() : '0',
        credit: isIncrease ? '0' : amount.toString(),
        description,
      },
      {
        accountId: isIncrease ? adjustmentAccountId : inventoryAccountId,
        debit: isIncrease ? '0' : amount.toString(),
        credit: isIncrease ? amount.toString() : '0',
        description,
      },
    ];

    await this.glEngine.post(
      {
        companyId: payload.companyId,
        financialPeriodId: financialPeriod.id,
        entryDate: new Date(),
        description,
        referenceType: 'INVENTORY_ADJUSTMENT',
        referenceId: payload.referenceId ?? payload.productId,
        createdBy: payload.adjustedBy,
        lines,
      },
      tx,
    );
  }
}
