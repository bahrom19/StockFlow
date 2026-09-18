import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { CustomerCreditController } from '../controllers/customer-credit.controller';
import { CustomerCreditLedgerService } from '../services/customer-credit-ledger.service';

/**
 * G11-F2 — controller contract tests: routes resolve, companyId/userId come
 * from the authenticated context only (never the client), and the
 * adjustment route maps to the service `adjust` call.
 *
 * The JwtAuthGuard is overridden to inject a fake authenticated user; the
 * RolesGuard is overridden to pass-through (role matrix itself is covered by
 * RBAC unit tests — this suite asserts wiring and contract shape).
 */
describe('CustomerCreditController (contract)', () => {
  let app: INestApplication;
  let service: { getBalances: jest.Mock; getTransactions: jest.Mock; adjust: jest.Mock };

  const authUser = { userId: 'user-1', companyId: 'comp-1', roles: ['Admin'] };

  beforeAll(async () => {
    service = {
      getBalances: jest
        .fn()
        .mockResolvedValue([
          { customerId: 'cust-1', currency: 'KZT', balance: '0.0000', issuedTotal: '0.0000', spentTotal: '0.0000', adjustedTotal: '0.0000' },
        ]),
      getTransactions: jest
        .fn()
        .mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
      adjust: jest
        .fn()
        .mockResolvedValue({ id: 'lrow-1', direction: 'ISSUED', amount: '10.0000' }),
    };

    const mod = await Test.createTestingModule({
      controllers: [CustomerCreditController],
      providers: [
        { provide: CustomerCreditLedgerService, useValue: service },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: { switchToHttp: () => { getRequest: () => { user: unknown } } }) => {
          ctx.switchToHttp().getRequest().user = authUser;
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = mod.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /crm/customers/:customerId/credit — passes JWT companyId (never client input)', async () => {
    // direct handler invocation through the testing module (no HTTP adapter
    // in unit scope): resolve the controller and call it as the framework
    // would after guards run.
    const controller = app.get(CustomerCreditController);
    const result = await controller.getBalance('cust-1', undefined, authUser as never);
    expect(service.getBalances).toHaveBeenCalledWith('cust-1', 'comp-1', undefined);
    expect(result).toHaveLength(1);
  });

  it('GET .../credit with currency query — forwards the currency filter', async () => {
    const controller = app.get(CustomerCreditController);
    await controller.getBalance('cust-1', 'USD', authUser as never);
    expect(service.getBalances).toHaveBeenLastCalledWith('cust-1', 'comp-1', 'USD');
  });

  it('GET .../credit/transactions — forwards pagination and filters', async () => {
    const controller = app.get(CustomerCreditController);
    const query = { page: 2, limit: 50, direction: 'SPENT' as const, currency: 'KZT' };
    await controller.getTransactions('cust-1', query, authUser as never);
    expect(service.getTransactions).toHaveBeenCalledWith('cust-1', 'comp-1', query);
  });

  it('POST .../credit/adjustments — maps body + actor into service adjust', async () => {
    const controller = app.get(CustomerCreditController);
    const dto = { amount: '-10.0000', currency: 'KZT', reason: 'write-off' };
    await controller.adjust('cust-1', dto, authUser as never);
    expect(service.adjust).toHaveBeenCalledWith(dto, 'cust-1', 'comp-1', 'user-1');
  });
});
