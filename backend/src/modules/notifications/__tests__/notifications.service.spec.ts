import { NotificationType } from '@prisma/client';
import { NotificationsService } from '../notifications.service';
import { NotificationRepository } from '../repositories/notification.repository';
import { PrismaService } from '../../../common/prisma';

describe('NotificationsService — fan-out, dedupe keys, tenant scoping', () => {
  let service: NotificationsService;
  let repo: ReturnType<typeof makeRepo>;
  let prisma: ReturnType<typeof makePrisma>;

  const makeRepo = () => ({
    findActiveMemberIds: jest.fn().mockResolvedValue(['user-1', 'user-2']),
    createMany: jest.fn().mockResolvedValue(2),
    touchByDedupeKeys: jest.fn().mockResolvedValue(undefined),
    upsertByDedupeKey: jest.fn(),
    findForUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    countUnreadForUser: jest.fn().mockResolvedValue(7),
    markReadForUser: jest.fn().mockResolvedValue(true),
  });

  const makePrisma = () => ({
    product: {
      findFirst: jest.fn().mockResolvedValue({ name: 'Milk 1L', sku: 'MLK-1' }),
    },
    warehouse: { findFirst: jest.fn().mockResolvedValue({ name: 'Main WH' }) },
  });

  beforeEach(() => {
    repo = makeRepo();
    prisma = makePrisma();
    service = new NotificationsService(
      repo as unknown as NotificationRepository,
      prisma as unknown as PrismaService,
    );
  });

  it('fan-out creates one row per active member with per-user dedupeKey', async () => {
    await service.fanOut({
      companyId: 'comp-1',
      type: NotificationType.PURCHASE_ORDER_STATUS_CHANGED,
      titleKey: 't',
      dedupeKeyBase: 'po_status:po-1:APPROVED:3',
    });

    expect(repo.createMany).toHaveBeenCalledTimes(1);
    const rows = repo.createMany.mock.calls[0][0];
    expect(rows).toHaveLength(2);
    expect(rows.map((r: { dedupeKey: string }) => r.dedupeKey)).toEqual([
      'po_status:po-1:APPROVED:3:user-1',
      'po_status:po-1:APPROVED:3:user-2',
    ]);
    for (const row of rows) {
      expect(row.companyId).toBe('comp-1');
      expect(row.userId).toBeDefined();
    }
  });

  it('excludes the actor for PO status notifications (changedBy)', async () => {
    await service.notifyPurchaseOrderStatusChanged({
      purchaseOrderId: 'po-1',
      companyId: 'comp-1',
      supplierId: 'sup-1',
      orderNumber: 'PO-001',
      previousStatus: 'PENDING' as never,
      newStatus: 'APPROVED' as never,
      changedBy: 'user-1',
      rowVersion: 3,
    });

    expect(repo.findActiveMemberIds).toHaveBeenCalledWith(
      'comp-1',
      undefined,
      'user-1',
    );
    // Actor exclusion is enforced by the repository query (see
    // notification.repository.spec); the service passes it through untouched.
    const rows = repo.createMany.mock.calls[0][0];
    expect(rows[0].params).toEqual({
      orderNumber: 'PO-001',
      oldStatus: 'PENDING',
      newStatus: 'APPROVED',
    });
    expect(rows[0].dedupeKey).toBe('po_status:po-1:APPROVED:3:user-1');
    expect(rows[0].entityType).toBe('PurchaseOrder');
    expect(rows[0].entityId).toBe('po-1');
  });

  it('PO status with changedBy null notifies everyone', async () => {
    await service.notifyPurchaseOrderStatusChanged({
      purchaseOrderId: 'po-1',
      companyId: 'comp-1',
      supplierId: 'sup-1',
      orderNumber: 'PO-001',
      previousStatus: 'ORDERED' as never,
      newStatus: 'PARTIALLY_RECEIVED' as never,
      changedBy: null,
      rowVersion: 5,
    });

    expect(repo.findActiveMemberIds).toHaveBeenCalledWith(
      'comp-1',
      undefined,
      null,
    );
    expect(repo.createMany.mock.calls[0][0]).toHaveLength(2);
  });

  it('LOW_STOCK builds per-user key, entity-field params, and touches updatedAt', async () => {
    await service.notifyLowStock('comp-1', 'prod-1', 'wh-1', 3);

    expect(prisma.product.findFirst).toHaveBeenCalledWith({
      where: { id: 'prod-1', companyId: 'comp-1' },
      select: { name: true, sku: true },
    });
    const rows = repo.createMany.mock.calls[0][0];
    expect(rows[0].dedupeKey).toBe('low_stock:prod-1:wh-1:user-1');
    expect(rows[0].params).toEqual({
      productName: 'Milk 1L',
      sku: 'MLK-1',
      warehouseName: 'Main WH',
      quantity: 3,
    });
    // dedupe freshness: updatedAt bumped, readAt never reset
    expect(repo.touchByDedupeKeys).toHaveBeenCalledWith(
      'comp-1',
      ['low_stock:prod-1:wh-1:user-1', 'low_stock:prod-1:wh-1:user-2'],
      undefined,
    );
    for (const row of rows) {
      expect(row).not.toHaveProperty('readAt');
    }
  });
});

