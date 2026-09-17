import { Injectable, Logger } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EventHandler } from '../../../common/events';
import { SalePartiallyRefundedEvent } from '../../sales/events/sale-partially-refunded.event';
import { InventoryRepository } from '../repositories/inventory.repository';
import { CostingService } from '../services/costing.service';
import { PrismaService } from '../../../common/prisma';

/**
 * Handles `sale.partially_refunded` events by restoring stock for each
 * refunded line and re-entering the refunded historical cost value into the
 * FIFO pool (G11-E E3).
 *
 * Canonical facts (locked G11-E design):
 * - restore quantity = `SalesRefundItem.quantity` (from the event payload —
 *   NEVER the original SaleItem quantity);
 * - restore cost     = `SalesRefundItem.fifoCost` (from the event payload —
 *   preserved exactly; CostLayer OUT rows are never read and the cost is
 *   never re-FIFO'd or derived from SaleItem.costPrice).
 *
 * Idempotency (no schema change): StockMovement rows for the refund
 * (`referenceType='REFUND'`, `referenceId=refundId`, `companyId`) act as the
 * durable application marker — insert-only, company-scoped, so a refundId
 * collision across tenants cannot cross-contaminate. A second delivery of the
 * same event finds prior movements and returns without restoring anything.
 *
 * Runs inside the originating transaction via `context.transactionClient`,
 * so stock, CostLayers, movements and the refund itself commit or roll back
 * atomically.
 */
@Injectable()
export class SalePartiallyRefundedEventHandler
  implements EventHandler<SalePartiallyRefundedEvent>
{
  private readonly logger = new Logger(SalePartiallyRefundedEventHandler.name);

  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly costingService: CostingService,
    private readonly prismaService: PrismaService,
  ) {}

  async handle(
    event: SalePartiallyRefundedEvent,
    context?: Record<string, any>,
  ): Promise<void> {
    const tx = context?.transactionClient ?? this.prismaService;

    // ── Idempotency gate ────────────────────────────────────────────
    // A second delivery of the same refund event must be a complete no-op.
    // In the publisher's model the event is executed synchronously inside
    // the winning transaction (single-writer per Sale via the rowVersion
    // CAS), so this marker check is safe there; if the delivery model ever
    // changes (e.g. outbox re-drive), the marker read remains the guard.
    const alreadyApplied = await tx.stockMovement.findFirst({
      where: {
        companyId: event.payload.companyId,
        referenceType: 'REFUND',
        referenceId: event.payload.refundId,
      },
      select: { id: true },
    });
    if (alreadyApplied) {
      this.logger.log(
        `sale.partially_refunded for refund ${event.payload.refundNumber} (${event.payload.refundId}) was already applied — skipping duplicate restore.`,
      );
      return;
    }

    for (const item of event.payload.items) {
      if (item.quantity <= 0) {
        // Persisted refund facts are validated upstream (E2); a non-positive
        // quantity here would be a contract violation — fail the transaction.
        throw new Error(
          `Invalid refund item quantity ${item.quantity} for product ${item.productId} in refund ${event.payload.refundNumber}`,
        );
      }

      let refundCost: Decimal;
      try {
        refundCost = new Decimal(item.fifoCost);
      } catch {
        throw new Error(
          `Invalid refund fifoCost "${item.fifoCost}" for product ${item.productId} in refund ${event.payload.refundNumber}`,
        );
      }
      if (!refundCost.isFinite()) {
        throw new Error(
          `Invalid refund fifoCost "${item.fifoCost}" for product ${item.productId} in refund ${event.payload.refundNumber}`,
        );
      }

      const stock = await this.inventoryRepository.findStockByProductAndWarehouse(
        item.productId,
        event.payload.warehouseId,
        event.payload.companyId,
        tx,
      );

      const beforeQty = stock?.quantity ?? 0;
      const afterQty = beforeQty + item.quantity;

      if (stock) {
        await this.inventoryRepository.updateStock(
          stock.id,
          {
            quantity: afterQty,
            availableQuantity: afterQty - stock.reservedQuantity,
          },
          event.payload.companyId,
          stock.rowVersion ?? 0,
          tx,
        );
      } else {
        await this.inventoryRepository.createStock(
          {
            product: { connect: { id: item.productId } },
            warehouse: { connect: { id: event.payload.warehouseId } },
            company: { connect: { id: event.payload.companyId } },
            quantity: afterQty,
            reservedQuantity: 0,
            availableQuantity: afterQty,
          },
          tx,
        );
      }

      // Exactly one movement per refund line; the (companyId, REFUND,
      // refundId) marker doubles as the idempotency record.
      await tx.stockMovement.create({
        data: {
          companyId: event.payload.companyId,
          productId: item.productId,
          warehouseId: event.payload.warehouseId,
          type: StockMovementType.RETURN,
          quantity: item.quantity,
          beforeQuantity: beforeQty,
          afterQuantity: afterQty,
          referenceType: 'REFUND',
          referenceId: event.payload.refundId,
          comment: `Partial refund ${event.payload.refundNumber} for sale ${event.payload.saleNumber}`,
          createdBy: event.payload.createdBy,
        },
      });

      // Restore the exact historical cost value persisted on the refund line.
      // referenceType/referenceId identify the REFUND (not the sale), so
      // IN layers of different refunds of the same sale stay distinct.
      await this.costingService.restoreRefundLayer(
        item.productId,
        event.payload.companyId,
        item.quantity,
        refundCost,
        'REFUND',
        event.payload.refundId,
        tx,
      );
    }
  }
}
