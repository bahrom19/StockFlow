import { ExecutionContext, INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PlatformOperatorGuard } from '../../../common/guards/platform-operator.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { SubscriptionPlanController } from '../../billing/controllers/subscription-plan.controller';
import { SubscriptionPlanService } from '../../billing/services/subscription-plan.service';
import { PermissionsController } from '../controllers/permissions.controller';
import { PermissionsService } from '../services/permissions.service';
import { RolesRepository } from '../repositories/roles.repository';
import { RolesGuard } from '../guards/roles.guard';
import { REQUIRE_PLATFORM_OPERATOR_KEY } from '../decorators/require-platform-operator.decorator';

/**
 * G16-N-4 P0-A — global resource authorization boundary (HTTP level).
 *
 * `SubscriptionPlan` and `Permission` are GLOBAL: neither has a companyId and
 * both are reachable by tenant-grantable permissions. Before this workstream a
 * stock tenant `Admin` could therefore mutate the platform-wide plan catalog
 * and the platform-wide authorization substrate itself.
 *
 * These tests exercise the REAL controller → guard chain (JwtAuthGuard is
 * stubbed only to inject a principal; PlatformOperatorGuard and RolesGuard are
 * the real implementations) so the assertions are about actual HTTP status
 * codes, not about mock choreography.
 *
 * The decisive property under test: platform authority comes from the
 * environment allowlist and from nothing else. Tenant RBAC can neither grant
 * it nor substitute for it, and it does not replace the pre-existing tenant
 * permission requirement.
 */

const OPERATOR = '11111111-1111-4111-8111-111111111111';
const TENANT_ADMIN = '22222222-2222-4222-8222-222222222222';
const OTHER_TENANT_ADMIN = '33333333-3333-4333-8333-333333333333';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const GLOBAL_MUTATIONS: ReadonlyArray<{
  label: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  successStatus: number;
}> = [
  {
    label: 'POST /billing/plans',
    method: 'POST',
    path: '/billing/plans',
    body: { code: 'starter', name: 'Starter' },
    successStatus: 201,
  },
  {
    label: 'PATCH /billing/plans/:id',
    method: 'PATCH',
    path: '/billing/plans/plan-1',
    body: { name: 'Renamed' },
    successStatus: 200,
  },
  {
    label: 'DELETE /billing/plans/:id',
    method: 'DELETE',
    path: '/billing/plans/plan-1',
    successStatus: 204,
  },
  {
    label: 'POST /rbac/permissions',
    method: 'POST',
    path: '/rbac/permissions',
    body: { code: 'x:y', name: 'X', module: 'x' },
    successStatus: 201,
  },
  {
    label: 'PATCH /rbac/permissions/:id',
    method: 'PATCH',
    path: '/rbac/permissions/perm-1',
    body: { code: 'x:z' },
    successStatus: 200,
  },
  {
    label: 'DELETE /rbac/permissions/:id',
    method: 'DELETE',
    path: '/rbac/permissions/perm-1',
    successStatus: 204,
  },
];

