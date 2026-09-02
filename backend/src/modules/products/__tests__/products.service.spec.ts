import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductsService } from '../services/products.service';
import { ProductsRepository } from '../repositories/products.repository';
import { StockService } from '../../inventory/services';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

describe('ProductsService', () => {
  let service: ProductsService;
  let mockRepo: jest.Mocked<ProductsRepository>;
  let mockStockService: { adjustStock: jest.Mock };

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
    ntin: null,
    category: null,
    brand: null,
    unit: null,
    stockQuantity: 0,
    rowVersion: 0,
    unitId: null,
    costingMethod: 'AVERAGE' as const,
    stocks: [] as { quantity: number }[],
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
      findActiveBySkuAndCompany: jest.fn(),
      findActiveByBarcodeAndCompany: jest.fn(),
    } as unknown as jest.Mocked<ProductsRepository>;

    mockStockService = { adjustStock: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: mockRepo },
        { provide: StockService, useValue: mockStockService },
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
    expect(Object.prototype.hasOwnProperty.call(data, 'costPrice')).toBe(false);
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
    expect(Object.prototype.hasOwnProperty.call(data, 'costPrice')).toBe(false);
  });

  // ── Regression: stockQuantity on PATCH /products/:id ────────────────
  // The product card must be able to change stock. Quantity is not a Product
  // column — updates reconcile the total through StockService.adjustStock so
  // an ADJUSTMENT StockMovement is written by the existing mechanism.
  describe('update — stockQuantity reconciliation', () => {
    const productWithStock = (qty: number) => ({
      ...baseProduct,
      stocks: [{ quantity: qty }],
    });

    beforeEach(() => {
      mockStockService.adjustStock.mockResolvedValue({} as any);
      mockRepo.findDefaultWarehouse.mockResolvedValue({ id: 'wh-1' });
      mockRepo.update.mockResolvedValue(baseProduct as any);
    });

    it.each([
      [10, 25, 15],
      [10, 0, -10],
      [10, 1, -9],
      [10, 100, 90],
    ])(
      'reconciles %i -> %i with a single adjustment of %+i',
      async (currentQty, requestedQty, expectedDelta) => {
        mockRepo.findById
          .mockResolvedValueOnce(productWithStock(currentQty) as any)
          .mockResolvedValueOnce(productWithStock(requestedQty) as any);

        await service.update(
          'prod-1',
          { stockQuantity: requestedQty } as any,
          currentUser,
        );

        expect(mockStockService.adjustStock).toHaveBeenCalledTimes(1);
        expect(mockStockService.adjustStock).toHaveBeenCalledWith(
          {
            productId: 'prod-1',
            warehouseId: 'wh-1',
            quantity: expectedDelta,
            referenceType: 'PRODUCT',
            referenceId: 'prod-1',
            comment: 'Stock reconciled from product card edit',
          },
          'comp-1',
          'me',
        );
        // The raw field must never reach Prisma — Product has no such column.
        const data = mockRepo.update.mock.calls[0]![1] as Record<
          string,
          unknown
        >;
        expect(
          Object.prototype.hasOwnProperty.call(data, 'stockQuantity'),
        ).toBe(false);
        // Response is re-read after the adjustment so the fresh total comes back.
        expect(mockRepo.findById).toHaveBeenCalledTimes(2);
      },
    );

    it('returns the refreshed quantity after the adjustment (10 -> 25 → response 25)', async () => {
      mockRepo.findById
        .mockResolvedValueOnce(productWithStock(10) as any)
        .mockResolvedValueOnce({
          ...productWithStock(25),
          name: 'Diag Widget',
        } as any);

      const result = await service.update(
        'prod-1',
        { stockQuantity: 25 } as any,
        currentUser,
      );

      expect(result.stockQuantity).toBe(25);
    });

    it('does not adjust when the sent quantity equals the current total (10 -> 10)', async () => {
      mockRepo.findById.mockResolvedValue(productWithStock(10) as any);

      await service.update(
        'prod-1',
        { stockQuantity: 10 } as any,
        currentUser,
      );

      expect(mockStockService.adjustStock).not.toHaveBeenCalled();
      expect(mockRepo.findById).toHaveBeenCalledTimes(1);
    });

    it('does not touch stock when stockQuantity is omitted (partial update)', async () => {
      mockRepo.findById.mockResolvedValue(productWithStock(10) as any);

      await service.update('prod-1', { name: 'Renamed' } as any, currentUser);

      expect(mockStockService.adjustStock).not.toHaveBeenCalled();
      expect(
        Object.prototype.hasOwnProperty.call(
          mockRepo.update.mock.calls[0]![1],
          'stockQuantity',
        ),
      ).toBe(false);
    });

    it('fails fast with 422 when no active warehouse exists and delta != 0', async () => {
      mockRepo.findById.mockResolvedValue(productWithStock(10) as any);
      mockRepo.findDefaultWarehouse.mockResolvedValue(null);

      await expect(
        service.update(
          'prod-1',
          { stockQuantity: 25 } as any,
          currentUser,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
      // Fail-fast: nothing written before the warehouse check.
      expect(mockStockService.adjustStock).not.toHaveBeenCalled();
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('propagates the strict-stock rejection when the adjustment would go negative', async () => {
      mockRepo.findById.mockResolvedValue(productWithStock(10) as any);
      mockStockService.adjustStock.mockRejectedValue(
        new BadRequestException('Insufficient stock'),
      );

      await expect(
        service.update(
          'prod-1',
          { stockQuantity: 0 } as any,
          currentUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates stock from zero without a prior Stock row (no stocks relation)', async () => {
      mockRepo.findById
        .mockResolvedValueOnce(baseProduct as any) // no `stocks` key at all
        .mockResolvedValueOnce(productWithStock(5) as any);

      await service.update(
        'prod-1',
        { stockQuantity: 5 } as any,
        currentUser,
      );

      expect(mockStockService.adjustStock).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 5 }),
        'comp-1',
        'me',
      );
    });
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

  // ── SKU / Barcode duplicate validation ──────────────────────────────────

  describe('SKU duplicate validation', () => {
    it('rejects duplicate SKU in same company on create', async () => {
      mockRepo.findActiveBySkuAndCompany.mockResolvedValue({
        id: 'existing',
        name: 'Existing Product',
      });

      await expect(
        service.create(
          { name: 'New', sku: 'SKU-001', price: 100 } as any,
          currentUser,
        ),
      ).rejects.toThrow(ConflictException);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('allows same SKU in different company on create', async () => {
      mockRepo.findActiveBySkuAndCompany.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(baseProduct as any);

      await service.create(
        { name: 'New', sku: 'SKU-001', price: 100 } as any,
        currentUser,
      );
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('allows NULL SKU on create', async () => {
      mockRepo.create.mockResolvedValue({ ...baseProduct, sku: null } as any);

      await service.create(
        { name: 'No SKU', price: 100 } as any,
        currentUser,
      );
      expect(mockRepo.findActiveBySkuAndCompany).not.toHaveBeenCalled();
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('normalizes empty SKU to NULL on create', async () => {
      mockRepo.create.mockResolvedValue({ ...baseProduct, sku: null } as any);

      await service.create(
        { name: 'Empty SKU', sku: '   ', price: 100 } as any,
        currentUser,
      );
      // SKU trimmed to '' → normalized to null → no duplicate check needed
      expect(mockRepo.findActiveBySkuAndCompany).not.toHaveBeenCalled();
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('normalizes whitespace SKU on create', async () => {
      mockRepo.create.mockResolvedValue({ ...baseProduct, sku: 'TRIMMED' } as any);

      await service.create(
        { name: 'Whitespace SKU', sku: '  TRIMMED  ', price: 100 } as any,
        currentUser,
      );
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sku: 'TRIMMED' }),
      );
    });
  });

  describe('Barcode duplicate validation', () => {
    it('rejects duplicate barcode in same company on create', async () => {
      mockRepo.findActiveByBarcodeAndCompany.mockResolvedValue({
        id: 'existing',
        name: 'Existing Product',
      });

      await expect(
        service.create(
          { name: 'New', barcode: '123456789', price: 100 } as any,
          currentUser,
        ),
      ).rejects.toThrow(ConflictException);
      expect(mockRepo.create).not.toHaveBeenCalled();
    });

    it('allows same barcode in different company on create', async () => {
      mockRepo.findActiveByBarcodeAndCompany.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue(baseProduct as any);

      await service.create(
        { name: 'New', barcode: '123456789', price: 100 } as any,
        currentUser,
      );
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('allows NULL barcode on create', async () => {
      mockRepo.create.mockResolvedValue({ ...baseProduct, barcode: null } as any);

      await service.create(
        { name: 'No Barcode', price: 100 } as any,
        currentUser,
      );
      expect(mockRepo.findActiveByBarcodeAndCompany).not.toHaveBeenCalled();
    });

    it('normalizes empty barcode to NULL on create', async () => {
      mockRepo.create.mockResolvedValue({ ...baseProduct, barcode: null } as any);

      await service.create(
        { name: 'Empty Barcode', barcode: '   ', price: 100 } as any,
        currentUser,
      );
      expect(mockRepo.findActiveByBarcodeAndCompany).not.toHaveBeenCalled();
    });
  });

  describe('SKU/barcode update validation', () => {
    it('allows updating product with its own SKU', async () => {
      mockRepo.findById.mockResolvedValue({
        ...baseProduct,
        sku: 'SKU-001',
        barcode: null,
      } as any);
      mockRepo.update.mockResolvedValue({ ...baseProduct, name: 'Updated' } as any);

      const result = await service.update(
        'prod-1',
        { sku: 'SKU-001' } as any,
        currentUser,
      );
      expect(result.name).toBe('Updated');
      expect(mockRepo.findActiveBySkuAndCompany).not.toHaveBeenCalled();
    });

    it('rejects update to another active product SKU', async () => {
      mockRepo.findById.mockResolvedValue({
        ...baseProduct,
        sku: 'OLD-SKU',
        barcode: null,
      } as any);
      mockRepo.findActiveBySkuAndCompany.mockResolvedValue({
        id: 'other',
        name: 'Other Product',
      });

      await expect(
        service.update('prod-1', { sku: 'NEW-SKU' } as any, currentUser),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects update to another active product barcode', async () => {
      mockRepo.findById.mockResolvedValue({
        ...baseProduct,
        sku: null,
        barcode: null,
      } as any);
      mockRepo.findActiveByBarcodeAndCompany.mockResolvedValue({
        id: 'other',
        name: 'Other Product',
      });

      await expect(
        service.update(
          'prod-1',
          { barcode: '123456789' } as any,
          currentUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('allows using SKU of soft-deleted product on update', async () => {
      mockRepo.findById.mockResolvedValue({
        ...baseProduct,
        sku: 'OLD-SKU',
        barcode: null,
      } as any);
      // findActiveBySkuAndCompany returns null because the conflicting product is deleted
      mockRepo.findActiveBySkuAndCompany.mockResolvedValue(null);
      mockRepo.update.mockResolvedValue({ ...baseProduct, sku: 'DELETED-SKU' } as any);

      const result = await service.update(
        'prod-1',
        { sku: 'DELETED-SKU' } as any,
        currentUser,
      );
      expect(result).toBeDefined();
    });

    it('normalizes SKU on update', async () => {
      mockRepo.findById.mockResolvedValue({
        ...baseProduct,
        sku: null,
        barcode: null,
      } as any);
      mockRepo.update.mockResolvedValue({ ...baseProduct, sku: 'TRIMMED' } as any);

      await service.update(
        'prod-1',
        { sku: '  TRIMMED  ' } as any,
        currentUser,
      );
      expect(mockRepo.update).toHaveBeenCalledWith(
        'prod-1',
        expect.objectContaining({ sku: 'TRIMMED' }),
        'comp-1',
        expect.any(Number),
      );
    });
  });

  describe('Regression: existing create/update without SKU/barcode', () => {
    it('creates product without SKU or barcode', async () => {
      mockRepo.create.mockResolvedValue({
        ...baseProduct,
        sku: null,
        barcode: null,
      } as any);

      await service.create(
        { name: 'Simple Product', price: 100 } as any,
        currentUser,
      );
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('updates product without changing SKU or barcode', async () => {
      mockRepo.findById.mockResolvedValue({
        ...baseProduct,
        sku: 'SKU-001',
        barcode: '123',
      } as any);
      mockRepo.update.mockResolvedValue({
        ...baseProduct,
        name: 'Updated',
      } as any);

      await service.update(
        'prod-1',
        { name: 'Updated' } as any,
        currentUser,
      );
      expect(mockRepo.findActiveBySkuAndCompany).not.toHaveBeenCalled();
      expect(mockRepo.findActiveByBarcodeAndCompany).not.toHaveBeenCalled();
    });
  });
});
