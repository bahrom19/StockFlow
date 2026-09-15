import { Injectable, Logger } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EventHandler } from '../../../common/events';
import { SaleRefundedEvent } from '../../sales/events/sale-refunded.event';
import { InventoryRepository } from '../repositories/inventory.repository';
import { CostingService } from '../services/costing.service';
import { PrismaService } from '../../../common/prisma';

/**
 * Handles `sale.refunded` events by restoring stock for each returned item
 * and (G9-F3) restoring the FIFO cost value of the refunded goods through IN
 * CostLayers derived from the sale's own OUT layers.
 * Runs inside the originating transaction via `context.transactionClient`.
 */
@Injectable()
export class SaleRefundedEventHandler implements EventHandler<SaleRefundedEvent> {
  private readonly logger = new Logger(SaleRefundedEventHandler.name);

  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly costingService: CostingService,
    private readonly prismaService: PrismaService,
  ) {}

  async handle(
    event: SaleRefundedEvent,
    context?: Record<string, any>,
  ): Promise<void> {
    const tx = context?.transactionClient ?? this.prismaService;

    for (const item of event.payload.items) {
      let stock = await this.inventoryRepository.findStockByProductAndWarehouse(
        item.productId,
        event.payload.warehouseId,
        event.payload.companyId,
        tx,
      );

      const beforeQty = stock?.quantity ?? 0;
      const afterQty = beforeQty + item.quantity;

      if (stock) {
        const rowVer = stock.rowVersion ?? 0;
        await this.inventoryRepository.updateStock(
          stock.id,
          {
            quantity: afterQty,
            availableQuantity: afterQty - stock.reservedQuantity,
          },
          event.payload.companyId,
          rowVer,
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
          referenceId: event.payload.saleId,
          comment: `Refund for sale ${event.payload.saleNumber}`,
          createdBy: event.payload.cashierId,
        },
      });
    }

    // G9-F3: restore the FIFO cost value of the refunded goods. Uses the SAME
    // transaction client, so the IN layers commit or roll back together with
    // the stock restore, the refund journal and the sale status update.
    await this.restoreCostLayers(event, tx);
  }

  /**
   * G9-F3: restore the cost value of refunded items by writing IN CostLayers
   * priced at the weighted average unit cost of the sale's own OUT layers
   * (referenceType='SALE', referenceId=saleId). Follows the approved
   * resolveSaleCogs coverage ladder — FIFO and legacy bases are never mixed:
   *
   * - full OUT coverage  → restore the exact value (restoreLayer);
   * - no OUT layers      → legacy sale: nothing to restore; the Finance
   *                        handler falls back to the legacy SaleItem.costPrice
   *                        basis for the COGS reversal (approved path);
   * - partial/excess     → data anomaly: NO partial or over-restore
   *                        (fail-safe), error-logged; the Finance handler's
   *                        ladder uses the full legacy basis.
   *
   * restoreLayer is not idempotent, but a refund can only be processed once:
   * the transition is guarded by the sale rowVersion CAS, REFUNDED is a
   * terminal status, and the event is published once inside the winning
   * transaction — so no additional idempotency architecture is added.
   */
  private async restoreCostLayers(
    event: SaleRefundedEvent,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    // Aggregate refund quantities per product: a multi-item sale can contain
    // the same product in several items, and OUT coverage must be evaluated
    // against the product's TOTAL refunded quantity, never per item.
    const expectedQtyByProduct = new Map<string, number>();
    for (const item of event.payload.items) {
      expectedQtyByProduct.set(
        item.productId,
        (expectedQtyByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }

    for (const [productId, expectedQuantity] of expectedQtyByProduct) {
      const outLayers = await this.costingService.findOutLayersByReferenceAndProduct(
        event.payload.companyId,
        'SALE',
        event.payload.saleId,
        productId,
        tx,
      );

      // Legacy sale (pre-G9-F2, no persisted OUT layers): the legacy
      // costPrice fallback applies end-to-end; no layer restore.
      if (outLayers.length === 0) {
        continue;
      }

      let layerQuantity = 0;
      let layerTotalCost = new Decimal(0);
      for (const layer of outLayers) {
        layerQuantity += layer.quantity;
        layerTotalCost = layerTotalCost.add(
          new Decimal(layer.totalCost.toString()),
        );
      }

      if (layerQuantity !== expectedQuantity) {
        // Anomaly: OUT coverage does not match the refunded quantity. Never
        // restore a partial or excessive value — skip the restore and log at
        // error level so ops can follow up; the Finance COGS ladder resolves
        // the reversal with the full legacy basis (no FIFO/legacy mixing).
        this.logger.error(
          `FIFO restore anomaly for sale ${event.payload.saleId}, product ${productId}: OUT layers cover ${layerQuantity} units but refund expects ${expectedQuantity} — skipping CostLayer restore (no partial FIFO restore; FIFO and legacy are never mixed).`,
        );
        continue;
      }

      // Full coverage: restore the exact VALUE at the weighted average unit
      // cost of the sale's own OUT layers. restoreLayer writes the IN layer
      // inside this transaction and preserves the original value basis.
      const averageUnitCost = layerTotalCost.div(layerQuantity);
      await this.costingService.restoreLayer(
        productId,
        event.payload.companyId,
        expectedQuantity,
        averageUnitCost,
        'REFUND_RESTORE',
        event.payload.saleId,
        tx,
      );
    }
  }
}
