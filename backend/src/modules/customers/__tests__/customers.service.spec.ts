import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, CustomerType } from '@prisma/client';
import { CustomersService } from '../services/customers.service';
import { CustomersRepository } from '../repositories/customers.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EVENT_BUS } from '../../../common/events';

describe('CustomersService', () => {
  let service: CustomersService;
  let mockRepo: jest.Mocked<CustomersRepository>;
  let mockPrisma: { $transaction: jest.Mock };
  let mockAuditLog: jest.Mocked<AuditLogService>;
  let mockEventBus: { publish: jest.Mock };
  let mockTx: Record<string, any>;

  const currentUser = {
    userId: 'me',
    companyId: 'comp-1',
    roles: ['Admin'],
    email: 'me@test.com',
  };
  const baseCustomer = {
    id: 'cust-1',
    companyId: 'comp-1',
    groupId: null,
    type: CustomerType.PERSON,
    firstName: 'John',
    lastName: 'Doe',
    companyName: null,
    iin: '123456789012',
    bin: null,
    email: 'john@test.com',
    phone: '+77001112233',
    mobile: null,
    discount: new Prisma.Decimal(0) as any,
    creditLimit: null,
    currentDebt: null,
    bonusPoints: 0,
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
    } as unknown as jest.Mocked<CustomersRepository>;

    mockTx = {};
    mockPrisma = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(mockTx)),
    };

    mockAuditLog = {
      log: jest.fn(),
    } as unknown as jest.Mocked<AuditLogService>;

    mockEventBus = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: CustomersRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: EVENT_BUS, useValue: mockEventBus },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  it('should create a customer with event and audit log', async () => {
    mockRepo.findAll.mockResolvedValue({ items: [], total: 0 });
    mockRepo.create.mockResolvedValue(baseCustomer as any);

    const result = await service.create(
      {
        firstName: 'John',
        lastName: 'Doe',
        type: CustomerType.PERSON,
        email: 'john@test.com',
        phone: '+77001112233',
      } as any,
      currentUser,
    );

    expect(result.id).toBe('cust-1');
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE' }),
    );
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  it('should throw ConflictException when customer already exists', async () => {
    mockRepo.findAll.mockResolvedValue({ items: [baseCustomer], total: 1 });
    await expect(
      service.create({ email: 'exists@test.com' } as any, currentUser),
    ).rejects.toThrow(ConflictException);
  });

  // ─────────────────────────────────────────────
  // FIND ALL
  // ─────────────────────────────────────────────
  it('should return paginated customers', async () => {
    mockRepo.findAll.mockResolvedValue({ items: [baseCustomer], total: 1 });
    const result = await service.findAll(
      { page: 1, limit: 20 } as any,
      currentUser,
    );
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(mockRepo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'comp-1' }),
    );
  });

  // ─────────────────────────────────────────────
  // FIND BY ID
  // ─────────────────────────────────────────────
  it('should find customer by id', async () => {
    mockRepo.findById.mockResolvedValue(baseCustomer as any);
    const result = await service.findById('cust-1', currentUser);
    expect(result.id).toBe('cust-1');
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
  it('should update customer with audit and event', async () => {
    mockRepo.findById.mockResolvedValue(baseCustomer as any);
    mockRepo.update.mockResolvedValue({
      ...baseCustomer,
      firstName: 'Jane',
    } as any);

    const result = await service.update(
      'cust-1',
      { firstName: 'Jane' } as any,
      currentUser,
    );
    expect(result.firstName).toBe('Jane');
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE' }),
    );
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────
  // SOFT DELETE
  // ─────────────────────────────────────────────
  it('should soft delete customer with event and audit', async () => {
    mockRepo.findById.mockResolvedValue(baseCustomer as any);
    mockRepo.softDelete.mockResolvedValue({
      ...baseCustomer,
      deletedAt: new Date(),
    } as any);

    const result = await service.softDelete('cust-1', currentUser);
    expect(result.deletedAt).not.toBeNull();
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE' }),
    );
    expect(mockEventBus.publish).toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────
  // MULTI-TENANT ISOLATION
  // ─────────────────────────────────────────────
  it('should reject cross-company findById', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(
      service.findById('cust-1', { ...currentUser, companyId: 'other' }),
    ).rejects.toThrow(NotFoundException);
  });
});
