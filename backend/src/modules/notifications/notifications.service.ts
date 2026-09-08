import { Injectable, Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma';
import { PurchaseOrderStatusChangedPayload } from '../purchasing/events/purchase-order-status-changed.event';
import { OverdueInvoiceRow } from './repositories/overdue-invoice.repository';
import {
  NotificationRepository,
  NotificationCreateRow,
  NotificationQuery,
} from './repositories/notification.repository';

/**
 * Hardcoded low-stock threshold — mirrors the existing reports behaviour
 * (reports.repository.ts lowStockData `quantity <= 5`). Per-product
 * reorder levels are a separate future workstream; reports stay untouched.
 */
export const LOW_STOCK_THRESHOLD = 5;

const LOW_STOCK_TITLE_KEY = 'notificationTypeLowStockTitle';
const LOW_STOCK_BODY_KEY = 'notificationTypeLowStockBody';
const PO_STATUS_TITLE_KEY = 'notificationTypePurchaseOrderStatusTitle';
const PO_STATUS_BODY_KEY = 'notificationTypePurchaseOrderStatusBody';
const OVERDUE_TITLE_KEY = 'notificationTypeSupplierPaymentOverdueTitle';
const OVERDUE_BODY_KEY = 'notificationTypeSupplierPaymentOverdueBody';

export interface FanOutInput {
  companyId: string;
  type: NotificationType;
  titleKey: string;
  bodyKey?: string;
  params?: Prisma.InputJsonValue;
  entityType?: string;
  entityId?: string;
  /** Dedupe key WITHOUT the per-user suffix; fanOut appends `:{userId}` —
   * required because the unique constraint is (companyId, dedupeKey) and one
   * row must exist per user. */
  dedupeKeyBase: string;
}

export interface FanOutOptions {
  /** Actor to exclude from the fan-out (e.g. PO status changer). */
  excludeUserId?: string | null;
  /** Bump updatedAt of existing rows (LOW_STOCK re-alert freshness). */
  touchUpdatedAt?: boolean;
}

/**
 * Notifications core service (N3) — creation (fan-out + dedupe) and the
 * user-scoped read primitives that N4 will expose over REST.
 *
 * Throwing policy: this service MAY throw; every EventBus handler and the
 * cron scanner that call it are responsible for catching and logging, so a
 * notification failure can never break a business operation.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Fan-out one notification row per active company member. Per-user
   * dedupeKey (`{base}:{userId}`) + the DB unique constraint guarantee that:
   * - every active member gets their own row;
   * - a repeated event never creates a duplicate (PG ON CONFLICT DO NOTHING).
   */
  async fanOut(
    input: FanOutInput,
    tx?: Prisma.TransactionClient,
    options?: FanOutOptions,
  ): Promise<number> {
    const memberIds = await this.notificationRepository.findActiveMemberIds(
      input.companyId,
      tx,
      options?.excludeUserId ?? null,
    );
    if (memberIds.length === 0) return 0;

    const rows: NotificationCreateRow[] = memberIds.map((userId) => ({
      companyId: input.companyId,
      userId,
      type: input.type,
      titleKey: input.titleKey,
      ...(input.bodyKey ? { bodyKey: input.bodyKey } : {}),
      ...(input.params !== undefined ? { params: input.params } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      dedupeKey: `${input.dedupeKeyBase}:${userId}`,
    }));
    const created = await this.notificationRepository.createMany(rows, tx);

    if (options?.touchUpdatedAt) {
      await this.notificationRepository.touchByDedupeKeys(
        input.companyId,
        rows.map((r) => r.dedupeKey),
        tx,
      );
    }
    return created;
  }

  /**
   * LOW_STOCK notification. `quantity` is the trusted post-change stock:
   * `afterQuantity` from the event payload, or the stock row read inside the
   * originating transaction for sale/transfer events.
   */
  async notifyLowStock(
    companyId: string,
    productId: string,
    warehouseId: string,
    quantity: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prismaService;
    const [product, warehouse] = await Promise.all([
      client.product.findFirst({
        where: { id: productId, companyId },
        select: { name: true, sku: true },
      }),
      client.warehouse.findFirst({
        where: { id: warehouseId, companyId },
        select: { name: true },
      }),
    ]);
    if (!product || !warehouse) return 0;

    return this.fanOut(
      {
        companyId,
        type: NotificationType.LOW_STOCK,
        titleKey: LOW_STOCK_TITLE_KEY,
        bodyKey: LOW_STOCK_BODY_KEY,
        params: {
          productName: product.name,
          sku: product.sku,
          warehouseName: warehouse.name,
          quantity,
        },
        entityType: 'Product',
        entityId: productId,
        dedupeKeyBase: `low_stock:${productId}:${warehouseId}`,
      },
      tx,
      { touchUpdatedAt: true },
    );
  }

  /**
   * PURCHASE_ORDER_STATUS_CHANGED notification for every active member
   * except the actor (when the transition has one — receipt-driven
   * transitions have `changedBy: null` and notify everyone).
   */
  async notifyPurchaseOrderStatusChanged(
    payload: PurchaseOrderStatusChangedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return this.fanOut(
      {
        companyId: payload.companyId,
        type: NotificationType.PURCHASE_ORDER_STATUS_CHANGED,
        titleKey: PO_STATUS_TITLE_KEY,
        bodyKey: PO_STATUS_BODY_KEY,
        params: {
          orderNumber: payload.orderNumber,
          oldStatus: payload.previousStatus,
          newStatus: payload.newStatus,
        },
        entityType: 'PurchaseOrder',
        entityId: payload.purchaseOrderId,
        dedupeKeyBase: `po_status:${payload.purchaseOrderId}:${payload.newStatus}:${payload.rowVersion}`,
      },
      tx,
      { excludeUserId: payload.changedBy },
    );
  }

  /**
   * SUPPLIER_PAYMENT_OVERDUE notification. `dayBucket` (yyyy-mm-dd, server
   * local — see OverdueNotificationCronService) scopes the dedupe key so a
   * repeated scan on the same day cannot duplicate, while the next day may
   * legitimately re-alert.
   */
  async notifyOverdueInvoice(
    invoice: OverdueInvoiceRow,
    dayBucket: string,
  ): Promise<number> {
    return this.fanOut({
      companyId: invoice.companyId,
      type: NotificationType.SUPPLIER_PAYMENT_OVERDUE,
      titleKey: OVERDUE_TITLE_KEY,
      bodyKey: OVERDUE_BODY_KEY,
      params: {
        invoiceNumber: invoice.invoiceNumber,
        supplierName: invoice.supplierName,
        daysOverdue: invoice.daysOverdue,
        outstandingAmount: invoice.outstanding,
        currency: invoice.currency,
      },
      entityType: 'PurchaseInvoice',
      entityId: invoice.invoiceId,
      dedupeKeyBase: `payment_overdue:${invoice.invoiceId}:${dayBucket}`,
    });
  }

  // ── Read side (N4 will expose over REST; strictly user-scoped) ──

  listForUser(companyId: string, userId: string, query: NotificationQuery) {
    return this.notificationRepository.findForUser(companyId, userId, query);
  }

  unreadCountForUser(companyId: string, userId: string): Promise<number> {
    return this.notificationRepository.countUnreadForUser(companyId, userId);
  }

  markRead(
    companyId: string,
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    return this.notificationRepository.markReadForUser(
      companyId,
      userId,
      notificationId,
    );
  }
}
