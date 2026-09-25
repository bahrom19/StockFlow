import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { FinancialTransactionsController } from '../controllers/financial-transactions.controller';
import { FinancialTransactionsService } from '../services/financial-transactions.service';

/**
 * F-AUD-03 — route wiring for the G15-07-C3-A posting endpoints.
 *
 * Verifies that POST :id/post and POST :id/reverse resolve to the posting
 * service (not to GET :id), carry the authenticated tenant, forward the
 * Idempotency-Key header, and pass the reversal reason body.
 *
 * Guards are overridden (pass-through) exactly like the ledger-routes
 * precedent: this spec covers routing/transport, not RBAC enforcement.
 * Like the other *.integration.spec.ts files it is excluded from the default
 * jest run via testPathIgnorePatterns.
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

describe('FinancialTransaction routes — post/reverse wiring (F-AUD-03)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const service = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    post: jest.fn(),
    reverse: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [FinancialTransactionsController],
      providers: [
        {
          provide: FinancialTransactionsService,
          useValue: service as unknown as FinancialTransactionsService,
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

  it('POST /finance/financial-transactions/:id/post resolves to service.post with tenant + key', async () => {
    service.post.mockResolvedValue({ id: 'ft-1', postingStatus: 'POSTED' });
    service.findById.mockRejectedValue(
      new Error('findById must NOT handle POST :id/post'),
    );

    const res = await fetch(
      `${baseUrl}/finance/financial-transactions/ft-1/post`,
      { method: 'POST', headers: { 'Idempotency-Key': 'key-1' } },
    );

    expect(res.status).toBe(200);
    expect(service.post).toHaveBeenCalledWith(
      'ft-1',
      expect.objectContaining({ companyId: 'comp-1', userId: 'user-1' }),
      'key-1',
    );
    expect(service.findById).not.toHaveBeenCalled();
  });

  it('POST /finance/financial-transactions/:id/reverse forwards reason + key', async () => {
    service.reverse.mockResolvedValue({ id: 'ft-2', postingStatus: 'POSTED' });

    const res = await fetch(
      `${baseUrl}/finance/financial-transactions/ft-1/reverse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'key-2',
        },
        body: JSON.stringify({ reason: 'duplicate' }),
      },
    );

    expect(res.status).toBe(200);
    expect(service.reverse).toHaveBeenCalledWith(
      'ft-1',
      expect.objectContaining({ companyId: 'comp-1' }),
      'duplicate',
      'key-2',
    );
  });

  it('POST /finance/financial-transactions forwards the Idempotency-Key to create', async () => {
    service.create.mockResolvedValue({ id: 'ft-1', postingStatus: 'DRAFT' });

    const res = await fetch(`${baseUrl}/finance/financial-transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'key-3',
      },
      body: JSON.stringify({
        amount: '1000',
        type: 'BANK_DEPOSIT',
        direction: 'INFLOW',
      }),
    });

    expect(res.status).toBe(201);
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '1000' }),
      expect.objectContaining({ companyId: 'comp-1' }),
      'key-3',
    );
  });
});
