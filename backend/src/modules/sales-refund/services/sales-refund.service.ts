import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RefundStatus, Sale, SaleItem, SaleStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { AuditLogService } from '../../shared/services/audit-log.service';
import {
  DocumentSequenceService,
  DocumentSequenceType,
} from '../../shared/services/document-sequence.service';
import { SalesRepository } from '../../sales/repositories/sales.repository';
import { CashShiftRepository } from '../../sales/repositories/cash-shift.repository';
import { allocateShiftSales } from '../../sales/services/payment-allocation';
import { SaleRefundedEvent } from '../../sales/events/sale-refunded.event';
import { SalePartiallyRefundedEvent } from '../../sales/events/sale-partially-refunded.event';
import { RefundPaymentAllocationService } from './refund-payment-allocation.service';
import {
  SalesRefundPreviousAggregate,
  SalesRefundRepository,
} from '../repositories/sales-refund.repository';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { SalesRefundEntity } from '../entities/sales-refund.entity';
import { SalesRefundMapper } from '../mappers/sales-refund.mapper';
import type { RefundAllocationFact } from './refund-payment-allocation.service';

/** Monetary/historical-cost scale — matches Decimal(18,4) columns. */
const MONEY_SCALE = 4;

/** One server-computed refund line (client never supplies these numbers). */
interface RefundLine {
  saleItem: SaleItem;
  quantity: number;
  isFinal: boolean;
  unitPrice: Decimal;
  total: Decimal;
  fifoCost: Decimal;
}

