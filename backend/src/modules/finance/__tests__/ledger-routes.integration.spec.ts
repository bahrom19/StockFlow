import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { LedgerQueryController } from '../controllers/ledger-query.controller';
import { LedgerQueryService } from '../services/ledger-query.service';

/**
 * Regression tests for the route-ordering bug that made
 * `GET /finance/ledger/trial-balance` resolve to `@Get(':accountId')` (binding
 * accountId="trial-balance") and throw a Prisma UUID error.
 *
 * Literal routes (`balances/account`, `trial-balance`) MUST be declared before
 * the parameterized `:accountId` route.
 */

/** Pass-through guard that also injects a fake authenticated user. */
const authGuard = {
  canActivate: (ctx: ExecutionContext) => {
    ctx.switchToHttp().getRequest().user = {
      userId: 'user-1',
      companyId: 'comp-1',
      roles: ['Admin'],
    };
    return true;
  },
};

describe('Ledger routes — literal vs param ordering (regression)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const ledgerQuery = {
    getLedger: jest.fn(),
    getAccountBalance: jest.fn(),
    getTrialBalance: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LedgerQueryController],
      providers: [
        {
          provide: LedgerQueryService,
          useValue: ledgerQuery as unknown as LedgerQueryService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .overrideGuard(RolesGuard)
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
  });

  it('GET /finance/ledger/trial-balance resolves to getTrialBalance (NOT :accountId)', async () => {
    ledgerQuery.getTrialBalance.mockResolvedValue({
      rows: [],
      totalDebit: '0.0000',
      totalCredit: '0.0000',
    });
    ledgerQuery.getLedger.mockRejectedValue(
      new Error('getLedger must NOT handle /finance/ledger/trial-balance'),
    );

    const res = await fetch(`${baseUrl}/finance/ledger/trial-balance`);

    expect(res.status).toBe(200);
    expect(ledgerQuery.getTrialBalance).toHaveBeenCalled();
    expect(ledgerQuery.getLedger).not.toHaveBeenCalled();
  });

  it('GET /finance/ledger/balances/account resolves to getAccountBalance', async () => {
    ledgerQuery.getAccountBalance.mockResolvedValue([]);

    const res = await fetch(`${baseUrl}/finance/ledger/balances/account`);

    expect(res.status).toBe(200);
    expect(ledgerQuery.getAccountBalance).toHaveBeenCalled();
    expect(ledgerQuery.getLedger).not.toHaveBeenCalled();
  });

  it('GET /finance/ledger/:accountId still resolves to getLedger', async () => {
    ledgerQuery.getLedger.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });

    const res = await fetch(
      `${baseUrl}/finance/ledger/11111111-1111-1111-1111-111111111111`,
    );

    expect(res.status).toBe(200);
    expect(ledgerQuery.getLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: '11111111-1111-1111-1111-111111111111',
      }),
    );
    expect(ledgerQuery.getTrialBalance).not.toHaveBeenCalled();
  });
});
