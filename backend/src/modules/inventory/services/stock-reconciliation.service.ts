import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';

/**
 * G16-I-3 — legacy Stock ↔ CostLayer reconciliation (approved G16-I-2 design).
 *
 * Restores the invariant Σ(IN CostLayer.remainingQuantity) === Stock.quantity
 * for historical pairs broken before G16-H by creating ONE synthetic IN cost
 * layer per (companyId, productId) pair, priced at the product's costPrice:
 *
 * - costPrice > 0        → AUTO: layer created (delta units at costPrice);
 * - costPrice = 0        → AUTO: valid zero-cost basis (G16-H-2 B4 / G16-H-3
 *                          semantics; NO truthiness checks — explicit nulls);
 * - costPrice = NULL     → MANUAL: never invent a cost basis (owner must set
 *                          costPrice via the B4 endpoint first);
 * - delta <= 0           → SKIP: nothing to reconcile;
 * - existing RECONCILIATION layer → SKIP (idempotency).
 *
 * Hard guards (approved design): Stock.quantity is NEVER modified; no
 * StockMovement; no GL; no EventBus; existing layers are read-only; the
 * synthetic layer carries referenceType='RECONCILIATION' and is appended as
 * the FIFO tail (findActiveCostLayers orders by createdAt ASC), so historical
 * COGS ordering is never rewritten.
 *
 * Concurrency: the Stock row is locked with SELECT … FOR UPDATE inside the
 * per-pair transaction BEFORE the delta is computed; stock, layers and the
 * product are then re-read under the lock. A concurrent reconciliation
 * serializes on the same row lock, so at most one RECONCILIATION layer can
 * ever exist. Parameters are bound values only (uuid-cast); no dynamic SQL.
 */
@Injectable()
export class StockReconciliationService {
  private readonly logger = new Logger(StockReconciliationService.name);

  static readonly REFERENCE_TYPE = 'RECONCILIATION';
  static readonly REMEDIATION_VERSION = 'G16-I-2';