describe('Global resource authorization boundary (G16-N-4 P0-A)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let server: ReturnType<INestApplication['getHttpServer']>;

  let principal: JwtPayload | null;
  let operatorUserIds: unknown;
  let grantedPermissions: string[];

  const planService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  const permissionsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    findByCode: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const authGuard = {
    canActivate: (ctx: ExecutionContext) => {
      if (principal) ctx.switchToHttp().getRequest().user = principal;
      return true;
    },
  };

  const call = async (
    method: 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: JSON_HEADERS,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SubscriptionPlanController, PermissionsController],
      providers: [
        { provide: SubscriptionPlanService, useValue: planService },
        { provide: PermissionsService, useValue: permissionsService },
        {
          provide: RolesRepository,
          useValue: {
            findPermissionCodesByRoleNames: jest.fn(() => grantedPermissions),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => operatorUserIds) },
        },
        PlatformOperatorGuard,
        RolesGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile();

    app = moduleRef.createNestApplication();
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
    // Default: a stock tenant Admin. PermissionsSeedService
    // .assignPermissionsToAdminRoles() grants the whole catalog to every
    // tenant Admin role, so this is the real pre-fix attacker.
    principal = {
      userId: TENANT_ADMIN,
      companyId: 'company-a',
      roles: ['Admin'],
      email: 'admin@tenant-a.example',
    };
    operatorUserIds = [OPERATOR];
    grantedPermissions = [
      'admin:billing',
      'roles:create',
      'roles:update',
      'roles:delete',
      'billing:read',
      'roles:read',
    ];
    planService.create.mockResolvedValue({ id: 'plan-1', code: 'starter' });
    planService.findAll.mockResolvedValue({ items: [], total: 0 });
    planService.update.mockResolvedValue({ id: 'plan-1', code: 'starter' });
    planService.softDelete.mockResolvedValue(undefined);
    planService.findById.mockResolvedValue({ id: 'plan-1', code: 'starter' });
    planService.findByCode.mockResolvedValue({ id: 'plan-1', code: 'free' });
    permissionsService.create.mockResolvedValue({ id: 'perm-1', code: 'x:y' });
    permissionsService.update.mockResolvedValue({ id: 'perm-1', code: 'x:z' });
    permissionsService.delete.mockResolvedValue(undefined);
    permissionsService.findAll.mockResolvedValue({ items: [], total: 0 });
  });

  // ── 1–6: tenant Admin holding every required permission is denied ────────
  describe('tenant Admin (auto-granted admin:billing + roles:delete)', () => {
    it.each(GLOBAL_MUTATIONS)(
      'T1-T6: $label returns 403 for a tenant Admin',
      async ({ method, path, body }) => {
        const res = await call(method, path, body);
        expect(res.status).toBe(403);
      },
    );

    it('T-regression: the tenant Admin genuinely held every required permission', () => {
      // Guards against a vacuous test: if the roles repository had not granted
      // the permissions, the 403 above would prove nothing about the platform
      // boundary.
      expect(grantedPermissions).toEqual(
        expect.arrayContaining([
          'admin:billing',
          'roles:create',
          'roles:update',
          'roles:delete',
        ]),
      );
    });

    it('T20: self-granting admin:billing does not bypass the platform guard', async () => {
      // Simulate the tenant having just granted itself the permission.
      grantedPermissions = ['admin:billing', 'billing:read'];
      const res = await call('PATCH', '/billing/plans/plan-1', { name: 'X' });
      expect(res.status).toBe(403);
    });

    it('T21: self-granting roles:delete does not bypass the platform guard', async () => {
      grantedPermissions = ['roles:delete', 'roles:read'];
      const res = await call('DELETE', '/rbac/permissions/perm-1');
      expect(res.status).toBe(403);
    });

    it('T19: another tenant role/company cannot be used to gain platform authority', async () => {
      // The principal claims a role from another company and the repository is
      // made to return that company-scoped grant. Platform authority is still
      // unavailable.
      principal = {
        userId: TENANT_ADMIN,
        companyId: 'company-b',
        roles: ['Admin'],
        email: 'admin@tenant-a.example',
      };
      grantedPermissions = ['admin:billing', 'roles:delete', 'roles:update'];
      const res = await call('DELETE', '/rbac/permissions/perm-1');
      expect(res.status).toBe(403);
    });

    it('T19b: a different tenant admin user id is still denied', async () => {
      principal = {
        userId: OTHER_TENANT_ADMIN,
        companyId: 'company-c',
        roles: ['Admin'],
        email: 'admin@tenant-c.example',
      };
      const res = await call('POST', '/billing/plans', {
        code: 'starter',
        name: 'Starter',
      });
      expect(res.status).toBe(403);
    });
  });

  // ── 7–12: a configured platform operator may mutate ──────────────────────
  describe('platform operator', () => {
    beforeEach(() => {
      principal = {
        userId: OPERATOR,
        companyId: 'company-platform',
        roles: ['Admin'],
        email: 'operator@example.com',
      };
    });

    it.each(GLOBAL_MUTATIONS)(
      'T7-T12: $label succeeds for a platform operator holding the tenant permission',
      async ({ method, path, body, successStatus }) => {
        const res = await call(method, path, body);
        expect(res.status).toBe(successStatus);
      },
    );
  });

  // ── 13–14: platform check is additive, not a bypass ─────────────────────
  describe('platform operator WITHOUT the tenant permission', () => {
    beforeEach(() => {
      principal = {
        userId: OPERATOR,
        companyId: 'company-platform',
        roles: [],
        email: 'operator@example.com',
      };
      grantedPermissions = ['billing:read', 'roles:read'];
    });

    it('T13: Permission mutation is denied without roles:create/update/delete', async () => {
      const created = await call('POST', '/rbac/permissions', {
        code: 'x:y',
        name: 'X',
        module: 'x',
      });
      expect(created.status).toBe(403);

      grantedPermissions = ['roles:read'];
      const patched = await call('PATCH', '/rbac/permissions/perm-1', {
        code: 'x:z',
      });
      expect(patched.status).toBe(403);

      grantedPermissions = ['roles:read'];
      const deleted = await call('DELETE', '/rbac/permissions/perm-1');
      expect(deleted.status).toBe(403);
    });

    it('T14: SubscriptionPlan mutation is denied without admin:billing', async () => {
      const patched = await call('PATCH', '/billing/plans/plan-1', {
        name: 'X',
      });
      expect(patched.status).toBe(403);

      grantedPermissions = ['billing:read'];
      const deleted = await call('DELETE', '/billing/plans/plan-1');
      expect(deleted.status).toBe(403);
    });
  });

  // ── 15–18: configuration and identity fail closed ────────────────────────
  describe('fail-closed configuration', () => {
    it.each([
      ['T15 missing allowlist', undefined],
      ['T16 empty allowlist', []],
      ['T17 malformed allowlist (non-array)', 'not-an-array'],
      ['T17b malformed allowlist (blank entries)', ['', '   ']],
      ['T17c malformed allowlist (no valid uuid)', ['not-a-uuid']],
    ])('%s denies a protected write', async (_label, configured) => {
      operatorUserIds = configured;
      const res = await call('DELETE', '/billing/plans/plan-1');
      expect(res.status).toBe(403);
    });

    it('T18: a non-operator authenticated user is denied', async () => {
      const res = await call('POST', '/rbac/permissions', {
        code: 'x:y',
        name: 'X',
        module: 'x',
      });
      expect(res.status).toBe(403);
    });
  });

  // ── reads are unchanged ─────────────────────────────────────────────────
  describe('reads remain tenant-readable (no platform identity required)', () => {
    it('GET /billing/plans still returns 200 for a tenant with billing:read', async () => {
      grantedPermissions = ['billing:read'];
      const res = await fetch(`${baseUrl}/billing/plans`);
      expect(res.status).toBe(200);
    });

    it('GET /rbac/permissions still returns 200 for a tenant with roles:read', async () => {
      grantedPermissions = ['roles:read'];
      const res = await fetch(`${baseUrl}/rbac/permissions`);
      expect(res.status).toBe(200);
    });

    it('GET /billing/plans/:id still returns 200 for a tenant with billing:read', async () => {
      grantedPermissions = ['billing:read'];
      const res = await fetch(`${baseUrl}/billing/plans/plan-1`);
      expect(res.status).toBe(200);
    });
  });

  // ── 11: targeted meta-regression ────────────────────────────────────────
  describe('meta-regression: every global mutation route is protected', () => {
    const metadataOf = (controller: object, method: string): unknown =>
      Reflect.getMetadata(
        REQUIRE_PLATFORM_OPERATOR_KEY,
        (controller as Record<string, () => unknown>)[method] as object,
      );

    it('runs PlatformOperatorGuard BEFORE RolesGuard on both controllers', () => {
      // Guard order is a security property, not a style choice: the platform
      // boundary must be evaluated before any tenant-RBAC lookup, so a tenant
      // permission can never be (partially) accepted first.
      for (const controller of [
        SubscriptionPlanController,
        PermissionsController,
      ]) {
        const guards = (
          Reflect.getMetadata(GUARDS_METADATA, controller) as unknown[]
        ).map((guard) => (guard as { name: string }).name);

        expect(guards).toEqual([
          'JwtAuthGuard',
          'PlatformOperatorGuard',
          'RolesGuard',
        ]);
      }
    });

    it('all six global mutation routes carry @RequirePlatformOperator()', () => {
      const plan = SubscriptionPlanController.prototype as unknown as Record<
        string,
        unknown
      >;
      const perm = PermissionsController.prototype as unknown as Record<
        string,
        unknown
      >;

      expect(metadataOf(plan, 'create')).toBe(true);
      expect(metadataOf(plan, 'update')).toBe(true);
      expect(metadataOf(plan, 'softDelete')).toBe(true);
      expect(metadataOf(perm, 'create')).toBe(true);
      expect(metadataOf(perm, 'update')).toBe(true);
      expect(metadataOf(perm, 'delete')).toBe(true);
    });

    it('no read route is marked as a platform mutation', () => {
      const plan = SubscriptionPlanController.prototype as unknown as Record<
        string,
        unknown
      >;
      const perm = PermissionsController.prototype as unknown as Record<
        string,
        unknown
      >;

      for (const method of ['findAll', 'findById', 'findByCode']) {
        expect(metadataOf(plan, method)).toBeUndefined();
        expect(metadataOf(perm, method)).toBeUndefined();
      }
    });

    it('no read route is marked on the Permission controller either', () => {
      const perm = PermissionsController.prototype as unknown as Record<
        string,
        unknown
      >;
      for (const method of ['findById', 'findByCode']) {
        expect(metadataOf(perm, method)).toBeUndefined();
      }
    });
  });
});
