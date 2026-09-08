import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainEvent, EventHandler } from '../../../common/events';
import { PurchaseOrderStatusChangedEvent } from '../../purchasing/events/purchase-order-status-changed.event';
import { NotificationsService } from '../notifications.service';

/**
 * PURCHASE_ORDER_STATUS_CHANGED notification consumer (N3).
 *
 * Fan-out targets all active company members except the actor (`changedBy`).
 * Receipt-driven transitions publish `changedBy: null` → everyone is notified.
 *
 * NEVER-THROW: runs synchronously inside the PO lifecycle transaction — any
 * failure is caught and logged so notifications can never break purchasing.
 */
@Injectable()
export class PurchaseOrderStatusNotificationHandler implements EventHandler<DomainEvent> {
  private readonly logger = new Logger(
    PurchaseOrderStatusNotificationHandler.name,
  );

  constructor(private readonly notificationsService: NotificationsService) {}

  async handle(
    event: DomainEvent,
    context?: Record<string, unknown>,
  ): Promise<void> {
    if (event.eventName !== 'purchase.order.status.changed') return;
    try {
      const tx =
        (context?.transactionClient as Prisma.TransactionClient | undefined) ??
        undefined;
      await this.notificationsService.notifyPurchaseOrderStatusChanged(
        (event as PurchaseOrderStatusChangedEvent).payload,
        tx,
      );
    } catch (error) {
      this.logger.warn(
        `PO status notification skipped (${event.eventId}): ${
          (error as Error).message
        }`,
      );
    }
  }
}
