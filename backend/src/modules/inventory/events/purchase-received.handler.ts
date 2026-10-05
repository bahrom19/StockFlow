import { Injectable, Logger } from '@nestjs/common';
import { StockMovementType, StockStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { EventHandler } from '../../../common/events';
import { PrismaService } from '../../../common/prisma';
import { InventoryRepository } from '../repositories/inventory.repository';

/**
 * Generic event payload for purchase received events.
 * In a fully event-driven system, Purchasing module would publish this event.
 */
export interface PurchaseReceivedPayload {
  purchaseOrderId: string;
  companyId: string;
  warehouseId: string;
  receivedBy: string;
  receiptNumber: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitCost: string;
    batchNumber?: string;
    expiryDate?: string;
  }>;
}

/**
 * Handles purchase received events by increasing stock for each received item.
 *
 * Creates stock records, cost layers, and optionally batch/lot tracking.
 * Runs inside the originating transaction.
 *
 * G16-N-4 P2 idempotency — the durable marker is the RECEIPT, not the order.
 * One purchase order legitimately accepts MANY receipts (a PO stays
 * receivable while PARTIALLY_RECEIVED), so `purchaseOrderId` must NEVER be
 * used as a duplicate key: doing so would silently discard the stock and
 * accrual of every receipt after the first. The marker is
 * `receiptNumber` — client generated exactly once per logical receipt and
 * already enforced by `@@unique([companyId, receiptNumber])` on GoodsReceipt.
 *
 * The existing movement `referenceType`/`referenceId` semantics are
 * deliberately left untouched (`PURCHASE_RECEIPT` / `purchaseOrderId`), so
 * the marker rides on `clientOperationId`, which reuses the existing
 * `@@unique([companyId, clientOperationId, type])` constraint — no migration.
 * It is suffixed with the item index because a single receipt legitimately
 * writes several PURCHASE movements, and two lines of one receipt may carry
 * the same product; the suffix keeps every write unique so a legitimate
 * receipt can never trip P2002.
 *
 * KNOWN LIMITATION (design D-2, accepted): the pre-loop marker read is a
 * replay guard, not a concurrent-delivery lock. A true concurrent duplicate
 * of a MULTI-ITEM receipt is only stopped from the second item onward by the
 * per-item unique. Closing that fully needs a dedicated applied-event table,
 * which is deferred; this is recorded rather than papered over.
 *
 * G16-N-4 P2 transaction context — `transactionClient` is MANDATORY (was
 * `?? this.prismaService`, which would have written stock and cost layers
 * outside the goods-receipt transaction).
 */
@Injectable()
export class PurchaseReceivedEventHandler implements EventHandler {
  private readonly logger = new Logger(PurchaseReceivedEventHandler.name);

  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly prismaService: PrismaService,
  ) {}

  async handle(
    event: { eventName: string; payload: PurchaseReceivedPayload },
    context?: Record<string, any>,
  ): Promise<void> {
    const payload = event.payload;
    const tx = context?.transactionClient;
    if (!tx) {
      throw new Error(
        `No transaction context for purchase.received event (receipt ${payload.receiptNumber}). Stock and cost layers cannot be written outside the goods-receipt transaction.`,
      );
    }

    // G16-N-4 P2: duplicate delivery of the SAME receipt → clean no-op.
    // Scoped to the receipt, never to the purchase order.
    const markerPrefix = `PURCHASE_RECEIPT:${payload.receiptNumber}:`;
    const alreadyApplied = await tx.stockMovement.findFirst({
      where: {
        companyId: payload.companyId,
        clientOperationId: { startsWith: markerPrefix },
      },
      select: { id: true },
    });
    if (alreadyApplied) {
      this.logger.log(
        `purchase.received for receipt ${payload.receiptNumber} was already applied — skipping duplicate.`,
      );
      return;
    }

    for (const [itemIndex, item] of payload.items.entries()) {
      let stock = await this.inventoryRepository.findStockByProductAndWarehouse(
        item.productId,
        payload.warehouseId,
        payload.companyId,
        tx,
      );

      const beforeQty = stock?.quantity ?? 0;
      const afterQty = beforeQty + item.quantity;
      const unitCost = new Decimal(item.unitCost);

      if (stock) {
        const rowVer = stock.rowVersion ?? 0;
        await this.inventoryRepository.updateStock(
          stock.id,
          {
            quantity: afterQty,
            availableQuantity: afterQty - (stock?.reservedQuantity ?? 0),
          },
          payload.companyId,
          rowVer,
          tx,
        );
      } else {
        stock = await this.inventoryRepository.createStock(
          {
            product: { connect: { id: item.productId } },
            warehouse: { connect: { id: payload.warehouseId } },
            company: { connect: { id: payload.companyId } },
            quantity: item.quantity,
            reservedQuantity: 0,
            availableQuantity: item.quantity,
          },
          tx,
        );
      }

      // Create batch if batch number provided
      let batchId: string | undefined;
      if (item.batchNumber) {
        const batch = await tx.batch.create({
          data: {
            product: { connect: { id: item.productId } },
            company: { connect: { id: payload.companyId } },
            batchNumber: item.batchNumber,
            quantity: item.quantity,
            availableQuantity: item.quantity,
            unitCost,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            receivedDate: new Date(),
            status: StockStatus.AVAILABLE,
          },
        });
        batchId = batch.id;
      }

      // Create cost layer for average/FIFO costing
      await tx.costLayer.create({
        data: {
          companyId: payload.companyId,
          productId: item.productId,
          batchId,
          direction: 'IN',
          quantity: item.quantity,
          remainingQuantity: item.quantity,
          unitCost,
          totalCost: unitCost.mul(item.quantity),
          referenceType: 'PURCHASE',
          referenceId: payload.purchaseOrderId,
        },
      });

      await tx.stockMovement.create({
        data: {
          companyId: payload.companyId,
          productId: item.productId,
          warehouseId: payload.warehouseId,
          type: StockMovementType.PURCHASE,
          quantity: item.quantity,
          beforeQuantity: beforeQty,
          afterQuantity: afterQty,
          referenceType: 'PURCHASE_RECEIPT',
          referenceId: payload.purchaseOrderId,
          // G16-N-4 P2: receipt-scoped operation identity — the duplicate
          // marker for this event. Unique per item so a multi-item receipt
          // never collides with itself.
          clientOperationId: `${markerPrefix}${itemIndex}`,
          comment: `Goods receipt ${payload.receiptNumber}`,
          createdBy: payload.receivedBy,
        },
      });
    }
  }
}