  constructor(
    private readonly prismaService: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Reconcile one (companyId, productId) pair inside a single transaction.
   * Never throws for business outcomes (SKIP/MANUAL) — those are returned in
   * the result; only infrastructure failures propagate.
   */
  async reconcilePair(
    companyId: string,
    productId: string,
    userId: string,
  ): Promise<ReconciliationResult> {
    return this.prismaService.$transaction(async (tx) =>
      this.reconcilePairInTx(companyId, productId, userId, tx),
    );
  }

  /**
   * Read-only planning for one pair (dry-run). Uses the same decision logic
   * without any side effect: no lock, no layer, no audit.
   */
  async dryRunPair(
    companyId: string,
    productId: string,
  ): Promise<ReconciliationPlan> {
    const state = await this.readPairState(companyId, productId, undefined);
    if (!state) {
      return {
        companyId,
        productId,
        action: 'SKIP',
        reason: 'no positive stock for pair',
      };
    }
    return this.decide(state);
  }

  /**
   * Shared decision logic (used by both dry-run and the transactional path).
   */
  private decide(state: {
    stockQty: number;
    inRemaining: number;
    costPrice: Decimal | string | null;
    hasReconciliationLayer: boolean;
  }): ReconciliationPlan {
    const { stockQty, inRemaining, hasReconciliationLayer } = state;

    if (hasReconciliationLayer) {
      return this.planFromState(
        state,
        'SKIP',
        undefined,
        undefined,
        'already reconciled (RECONCILIATION layer exists)',
      );
    }

    const delta = stockQty - inRemaining;
    if (delta <= 0) {
      return this.planFromState(
        state,
        'SKIP',
        undefined,
        undefined,
        'delta <= 0, nothing to reconcile',
      );
    }

    // Explicit absence checks only — Decimal(0) is a valid zero-cost basis
    // (G16-H-2 B4 / G16-H-3 semantics; no truthiness shortcuts).
    if (state.costPrice === null || state.costPrice === undefined) {
      return this.planFromState(
        state,
        'MANUAL',
        undefined,
        undefined,
        'costPrice is NULL — manual reconciliation required (never invent a basis)',
      );
    }

    const unitCost = new Decimal(state.costPrice.toString());
    return this.planFromState(
      state,
      'AUTO',
      unitCost,
      unitCost.mul(delta),
      'create synthetic IN layer priced at product.costPrice',
    );
  }

  /**
   * Transactional core. The Stock row lock (FOR UPDATE) is acquired BEFORE
   * the delta computation; all subsequent reads happen in the same tx.
   */
  private async reconcilePairInTx(
    companyId: string,
    productId: string,
    userId: string,
    tx: Prisma.TransactionClient,
  ): Promise<ReconciliationResult> {
    // STEP 1: row lock on the tenant-scoped Stock row (bound uuid params).
    const locked = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT id FROM "Stock" WHERE "companyId" = ${companyId}::uuid AND "productId" = ${productId}::uuid FOR UPDATE`,
    );
    if (!locked || locked.length === 0) {
      return {
        status: 'SKIPPED',
        companyId,
        productId,
        reason: 'no positive stock row for pair',
      };
    }

    // STEP 2: re-read state under the lock (tenant-scoped).
    const stock = await tx.stock.findFirst({
      where: { companyId, productId },
      select: { quantity: true },
    });
    const stockQty = stock?.quantity ?? 0;
    if (stockQty <= 0) {
      return {
        status: 'SKIPPED',
        companyId,
        productId,
        stockQty,
        inRemaining: 0,
        delta: stockQty,
        reason: 'stock quantity is not positive',
      };
    }

    const product = await tx.product.findFirst({
      where: { id: productId, companyId, deletedAt: null },
      select: { costPrice: true },
    });
    if (!product) {
      return {
        status: 'SKIPPED',
        companyId,
        productId,
        stockQty,
        reason: 'product not found for company (or deleted)',
      };
    }

    const layerAgg = await tx.costLayer.aggregate({
      where: { companyId, productId, direction: 'IN' },
      _sum: { remainingQuantity: true },
    });
    const inRemaining = layerAgg._sum.remainingQuantity ?? 0;

    const existing = await tx.costLayer.findFirst({
      where: {
        companyId,
        productId,
        direction: 'IN',
        referenceType: StockReconciliationService.REFERENCE_TYPE,
        referenceId: productId,
      },
      select: { id: true },
    });
    const hasReconciliationLayer = existing !== null;

    // STEPS 3-5: shared decision logic.
    const plan = this.decide({
      stockQty,
      inRemaining,
      costPrice: product.costPrice,
      hasReconciliationLayer,
    });

    if (plan.action === 'SKIP') {
      return {
        status: 'SKIPPED',
        companyId,
        productId,
        stockQty,
        inRemaining,
        delta: stockQty - inRemaining,
        costPrice: product.costPrice?.toString() ?? null,
        reason: plan.reason,
      };
    }

    if (plan.action === 'MANUAL') {
      this.logger.warn(
        `Reconciliation MANUAL for product ${productId} (company ${companyId}): stock ${stockQty} vs layers ${inRemaining} — costPrice is NULL; set costPrice (B4) and re-run`,
      );
      return {
        status: 'MANUAL_REQUIRED',
        companyId,
        productId,
        stockQty,
        inRemaining,
        delta: stockQty - inRemaining,
        costPrice: null,
        reason: plan.reason,
      };
    }

    // STEP 6: create the synthetic IN layer (FIFO tail by createdAt).
    const unitCost = plan.unitCost!;
    const delta = stockQty - inRemaining;
    const layer = await tx.costLayer.create({
      data: {
        companyId,
        productId,
        direction: 'IN',
        quantity: delta,
        remainingQuantity: delta,
        unitCost,
        totalCost: unitCost.mul(delta),
        referenceType: StockReconciliationService.REFERENCE_TYPE,
        referenceId: productId,
      },
    });

    // STEP 7: audit inside the SAME transaction — failure rolls everything back.
    await this.auditLogService.log(
      {
        companyId,
        userId,
        entityType: 'CostLayer',
        entityId: layer.id,
        action: 'COST_LAYER_RECONCILIATION',
        before: { stockQty, inRemaining },
        after: {
          delta,
          unitCost: unitCost.toString(),
          totalCost: unitCost.mul(delta).toString(),
          reason: plan.reason,
          remediationVersion: StockReconciliationService.REMEDIATION_VERSION,
        },
      },
      tx,
    );

    this.logger.log(
      `Reconciled product ${productId} (company ${companyId}): +${delta} units at ${unitCost.toString()} (layer ${layer.id})`,
    );

    return {
      status: 'AUTO_RECONCILED',
      companyId,
      productId,
      stockQty,
      inRemaining,
      delta,
      costPrice: unitCost.toString(),
      layerId: layer.id,
      reason: plan.reason,
    };
  }

  /** READ-ONLY state snapshot (no lock, no writes) for planning/dry-run. */
  private async readPairState(
    companyId: string,
    productId: string,
    tx: Prisma.TransactionClient | undefined,
  ): Promise<{
    stockQty: number;
    inRemaining: number;
    costPrice: Decimal | string | null;
    hasReconciliationLayer: boolean;
  } | null> {
    const client = tx ?? this.prismaService;
    const stock = await client.stock.findFirst({
      where: { companyId, productId },
      select: { quantity: true },
    });
    if (!stock || stock.quantity <= 0) return null;

    const product = await client.product.findFirst({
      where: { id: productId, companyId, deletedAt: null },
      select: { costPrice: true },
    });
    if (!product) return null;

    const layerAgg = await client.costLayer.aggregate({
      where: { companyId, productId, direction: 'IN' },
      _sum: { remainingQuantity: true },
    });
    const existing = await client.costLayer.findFirst({
      where: {
        companyId,
        productId,
        direction: 'IN',
        referenceType: StockReconciliationService.REFERENCE_TYPE,
        referenceId: productId,
      },
      select: { id: true },
    });

    return {
      stockQty: stock.quantity,
      inRemaining: layerAgg._sum.remainingQuantity ?? 0,
      costPrice: product.costPrice,
      hasReconciliationLayer: existing !== null,
    };
  }

  private plan(
    companyId: string,
    productId: string,
    action: 'AUTO' | 'MANUAL' | 'SKIP',
    unitCost: Decimal | undefined,
    totalCost: Decimal | undefined,
    reason: string,
  ): ReconciliationPlan {
    return { companyId, productId, action, unitCost, totalCost, reason };
  }

  private planFromState(
    state: { stockQty: number; inRemaining: number },
    action: 'AUTO' | 'MANUAL' | 'SKIP',
    unitCost: Decimal | undefined,
    totalCost: Decimal | undefined,
    reason: string,
  ): ReconciliationPlan {
    return {
      companyId: '',
      productId: '',
      action,
      unitCost,
      totalCost,
      reason,
      stockQty: state.stockQty,
      inRemaining: state.inRemaining,
      delta: state.stockQty - state.inRemaining,
    };
  }
}

export interface ReconciliationPlan {
  companyId: string;
  productId: string;
  action: 'AUTO' | 'MANUAL' | 'SKIP';
  unitCost?: Decimal;
  totalCost?: Decimal;
  reason: string;
  stockQty?: number;
  inRemaining?: number;
  delta?: number;
}

export interface ReconciliationResult {
  status: 'AUTO_RECONCILED' | 'MANUAL_REQUIRED' | 'SKIPPED' | 'FAILED';
  companyId: string;
  productId: string;
  stockQty?: number;
  inRemaining?: number;
  delta?: number;
  costPrice?: string | null;
  layerId?: string;
  reason: string;
}
