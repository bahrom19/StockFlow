import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductsService } from '../services/products.service';
import { ProductsRepository } from '../repositories/products.repository';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

describe('ProductsService', () => {
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
    name: 'Test Product',
    companyId: 'comp-1',
    sku: 'SKU-001',
    isActive: true,
    price: new Prisma.Decimal(1000),
    costPrice: new Prisma.Decimal(600),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    description: null,
    barcode: null,
    category: null,
    brand: null,
    unit: null,
    stockQuantity: 0,
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
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should create a product', async () => {
    mockRepo.create.mockResolvedValue(baseProduct as any);
    const result = await service.create(
      {
        name: 'Test Product',
        sku: 'SKU-001',
        price: 1000,
        costPrice: 600,
      } as any,
      currentUser,
    );
    expect(result.name).toBe('Test Product');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ company: { connect: { id: 'comp-1' } } }),
    );
  });

  it('should persist unit by resolving the UnitOfMeasure (find-or-create)', async () => {
    mockRepo.findOrCreateUnitByName.mockResolvedValue({ id: 'uom-1' });
    mockRepo.create.mockResolvedValue(baseProduct as any);

    await service.create(
      { name: 'Coffee', price: 100, unit: 'kg' } as any,
      currentUser,
    );

    expect(mockRepo.findOrCreateUnitByName).toHaveBeenCalledWith(
      'kg',
      'comp-1',
    );
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ unit: { connect: { id: 'uom-1' } } }),
    );
  });

  it('should not resolve a unit when unit is omitted', async () => {
    mockRepo.create.mockResolvedValue(baseProduct as any);

    await service.create({ name: 'Coffee', price: 100 } as any, currentUser);

    expect(mockRepo.findOrCreateUnitByName).not.toHaveBeenCalled();
    const data = mockRepo.create.mock.calls[0]![0] as Record<string, unknown>;
    expect(data.unit).toBeUndefined();
  });

  it('should persist initial stockQuantity in the default warehouse', async () => {
    mockRepo.create.mockResolvedValue({ ...baseProduct, id: 'prod-1' } as any);
    mockRepo.findDefaultWarehouse.mockResolvedValue({ id: 'wh-1' });
    mockRepo.findById.mockResolvedValue({
      ...baseProduct,
      id: 'prod-1',
      unit: { name: 'kg' },
      stocks: [{ quantity: 15 }],
    } as any);

    const result = await service.create(
      { name: 'Rice', price: 50, stockQuantity: 15 } as any,
      currentUser,
    );

    expect(mockRepo.findDefaultWarehouse).toHaveBeenCalledWith('comp-1');
    // The warehouse is resolved BEFORE the product is created (fail fast).
    expect(mockRepo.create).toHaveBeenCalled();
    expect(mockRepo.createInitialStock).toHaveBeenCalledWith({
      productId: 'prod-1',
      warehouseId: 'wh-1',
      companyId: 'comp-1',
      quantity: 15,
      userId: 'me',
    });
    // Response reflects the persisted stock + unit name.
    expect(result.stockQuantity).toBe(15);
    expect(result.unit).toBe('kg');
  });

  it('should fail fast with 422 when stockQuantity requested but no warehouse exists', async () => {
    mockRepo.create.mockResolvedValue(baseProduct as any);
    mockRepo.findDefaultWarehouse.mockResolvedValue(null);

    await expect(
      service.create(
        { name: 'Rice', price: 50, stockQuantity: 15 } as any,
        currentUser,
      ),
    ).rejects.toThrow(UnprocessableEntityException);

    // Fail fast: the product must NOT be created, and no stock row written.
    expect(mockRepo.create).not.toHaveBeenCalled();
    expect(mockRepo.createInitialStock).not.toHaveBeenCalled();
  });

  it('should not create stock when stockQuantity is zero/absent (warehouse not needed)', async () => {
    mockRepo.create.mockResolvedValue(baseProduct as any);

    await service.create({ name: 'Rice', price: 50 } as any, currentUser);

    expect(mockRepo.findDefaultWarehouse).not.toHaveBeenCalled();
    expect(mockRepo.createInitialStock).not.toHaveBeenCalled();
  });

  it('should still create product without warehouse when stockQuantity is 0', async () => {
    mockRepo.create.mockResolvedValue(baseProduct as any);

    await service.create(
      { name: 'Rice', price: 50, stockQuantity: 0 } as any,
      currentUser,
    );

    expect(mockRepo.findDefaultWarehouse).not.toHaveBeenCalled();
    expect(mockRepo.create).toHaveBeenCalled();
  });

  it('should find all products with pagination', async () => {
    mockRepo.findAll.mockResolvedValue({ items: [baseProduct], total: 1 });
    const result = await service.findAll(
      { page: 1, limit: 20 } as any,
      currentUser,
    );
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('should find product by id', async () => {
    mockRepo.findById.mockResolvedValue(baseProduct as any);
    const result = await service.findById('prod-1', currentUser);
    expect(result.id).toBe('prod-1');
  });

  it('should throw NotFoundException when product not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.findById('unknown', currentUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should update a product', async () => {
    mockRepo.findById.mockResolvedValue(baseProduct as any);
    mockRepo.update.mockResolvedValue({
      ...baseProduct,
      name: 'Updated',
    } as any);
    const result = await service.update(
      'prod-1',
      { name: 'Updated' } as any,
      currentUser,
    );
    expect(result.name).toBe('Updated');
  });

  it('should not send undefined decimal fields on partial update', async () => {
    mockRepo.findById.mockResolvedValue(baseProduct as any);
    mockRepo.update.mockResolvedValue({
      ...baseProduct,
      name: 'Renamed',
    } as any);

    // Name-only update must NOT include price/costPrice keys at all
    await service.update('prod-1', { name: 'Renamed' } as any, currentUser);

    expect(mockRepo.update).toHaveBeenCalledWith(
      'prod-1',
      expect.objectContaining({ name: 'Renamed' }),
      'comp-1',
      0,
    );
    const data = mockRepo.update.mock.calls[0]![1] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(data, 'price')).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(data, 'costPrice'),
    ).toBe(false);
  });

  it('should pass only explicitly provided fields to repository', async () => {
    mockRepo.findById.mockResolvedValue(baseProduct as any);
    mockRepo.update.mockResolvedValue({
      ...baseProduct,
      price: new Prisma.Decimal(88.88),
    } as any);

    await service.update(
      'prod-1',
      { name: 'Renamed', price: 88.88 } as any,
      currentUser,
    );

    const data = mockRepo.update.mock.calls[0]![1] as Record<string, unknown>;
    expect(data).toEqual({ name: 'Renamed', price: 88.88 });
    expect(
      Object.prototype.hasOwnProperty.call(data, 'costPrice'),
    ).toBe(false);
  });

  it('should reject body companyId that mismatches the JWT company', async () => {
    await expect(
      service.create(
        {
          name: 'X',
          price: 100,
          companyId: 'other-company',
        } as any,
        currentUser,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('should accept matching body companyId', async () => {
    mockRepo.create.mockResolvedValue(baseProduct as any);
    await service.create(
      {
        name: 'X',
        price: 100,
        companyId: 'comp-1',
      } as any,
      currentUser,
    );
    expect(mockRepo.create).toHaveBeenCalled();
  });

  it('should soft delete a product', async () => {
    mockRepo.findById.mockResolvedValue(baseProduct as any);
    mockRepo.softDelete.mockResolvedValue({
      ...baseProduct,
      deletedAt: new Date(),
    } as any);
    const result = await service.softDelete('prod-1', currentUser);
    expect(result.deletedAt).not.toBeNull();
  });

  it('should enforce company isolation', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      service.findById('prod-1', {
        ...currentUser,
        companyId: 'other-company',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(mockRepo.findById).toHaveBeenCalledWith('prod-1', 'other-company');
  });
});
