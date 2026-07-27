import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { SuppliersService } from '../services/suppliers.service';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let mockRepo: jest.Mocked<SuppliersRepository>;
  let mockPrisma: { $transaction: jest.Mock };
  let mockTx: Record<string, any>;

  const currentUser = {
    userId: 'me',
    companyId: 'comp-1',
    roles: ['Admin'],
    email: 'me@test.com',
  };
  const baseSupplier = {
    id: 'supp-1',
    companyId: 'comp-1',
    companyName: 'Supply Co',
    bin: '123456789012',
    email: 'supply@test.com',
    phone: '+77001112233',
    website: null,
    notes: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    rowVersion: 0,
  };

  beforeEach(async () => {
    mockRepo = {
      findAll: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<SuppliersRepository>;

    mockTx = {};
    mockPrisma = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: SuppliersRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  it('should create a supplier', async () => {
    mockRepo.findAll.mockResolvedValue({ items: [], total: 0 });
    mockRepo.create.mockResolvedValue(baseSupplier as any);

    const result = await service.create(
      {
        companyName: 'Supply Co',
        bin: '123456789012',
      } as any,
      currentUser,
    );

    expect(result.id).toBe('supp-1');
  });

  it('should throw ConflictException when supplier already exists', async () => {
    mockRepo.findAll.mockResolvedValue({ items: [baseSupplier], total: 1 });
    await expect(
      service.create({ email: 'exists@test.com' } as any, currentUser),
    ).rejects.toThrow(ConflictException);
  });

  // ─────────────────────────────────────────────
  // FIND ALL
  // ─────────────────────────────────────────────
  it('should return paginated suppliers', async () => {
    mockRepo.findAll.mockResolvedValue({ items: [baseSupplier], total: 1 });
    const result = await service.findAll(
      { page: 1, limit: 20 } as any,
      currentUser,
    );
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  // ─────────────────────────────────────────────
  // FIND BY ID
  // ─────────────────────────────────────────────
  it('should find supplier by id', async () => {
    mockRepo.findById.mockResolvedValue(baseSupplier as any);
    const result = await service.findById('supp-1', currentUser);
    expect(result.id).toBe('supp-1');
  });

  it('should throw NotFoundException when not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.findById('unknown', currentUser)).rejects.toThrow(
      NotFoundException,
    );
  });

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  it('should update supplier', async () => {
    mockRepo.findById.mockResolvedValue(baseSupplier as any);
    mockRepo.update.mockResolvedValue({
      ...baseSupplier,
      companyName: 'Updated Co',
    } as any);
    const result = await service.update(
      'supp-1',
      { companyName: 'Updated Co' } as any,
      currentUser,
    );
    expect(result.companyName).toBe('Updated Co');
  });

  // ─────────────────────────────────────────────
  // SOFT DELETE
  // ─────────────────────────────────────────────
  it('should soft delete a supplier', async () => {
    mockRepo.findById.mockResolvedValue(baseSupplier as any);
    mockRepo.softDelete.mockResolvedValue({
      ...baseSupplier,
      deletedAt: new Date(),
    } as any);
    const result = await service.softDelete('supp-1', currentUser);
    expect(result.deletedAt).not.toBeNull();
  });

  // ─────────────────────────────────────────────
  // MULTI-TENANT ISOLATION
  // ─────────────────────────────────────────────
  it('should reject cross-company findById', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      service.findById('supp-1', { ...currentUser, companyId: 'other' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should scope findAll to company', async () => {
    mockRepo.findAll.mockResolvedValue({ items: [], total: 0 });
    await service.findAll({ page: 1, limit: 20 } as any, currentUser);
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'comp-1' }),
    );
  });
});
