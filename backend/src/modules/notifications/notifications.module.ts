import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { EventBus, EVENT_BUS } from '../../common/events';
import { PrismaModule } from '../../common/prisma';
import { NotificationRepository } from './repositories/notification.repository';
import { OverdueInvoiceRepository } from './repositories/overdue-invoice.repository';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { LowStockNotificationHandler } from './handlers/low-stock-notification.handler';
import { PurchaseOrderStatusNotificationHandler } from './handlers/purchase-order-status-notification.handler';
import { OverdueNotificationCronService } from './scheduler/overdue-notification-cron.service';

/**
 * Notifications Foundation V1 (N3+N4) — backend creation + REST API.
 *
 * Consumes existing domain events plus the new generic PO status event and
 * fans out Notification rows to all active company members.
 * N4 adds the REST API (list, unread-count, mark-read) via NotificationsController.
 *
 * Handler ordering: `sale.completed` subscriptions carry explicit EventBus
 * priorities (G16-E) — Inventory 10 → Finance 20 → Notifications 30 — so a
 * low-stock check always reads the post-decrement stock inside the same
 * transaction, regardless of module import or init order.
 */
@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationRepository,
    OverdueInvoiceRepository,
    NotificationsService,
    LowStockNotificationHandler,
    PurchaseOrderStatusNotificationHandler,
    OverdueNotificationCronService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly lowStockHandler: LowStockNotificationHandler,
    private readonly poStatusHandler: PurchaseOrderStatusNotificationHandler,
  ) {}

  onModuleInit(): void {
    // G16-E: priority 30 — runs LAST on sale.completed so the low-stock
    // check reads the post-decrement stock created by the Inventory
    // handler (order: Inventory 10 → Finance 20 → Notifications 30).
    // Ordering is now explicit, not dependent on module import order.
    this.eventBus.subscribe('sale.completed', this.lowStockHandler, {
      priority: 30,
    });
    this.eventBus.subscribe('inventory.adjusted', this.lowStockHandler);
    this.eventBus.subscribe('inventory.transferred', this.lowStockHandler);
    this.eventBus.subscribe(
      'purchase.order.status.changed',
      this.poStatusHandler,
    );
  }
}
