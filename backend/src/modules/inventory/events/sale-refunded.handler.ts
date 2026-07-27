import { Injectable } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { EventHandler } from '../../../common/events';
import { SaleRefundedEvent } from '../../sales/events/sale-refunded.event';
import { InventoryRepository } from '../repositories/inventory.repository';
import { PrismaService } from '../../../common/prisma';

/**
 * Handles `sale.refunded` events by restoring stock for each returned item.
 * Runs inside the originating transaction via `context.transactionClient`.
 */
@Injectable()
export class SaleRefundedEventHandler implements EventHandler<SaleRefundedEvent> {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
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
        const rowVer = (stock as Record<string, any>).rowVersion ?? 0;
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
  }
}