function toDecimal(
  value: string | number | Decimal | null | undefined,
): Decimal {
  if (value == null) return new Decimal(0);
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

/**
 * G11-E E2 — SalesRefund domain service.
 *
 * Owns the refund lifecycle: validation of remaining quantities, server-side
 * amount + historical-cost derivation, aggregate creation, refund-derived Sale
 * status, optimistic-concurrency (rowVersion CAS), audit, and the LEGACY
 * single-shot full-refund side effects (cash shift + SaleRefundedEvent).
 *
 * Out of scope (E3/E4/E5/E6): inventory restoration, GL posting, monetary
 * `SaleRefundedEvent` redesign for the partial lifecycle, and payment
 * allocation.
 */
@Injectable()
export class SalesRefundService {    constructor(
    private readonly prismaService: PrismaService,
    private readonly salesRepository: SalesRepository,
    private readonly cashShiftRepository: CashShiftRepository,
    private readonly salesRefundRepository: SalesRefundRepository,
    private readonly documentSequenceService: DocumentSequenceService,
    private readonly auditLog: AuditLogService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  /**
   * G11-E5 — bucket-level refund payment allocation. A stateless pure domain
   * service (no injected infrastructure — everything flows through the tx
   * client), so it is instantiated directly; this keeps the module provider
   * list and the DI graph unchanged.
   */
  private readonly refundPaymentAllocation = new RefundPaymentAllocationService();

  /**
   * Refund the given quantities (or ALL remaining quantities when `items` is
   * omitted/empty) of a sale. Runs entirely inside ONE transaction.
   */
  async createRefund(
    saleId: string,
    dto: CreateRefundDto,
    userId: string,
    companyId: string,
  ): Promise<SalesRefundEntity> {
    return this.prismaService.$transaction((tx) =>
      this.createRefundInTransaction(saleId, dto, userId, companyId, tx),
    );
  }

  /**
   * Compatibility semantics for `POST /sales/:id/refund`:
   * refund ALL REMAINING quantities (never the original quantities).
   */
  async refundAllRemaining(
    saleId: string,
    userId: string,
    companyId: string,
    dto?: Pick<CreateRefundDto, 'reason' | 'reference'>,
  ): Promise<SalesRefundEntity> {
    return this.createRefund(
      saleId,
      { items: undefined, reason: dto?.reason, reference: dto?.reference },
      userId,
      companyId,
    );
  }

  async findById(
    id: string,
    companyId: string,
  ): Promise<SalesRefundEntity> {
    const refund = await this.salesRefundRepository.findById(id, companyId);
    if (!refund) throw new NotFoundException(`SalesRefund ${id} not found`);
    return SalesRefundMapper.toEntity(refund);
  }

  async findBySaleId(
    saleId: string,
    companyId: string,
  ): Promise<SalesRefundEntity[]> {
    const refunds = await this.salesRefundRepository.findBySaleId(
      saleId,
      companyId,
    );
    return refunds.map((r) => SalesRefundMapper.toEntity(r));
  }

  private async createRefundInTransaction(
    saleId: string,
    dto: CreateRefundDto,
    userId: string,
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<SalesRefundEntity> {
    // 1-2. Load the Sale tenant-safely (id + companyId + not deleted).
    const sale = await this.salesRepository.findById(saleId, companyId, tx);
    if (!sale) throw new NotFoundException(`Sale ${saleId} not found`);

    // 3. Validate the sale state. Refund statuses are refund-derived, so they
    // can only be reached from COMPLETED (never previously partially refunded)
    // or PARTIALLY_REFUNDED.
    if (sale.status === SaleStatus.REFUNDED) {
      throw new BadRequestException(
        `Sale ${sale.saleNumber} is already fully refunded`,
      );
    }
    if (
      sale.status !== SaleStatus.COMPLETED &&
      sale.status !== SaleStatus.PARTIALLY_REFUNDED
    ) {
      throw new BadRequestException(
        `Cannot refund a sale in ${sale.status} status. Only COMPLETED or PARTIALLY_REFUNDED sales can be refunded.`,
      );
    }

    // Capture the CAS token BEFORE any mutation in this transaction.
    const expectedRowVersion = sale.rowVersion ?? 0;

    // 4. Load the sale's items (all item-level refund math is per SaleItem).
    const saleItems = await tx.saleItem.findMany({
      where: { saleId: sale.id },
      orderBy: { createdAt: 'asc' },
    });
    if (saleItems.length === 0) {
      throw new BadRequestException(`Sale ${sale.saleNumber} has no items`);
    }
    const itemById = new Map<string, SaleItem>();
    for (const item of saleItems) itemById.set(item.id, item);

    // 5. Aggregate the durable COMPLETED refund facts (source of truth).
    const previous = await this.salesRefundRepository.aggregateCompletedBySaleItem(
      sale.id,
      companyId,
      tx,
    );

    // 6. Resolve the requested quantities (deduplicated per SaleItem).
    const requested = this.resolveRequestedQuantities(dto, saleItems, previous);

    if (requested.size === 0) {
      throw new BadRequestException(
        `Sale ${sale.saleNumber} has no remaining refundable quantities`,
      );
    }

    // 7. Validate every requested quantity against the remaining quantity.
    for (const [saleItemId, quantity] of requested) {
      const saleItem = itemById.get(saleItemId);
      if (!saleItem) {
        throw new BadRequestException(
          `SaleItem ${saleItemId} does not belong to sale ${sale.saleNumber}`,
        );
      }
      const already = previous.get(saleItemId)?.quantity ?? 0;
      const remaining = saleItem.quantity - already;

      if (quantity <= 0) {
        throw new BadRequestException(
          `Refund quantity must be greater than zero (SaleItem ${saleItemId})`,
        );
      }
      if (remaining <= 0) {
        throw new BadRequestException(
          `SaleItem ${saleItemId} is already fully refunded`,
        );
      }
      if (quantity > remaining) {
        throw new BadRequestException(
          `Cannot refund ${quantity} of SaleItem ${saleItemId}: only ${remaining} remaining of ${saleItem.quantity} (already refunded: ${already})`,
        );
      }
    }

    // 8. Derive server-side amounts and historical FIFO cost per line.
    const lines = this.buildRefundLines(requested, itemById, previous);

    // 9. Consume the tenant-scoped SALES_REFUND document number (same tx).
    const sequence = await this.documentSequenceService.nextNumber(
      companyId,
      DocumentSequenceType.SALES_REFUND,
      tx,
    );
    const refundNumber = `REF-${companyId.substring(0, 8).toUpperCase()}-${String(
      sequence,
    ).padStart(4, '0')}`;

    const refundTotal = lines.reduce(
      (acc, line) => acc.add(line.total),
      new Decimal(0),
    );

    // 10. Create the SalesRefund + its SalesRefundItems (durable facts).
    const refund = await this.salesRefundRepository.create(
      {
        companyId: sale.companyId,
        saleId: sale.id,
        warehouseId: sale.warehouseId,
        refundNumber,
        status: RefundStatus.COMPLETED,
        total: refundTotal,
        currency: sale.currency,
        reason: dto.reason ?? null,
        reference: dto.reference ?? null,
        createdBy: userId,
        items: {
          create: lines.map((line) => ({
            saleItemId: line.saleItem.id,
            productId: line.saleItem.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            total: line.total,
            fifoCost: line.fifoCost,
          })),
        },
      },
      tx,
    );

    // 11. Derive the refund-derived Sale status: REFUNDED only when EVERY
    // SaleItem reaches zero remaining quantity. Computed here (before the
    // allocation step) so the legacy single-shot full refund is known early.
    const fullyRefunded = saleItems.every((saleItem) => {
      const already = previous.get(saleItem.id)?.quantity ?? 0;
      const here = requested.get(saleItem.id) ?? 0;
      return already + here >= saleItem.quantity;
    });
    const newStatus = fullyRefunded
      ? SaleStatus.REFUNDED
      : SaleStatus.PARTIALLY_REFUNDED;
    const isLegacySingleShotFullRefund =
      sale.status === SaleStatus.COMPLETED &&
      newStatus === SaleStatus.REFUNDED;

    // 10b. G11-E5 — persist the bucket-level refund payment allocation
    // (insert-only facts) inside the SAME transaction, so the refund and its
    // payment-side allocation are atomic: a rollback removes both. Full
    // single-shot refunds (legacy path) do not need allocation rows — their
    // G11-D payment reversal reconstructs buckets from the full payments[]
    // payload — so allocation is computed only for the partial lifecycle
    // (partial or final-after-partial). Finance consumes these rows via the
    // event's transaction client (E4 handler, same tx).
    let paymentAllocationFacts: RefundAllocationFact[] = [];
    if (!isLegacySingleShotFullRefund) {
      paymentAllocationFacts = await this.refundPaymentAllocation.createForRefund(
        tx,
        {
          sale,
          salesRefundId: refund.id,
          refundTotal,
          userId,
        },
      );
    }

    // (Status derivation + legacy-refund detection moved above the allocation
    // step — see step 11.)

    // 12. CAS update the Sale using the rowVersion captured before any write.
    // A conflicting concurrent refund makes this match 0 rows and the
    // repository throws ConflictException -> the whole transaction (including
    // the SalesRefund/SalesRefundItem inserts above) rolls back.
    await this.salesRepository.updateStatus(
      sale.id,
      newStatus,
      companyId,
      expectedRowVersion,
      tx,
    );

    // 13. Audit (inside the same transaction).
    await this.auditLog.log(
      {
        companyId,
        userId,
        entityType: 'SalesRefund',
        entityId: refund.id,
        action: 'CREATED',
        before: null,
        after: {
          refundNumber,
          saleId: sale.id,
          saleNumber: sale.saleNumber,
          status: refund.status,
          total: refundTotal.toString(),
          currency: sale.currency,
          itemCount: lines.length,
        },
      },
      tx,
    );
    await this.auditLog.log(
      {
        companyId,
        userId,
        entityType: 'Sale',
        entityId: sale.id,
        action: 'STATUS_CHANGED',
        before: { status: sale.status },
        after: { status: newStatus },
      },
      tx,
    );

    // 14. LEGACY single-shot full refund only: preserve the existing cash-shift
    // reversal and publish the EXISTING SaleRefundedEvent unchanged. Partial
    // (and final-after-partial) refunds publish the NEW SalePartiallyRefundedEvent
    // (G11-E E3) instead — the two inventory events are mutually exclusive per
    // refund operation, so stock is restored exactly once. The legacy-refund
    // predicate was computed in step 11.
    if (isLegacySingleShotFullRefund) {
      await this.applyLegacyFullRefundSideEffects(
        sale,
        saleItems,
        userId,
        companyId,
        tx,
      );
    } else {
      await this.publishPartiallyRefundedEvent(sale, refund, userId, tx);
    }

    return SalesRefundMapper.toEntity(refund);
  }

  /**
   * Resolve requested quantities per SaleItem.
   *
   * - `items` omitted/empty -> ALL REMAINING quantities (compatibility path:
   *   POST /sales/:id/refund refunds what is left, never the original amount).
   * - `items` provided      -> each SaleItem must belong to this sale; duplicate
   *   lines for the same SaleItem are summed.
   */
  private resolveRequestedQuantities(
    dto: CreateRefundDto,
    saleItems: SaleItem[],
    previous: Map<string, SalesRefundPreviousAggregate>,
  ): Map<string, number> {
    const requested = new Map<string, number>();

    if (!dto.items || dto.items.length === 0) {
      for (const saleItem of saleItems) {
        const already = previous.get(saleItem.id)?.quantity ?? 0;
        const remaining = saleItem.quantity - already;
        if (remaining > 0) requested.set(saleItem.id, remaining);
      }
      return requested;
    }

    const itemById = new Map<string, SaleItem>();
    for (const saleItem of saleItems) itemById.set(saleItem.id, saleItem);

    for (const line of dto.items) {
      if (!itemById.has(line.saleItemId)) {
        throw new BadRequestException(
          `SaleItem ${line.saleItemId} does not belong to this sale`,
        );
      }
      requested.set(
        line.saleItemId,
        (requested.get(line.saleItemId) ?? 0) + line.quantity,
      );
    }
    return requested;
  }
  /**
   * Build the server-computed refund lines.
   *
   * Money: `total = SaleItem.total (net of discount) / quantity * qty`; the
   * FINAL line takes the exact remainder (`SaleItem.total - previously refunded
   * totals`) so the sum conserves the original SaleItem.total. Historical cost
   * follows the same conservation rule (see computeRefundFifoCost).
   *
   * Client-supplied money/cost is never used.
   */
  private buildRefundLines(
    requested: Map<string, number>,
    itemById: Map<string, SaleItem>,
    previous: Map<string, SalesRefundPreviousAggregate>,
  ): RefundLine[] {
    const lines: RefundLine[] = [];

    for (const [saleItemId, quantity] of requested) {
      const saleItem = itemById.get(saleItemId);
      if (!saleItem) continue; // already validated; defensive

      const aggregate = previous.get(saleItemId);
      const alreadyQuantity = aggregate?.quantity ?? 0;
      const alreadyFifoCost = aggregate?.fifoCost ?? new Decimal(0);
      const alreadyTotal = aggregate?.total ?? new Decimal(0);

      const remainingQuantity = saleItem.quantity - alreadyQuantity;
      const isFinal = quantity === remainingQuantity;

      const total = isFinal
        ? toDecimal(saleItem.total)
            .sub(alreadyTotal)
            .toDecimalPlaces(MONEY_SCALE)
        : toDecimal(saleItem.total)
            .mul(quantity)
            .div(saleItem.quantity)
            .toDecimalPlaces(MONEY_SCALE);

      const fifoCost = this.computeRefundFifoCost(
        saleItem,
        quantity,
        isFinal,
        alreadyFifoCost,
      );

      lines.push({
        saleItem,
        quantity,
        isFinal,
        unitPrice: toDecimal(saleItem.unitPrice),
        total,
        fifoCost,
      });
    }

    return lines;
  }

  /**
   * G11-E E2 frozen FIFO-cost contract.
   *
   * `SaleItem.fifoCost` is the canonical historical cost of the WHOLE
   * SaleItem quantity:
   *
   * - non-final: round(fifoCost / quantity * refundQuantity, 4)
   * - FINAL    : fifoCost - (already refunded fifoCost)   [exact remainder]
   *
   * The FINAL line must NEVER use the proportional formula — the remainder is
   * what makes `SUM(refund fifoCost) == SaleItem.fifoCost` exact under
   * Decimal(18,4) rounding (e.g. 100/3 => 33.3333 + 33.3333 + 33.3334).
   *
   * When `fifoCost` IS NULL the legacy basis `costPrice * refundQuantity` is
   * used; the basis is chosen once per SaleItem, so FIFO and legacy are never
   * mixed. CostLayer is never consulted.
   */
  private computeRefundFifoCost(
    saleItem: SaleItem,
    refundQuantity: number,
    isFinal: boolean,
    alreadyFifoCost: Decimal,
  ): Decimal {
    if (saleItem.fifoCost == null) {
      return toDecimal(saleItem.costPrice)
        .mul(refundQuantity)
        .toDecimalPlaces(MONEY_SCALE);
    }

    const original = toDecimal(saleItem.fifoCost);

    if (isFinal) {
      return original.sub(alreadyFifoCost).toDecimalPlaces(MONEY_SCALE);
    }

    return original
      .mul(refundQuantity)
      .div(saleItem.quantity)
      .toDecimalPlaces(MONEY_SCALE);
  }
  /**
   * G11-E E3 — publish `sale.partially_refunded` from the canonical
   * SalesRefund/SalesRefundItem facts, inside the originating transaction
   * (event handlers receive the tx via the event context).
   *
   * Event-scope rule (locked):
   * - COMPLETED → full refund         → legacy `sale.refunded` ONLY
   * - COMPLETED → partial             → `sale.partially_refunded`
   * - PARTIALLY_REFUNDED → partial    → `sale.partially_refunded`
   * - PARTIALLY_REFUNDED → final      → `sale.partially_refunded`
   *
   * This method is reached only for the non-legacy cases (see step 14);
   * the legacy single-shot full refund never reaches it, so the two
   * inventory events can never both fire for one refund operation.
   */
  private async publishPartiallyRefundedEvent(
    sale: Sale,
    refund: Prisma.SalesRefundGetPayload<{ include: { items: true } }>,
    userId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await this.eventBus.publish(
      new SalePartiallyRefundedEvent({
        saleId: sale.id,
        companyId: sale.companyId,
        warehouseId: sale.warehouseId,
        refundId: refund.id,
        refundNumber: refund.refundNumber,
        saleNumber: sale.saleNumber,
        total: refund.total.toString(),
        currency: refund.currency,
        createdBy: userId,
        items: refund.items.map((item) => ({
          productId: item.productId,
          saleItemId: item.saleItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          total: item.total.toString(),
          fifoCost: item.fifoCost.toString(),
        })),
      }),
      { context: { transactionClient: tx } },
    );
  }

  /**
   * LEGACY full-refund side effects — preserved VERBATIM from the previous
   * `SalesService.refundSale()` for the single-shot full refund only:
   *
   *  1. net the refund out of the linked OPEN cash shift using the EXACT
   *     original per-method payment composition (guarded by the shift's own
   *     rowVersion CAS — a stale shift throws ConflictException and rolls the
   *     refund back);
   *  2. publish the EXISTING `SaleRefundedEvent` (contract unchanged), which the
   *     Inventory and Finance handlers already consume.
   *
   * Partial refunds deliberately do NOT run this: partial payment/shift
   * allocation is E6, and partial inventory/GL/event handling is E3/E4/E5.
   */
  private async applyLegacyFullRefundSideEffects(
    sale: Sale,
    saleItems: SaleItem[],
    userId: string,
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (sale.cashShiftId) {
      const shift = await tx.cashShift.findFirst({
        where: { id: sale.cashShiftId, companyId },
      });
      if (shift && shift.status === 'OPEN') {
        const payments = await tx.payment.findMany({
          where: { saleId: sale.id },
        });
        const allocation = allocateShiftSales(payments);
        const changeAmount = toDecimal(sale.changeAmount);
        const cashSalesNet = allocation.cash.sub(changeAmount);
        const saleTotal = toDecimal(sale.total);

        await this.cashShiftRepository.update(
          shift.id,
          {
            cashSales: toDecimal(shift.cashSales).sub(cashSalesNet),
            cardSales: toDecimal(shift.cardSales).sub(allocation.card),
            qrSales: toDecimal(shift.qrSales).sub(allocation.qr),
            bankTransferSales: toDecimal(shift.bankTransferSales).sub(
              allocation.bankTransfer,
            ),
            mobileWalletSales: toDecimal(shift.mobileWalletSales).sub(
              allocation.mobileWallet,
            ),
            totalSales: toDecimal(shift.totalSales).sub(saleTotal),
          },
          companyId,
          shift.rowVersion ?? 0,
          tx,
        );
      }
    }

    const payments = await tx.payment.findMany({ where: { saleId: sale.id } });
    await this.eventBus.publish(
      new SaleRefundedEvent({
        saleId: sale.id,
        companyId,
        warehouseId: sale.warehouseId,
        cashierId: userId,
        saleNumber: sale.saleNumber,
        total: sale.total.toString(),
        currency: sale.currency,
        items: saleItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          costPrice: item.costPrice.toString(),
          discount: item.discount.toString(),
          subtotal: item.subtotal.toString(),
          total: item.total.toString(),
          margin: item.margin.toString(),
        })),
        payments: payments.map((payment) => ({
          method: payment.method,
          amount: payment.amount.toString(),
        })),
      }),
      { context: { transactionClient: tx } },
    );
  }
}
