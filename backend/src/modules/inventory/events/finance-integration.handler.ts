import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EventHandler } from '../../../common/events';
import {
  GlEngineService,
  PostJournalEntryInput,
} from '../../finance/services/gl-engine.service';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';

/**
 * G16-F (NWD-02): canonical reference metadata persisted on every GL skip
 * so a future replay mechanism has everything it needs in one place.
 */
interface GlSkipReference {
  referenceType?: string;
  referenceId?: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost?: string;
  reason?: string;
}

const GL_SKIP_ACTIONS = {
  NO_TX_CONTEXT: 'GL_SKIP_NO_TX_CONTEXT',
  NO_ACCOUNTS: 'GL_SKIP_NO_ACCOUNTS',
  NO_PERIOD: 'GL_SKIP_NO_PERIOD',
  ZERO_AMOUNT: 'GL_SKIP_ZERO_AMOUNT',
} as const;

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
 * Creates (balanced):
 * - Increase:  Debit Inventory (1300) / Credit Inventory Adjustment (5100)
 * - Decrease:  Debit Inventory Adjustment (5100) / Credit Inventory (1300)
 */
@Injectable()
export class InventoryFinanceHandler implements EventHandler {
  private readonly logger = new Logger(InventoryFinanceHandler.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly glEngine: GlEngineService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async handle(
    event: { eventName: string; payload: AdjustmentJournalPayload },
    context?: Record<string, any>,
  ): Promise<void> {
    const tx = context?.transactionClient;
    const payload = event.payload;

    if (!tx) {
      const reference = this.toReference(payload);
      this.logger.error(
        `No transaction context — journal skipped (company ${payload.companyId}, reference ${payload.referenceType ?? 'unknown'}:${payload.referenceId ?? 'n/a'}, amount ${payload.unitCost ?? '0'})`,
      );
      // G16-F (NWD-02): observable-skip, ERROR semantics. No tx is available
      // for an in-transaction write, so this one record is best-effort:
      // losing it must never throw out of an event handler that has no
      // transaction to roll back.
      await this.logSkipBestEffort(
        GL_SKIP_ACTIONS.NO_TX_CONTEXT,
        payload.companyId,
        payload.adjustedBy,
        reference,
        { reason: 'no transaction context on event' },
      );
      return;
    }

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
      const reference = this.toReference(payload);
      this.logger.warn(
        `Chart of Accounts not configured for inventory — journal skipped (company ${payload.companyId}, reference ${payload.referenceType ?? 'unknown'}:${payload.referenceId ?? 'n/a'})`,
      );
      // G16-F (NWD-02): observable-skip, ERROR semantics. The business
      // operation stays successful; the gap is durable inside the same
      // transaction so it can be audited and later replayed.
      await this.logSkip(
        GL_SKIP_ACTIONS.NO_ACCOUNTS,
        payload.companyId,
        payload.adjustedBy,
        reference,
        {
          reason: 'inventory chart of accounts not configured',
          missingAccountCodes: [
            ...(!inventoryAccountId ? [ACCOUNT_CODES.INVENTORY] : []),
            ...(!adjustmentAccountId ? [ACCOUNT_CODES.INVENTORY_ADJUSTMENT] : []),
          ],
        },
        tx,
      );
      return;
    }

    const financialPeriod = await tx.financialPeriod.findFirst({
      where: { companyId: payload.companyId, status: 'OPEN' },
      orderBy: { startDate: 'desc' },
    });

    if (!financialPeriod) {
      const reference = this.toReference(payload);
      this.logger.warn(
        `No open financial period — journal skipped (company ${payload.companyId}, reference ${payload.referenceType ?? 'unknown'}:${payload.referenceId ?? 'n/a'})`,
      );
      // G16-F (NWD-02): observable-skip, ERROR semantics, same-transaction
      // durable record for audit/replay.
      await this.logSkip(
        GL_SKIP_ACTIONS.NO_PERIOD,
        payload.companyId,
        payload.adjustedBy,
        reference,
        {
          reason: 'no OPEN financial period',
          expectedDate: new Date().toISOString(),
        },
        tx,
      );
      return;
    }

    const diff = payload.afterQuantity - payload.beforeQuantity;
    // G16-N-4 P1-A: when the publisher supplies an authoritative totalCost
    // (inventory-count shrinkage: the canonical consumeFifoLayers().totalCost),
    // it IS the GL amount — do not re-derive unitCost × |diff|, which would
    // flatten multi-layer FIFO consumption into an average-unit-cost
    // multiplication. Absent (all legacy publishers) → existing behavior.
    // Zero-value adjustments (e.g. product without a cost price) have nothing
    // to post — skip rather than fail the whole inventory transaction.
    const amount = payload.totalCost
      ? new Decimal(payload.totalCost)
      : (payload.unitCost ? new Decimal(payload.unitCost) : new Decimal(0)).mul(
          Math.abs(diff),
        );
    if (amount.isZero()) {
      const reference = this.toReference(payload);
      this.logger.warn(
        `Zero amount for inventory adjustment (product ${payload.productId}) — journal skipped (company ${payload.companyId})`,
      );
      // G16-F (NWD-02): observable-skip, INFO semantics — a legitimate
      // non-exception case, recorded for completeness of the audit trail.
      await this.logSkip(
        GL_SKIP_ACTIONS.ZERO_AMOUNT,
        payload.companyId,
        payload.adjustedBy,
        reference,
        { reason: 'zero valuation amount — nothing to post', amount: '0' },
        tx,
      );
      return;
    }

    const isIncrease = diff > 0;
    const description = `Inventory adjustment: ${payload.reason ?? 'manual'}`;

    // Inventory account is always the first leg, adjustment account the second.
    // Increase:  Dr Inventory / Cr Adjustment
    // Decrease:  Cr Inventory / Dr Adjustment
    const lines: PostJournalEntryInput['lines'] = [
      {
        accountId: inventoryAccountId,
        debit: isIncrease ? amount.toString() : '0',
        credit: isIncrease ? '0' : amount.toString(),
        description,
      },
      {
        accountId: adjustmentAccountId,
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

  // ── G16-F (NWD-02) helpers ───────────────────────────────────────────────

  /**
   * Canonical reference metadata for skip records — enough for a future
   * replay mechanism to re-post the journal without touching the source
   * domain aggregate. No secrets/PII: inventory reference data only.
   */
  private toReference(payload: AdjustmentJournalPayload): GlSkipReference {
    return {
      referenceType: payload.referenceType,
      referenceId: payload.referenceId,
      productId: payload.productId,
      warehouseId: payload.warehouseId,
      quantity: payload.quantity,
      unitCost: payload.unitCost,
      reason: payload.reason,
    };
  }

  /**
   * Durable skip record written INSIDE the originating transaction — the
   * skip is rolled back together with the business operation if that
   * transaction fails, and becomes visible exactly when the operation
   * commits.
   */
  private async logSkip(
    action: string,
    companyId: string,
    userId: string,
    reference: GlSkipReference,
    details: Record<string, unknown>,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await this.auditLogService.log(
      {
        companyId,
        userId,
        entityType: 'FinanceJournal',
        entityId: `${reference.referenceType ?? 'unknown'}:${reference.referenceId ?? 'n/a'}`,
        action,
        before: null,
        after: { reference, ...details },
      },
      tx,
    );
  }

  /**
   * Best-effort variant used when NO transaction context exists: there is
   * nothing to be transactional with, and a failure here must never throw
   * out of an event handler that cannot roll back the business operation.
   */
  private async logSkipBestEffort(
    action: string,
    companyId: string,
    userId: string,
    reference: GlSkipReference,
    details: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.auditLogService.log({
        companyId,
        userId,
        entityType: 'FinanceJournal',
        entityId: `${reference.referenceType ?? 'unknown'}:${reference.referenceId ?? 'n/a'}`,
        action,
        before: null,
        after: { reference, ...details },
      });
    } catch (err) {
      this.logger.error(
        `Failed to persist GL skip record (${action}) for company ${companyId}: ${(err as Error).message}`,
      );
    }
  }
}