describe('NotificationsService — overdue content and user-scoped reads', () => {
  let service: NotificationsService;
  let repo: ReturnType<typeof makeRepo>;
  let prisma: ReturnType<typeof makePrisma>;

  const makeRepo = () => ({
    findActiveMemberIds: jest.fn().mockResolvedValue(['user-1']),
    createMany: jest.fn().mockResolvedValue(1),
    touchByDedupeKeys: jest.fn(),
    findForUser: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    countUnreadForUser: jest.fn().mockResolvedValue(7),
    markReadForUser: jest.fn().mockResolvedValue(true),
  });

  const makePrisma = () => ({
    product: { findFirst: jest.fn() },
    warehouse: { findFirst: jest.fn() },
  });

  beforeEach(() => {
    repo = makeRepo();
    prisma = makePrisma();
    service = new NotificationsService(
      repo as unknown as NotificationRepository,
      prisma as unknown as PrismaService,
    );
  });

  it('OVERDUE: day-bucketed per-user dedupe key with real entity-field params', async () => {
    await service.notifyOverdueInvoice(
      {
        companyId: 'comp-1',
        invoiceId: 'inv-1',
        invoiceNumber: 'PI-001',
        supplierId: 'sup-1',
        supplierName: 'Acme',
        dueDate: new Date('2026-09-01'),
        currency: 'KZT',
        outstanding: '15000.0000',
        daysOverdue: 5,
      },
      '2026-09-06',
    );

    const rows = repo.createMany.mock.calls[0][0];
    expect(rows[0].dedupeKey).toBe('payment_overdue:inv-1:2026-09-06:user-1');
    expect(rows[0].params).toEqual({
      invoiceNumber: 'PI-001',
      supplierName: 'Acme',
      daysOverdue: 5,
      outstandingAmount: '15000.0000',
      currency: 'KZT',
    });
    expect(rows[0].entityType).toBe('PurchaseInvoice');
    expect(rows[0].entityId).toBe('inv-1');
  });

  it('missing product/warehouse → no fan-out (never throws)', async () => {
    const created = await service.notifyLowStock('comp-1', 'prod-x', 'wh-1', 2);
    expect(created).toBe(0);
    expect(repo.createMany).not.toHaveBeenCalled();
  });

  it('read methods are always (companyId, userId)-scoped', async () => {
    await service.listForUser('comp-1', 'user-1', {
      page: 1,
      limit: 50,
      unreadOnly: true,
    });
    expect(repo.findForUser).toHaveBeenCalledWith('comp-1', 'user-1', {
      page: 1,
      limit: 50,
      unreadOnly: true,
    });

    await service.unreadCountForUser('comp-1', 'user-1');
    expect(repo.countUnreadForUser).toHaveBeenCalledWith('comp-1', 'user-1');

    await service.markRead('comp-1', 'user-1', 'n-1');
    expect(repo.markReadForUser).toHaveBeenCalledWith(
      'comp-1',
      'user-1',
      'n-1',
    );
  });
});
