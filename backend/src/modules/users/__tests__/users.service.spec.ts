import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { UsersRepository } from '../repositories/users.repository';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { UserStatus } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let mockRepo: jest.Mocked<UsersRepository>;

  const currentUser = {
    userId: 'me',
    companyId: 'comp-1',
    roles: ['Admin'],
    email: 'me@test.com',
  };

  beforeEach(async () => {
    mockRepo = {
      findByEmailGlobal: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockRepo },
        {
          provide: PrismaService,
          useValue: { $transaction: jest.fn((cb: any) => cb({})) },
        },
        { provide: AuditLogService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  describe('create', () => {
    it('should create a new user', async () => {
      mockRepo.findByEmailGlobal.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@test.com',
        firstName: 'John',
        lastName: 'Doe',
        status: UserStatus.ACTIVE,
        isActive: true,
        phone: null,
        passwordHash: 'hash',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as any);

      const result = await service.create({
        email: 'new@test.com',
        firstName: 'John',
        lastName: 'Doe',
        passwordHash: 'hash',
      } as any);

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('new@test.com');
    });

    it('should throw ConflictException when email already exists globally', async () => {
      mockRepo.findByEmailGlobal.mockResolvedValue({ id: 'existing' } as any);
      await expect(
        service.create({ email: 'existing@test.com' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────
  // FIND ALL
  // ─────────────────────────────────────────────
  describe('findAll', () => {
    it('should return all users in company', async () => {
      mockRepo.findAll.mockResolvedValue([
        {
          id: 'user-1',
          email: 'a@test.com',
          status: UserStatus.ACTIVE,
          isActive: true,
          phone: null,
          passwordHash: 'h',
          firstName: 'A',
          lastName: 'B',
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
      ] as any);

      const result = await service.findAll(currentUser);
      expect(result).toHaveLength(1);
      expect(mockRepo.findAll).toHaveBeenCalledWith('comp-1');
    });
  });

  // ─────────────────────────────────────────────
  // FIND BY ID
  // ─────────────────────────────────────────────
  describe('findById', () => {
    it('should return user when found in company', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'user-1',
        email: 'a@test.com',
        status: UserStatus.ACTIVE,
        isActive: true,
        firstName: 'A',
        lastName: 'B',
        phone: null,
        passwordHash: 'h',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as any);

      const result = await service.findById('user-1', currentUser);
      expect(result.id).toBe('user-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findById('unknown', currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  describe('update', () => {
    it('should update user fields', async () => {
      mockRepo.findById.mockResolvedValueOnce({
        id: 'user-1',
        email: 'old@test.com',
        firstName: 'Old',
        status: UserStatus.ACTIVE,
        isActive: true,
        phone: null,
        passwordHash: 'h',
        lastName: 'User',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as any);
      mockRepo.findByEmail.mockResolvedValue(null);
      mockRepo.update.mockResolvedValue({
        id: 'user-1',
        email: 'new@test.com',
        firstName: 'New',
        status: UserStatus.ACTIVE,
        isActive: true,
        phone: null,
        passwordHash: 'h',
        lastName: 'User',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as any);

      const result = await service.update(
        'user-1',
        { email: 'new@test.com', firstName: 'New' } as any,
        currentUser,
      );
      expect(result.email).toBe('new@test.com');
    });

    it('should throw ConflictException on duplicate email', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'user-1',
        email: 'old@test.com',
        status: UserStatus.ACTIVE,
        isActive: true,
        phone: null,
        passwordHash: 'h',
        firstName: 'A',
        lastName: 'B',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as any);
      mockRepo.findByEmail.mockResolvedValue({ id: 'user-2' } as any);

      await expect(
        service.update(
          'user-1',
          { email: 'user-2@test.com' } as any,
          currentUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────
  // SOFT DELETE
  // ─────────────────────────────────────────────
  describe('softDelete', () => {
    it('should soft delete a user', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'user-1',
        email: 'del@test.com',
        status: UserStatus.ACTIVE,
        isActive: true,
        phone: null,
        passwordHash: 'h',
        firstName: 'A',
        lastName: 'B',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      } as any);
      mockRepo.softDelete.mockResolvedValue({
        id: 'user-1',
        deletedAt: new Date(),
        status: UserStatus.DELETED,
        isActive: false,
        email: 'del@test.com',
        phone: null,
        passwordHash: 'h',
        firstName: 'A',
        lastName: 'B',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await service.softDelete('user-1', currentUser);
      expect(result.deletedAt).not.toBeNull();
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.softDelete('unknown', currentUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // MULTI-TENANT ISOLATION
  // ─────────────────────────────────────────────
  describe('multi-tenant isolation', () => {
    it('should scope findAll to companyId', async () => {
      mockRepo.findAll.mockResolvedValue([]);
      await service.findAll(currentUser);
      expect(mockRepo.findAll).toHaveBeenCalledWith('comp-1');
    });

    it('should throw NotFoundException when user is not in company', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findById('user-1', currentUser)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRepo.findById).toHaveBeenCalledWith('user-1', 'comp-1');
    });
  });
});
