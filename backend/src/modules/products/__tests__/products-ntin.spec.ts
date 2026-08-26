import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { ProductsService } from '../services/products.service';
import { ProductsRepository } from '../repositories/products.repository';
import { ProductMapper } from '../mappers/product.mapper';
import { StockService } from '../../inventory/services';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

/**
 * NTIN feature tests — NTIN must live alongside SKU and barcode as an
 * independent, fully optional identifier. Existing products (without NTIN)
 * keep working, SKU and barcode behaviour is untouched.
 */
describe('ProductsService — NTIN', () => {
  let service: ProductsService;
  let mockRepo: jest.Mocked<ProductsRepository>;

  const currentUser: JwtPayload = {
    userId: 'me',
    companyId: 'comp-1',
    roles: ['Admin'],
    email: 'me@test.com',
  };

  const baseProduct = {
    id: 'prod-1',
    name: 'Молоко 1 л',
    companyId: 'comp-1',
    sku: 'MILK-001',
    barcode: '4870001234567',
    ntin: null as string | null,
    isActive: true,
    price: new Prisma.Decimal(450),
    costPrice: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    description: null,
    category: null,
    brand: null,
    unit: null,
    stocks: [],
    rowVersion: 0,
    unitId: null,
    costingMethod: 'AVERAGE' as const,
  };

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findOrCreateUnitByName: jest.fn(),
      findDefaultWarehouse: jest.fn(),
      createInitialStock: jest.fn(),
    } as unknown as jest.Mocked<ProductsRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: mockRepo },
        // NTIN tests never send stockQuantity, so a no-op StockService is enough.
        { provide: StockService, useValue: { adjustStock: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('creates a product WITHOUT ntin (ntin is not required)', async () => {
    mockRepo.create.mockResolvedValue({ ...baseProduct, ntin: null } as any);

    const result = await service.create(
      { name: 'Молоко 1 л', sku: 'MILK-001', barcode: '4870001234567', price: 450 } as any,
      currentUser,
    );

    expect(result.ntin).toBeNull();
    const data = mockRepo.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(data.ntin).toBeUndefined();
    // SKU and barcode are untouched
    expect(data.sku).toBe('MILK-001');
    expect(data.barcode).toBe('4870001234567');
  });

  it('creates a product WITH ntin and persists it', async () => {
    mockRepo.create.mockResolvedValue({
      ...baseProduct,
      ntin: '123456789',
    } as any);

    const result = await service.create(
      {
        name: 'Молоко 1 л',
        barcode: '4870001234567',
        ntin: '123456789',
        sku: 'MILK-001',
        price: 450,
      } as any,
      currentUser,
    );

    const data = mockRepo.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(data.ntin).toBe('123456789');
    expect(result.ntin).toBe('123456789');
    // All three identifiers exist independently
    expect(result.sku).toBe('MILK-001');
    expect(result.barcode).toBe('4870001234567');
  });

  it('updates ntin', async () => {
    mockRepo.findById.mockResolvedValue({ ...baseProduct, ntin: '123456789' } as any);
    mockRepo.update.mockResolvedValue({ ...baseProduct, ntin: '987654321' } as any);

    const result = await service.update(
      'prod-1',
      { ntin: '987654321' } as any,
      currentUser,
    );

    expect(mockRepo.update).toHaveBeenCalledWith(
      'prod-1',
      { ntin: '987654321' },
      'comp-1',
      0,
    );
    expect(result.ntin).toBe('987654321');
  });

  it('clears ntin with an explicit null', async () => {
    mockRepo.findById.mockResolvedValue({ ...baseProduct, ntin: '123456789' } as any);
    mockRepo.update.mockResolvedValue({ ...baseProduct, ntin: null } as any);

    const result = await service.update(
      'prod-1',
      { ntin: null } as any,
      currentUser,
    );

    const data = mockRepo.update.mock.calls[0]![1] as Record<string, unknown>;
    expect(data).toEqual({ ntin: null });
    expect(result.ntin).toBeNull();
  });

  it('keeps ntin untouched when the field is omitted (partial update)', async () => {
    mockRepo.findById.mockResolvedValue({ ...baseProduct, ntin: '123456789' } as any);
    mockRepo.update.mockResolvedValue({ ...baseProduct, ntin: '123456789' } as any);

    await service.update('prod-1', { name: 'Молоко 1.5 л' } as any, currentUser);

    const data = mockRepo.update.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(data, 'ntin')).toBe(false);
  });

  it('legacy products without ntin keep working (mapper defaults to null)', () => {
    const legacy = { ...baseProduct } as Record<string, unknown>;
    delete legacy.ntin; // simulate an old row / old API payload

    const entity = ProductMapper.toEntity(legacy);

    expect(entity.ntin).toBeNull();
    expect(entity.sku).toBe('MILK-001');
    expect(entity.barcode).toBe('4870001234567');
  });

  it('API response returns ntin alongside sku and barcode', () => {
    const entity = ProductMapper.toEntity({
      ...baseProduct,
      ntin: '123456789',
    });

    expect(entity.ntin).toBe('123456789');
    expect(entity.sku).toBe('MILK-001');
    expect(entity.barcode).toBe('4870001234567');
  });

  it('passes the ntin filter to the repository for search', async () => {
    mockRepo.findAll.mockResolvedValue({ items: [], total: 0 });

    await service.findAll(
      { ntin: '123456789' } as any,
      currentUser,
    );

    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'comp-1', ntin: '123456789' }),
    );
  });
});
