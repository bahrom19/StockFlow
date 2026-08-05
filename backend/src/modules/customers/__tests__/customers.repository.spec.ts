import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomerType, Prisma } from '@prisma/client';
import { CustomersRepository } from '../repositories/customers.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Regression tests for the Blocker B1 pattern in CustomersRepository.update:
 * relation writes (e.g. `group: { connect }` from CustomersService.update)
 * must NOT be passed into `customer.updateMany`, which only accepts scalar
 * fields (CustomerUpdateManyMutationInput).
 */
describe('CustomersRepository — update with relation writes + optimistic locking (B1 regression)', () => {
  let repo: CustomersRepository;
  let mockPrisma: Record<string, any>;

  const baseCustomer = {
    id: 'cust-1',
    companyId: 'comp-1',
    type: 'RETAIL',
    firstName: 'John',
    lastName: 'Doe',
    companyName: null,
    groupId: null,
    rowVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    isActive: true,
  };

  beforeEach(async () => {
    mockPrisma = {
      customer: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<CustomersRepository>(CustomersRepository);
  });

  it('should NOT pass relation writes (group connect) to updateMany — B1 fix', async () => {
    mockPrisma.customer.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.customer.findUnique.mockResolvedValue(baseCustomer as any);

    const data: Prisma.CustomerUpdateInput = {
      type: CustomerType.COMPANY,
      group: { connect: { id: 'group-1' } },
    };

    const result = await repo.update('cust-1', data, 'comp-1', 0);

    expect(mockPrisma.customer.updateMany).toHaveBeenCalledWith({
      where: { id: 'cust-1', companyId: 'comp-1', rowVersion: 0 },
      data: { type: CustomerType.COMPANY, rowVersion: { increment: 1 } },
    });
    // group connect goes through a follow-up update
    expect(mockPrisma.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-1' },
      data: { group: { connect: { id: 'group-1' } } },
    });
    expect(result.id).toBe('cust-1');
  });

  it('should apply scalar-only updates via updateMany without a follow-up update', async () => {
    mockPrisma.customer.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.customer.findUnique.mockResolvedValue(baseCustomer as any);

    await repo.update('cust-1', { type: CustomerType.COMPANY }, 'comp-1', 0);

    expect(mockPrisma.customer.updateMany).toHaveBeenCalledWith({
      where: { id: 'cust-1', companyId: 'comp-1', rowVersion: 0 },
      data: { type: CustomerType.COMPANY, rowVersion: { increment: 1 } },
    });
    expect(mockPrisma.customer.update).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when rowVersion is stale', async () => {
    mockPrisma.customer.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.customer.findFirst.mockResolvedValue({
      ...baseCustomer,
      rowVersion: 5,
    });

    await expect(
      repo.update('cust-1', { type: CustomerType.COMPANY }, 'comp-1', 0),
    ).rejects.toThrow(ConflictException);
  });

  it('should throw NotFoundException when customer does not exist', async () => {
    mockPrisma.customer.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.customer.findFirst.mockResolvedValue(null);

    await expect(
      repo.update('cust-1', { type: CustomerType.COMPANY }, 'comp-1', 0),
    ).rejects.toThrow(NotFoundException);
  });

  it('should support legacy path (no rowVersion) with relation writes', async () => {
    mockPrisma.customer.findFirst.mockResolvedValue(baseCustomer as any);
    mockPrisma.customer.update.mockResolvedValue({
      ...baseCustomer,
      type: CustomerType.COMPANY,
    } as any);

    const result = await repo.update(
      'cust-1',
      {
        type: CustomerType.COMPANY,
        group: { connect: { id: 'group-1' } },
      },
      'comp-1',
      undefined,
    );

    expect(mockPrisma.customer.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.customer.update).toHaveBeenCalled();
    expect(result.id).toBe('cust-1');
  });
});
