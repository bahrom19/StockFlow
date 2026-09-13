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
    defaultDueDays: null,
    creditLimit: null,
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

  // ─────────────────────────────────────────────
  // G9-C: SUPPLIER TERMS & CREDIT FOUNDATION
  // ─────────────────────────────────────────────
  describe('G9-C supplier terms (defaultDueDays / creditLimit)', () => {
    it('creates a supplier with defaultDueDays and creditLimit', async () => {
      mockRepo.create.mockResolvedValue({
        ...baseSupplier,
        defaultDueDays: 30,
        creditLimit: new Prisma.Decimal('1000000'),
      } as any);

      const result = await service.create(
        {
          companyName: 'Terms Co',
          defaultDueDays: 30,
          creditLimit: 1000000,
        } as any,
        currentUser,
      );

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultDueDays: 30,
          creditLimit: 1000000,
        }),
        mockTx,
      );
      expect(result.defaultDueDays).toBe(30);
      expect(result.creditLimit).toBe('1000000');
    });

    it('creates a supplier without terms (no implicit defaults)', async () => {
      mockRepo.create.mockResolvedValue(baseSupplier as any);

      const result = await service.create(
        { companyName: 'Plain Co' } as any,
        currentUser,
      );

      const data = mockRepo.create.mock.calls[0]?.[0] as any;
      expect(data.defaultDueDays).toBeUndefined();
      expect(data.creditLimit).toBeUndefined();
      expect(result.defaultDueDays).toBeNull();
      expect(result.creditLimit).toBeNull();
    });

    it('updates defaultDueDays and creditLimit', async () => {
      mockRepo.findById.mockResolvedValue(baseSupplier as any);
      mockRepo.update.mockResolvedValue({
        ...baseSupplier,
        defaultDueDays: 45,
        creditLimit: new Prisma.Decimal('250000.5'),
      } as any);

      const result = await service.update(
        'supp-1',
        { defaultDueDays: 45, creditLimit: 250000.5 } as any,
        currentUser,
      );

      expect(mockRepo.update).toHaveBeenCalledWith(
        'supp-1',
        expect.objectContaining({
          defaultDueDays: 45,
          creditLimit: 250000.5,
        }),
        'comp-1',
        0,
        mockTx,
      );
      expect(result.defaultDueDays).toBe(45);
      expect(result.creditLimit).toBe('250000.5');
    });

    it('does not touch terms when they are not provided on update', async () => {
      mockRepo.findById.mockResolvedValue(baseSupplier as any);
      mockRepo.update.mockResolvedValue(baseSupplier as any);

      await service.update('supp-1', { notes: 'x' } as any, currentUser);

      const data = mockRepo.update.mock.calls[0]?.[1] as any;
      expect(data.defaultDueDays).toBeUndefined();
      expect(data.creditLimit).toBeUndefined();
    });

    it('keeps tenant isolation on terms updates', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(
        service.update(
          'supp-1',
          { defaultDueDays: 30 } as any,
          { ...currentUser, companyId: 'other-comp' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    describe('DTO validation', () => {
      const plainToInstance = require('class-transformer').plainToInstance;
      const { validate } = require('class-validator');
      const { CreateSupplierDto } = require('../dto/create-supplier.dto');

      async function validateDto(body: Record<string, unknown>) {
        const dto = plainToInstance(CreateSupplierDto, body);
        return validate(dto, { skipMissingProperties: true });
      }

      it('accepts defaultDueDays = 0 and positive integers', async () => {
        expect(await validateDto({ defaultDueDays: 0 })).toHaveLength(0);
        expect(await validateDto({ defaultDueDays: 30 })).toHaveLength(0);
      });

      it('rejects negative and non-integer defaultDueDays', async () => {
        expect(await validateDto({ defaultDueDays: -1 })).not.toHaveLength(0);
        expect(await validateDto({ defaultDueDays: 1.5 })).not.toHaveLength(0);
      });

      it('accepts creditLimit = 0 and positive decimals', async () => {
        expect(await validateDto({ creditLimit: 0 })).toHaveLength(0);
        expect(await validateDto({ creditLimit: 1000000.5 })).toHaveLength(0);
      });

      it('rejects negative creditLimit', async () => {
        expect(await validateDto({ creditLimit: -1 })).not.toHaveLength(0);
      });

      it('allows both fields to be omitted', async () => {
        expect(await validateDto({ companyName: 'X' })).toHaveLength(0);
      });
    });
  });
});
