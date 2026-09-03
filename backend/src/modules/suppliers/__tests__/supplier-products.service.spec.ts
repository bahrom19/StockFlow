import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { SupplierProductsService } from '../services/supplier-products.service';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { SupplierProductsRepository } from '../repositories/supplier-products.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

const companyId = 'comp-1';
const supplierId = 'supplier-1';
const productId = 'product-1';
const spId = 'sp-1';

const baseSupplier = {
  id: supplierId,
  companyId,
  companyName: 'Test Supplier',
  isActive: true,
  deletedAt: null,
};

const baseProduct = {
  id: productId,
  companyId,
  name: 'Test Product',
  sku: 'SKU-001',
  deletedAt: null,
};

const baseSp = {
  id: spId,
  companyId,
  supplierId,
  productId,
  supplierSku: 'SUP-001',
  purchasePrice: null,
  currency: 'KZT' as any,
  isPreferred: false,
  notes: null,
  lastPurchaseAt: null,
  rowVersion: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  product: { id: productId, name: 'Test Product', sku: 'SKU-001' },
};

describe('SupplierProductsService', () => {
  let service: SupplierProductsService;
  let mockPrisma: any;
  let mockSuppliersRepo: any;
  let mockSupplierProductsRepo: any;

  beforeEach(async () => {
    mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockPrisma)),
      product: {
        findFirst: jest.fn().mockResolvedValue(baseProduct),
      },
    };

    mockSuppliersRepo = {
      findById: jest.fn().mockResolvedValue(baseSupplier),
    };

    mockSupplierProductsRepo = {
      findMany: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      findById: jest.fn().mockResolvedValue(null),
      findBySupplierAndProduct: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data: any) =>
        Promise.resolve({ ...baseSp, ...data }),
      ),
      update: jest.fn().mockImplementation((id: string, companyId: string, data: any) =>
        Promise.resolve({ ...baseSp, ...data }),
      ),
      softDelete: jest.fn().mockResolvedValue(undefined),
      clearPreferred: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierProductsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SuppliersRepository, useValue: mockSuppliersRepo },
        { provide: SupplierProductsRepository, useValue: mockSupplierProductsRepo },
      ],
    }).compile();

    service = module.get<SupplierProductsService>(SupplierProductsService);
  });

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  describe('create', () => {
    it('should create a supplier product successfully', async () => {
      const result = await service.create(
        supplierId,
        { productId, supplierSku: 'SUP-001', purchasePrice: 1500 },
        companyId,
      );
      expect(result).toBeDefined();
      expect(mockSupplierProductsRepo.create).toHaveBeenCalledTimes(1);
    });

    it('should reject supplier not found', async () => {
      mockSuppliersRepo.findById.mockResolvedValue(null);
      await expect(
        service.create(supplierId, { productId }, companyId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject product not found', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      await expect(
        service.create(supplierId, { productId }, companyId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject cross-tenant product', async () => {
      mockPrisma.product.findFirst.mockResolvedValue(null);
      await expect(
        service.create(supplierId, { productId: 'other-company-product' }, companyId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject duplicate active relation', async () => {
      mockSupplierProductsRepo.findBySupplierAndProduct.mockResolvedValue(baseSp);
      await expect(
        service.create(supplierId, { productId }, companyId),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject non-KZT currency', async () => {
      await expect(
        service.create(supplierId, { productId, currency: 'USD' as any }, companyId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject zero purchase price', async () => {
      await expect(
        service.create(supplierId, { productId, purchasePrice: 0 }, companyId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative purchase price', async () => {
      await expect(
        service.create(supplierId, { productId, purchasePrice: -100 }, companyId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should clear existing preferred when setting new preferred', async () => {
      await service.create(
        supplierId,
        { productId, isPreferred: true },
        companyId,
      );
      expect(mockSupplierProductsRepo.clearPreferred).toHaveBeenCalledWith(
        productId,
        companyId,
        undefined,
        expect.anything(),
      );
    });
  });

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────

  describe('update', () => {
    it('should update supplier product successfully', async () => {
      mockSupplierProductsRepo.findById.mockResolvedValue(baseSp);
      const result = await service.update(spId, supplierId, companyId, {
        purchasePrice: 2000,
      });
      expect(result).toBeDefined();
    });

    it('should reject not found', async () => {
      mockSupplierProductsRepo.findById.mockResolvedValue(null);
      await expect(
        service.update(spId, supplierId, companyId, { purchasePrice: 2000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject zero purchase price on update', async () => {
      mockSupplierProductsRepo.findById.mockResolvedValue(baseSp);
      await expect(
        service.update(spId, supplierId, companyId, { purchasePrice: 0 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle preferred switching on update', async () => {
      mockSupplierProductsRepo.findById.mockResolvedValue({
        ...baseSp,
        isPreferred: false,
      });
      await service.update(spId, supplierId, companyId, { isPreferred: true });
      expect(mockSupplierProductsRepo.clearPreferred).toHaveBeenCalled();
    });

    it('should not clear preferred when already preferred', async () => {
      mockSupplierProductsRepo.findById.mockResolvedValue({
        ...baseSp,
        isPreferred: true,
      });
      await service.update(spId, supplierId, companyId, { isPreferred: true });
      expect(mockSupplierProductsRepo.clearPreferred).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // DELETE
  // ─────────────────────────────────────────────

  describe('remove', () => {
    it('should soft delete successfully', async () => {
      mockSupplierProductsRepo.findById.mockResolvedValue(baseSp);
      await service.remove(spId, supplierId, companyId);
      expect(mockSupplierProductsRepo.softDelete).toHaveBeenCalledWith(
        spId,
        companyId,
        baseSp.rowVersion,
      );
    });

    it('should reject not found', async () => {
      mockSupplierProductsRepo.findById.mockResolvedValue(null);
      await expect(
        service.remove(spId, supplierId, companyId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // LIST
  // ─────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const result = await service.findAll(supplierId, companyId, {
        page: 1,
        limit: 10,
      });
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
    });

    it('should reject supplier not found', async () => {
      mockSuppliersRepo.findById.mockResolvedValue(null);
      await expect(
        service.findAll(supplierId, companyId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─────────────────────────────────────────────
  // GET BY ID
  // ─────────────────────────────────────────────

  describe('findById', () => {
    it('should return supplier product', async () => {
      mockSupplierProductsRepo.findById.mockResolvedValue(baseSp);
      const result = await service.findById(spId, supplierId, companyId);
      expect(result).toBeDefined();
    });

    it('should reject not found', async () => {
      mockSupplierProductsRepo.findById.mockResolvedValue(null);
      await expect(
        service.findById(spId, supplierId, companyId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
