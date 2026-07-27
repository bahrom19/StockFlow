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
    const tx = context?.transactionClient ?? this.prismaService;
    const payload = event.payload;

    for (const item of payload.items) {
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
        const rowVer = (stock as Record<string, any>).rowVersion ?? 0;
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
          comment: `Goods receipt ${payload.receiptNumber}`,
          createdBy: payload.receivedBy,
        },
      });
    }
  }
}
