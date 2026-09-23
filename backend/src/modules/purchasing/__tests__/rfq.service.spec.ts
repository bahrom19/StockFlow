import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RFQService } from '../services/rfq.service';
import { RFQRepository } from '../repositories/rfq.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EVENT_BUS } from '../../../common/events';

const companyId = 'comp-1';
const userId = 'user-1';
const productId = 'prod-1';

const baseRfq = {
  id: 'rfq-1',
  companyId,
  rfqNumber: 'RFQ-TEST-0001',
  status: 'DRAFT',
  createdBy: userId,
};

describe('RFQService (G14-03-06 product validation)', () => {
  let service: RFQService;
  let mockRepo: any;
  let mockAuditLog: any;
  let mockEventBus: { publish: jest.Mock };
  const mockTransaction = jest.fn();

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findByRfqNumber: jest.fn(),
    };
    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) };
    mockEventBus = { publish: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RFQService,
        { provide: RFQRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: { $transaction: mockTransaction } },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<RFQService>(RFQService);
    mockRepo.findByRfqNumber.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const itemDto = (pid: string) => ({ productId: pid, quantity: 10 });

  // 1. valid same-company active product → create PASS.
  it('should create RFQ with same-company active product', async () => {
    const mockTx = {
      product: { findMany: jest.fn().mockResolvedValue([{ id: productId }]) },
    };
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
    mockRepo.create.mockResolvedValue(baseRfq as any);

    const result = await service.create(
      { items: [itemDto(productId)] } as any,
      userId,
      companyId,
    );
    expect(result).toBeDefined();
    expect(mockTx.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [productId] },
          companyId,
          deletedAt: null,
        }),
      }),
    );
    expect(mockRepo.create).toHaveBeenCalled();
  });

  // 2. cross-company product → reject.
  it('should reject create with cross-company product', async () => {
    const mockTx = {
      product: { findMany: jest.fn().mockResolvedValue([]) },
    };
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));

    await expect(
      service.create({ items: [itemDto('foreign-product')] } as any, userId, companyId),
    ).rejects.toThrow(NotFoundException);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  // 3. deleted product → reject.
  it('should reject create with soft-deleted product', async () => {
    const mockTx = {
      product: { findMany: jest.fn().mockResolvedValue([]) },
    };
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));

    await expect(
      service.create({ items: [itemDto('deleted-product')] } as any, userId, companyId),
    ).rejects.toThrow(NotFoundException);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  // 4. nonexistent product → reject.
  it('should reject create with nonexistent product ID', async () => {
    const mockTx = {
      product: { findMany: jest.fn().mockResolvedValue([]) },
    };
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));

    await expect(
      service.create({ items: [itemDto('no-such-product')] } as any, userId, companyId),
    ).rejects.toThrow(NotFoundException);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  // 5. multiple products validated in one batch (no N+1).
  it('should validate multiple products in a single batched query', async () => {
    const mockTx = {
      product: {
        findMany: jest.fn().mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]),
      },
    };
    mockTransaction.mockImplementation((cb: (tx: any) => any) => cb(mockTx));
    mockRepo.create.mockResolvedValue(baseRfq as any);

    const result = await service.create(
      { items: [itemDto('p1'), itemDto('p2'), itemDto('p1')] } as any,
      userId,
      companyId,
    );
    expect(result).toBeDefined();
    // Deduplicated IDs in a single query — no per-item lookup.
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
  });
});
