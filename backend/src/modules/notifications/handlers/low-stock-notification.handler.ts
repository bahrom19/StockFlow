import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainEvent, EventHandler } from '../../../common/events';
import { PrismaService } from '../../../common/prisma';
import { InventoryAdjustedEvent } from '../../inventory/events/inventory-adjusted.event';
import { InventoryTransferredEvent } from '../../inventory/events/inventory-transferred.event';
import { SaleCompletedEvent } from '../../sales/events/sale-completed.event';
import {
  LOW_STOCK_THRESHOLD,
  NotificationsService,
} from '../notifications.service';

/**
 * LOW_STOCK notification consumer (N3).
 *
 * Subscribed to `inventory.adjusted`, `inventory.transferred` and
 * `sale.completed`. Threshold mirrors the existing reports behaviour
 * (quantity <= 5, hardcoded — per-product reorder levels are a future
 * workstream).
 *
 * NEVER-THROW: this handler runs synchronously inside the originating
 * business transaction (EventBus contract), so every failure is caught and
 * logged — a notification problem must never break an adjustment, sale or
 * transfer.
 */
@Injectable()
export class LowStockNotificationHandler implements EventHandler<DomainEvent> {
  private readonly logger = new Logger(LowStockNotificationHandler.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly prismaService: PrismaService,
  ) {}

  async handle(
    event: DomainEvent,
    context?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const tx =
        (context?.transactionClient as Prisma.TransactionClient | undefined) ??
        undefined;

      switch (event.eventName) {
        case 'inventory.adjusted':
          await this.handleAdjusted(event as InventoryAdjustedEvent, tx);
          break;
        case 'inventory.transferred':
          await this.handleTransferred(event as InventoryTransferredEvent, tx);
          break;
        case 'sale.completed':
          await this.handleSaleCompleted(event as SaleCompletedEvent, tx);
          break;
        default:
          break;
      }
    } catch (error) {
      this.logger.warn(
        `Low-stock notification skipped (${event.eventName} ${event.eventId}): ${
          (error as Error).message
        }`,
      );
    }
  }

  /** Primary trigger — the payload carries the trusted `afterQuantity`. */
  private async handleAdjusted(
    event: InventoryAdjustedEvent,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const { companyId, productId, warehouseId, afterQuantity } = event.payload;
    if (afterQuantity > LOW_STOCK_THRESHOLD) return;
    await this.notificationsService.notifyLowStock(
      companyId,
      productId,
      warehouseId,
      afterQuantity,
      tx,
    );
  }

  /**
   * Both affected warehouses are checked against the actual stock rows.
   * Same dedupe key per (product, warehouse) → no duplicate when a warehouse
   * is already notified.
   */
  private async handleTransferred(
    event: InventoryTransferredEvent,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const { companyId, productId, fromWarehouseId, toWarehouseId } =
      event.payload;
    for (const warehouseId of [fromWarehouseId, toWarehouseId]) {
      const quantity = await this.readStockQuantity(
        companyId,
        productId,
        warehouseId,
        tx,
      );
      if (quantity === null || quantity > LOW_STOCK_THRESHOLD) continue;
      await this.notificationsService.notifyLowStock(
        companyId,
        productId,
        warehouseId,
        quantity,
        tx,
      );
    }
  }

  /**
   * The sale payload has no post-sale quantity — read the actual stock row
   * AFTER the inventory handler's decrement (handler ordering is guaranteed
   * by module registration order). Missing stock → skip silently.
   */
  private async handleSaleCompleted(
    event: SaleCompletedEvent,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const { companyId, warehouseId, items } = event.payload;
    // Sale is single-warehouse (payload-level warehouseId); dedupe identical
    // product pairs so one sale with duplicate lines reads stock only once.
    const productIds = [...new Set(items.map((i) => i.productId))];
    for (const productId of productIds) {
      const quantity = await this.readStockQuantity(
        companyId,
        productId,
        warehouseId,
        tx,
      );
      if (quantity === null || quantity > LOW_STOCK_THRESHOLD) continue;
      await this.notificationsService.notifyLowStock(
        companyId,
        productId,
        warehouseId,
        quantity,
        tx,
      );
    }
  }

  private async readStockQuantity(
    companyId: string,
    productId: string,
    warehouseId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number | null> {
    const client = tx ?? this.prismaService;
    const stock = await client.stock.findFirst({
      where: { companyId, productId, warehouseId },
      select: { quantity: true },
    });
    return stock?.quantity ?? null;
  }
}
