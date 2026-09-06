import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import { NotificationType } from '@prisma/client';

/** Pass-through guard that injects a fake authenticated user. */
function makeAuthGuard(user: { userId: string; companyId: string }) {
  return {
    canActivate: (ctx: ExecutionContext) => {
      ctx.switchToHttp().getRequest().user = {
        ...user,
        roles: ['Admin'],
        email: 'test@test.com',
      };
      return true;
    },
  };
}

describe('NotificationsController (HTTP)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let baseUrl: string;

  const mockUser = { userId: 'user-1', companyId: 'comp-1' };

  const mockNotifications = [
    {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      type: NotificationType.LOW_STOCK,
      titleKey: 'notificationTypeLowStockTitle',
      bodyKey: 'notificationTypeLowStockBody',
      params: { productName: 'Widget', sku: 'W-001', warehouseName: 'Main', quantity: 3 },
      entityType: 'Product',
      entityId: 'prod-1',
      readAt: null,
      createdAt: new Date('2026-09-06T10:00:00Z'),
    },
    {
      id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
      type: NotificationType.PURCHASE_ORDER_STATUS_CHANGED,
      titleKey: 'notificationTypePurchaseOrderStatusTitle',
      bodyKey: 'notificationTypePurchaseOrderStatusBody',
      params: { orderNumber: 'PO-001', oldStatus: 'ORDERED', newStatus: 'RECEIVED' },
      entityType: 'PurchaseOrder',
      entityId: 'po-1',
      readAt: new Date('2026-09-06T09:00:00Z'),
      createdAt: new Date('2026-09-06T08:00:00Z'),
    },
  ];

  const mockService = {
    listForUser: jest.fn().mockResolvedValue({ items: mockNotifications, total: 2, page: 1, limit: 20 }),
    unreadCountForUser: jest.fn().mockResolvedValue(1),
    markRead: jest.fn().mockResolvedValue(true),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(makeAuthGuard(mockUser))
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    server = app.getHttpServer();
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockService.listForUser.mockResolvedValue({ items: mockNotifications, total: 2, page: 1, limit: 20 });
    mockService.unreadCountForUser.mockResolvedValue(1);
    mockService.markRead.mockResolvedValue(true);
  });

  // ── GET /notifications ──

  describe('GET /notifications', () => {
    it('returns paginated notifications for the authenticated user', async () => {
      const res = await fetch(`${baseUrl}/notifications`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(20);
      expect(mockService.listForUser).toHaveBeenCalledWith('comp-1', 'user-1', {
        page: 1,
        limit: 20,
        unreadOnly: undefined,
        type: undefined,
      });
    });

    it('passes unreadOnly=true to service', async () => {
      await fetch(`${baseUrl}/notifications?unreadOnly=true`);
      expect(mockService.listForUser).toHaveBeenCalledWith('comp-1', 'user-1', {
        page: 1,
        limit: 20,
        unreadOnly: true,
        type: undefined,
      });
    });

    it('passes type filter to service', async () => {
      await fetch(`${baseUrl}/notifications?type=LOW_STOCK`);
      expect(mockService.listForUser).toHaveBeenCalledWith('comp-1', 'user-1', {
        page: 1,
        limit: 20,
        unreadOnly: undefined,
        type: NotificationType.LOW_STOCK,
      });
    });

    it('passes custom page and limit', async () => {
      await fetch(`${baseUrl}/notifications?page=2&limit=10`);
      expect(mockService.listForUser).toHaveBeenCalledWith('comp-1', 'user-1', {
        page: 2,
        limit: 10,
        unreadOnly: undefined,
        type: undefined,
      });
    });

    it('companyId comes from JWT, not query params', async () => {
      await fetch(`${baseUrl}/notifications`);
      expect(mockService.listForUser).toHaveBeenCalledWith('comp-1', 'user-1', expect.any(Object));
    });

    it('rejects page < 1 with 400', async () => {
      const res = await fetch(`${baseUrl}/notifications?page=0`);
      expect(res.status).toBe(400);
    });

    it('rejects limit > 100 with 400', async () => {
      const res = await fetch(`${baseUrl}/notifications?limit=101`);
      expect(res.status).toBe(400);
    });

    it('rejects invalid type with 400', async () => {
      const res = await fetch(`${baseUrl}/notifications?type=INVALID`);
      expect(res.status).toBe(400);
    });
  });

  // ── GET /notifications/unread-count ──

  describe('GET /notifications/unread-count', () => {
    it('returns unread count for the authenticated user', async () => {
      const res = await fetch(`${baseUrl}/notifications/unread-count`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ count: 1 });
      expect(mockService.unreadCountForUser).toHaveBeenCalledWith('comp-1', 'user-1');
    });

    it('uses JWT companyId and userId, not query params', async () => {
      await fetch(`${baseUrl}/notifications/unread-count`);
      expect(mockService.unreadCountForUser).toHaveBeenCalledWith('comp-1', 'user-1');
    });
  });

  // ── PATCH /notifications/:id/read ──

  describe('PATCH /notifications/:id/read', () => {
    it('marks notification as read and returns success', async () => {
      const res = await fetch(`${baseUrl}/notifications/a1b2c3d4-e5f6-7890-abcd-ef1234567890/read`, { method: 'PATCH' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true });
      expect(mockService.markRead).toHaveBeenCalledWith('comp-1', 'user-1', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });

    it('returns success: false when notification not found or not owned', async () => {
      mockService.markRead.mockResolvedValue(false);
      const res = await fetch(`${baseUrl}/notifications/c3d4e5f6-a7b8-9012-cdef-123456789012/read`, { method: 'PATCH' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: false });
    });

    it('user can only mark their own notifications (JWT userId used)', async () => {
      await fetch(`${baseUrl}/notifications/a1b2c3d4-e5f6-7890-abcd-ef1234567890/read`, { method: 'PATCH' });
      expect(mockService.markRead).toHaveBeenCalledWith('comp-1', 'user-1', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });

    it('rejects invalid UUID with 400', async () => {
      const res = await fetch(`${baseUrl}/notifications/not-a-uuid/read`, { method: 'PATCH' });
      expect(res.status).toBe(400);
    });
  });

  // ── Tenant isolation ──

  describe('tenant isolation', () => {
    it('different users get separate notification lists', async () => {
      // User 1
      await fetch(`${baseUrl}/notifications`);
      expect(mockService.listForUser).toHaveBeenCalledWith('comp-1', 'user-1', expect.any(Object));

      // Create a second app instance with different user
      const moduleRef2 = await Test.createTestingModule({
        controllers: [NotificationsController],
        providers: [{ provide: NotificationsService, useValue: mockService }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue(makeAuthGuard({ userId: 'user-2', companyId: 'comp-1' }))
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();

      const app2 = moduleRef2.createNestApplication();
      await app2.init();
      const server2 = app2.getHttpServer();
      await new Promise<void>((resolve) => server2.listen(0, resolve));
      const addr2 = server2.address();
      const port2 = typeof addr2 === 'object' && addr2 ? addr2.port : 0;

      await fetch(`http://127.0.0.1:${port2}/notifications`);
      expect(mockService.listForUser).toHaveBeenCalledWith('comp-1', 'user-2', expect.any(Object));

      await new Promise<void>((resolve) => server2.close(() => resolve()));
      await app2.close();
    });
  });

  // ── Unauthenticated ──

  describe('unauthenticated requests', () => {
    let unauthApp: INestApplication;
    let unauthServer: ReturnType<INestApplication['getHttpServer']>;
    let unauthBaseUrl: string;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [NotificationsController],
        providers: [{ provide: NotificationsService, useValue: mockService }],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => { throw new (require('@nestjs/common').UnauthorizedException)('Invalid token'); } })
        .overrideGuard(RolesGuard)
        .useValue({ canActivate: () => true })
        .compile();

      unauthApp = moduleRef.createNestApplication();
      await unauthApp.init();
      unauthServer = unauthApp.getHttpServer();
      await new Promise<void>((resolve) => unauthServer.listen(0, resolve));
      const addr = unauthServer.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      unauthBaseUrl = `http://127.0.0.1:${port}`;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => unauthServer.close(() => resolve()));
      await unauthApp.close();
    });

    it('returns 401 for unauthenticated GET /notifications', async () => {
      const res = await fetch(`${unauthBaseUrl}/notifications`);
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated GET /notifications/unread-count', async () => {
      const res = await fetch(`${unauthBaseUrl}/notifications/unread-count`);
      expect(res.status).toBe(401);
    });

    it('returns 401 for unauthenticated PATCH /notifications/:id/read', async () => {
      const res = await fetch(`${unauthBaseUrl}/notifications/a1b2c3d4-e5f6-7890-abcd-ef1234567890/read`, { method: 'PATCH' });
      expect(res.status).toBe(401);
    });
  });
});
