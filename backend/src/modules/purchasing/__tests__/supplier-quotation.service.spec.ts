import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SupplierQuotationService } from '../services/supplier-quotation.service';
import { SupplierQuotationRepository } from '../repositories/supplier-quotation.repository';
import { RFQRepository } from '../repositories/rfq.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';

const companyId = 'comp-1';
const userId = 'user-1';
const supplierId = 'supplier-1';
const productId = 'prod-1';
const rfqId = 'rfq-1';

const baseQuotation = {
  id: 'qt-1',
  companyId,
  rfqId,
  supplierId,
  quotationNumber: 'QTN-TEST-0001',
  status: 'DRAFT',
  grandTotal: '1000',
};

describe('SupplierQuotationService (G14-03-06 supplier/product validation)', () => {
  let service: SupplierQuotationService;
  let mockRepo: any;
  let mockRfqRepo: any;
  let mockAuditLog: any;
  const mockTransaction = jest.fn();

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findByQuotationNumber: jest.fn(),
    };
    mockRfqRepo = {
      findById: jest.fn(),
    };
    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierQuotationService,
        { provide: SupplierQuotationRepository, useValue: mockRepo },
        { provide: RFQRepository, useValue: mockRfqRepo },
        { provide: PrismaService, useValue: { $transaction: mockTransaction } },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<SupplierQuotationService>(SupplierQuotationService);
    mockRepo.findByQuotationNumber.mockResolvedValue(null);
    mockRfqRepo.findById.mockResolvedValue({ id: rfqId, companyId });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const itemDto = (pid: string) => ({
    productId: pid,
    quantity: 10,
    unitCost: 100.0,
  });
  const dto = (sid: string, items: any[]) => ({
    rfqId,
    supplierId: sid,
    items,
  });
  // Valid tenant-resolved tx: supplier + all requested products resolve.
  const validTx = (productIds: string[]) => ({
    supplier: { findFirst: jest.fn().mockResolvedValue({ id: supplierId }) },
    product: {
      findMany: jest.fn().mockResolvedValue(productIds.map((id) => ({ id }))),
    },
  });

  // 1. valid same-company supplier → create PASS.
  it('should create quotation with same-company supplier', async () => {
    const mockTx = validTx([productId]);
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
    mockRepo.create.mockResolvedValue(baseQuotation as any);

    const result = await service.create(
      dto(supplierId, [itemDto(productId)]) as any,
      userId,
      companyId,
    );
    expect(result).toBeDefined();
    expect(mockTx.supplier.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: supplierId,
          companyId,
          deletedAt: null,
        }),
      }),
    );
    expect(mockRepo.create).toHaveBeenCalled();
  });

  // 2. cross-company supplier → reject.
  it('should reject create with cross-company supplier', async () => {
    const mockTx = {
      supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      product: { findMany: jest.fn() },
    };
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));

    await expect(
      service.create(dto('foreign-supplier', [itemDto(productId)]) as any, userId, companyId),
    ).rejects.toThrow(NotFoundException);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  // 3. deleted supplier → reject.
  it('should reject create with soft-deleted supplier', async () => {
    const mockTx = {
      supplier: { findFirst: jest.fn().mockResolvedValue(null) },
      product: { findMany: jest.fn() },
    };
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));

    await expect(
      service.create(dto('deleted-supplier', [itemDto(productId)]) as any, userId, companyId),
    ).rejects.toThrow(NotFoundException);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  // 4. valid product → covered by test 1 (explicit predicate check here).
  it('should validate quotation products with tenant scope', async () => {
    const mockTx = validTx([productId]);
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
    mockRepo.create.mockResolvedValue(baseQuotation as any);

    await service.create(dto(supplierId, [itemDto(productId)]) as any, userId, companyId);

    expect(mockTx.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [productId] },
          companyId,
          deletedAt: null,
        }),
      }),
    );
  });

  // 5. cross-company product → reject.
  it('should reject create with cross-company product', async () => {
    const mockTx = {
      supplier: { findFirst: jest.fn().mockResolvedValue({ id: supplierId }) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
    };
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));

    await expect(
      service.create(dto(supplierId, [itemDto('foreign-product')]) as any, userId, companyId),
    ).rejects.toThrow(NotFoundException);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  // 6. deleted product → reject.
  it('should reject create with soft-deleted product', async () => {
    const mockTx = {
      supplier: { findFirst: jest.fn().mockResolvedValue({ id: supplierId }) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
    };
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));

    await expect(
      service.create(dto(supplierId, [itemDto('deleted-product')]) as any, userId, companyId),
    ).rejects.toThrow(NotFoundException);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  // 7. nonexistent product → reject.
  it('should reject create with nonexistent product ID', async () => {
    const mockTx = {
      supplier: { findFirst: jest.fn().mockResolvedValue({ id: supplierId }) },
      product: { findMany: jest.fn().mockResolvedValue([]) },
    };
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));

    await expect(
      service.create(dto(supplierId, [itemDto('no-such-product')]) as any, userId, companyId),
    ).rejects.toThrow(NotFoundException);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  // 8. supplier + multiple products validated without N+1.
  it('should validate supplier and multiple products in batched queries', async () => {
    const mockTx = validTx(['p1', 'p2']);
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
    mockRepo.create.mockResolvedValue(baseQuotation as any);

    const result = await service.create(
      dto(supplierId, [itemDto('p1'), itemDto('p2'), itemDto('p1')]) as any,
      userId,
      companyId,
    );
    expect(result).toBeDefined();
    expect(mockTx.supplier.findFirst).toHaveBeenCalledTimes(1);
    expect(mockTx.product.findMany).toHaveBeenCalledTimes(1);
    expect(mockTx.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['p1', 'p2'] },
          companyId,
          deletedAt: null,
        }),
      }),
    );
    expect(mockRepo.create).toHaveBeenCalled();
  });
});
