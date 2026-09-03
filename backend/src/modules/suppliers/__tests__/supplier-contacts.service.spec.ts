import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SupplierContactsService } from '../services/supplier-contacts.service';
import { SupplierContactsRepository } from '../repositories/supplier-contacts.repository';
import { SuppliersService } from '../services/suppliers.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('SupplierContactsService', () => {
  let service: SupplierContactsService;
  let mockContactsRepo: jest.Mocked<SupplierContactsRepository>;
  let mockSuppliersService: jest.Mocked<SuppliersService>;
  let mockPrisma: { $transaction: jest.Mock };

  const currentUser = {
    userId: 'me',
    companyId: 'comp-1',
    roles: ['Admin'],
    email: 'me@test.com',
  };

  const baseContact = {
    id: 'contact-1',
    supplierId: 'supp-1',
    firstName: 'John',
    lastName: 'Doe',
    phone: '+77001112233',
    email: 'john@test.com',
    position: 'Manager',
    isPrimary: false,
    notes: null,
    rowVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    mockContactsRepo = {
      findAllBySupplier: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(baseContact as any),
      update: jest.fn().mockResolvedValue(baseContact as any),
      softDelete: jest.fn().mockResolvedValue({ ...baseContact, deletedAt: new Date() } as any),
      findActivePrimary: jest.fn().mockResolvedValue(null),
      clearPrimary: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SupplierContactsRepository>;

    mockSuppliersService = {
      findById: jest.fn().mockResolvedValue({ id: 'supp-1' } as any),
    } as unknown as jest.Mocked<SuppliersService>;

    mockPrisma = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierContactsService,
        { provide: SupplierContactsRepository, useValue: mockContactsRepo },
        { provide: SuppliersService, useValue: mockSuppliersService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SupplierContactsService>(SupplierContactsService);
  });

  // ── CREATE ─────────────────────────────────────────────
  it('should create a contact', async () => {
    const result = await service.create(
      'supp-1',
      { firstName: 'John', lastName: 'Doe' } as any,
      currentUser,
    );
    expect(result.id).toBe('contact-1');
    expect(mockContactsRepo.create).toHaveBeenCalled();
  });

  it('should clear primary when creating primary contact', async () => {
    await service.create(
      'supp-1',
      { firstName: 'John', isPrimary: true } as any,
      currentUser,
    );
    expect(mockContactsRepo.clearPrimary).toHaveBeenCalledWith(
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
      service.create('bad-id', { firstName: 'John' } as any, currentUser),
    ).rejects.toThrow(NotFoundException);
  });

  // ── FIND ALL ───────────────────────────────────────────
  it('should return contacts for a supplier', async () => {
    mockContactsRepo.findAllBySupplier.mockResolvedValue([baseContact as any]);
    const result = await service.findAll('supp-1', currentUser);
    expect(result).toHaveLength(1);
    expect(result[0]!.firstName).toBe('John');
  });

  // ── FIND BY ID ─────────────────────────────────────────
  it('should find contact by id', async () => {
    mockContactsRepo.findById.mockResolvedValue(baseContact as any);
    const result = await service.findById('supp-1', 'contact-1', currentUser);
    expect(result.id).toBe('contact-1');
  });

  it('should throw NotFoundException for missing contact', async () => {
    mockContactsRepo.findById.mockResolvedValue(null);
    await expect(
      service.findById('supp-1', 'missing', currentUser),
    ).rejects.toThrow(NotFoundException);
  });

  // ── UPDATE ─────────────────────────────────────────────
  it('should update a contact', async () => {
    mockContactsRepo.findById.mockResolvedValue(baseContact as any);
    mockContactsRepo.update.mockResolvedValue({
      ...baseContact,
      firstName: 'Jane',
    } as any);
    const result = await service.update(
      'supp-1',
      'contact-1',
      { firstName: 'Jane' } as any,
      currentUser,
    );
    expect(result.firstName).toBe('Jane');
  });

  it('should clear primary when updating to primary', async () => {
    mockContactsRepo.findById.mockResolvedValue(baseContact as any);
    await service.update(
      'supp-1',
      'contact-1',
      { isPrimary: true } as any,
      currentUser,
    );
    expect(mockContactsRepo.clearPrimary).toHaveBeenCalledWith(
      'supp-1',
      'contact-1',
      expect.anything(),
    );
  });

  it('should use optimistic locking on update', async () => {
    mockContactsRepo.findById.mockResolvedValue({
      ...baseContact,
      rowVersion: 5,
    } as any);
    await service.update(
      'supp-1',
      'contact-1',
      { firstName: 'Jane' } as any,
      currentUser,
    );
    expect(mockContactsRepo.update).toHaveBeenCalledWith(
      'contact-1',
      'supp-1',
      expect.anything(),
      5,
      expect.anything(),
    );
  });

  // ── SOFT DELETE ────────────────────────────────────────
  it('should soft delete a contact', async () => {
    mockContactsRepo.findById.mockResolvedValue(baseContact as any);
    await service.softDelete('supp-1', 'contact-1', currentUser);
    expect(mockContactsRepo.softDelete).toHaveBeenCalledWith(
      'contact-1',
      'supp-1',
      0,
      expect.anything(),
    );
  });

  it('should throw NotFoundException when deleting missing contact', async () => {
    mockContactsRepo.findById.mockResolvedValue(null);
    await expect(
      service.softDelete('supp-1', 'missing', currentUser),
    ).rejects.toThrow(NotFoundException);
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
