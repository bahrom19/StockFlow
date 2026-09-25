import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { RolesRepository } from '../../rbac/repositories/roles.repository';
import { GlEngineController } from '../controllers/gl-engine.controller';
import { GlEngineService } from '../services/gl-engine.service';
import { FiscalYearCloseService } from '../services/fiscal-year-close.service';

/**
 * G15-07-C0-b — authorization on the fiscal-year close route.
 *
 * `POST /finance/gl/fiscal-year/:year/close` is guarded by
 * `@UseGuards(JwtAuthGuard, RolesGuard)` + `@RequirePermission('finance:close')`.
 * The controller and guard are NOT modified by C0-b; this spec pins the
 * end-to-end authorization behaviour of that wiring with the REAL RolesGuard
 * backed by a mocked RolesRepository (the same layer the guard uses in
 * production), following the existing finance integration-test precedent
 * (ledger-routes.integration.spec.ts).
 *
 * It asserts:
 *   - a caller whose company resolves `finance:close` is authorized (200);
 *   - a caller without it is denied (403, fail-closed);
 *   - permission resolution stays company-scoped (tenant isolation).
 */

let currentUser: {
  userId: string;
  companyId: string;
  roles: string[];
} = { userId: 'user-1', companyId: 'comp-A', roles: ['Admin'] };

/** Pass-through auth guard that injects the current test user. */
const authGuard = {
  canActivate: (ctx: ExecutionContext) => {
    ctx.switchToHttp().getRequest().user = currentUser;
    return true;
  },
};

describe('Fiscal year close route — finance:close authorization (G15-07-C0-b)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const glEngine = {
    post: jest.fn(),
    reverse: jest.fn(),
  };
  const fiscalYearClose = {
    closeFiscalYear: jest.fn(),
  };
  const rolesRepository = {
    findPermissionCodesByRoleNames: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GlEngineController],
      providers: [
        { provide: GlEngineService, useValue: glEngine },
        { provide: FiscalYearCloseService, useValue: fiscalYearClose },
        { provide: RolesRepository, useValue: rolesRepository },
        // Real guard, with the mocked repository injected.
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
    currentUser = { userId: 'user-1', companyId: 'comp-A', roles: ['Admin'] };
    fiscalYearClose.closeFiscalYear.mockResolvedValue({
      fiscalYearId: 'fy-1',
      year: 2026,
      closedAt: new Date('2026-12-31T00:00:00.000Z'),
      retainedEarningsEntryId: 'je-1',
      closedPeriodIds: [],
    });
  });

  const close = () =>
    fetch(`${baseUrl}/finance/gl/fiscal-year/2026/close`, { method: 'POST' });

  it('authorizes a caller whose company resolves finance:close', async () => {
    rolesRepository.findPermissionCodesByRoleNames.mockImplementation(
      (_roles: string[], companyId: string) =>
        companyId === 'comp-A' ? ['finance:close'] : [],
    );

    const res = await close();

    expect(res.status).toBe(200);
    expect(fiscalYearClose.closeFiscalYear).toHaveBeenCalledWith(
      'comp-A',
      2026,
      'user-1',
    );
  });

  it('denies a caller without finance:close (fail closed)', async () => {
    rolesRepository.findPermissionCodesByRoleNames.mockResolvedValue([
      'finance:period-close',
      'finance:read',
    ]);

    const res = await close();

    expect(res.status).toBe(403);
    expect(fiscalYearClose.closeFiscalYear).not.toHaveBeenCalled();
  });

  it('resolves permissions company-scoped (no cross-tenant authorization)', async () => {
    // `finance:close` is granted only in comp-A; the caller acts in comp-B.
    currentUser = { userId: 'user-2', companyId: 'comp-B', roles: ['Admin'] };
    rolesRepository.findPermissionCodesByRoleNames.mockImplementation(
      (_roles: string[], companyId: string) =>
        companyId === 'comp-A' ? ['finance:close'] : [],
    );

    const res = await close();

    expect(res.status).toBe(403);
    expect(
      rolesRepository.findPermissionCodesByRoleNames,
    ).toHaveBeenCalledWith(['Admin'], 'comp-B');
    expect(fiscalYearClose.closeFiscalYear).not.toHaveBeenCalled();
  });
});
