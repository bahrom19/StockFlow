import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, UserStatus } from '@prisma/client';
import { UsersRepository } from '../repositories/users.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('UsersRepository', () => {
  let repo: UsersRepository;
  let mockPrisma: Record<string, any>;

  const baseUser = {
    id: 'user-1',
    email: 'test@test.com',
    firstName: 'John',
    lastName: 'Doe',
    passwordHash: 'hash',
    phone: null,
    status: UserStatus.ACTIVE,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    mockPrisma = {
      user: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      companyMember: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<UsersRepository>(UsersRepository);
  });

  it('should create a user', async () => {
    const data: Prisma.UserCreateInput = {
      email: 'new@test.com',
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      isActive: true,
    };
    mockPrisma.user.create.mockResolvedValue({
      ...baseUser,
      email: 'new@test.com',
    });
    const result = await repo.create(data);
    expect(result.email).toBe('new@test.com');
  });

  it('should find all users in company', async () => {
    mockPrisma.user.findMany.mockResolvedValue([baseUser]);
    const result = await repo.findAll('comp-1');
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        members: { some: { companyId: 'comp-1', deletedAt: null } },
      },
    });
    expect(result).toHaveLength(1);
  });

  it('should find user by id with company scoping', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(baseUser);
    const result = await repo.findById('user-1', 'comp-1');
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'user-1',
        deletedAt: null,
        members: { some: { companyId: 'comp-1', deletedAt: null } },
      },
    });
    expect(result?.id).toBe('user-1');
  });

  it('should return null when user not found by id in company', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const result = await repo.findById('unknown', 'comp-1');
    expect(result).toBeNull();
  });

  it('should find user by email with company scoping', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(baseUser);
    const result = await repo.findByEmail('test@test.com', 'comp-1');
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: 'test@test.com',
        deletedAt: null,
        members: { some: { companyId: 'comp-1', deletedAt: null } },
      },
    });
    expect(result?.email).toBe('test@test.com');
  });

  it('should find user globally by email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);
    const result = await repo.findByEmailGlobal('test@test.com');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@test.com' },
    });
    expect(result?.id).toBe('user-1');
  });

  it('should update a user', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(baseUser);
    mockPrisma.user.update.mockResolvedValue({
      ...baseUser,
      firstName: 'Updated',
    });

    const result = await repo.update(
      'user-1',
      { firstName: 'Updated' },
      'comp-1',
    );
    expect(result.firstName).toBe('Updated');
  });

  it('should throw error when updating non-existent user', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    await expect(
      repo.update('unknown', { firstName: 'X' }, 'comp-1'),
    ).rejects.toThrow('User with id unknown not found');
  });

  it('should soft delete a user', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(baseUser);
    mockPrisma.user.update.mockResolvedValue({
      ...baseUser,
      deletedAt: new Date(),
      isActive: false,
      status: 'DELETED',
    });

    const result = await repo.softDelete('user-1', 'comp-1');
    expect(result.deletedAt).not.toBeNull();
    expect(result.isActive).toBe(false);
  });

  it('should enforce multi-tenant isolation in findById', async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const result = await repo.findById('user-1', 'different-company');
    expect(result).toBeNull();
  });

  it('should create a company member', async () => {
    mockPrisma.companyMember.create.mockResolvedValue({ id: 'member-1' });
    const result = await repo.createCompanyMember('user-1', 'comp-1');
    expect(mockPrisma.companyMember.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', companyId: 'comp-1' },
    });
    expect(result.id).toBe('member-1');
  });

  // ─────────────────────────────────────────────
  // G16-B-01 (B01-6): company-scoped CAS writes
  // ─────────────────────────────────────────────
  describe('company-scoped CAS writes (B01-6)', () => {
    it('update with rowVersion scopes predicate to company and re-reads scoped', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findFirst.mockResolvedValue(baseUser);

      await repo.update('user-1', { firstName: 'Scoped' }, 'comp-1', 2);

      // P: CAS predicate carries the company scope.
      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          rowVersion: 2,
          members: { some: { companyId: 'comp-1', deletedAt: null } },
        },
        data: { firstName: 'Scoped', rowVersion: { increment: 1 } },
      });
      // Scoped re-read (no unscoped findUnique).
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          deletedAt: null,
          members: { some: { companyId: 'comp-1', deletedAt: null } },
        },
      });
    });

    it('update with rowVersion denies foreign-company row as NotFound', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        repo.update('user-1', { firstName: 'X' }, 'other-comp', 2),
      ).rejects.toThrow('User with id user-1 not found');
    });

    it('update with rowVersion raises Conflict on same-company version mismatch', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.findFirst.mockResolvedValue(baseUser);

      await expect(
        repo.update('user-1', { firstName: 'X' }, 'comp-1', 99),
      ).rejects.toThrow('was modified by another user');
    });

    it('softDelete with rowVersion scopes predicate to company', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.user.findFirst.mockResolvedValue({
        ...baseUser,
        deletedAt: new Date(),
      });

      await repo.softDelete('user-1', 'comp-1', 2);

      expect(mockPrisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'user-1',
          rowVersion: 2,
          members: { some: { companyId: 'comp-1', deletedAt: null } },
        },
        data: expect.objectContaining({ status: 'DELETED' }),
      });
    });

    it('softDelete with rowVersion denies foreign-company row as NotFound', async () => {
      mockPrisma.user.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(repo.softDelete('user-1', 'other-comp', 2)).rejects.toThrow(
        'User with id user-1 not found',
      );
    });
  });
});
