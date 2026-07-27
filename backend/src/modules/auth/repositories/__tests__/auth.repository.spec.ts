import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, UserStatus } from '@prisma/client';
import { AuthRepository } from '../auth.repository';
import { PrismaService } from '../../../../common/prisma/prisma.service';

describe('AuthRepository', () => {
  let repo: AuthRepository;
  let mockPrisma: Record<string, any>;

  beforeEach(async () => {
    mockPrisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      company: { create: jest.fn() },
      companyMember: { create: jest.fn(), findFirst: jest.fn() },
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthRepository,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    repo = module.get<AuthRepository>(AuthRepository);
  });

  it('should find user by email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@test.com',
    });
    const result = await repo.findUserByEmail('test@test.com');
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { email: 'test@test.com' },
    });
    expect(result?.id).toBe('user-1');
  });

  it('should return null when user not found by email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const result = await repo.findUserByEmail('unknown@test.com');
    expect(result).toBeNull();
  });

  it('should create a company', async () => {
    mockPrisma.company.create.mockResolvedValue({
      id: 'comp-1',
      name: 'TestCo',
    });
    const result = await repo.createCompany('TestCo');
    expect(mockPrisma.company.create).toHaveBeenCalledWith({
      data: { name: 'TestCo', status: 'ACTIVE', isActive: true },
    });
    expect(result.id).toBe('comp-1');
  });

  it('should create a user', async () => {
    const userData = {
      email: 'new@test.com',
      passwordHash: 'hash',
      firstName: 'John',
    };
    mockPrisma.user.create.mockResolvedValue({ id: 'user-1', ...userData });
    const result = await repo.createUser(userData);
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: { ...userData, status: UserStatus.ACTIVE, isActive: true },
    });
    expect(result.id).toBe('user-1');
  });

  it('should create a company member', async () => {
    mockPrisma.companyMember.create.mockResolvedValue({
      id: 'cm-1',
      companyId: 'comp-1',
      userId: 'user-1',
    });
    const result = await repo.createCompanyMember('comp-1', 'user-1');
    expect(result.id).toBe('cm-1');
  });

  it('should find company member by user id', async () => {
    mockPrisma.companyMember.findFirst.mockResolvedValue({
      id: 'cm-1',
      companyId: 'comp-1',
    });
    const result = await repo.findCompanyMemberByUserId('user-1');
    expect(mockPrisma.companyMember.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', deletedAt: null },
    });
    expect(result?.id).toBe('cm-1');
  });

  it('should revoke refresh tokens', async () => {
    mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    await repo.revokeRefreshTokens('user-1');
    expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('should find user roles via company member chain', async () => {
    mockPrisma.companyMember.findFirst.mockResolvedValue({
      id: 'cm-1',
      userRoles: [{ role: { name: 'Admin' } }, { role: { name: 'Editor' } }],
    });

    const roles = await repo.findUserRoles('user-1', 'comp-1');
    expect(roles).toEqual(['Admin', 'Editor']);
  });

  it('should return empty roles when membership not found', async () => {
    mockPrisma.companyMember.findFirst.mockResolvedValue(null);
    const roles = await repo.findUserRoles('user-1', 'comp-1');
    expect(roles).toEqual([]);
  });

  it('should propagate Prisma transaction client', async () => {
    const mockTx = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: 'tx-user' }) },
    };
    const result = await repo.findUserByEmail('test@test.com', mockTx as any);
    expect(result?.id).toBe('tx-user');
  });
});
