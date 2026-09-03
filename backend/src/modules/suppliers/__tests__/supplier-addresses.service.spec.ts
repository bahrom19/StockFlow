import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SupplierAddressesService } from '../services/supplier-addresses.service';
import { SupplierAddressesRepository } from '../repositories/supplier-addresses.repository';
import { SuppliersService } from '../services/suppliers.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('SupplierAddressesService', () => {
  let service: SupplierAddressesService;
  let mockAddressesRepo: jest.Mocked<SupplierAddressesRepository>;
  let mockSuppliersService: jest.Mocked<SuppliersService>;
  let mockPrisma: { $transaction: jest.Mock };

  const currentUser = {
    userId: 'me',
    companyId: 'comp-1',
    roles: ['Admin'],
    email: 'me@test.com',
  };

  const baseAddress = {
    id: 'addr-1',
    supplierId: 'supp-1',
    city: 'Almaty',
    country: 'Kazakhstan',
    street: '123 Main St',
    postalCode: '050000',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    mockAddressesRepo = {
      findAllBySupplier: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(baseAddress as any),
      update: jest.fn().mockResolvedValue(baseAddress as any),
      softDelete: jest.fn().mockResolvedValue({ ...baseAddress, deletedAt: new Date() } as any),
      findActiveDefault: jest.fn().mockResolvedValue(null),
      clearDefault: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SupplierAddressesRepository>;

    mockSuppliersService = {
      findById: jest.fn().mockResolvedValue({ id: 'supp-1' } as any),
    } as unknown as jest.Mocked<SuppliersService>;

    mockPrisma = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierAddressesService,
        { provide: SupplierAddressesRepository, useValue: mockAddressesRepo },
        { provide: SuppliersService, useValue: mockSuppliersService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SupplierAddressesService>(SupplierAddressesService);
  });

  // ── CREATE ─────────────────────────────────────────────
  it('should create an address', async () => {
    const result = await service.create(
      'supp-1',
      { city: 'Almaty', country: 'Kazakhstan' } as any,
      currentUser,
    );
    expect(result.id).toBe('addr-1');
    expect(mockAddressesRepo.create).toHaveBeenCalled();
  });

  it('should clear default when creating default address', async () => {
    await service.create(
      'supp-1',
      { city: 'Almaty', isDefault: true } as any,
      currentUser,
    );
    expect(mockAddressesRepo.clearDefault).toHaveBeenCalledWith(
      'supp-1',
      undefined,
      expect.anything(),
    );
  });

  it('should verify supplier exists before creating', async () => {
    mockSuppliersService.findById.mockRejectedValue(
      new NotFoundException('not found'),
    );
    await expect(
      service.create('bad-id', { city: 'Almaty' } as any, currentUser),
    ).rejects.toThrow(NotFoundException);
  });

  // ── FIND ALL ───────────────────────────────────────────
  it('should return addresses for a supplier', async () => {
    mockAddressesRepo.findAllBySupplier.mockResolvedValue([baseAddress as any]);
    const result = await service.findAll('supp-1', currentUser);
    expect(result).toHaveLength(1);
    expect(result[0]!.city).toBe('Almaty');
  });

  // ── FIND BY ID ─────────────────────────────────────────
  it('should find address by id', async () => {
    mockAddressesRepo.findById.mockResolvedValue(baseAddress as any);
    const result = await service.findById('supp-1', 'addr-1', currentUser);
    expect(result.id).toBe('addr-1');
  });

  it('should throw NotFoundException for missing address', async () => {
    mockAddressesRepo.findById.mockResolvedValue(null);
    await expect(
      service.findById('supp-1', 'missing', currentUser),
    ).rejects.toThrow(NotFoundException);
  });

  // ── UPDATE ─────────────────────────────────────────────
  it('should update an address', async () => {
    mockAddressesRepo.update.mockResolvedValue({
      ...baseAddress,
      city: 'Astana',
    } as any);
    const result = await service.update(
      'supp-1',
      'addr-1',
      { city: 'Astana' } as any,
      currentUser,
    );
    expect(result.city).toBe('Astana');
  });

  it('should clear default when updating to default', async () => {
    await service.update(
      'supp-1',
      'addr-1',
      { isDefault: true } as any,
      currentUser,
    );
    expect(mockAddressesRepo.clearDefault).toHaveBeenCalledWith(
      'supp-1',
      'addr-1',
      expect.anything(),
    );
  });

  // ── SOFT DELETE ────────────────────────────────────────
  it('should soft delete an address', async () => {
    await service.softDelete('supp-1', 'addr-1', currentUser);
    expect(mockAddressesRepo.softDelete).toHaveBeenCalledWith(
      'addr-1',
      'supp-1',
    );
  });

  // ── CROSS-COMPANY ──────────────────────────────────────
  it('should verify supplier belongs to company', async () => {
    mockSuppliersService.findById.mockRejectedValue(
      new NotFoundException('not found'),
    );
    await expect(
      service.findAll('other-supplier', currentUser),
    ).rejects.toThrow(NotFoundException);
  });
});
