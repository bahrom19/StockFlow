import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { SalesModule } from '../sales.module';
import { CashShiftRepository } from '../repositories/cash-shift.repository';
import { SalesRepository } from '../repositories/sales.repository';
import { CashShiftService } from '../services/cash-shift.service';
import { SalesService } from '../services/sales.service';

/**
 * Regression tests for the route-ordering bug that made
 * `GET /sales/cash-shifts` resolve to `SalesController.findById` (binding
 * id="cash-shifts") and throw a Prisma UUID error.
 *
 * CashShiftController MUST be registered before SalesController so the literal
 * `sales/cash-shifts` route wins over the parameterized `sales/:id`.
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

describe('Sales routes — literal vs param ordering (regression)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const salesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    getNextSaleNumber: jest.fn(),
    getReceipt: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    transitionStatus: jest.fn(),
  };

  const cashShiftService = {
    openShift: jest.fn(),
    closeShift: jest.fn(),
    cashIn: jest.fn(),
    cashOut: jest.fn(),
    getXReport: jest.fn(),
    getZReport: jest.fn(),
    listShifts: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SalesModule],
    })
      .overrideProvider(SalesService)
      .useValue(salesService as unknown as SalesService)
      .overrideProvider(CashShiftService)
      .useValue(cashShiftService as unknown as CashShiftService)
      .overrideProvider(SalesRepository)
      .useValue({} as unknown as SalesRepository)
      .overrideProvider(CashShiftRepository)
      .useValue({} as unknown as CashShiftRepository)
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

  it('GET /sales/cash-shifts resolves to CashShiftController.listShifts (NOT /sales/:id)', async () => {
    cashShiftService.listShifts.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    salesService.findById.mockRejectedValue(
      new Error('SalesController.findById must NOT handle /sales/cash-shifts'),
    );

    const res = await fetch(`${baseUrl}/sales/cash-shifts`);

    expect(res.status).toBe(200);
    expect(cashShiftService.listShifts).toHaveBeenCalled();
    expect(salesService.findById).not.toHaveBeenCalled();
  });

  it('POST /sales/cash-shifts/open resolves to CashShiftController.openShift', async () => {
    cashShiftService.openShift.mockResolvedValue({ id: 'shift-1' });

    const res = await fetch(`${baseUrl}/sales/cash-shifts/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouseId: 'wh-1', openingBalance: 0 }),
    });

    expect(res.status).toBe(201);
    expect(cashShiftService.openShift).toHaveBeenCalled();
  });

  it('GET /sales/:id still resolves to SalesController.findById', async () => {
    salesService.findById.mockResolvedValue({ id: 'sale-1' });

    const res = await fetch(
      `${baseUrl}/sales/11111111-1111-1111-1111-111111111111`,
    );

    expect(res.status).toBe(200);
    expect(salesService.findById).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
      'comp-1',
    );
    expect(cashShiftService.listShifts).not.toHaveBeenCalled();
  });

  it('GET /sales/next-number still resolves to SalesController.getNextNumber', async () => {
    salesService.getNextSaleNumber.mockResolvedValue({
      saleNumber: 'SALE-0001',
    });

    const res = await fetch(`${baseUrl}/sales/next-number`);

    expect(res.status).toBe(200);
    expect(salesService.getNextSaleNumber).toHaveBeenCalledWith('comp-1');
  });
});
