import { BadRequestException, Injectable } from '@nestjs/common';
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
      const reservedQty = stock?.reservedQuantity ?? 0;

      // Strict stock (Policy A): never sell more than is available. The
      // conditional update below also guards against concurrent sales racing
      // on the same stock row, so oversell is rejected under all conditions.
      if (beforeQty - reservedQty < item.quantity) {
        throw new BadRequestException('Insufficient stock');
      }

      const afterQty = beforeQty - item.quantity;

      if (stock) {
        // Atomic decrement: the WHERE re-check runs on the committed row, so
        // a concurrent decrement that leaves insufficient stock makes this
        // update match 0 rows and the sale transaction rolls back.
        const result = await tx.stock.updateMany({
          where: {
            id: stock.id,
            companyId: event.payload.companyId,
            quantity: { gte: item.quantity + reservedQty },
          },
          data: {
            quantity: { decrement: item.quantity },
            availableQuantity: { decrement: item.quantity },
            rowVersion: { increment: 1 },
          },
        });
        if (result.count === 0) {
          throw new BadRequestException('Insufficient stock');
        }
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
