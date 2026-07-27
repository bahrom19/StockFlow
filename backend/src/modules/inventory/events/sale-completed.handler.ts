import { Injectable } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { EventHandler } from '../../../common/events';
import { SaleCompletedEvent } from '../../sales/events/sale-completed.event';
import { InventoryRepository } from '../repositories/inventory.repository';
import { PrismaService } from '../../../common/prisma';

/**
 * Handles `sale.completed` events by decreasing stock for each sold item.
 *
 * This handler replaces the direct stock manipulation in SalesService.completeSale().
 * It runs inside the originating transaction via `context.transactionClient`.
 */
@Injectable()
export class SaleCompletedEventHandler implements EventHandler<SaleCompletedEvent> {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly prismaService: PrismaService,
  ) {}

  async handle(
    event: SaleCompletedEvent,
    context?: Record<string, any>,
  ): Promise<void> {
    const tx = context?.transactionClient ?? this.prismaService;

    for (const item of event.payload.items) {
      const stock =
        await this.inventoryRepository.findStockByProductAndWarehouse(
          item.productId,
          event.payload.warehouseId,
          event.payload.companyId,
          tx,
        );

      const beforeQty = stock?.quantity ?? 0;
      const afterQty = Math.max(0, beforeQty - item.quantity);

      if (stock) {
        const rowVer = (stock as Record<string, any>).rowVersion ?? 0;
        await this.inventoryRepository.updateStock(
          stock.id,
          {
            quantity: afterQty,
            availableQuantity: Math.max(0, afterQty - stock.reservedQuantity),
          },
          event.payload.companyId,
          rowVer,
          tx,
        );
      }

      await tx.stockMovement.create({
        data: {
          companyId: event.payload.companyId,
          productId: item.productId,
          warehouseId: event.payload.warehouseId,
          type: StockMovementType.SALE,
          quantity: -item.quantity,
          beforeQuantity: beforeQty,
          afterQuantity: afterQty,
          referenceType: 'SALE',
          referenceId: event.payload.saleId,
          comment: `Sale ${event.payload.saleNumber}`,
          createdBy: event.payload.cashierId,
        },
      });
    }
  }
}
