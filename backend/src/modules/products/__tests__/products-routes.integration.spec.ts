import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ProductsController } from '../controllers/products.controller';
import { ProductsService } from '../services/products.service';

/**
 * Regression tests for INC-2: stockQuantity must never be silently lost.
 *
 * When a client creates a product with stockQuantity > 0 but the company has
 * no active warehouse, ProductsService throws UnprocessableEntityException.
 * These tests prove the exception is surfaced through the HTTP layer as 422
 * (NOT a 201 with silently-dropped stock), and that a normal create still
 * returns 201.
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

describe('Products routes — stockQuantity fail-fast (regression)', () => {
  let app: INestApplication;
  let baseUrl: string;
  let server: ReturnType<INestApplication['getHttpServer']>;

  const productsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: productsService as unknown as ProductsService,
        },
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
  });

  it('POST /products returns 422 when stockQuantity requested without warehouse', async () => {
    productsService.create.mockRejectedValue(
      new (require('@nestjs/common').UnprocessableEntityException)(
        'Cannot persist stockQuantity: no active warehouse exists for this company. Create a warehouse first, or create the product without stockQuantity.',
      ),
    );

    const res = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rice',
        price: 50,
        stockQuantity: 15,
      }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(JSON.stringify(body.message)).toContain('no active warehouse');
    // The product must NOT be created — fail fast.
    expect(productsService.create).toHaveBeenCalled();
  });

  it('POST /products returns 201 when warehouse exists (stock persisted)', async () => {
    productsService.create.mockResolvedValue({
      id: 'prod-1',
      name: 'Rice',
      companyId: 'comp-1',
      sku: null,
      isActive: true,
      price: '50.0000',
      costPrice: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      description: null,
      barcode: null,
      category: null,
      brand: null,
      unit: 'kg',
      stockQuantity: 15,
      rowVersion: 0,
      unitId: null,
    });

    const res = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rice',
        price: 50,
        stockQuantity: 15,
      }),
    });

    expect(res.status).toBe(201);
  });
});
