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
      findActiveByEmail: jest.fn().mockResolvedValue(null),
      findActiveByPhone: jest.fn().mockResolvedValue(null),
      findActiveByBin: jest.fn().mockResolvedValue(null),
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

  // G1: field-level duplicate checks
  it('should reject duplicate email on create', async () => {
    mockRepo.findActiveByEmail.mockResolvedValue(baseSupplier as any);
    await expect(
      service.create({ companyName: 'New', email: 'dup@test.com' } as any, currentUser),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject duplicate phone on create', async () => {
    mockRepo.findActiveByPhone.mockResolvedValue(baseSupplier as any);
    await expect(
      service.create({ companyName: 'New', phone: '+77001112233' } as any, currentUser),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject duplicate BIN on create', async () => {
    mockRepo.findActiveByBin.mockResolvedValue(baseSupplier as any);
    await expect(
      service.create({ companyName: 'New', bin: '123456789012' } as any, currentUser),
    ).rejects.toThrow(ConflictException);
  });

  it('should allow create when no duplicates', async () => {
    mockRepo.create.mockResolvedValue(baseSupplier as any);
    const result = await service.create(
      { companyName: 'Supply Co', email: 'new@test.com', phone: '+77009998877', bin: '999999999999' } as any,
      currentUser,
    );
    expect(result.id).toBe('supp-1');
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

  // G1: field-level duplicate checks on update
  it('should reject duplicate email on update', async () => {
    mockRepo.findById.mockResolvedValue(baseSupplier as any);
    mockRepo.findActiveByEmail.mockResolvedValue({ ...baseSupplier, id: 'other' } as any);
    await expect(
      service.update('supp-1', { email: 'taken@test.com' } as any, currentUser),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject duplicate phone on update', async () => {
    mockRepo.findById.mockResolvedValue(baseSupplier as any);
    mockRepo.findActiveByPhone.mockResolvedValue({ ...baseSupplier, id: 'other' } as any);
    await expect(
      service.update('supp-1', { phone: '+77009998877' } as any, currentUser),
    ).rejects.toThrow(ConflictException);
  });

  it('should reject duplicate BIN on update', async () => {
    mockRepo.findById.mockResolvedValue(baseSupplier as any);
    mockRepo.findActiveByBin.mockResolvedValue({ ...baseSupplier, id: 'other' } as any);
    await expect(
      service.update('supp-1', { bin: '999999999999' } as any, currentUser),
    ).rejects.toThrow(ConflictException);
  });

  it('should allow self-update with same email/phone/BIN', async () => {
    mockRepo.findById.mockResolvedValue(baseSupplier as any);
    mockRepo.update.mockResolvedValue({ ...baseSupplier, companyName: 'Updated' } as any);
    // Same values as existing — should not trigger duplicate check
    const result = await service.update(
      'supp-1',
      { email: 'supply@test.com', phone: '+77001112233', bin: '123456789012' } as any,
      currentUser,
    );
    expect(result.companyName).toBe('Updated');
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
  // G1: CROSS-COMPANY DUPLICATE ISOLATION
  // ─────────────────────────────────────────────
  it('should scope duplicate checks to company', async () => {
    mockRepo.create.mockResolvedValue(baseSupplier as any);
    await service.create(
      { companyName: 'New', email: 'same@test.com' } as any,
      currentUser,
    );
    // findActiveByEmail should be called with the correct companyId
    expect(mockRepo.findActiveByEmail).toHaveBeenCalledWith(
      'same@test.com',
      'comp-1',
    );
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
