import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RolesService } from '../services/roles.service';
import { RolesRepository } from '../repositories/roles.repository';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('RolesService', () => {
  let service: RolesService;
  let mockRolesRepo: jest.Mocked<RolesRepository>;
  let mockPrisma: { $transaction: jest.Mock };

  const companyId = 'comp-1';
  const mockTx = {};

  beforeEach(async () => {
    mockRolesRepo = {
      findByName: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      setPermissions: jest.fn(),
      findAllByCompany: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findCompanyMemberId: jest.fn(),
      assignRoleToUser: jest.fn(),
      removeRoleFromUser: jest.fn(),
      findUsersByCompany: jest.fn(),
      findPermissionCodesByRoleNames: jest.fn(),
    } as unknown as jest.Mocked<RolesRepository>;

    mockPrisma = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: RolesRepository, useValue: mockRolesRepo },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  describe('create', () => {
    const dto = {
      name: 'Manager',
      description: 'Manages team',
      permissionIds: ['perm-1'],
    };

    it('should create a role with permissions', async () => {
      mockRolesRepo.findByName.mockResolvedValue(null);
      mockRolesRepo.create.mockResolvedValue({
        id: 'role-1',
        name: 'Manager',
      } as any);
      mockRolesRepo.findById.mockResolvedValue({
        id: 'role-1',
        name: 'Manager',
        description: 'Manages team',
        permissions: [
          {
            permission: {
              id: 'perm-1',
              code: 'sales:read',
              name: 'Sales Read',
              module: 'sales',
            },
          },
        ],
        rolePermissions: [],
        companyId,
        isSystem: false,
      } as any);

      const result = await service.create(dto, companyId);

      expect(result.name).toBe('Manager');
      expect(mockRolesRepo.setPermissions).toHaveBeenCalledWith(
        'role-1',
        ['perm-1'],
        expect.anything(),
      );
    });

    it('should throw ConflictException when role name already exists', async () => {
      mockRolesRepo.findByName.mockResolvedValue({ id: 'existing' } as any);

      await expect(service.create(dto, companyId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // FIND ALL
  // ─────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated roles', async () => {
      mockRolesRepo.findAllByCompany.mockResolvedValue({
        items: [{ id: 'role-1', name: 'Admin', permissions: [] }],
        total: 1,
      } as any);

      const result = await service.findAll(companyId, { page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should throw BadRequestException for invalid pagination', async () => {
      await expect(
        service.findAll(companyId, { page: 0, limit: 20 }),
      ).rejects.toThrow();
    });
  });

  // ─────────────────────────────────────────────
  // FIND BY ID
  // ─────────────────────────────────────────────
  describe('findById', () => {
    it('should return role if found', async () => {
      mockRolesRepo.findById.mockResolvedValue({
        id: 'role-1',
        name: 'Admin',
        permissions: [],
      } as any);
      const result = await service.findById('role-1', companyId);
      expect(result.id).toBe('role-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRolesRepo.findById.mockResolvedValue(null);
      await expect(service.findById('role-1', companyId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  describe('update', () => {
    it('should update role name and permissions', async () => {
      mockRolesRepo.findById.mockResolvedValue({
        id: 'role-1',
        name: 'Old',
        permissions: [],
      } as any);
      mockRolesRepo.findByName.mockResolvedValue(null);
      mockRolesRepo.findById.mockResolvedValue({
        id: 'role-1',
        name: 'New',
        permissions: [
          {
            permission: {
              id: 'perm-1',
              code: 'sales:read',
              name: 'Sales Read',
              module: 'sales',
            },
          },
        ],
        rolePermissions: [],
        companyId,
        isSystem: false,
      } as any);

      const result = await service.update('role-1', { name: 'New' }, companyId);
      expect(result.name).toBe('New');
    });

    it('should throw NotFoundException when role does not exist', async () => {
      mockRolesRepo.findById.mockResolvedValue(null);
      await expect(
        service.update('role-1', { name: 'New' }, companyId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException on duplicate name', async () => {
      mockRolesRepo.findById.mockResolvedValue({
        id: 'role-1',
        name: 'Old',
        permissions: [],
      } as any);
      mockRolesRepo.findByName.mockResolvedValue({ id: 'other' } as any);
      await expect(
        service.update('role-1', { name: 'Duplicate' }, companyId),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─────────────────────────────────────────────
  // SOFT DELETE
  // ─────────────────────────────────────────────
  describe('softDelete', () => {
    it('should soft delete a role', async () => {
      mockRolesRepo.findById.mockResolvedValue({
        id: 'role-1',
        name: 'Temp',
      } as any);
      await service.softDelete('role-1', companyId);
      expect(mockRolesRepo.softDelete).toHaveBeenCalledWith(
        'role-1',
        companyId,
        expect.any(Number), // rowVersion
      );
    });

    it('should throw NotFoundException when not found', async () => {
      mockRolesRepo.findById.mockResolvedValue(null);
      await expect(service.softDelete('role-1', companyId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─────────────────────────────────────────────
  // ASSIGN / REMOVE ROLE
  // ─────────────────────────────────────────────
  describe('assignRoleToUser', () => {
    it('should assign role to user', async () => {
      mockRolesRepo.findById.mockResolvedValue({ id: 'role-1' } as any);
      mockRolesRepo.findCompanyMemberId.mockResolvedValue('cm-1');
      mockRolesRepo.assignRoleToUser.mockResolvedValue(undefined);

      await service.assignRoleToUser(
        { roleId: 'role-1', userId: 'user-1' },
        companyId,
      );
      expect(mockRolesRepo.assignRoleToUser).toHaveBeenCalledWith(
        'cm-1',
        'role-1',
      );
    });

    it('should throw NotFoundException when role not found', async () => {
      mockRolesRepo.findById.mockResolvedValue(null);
      await expect(
        service.assignRoleToUser(
          { roleId: 'role-1', userId: 'user-1' },
          companyId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeRoleFromUser', () => {
    it('should remove role from user', async () => {
      mockRolesRepo.findById.mockResolvedValue({ id: 'role-1' } as any);
      mockRolesRepo.findCompanyMemberId.mockResolvedValue('cm-1');

      await service.removeRoleFromUser(
        { roleId: 'role-1', userId: 'user-1' },
        companyId,
      );
      expect(mockRolesRepo.removeRoleFromUser).toHaveBeenCalledWith(
        'cm-1',
        'role-1',
      );
    });
  });

  // ─────────────────────────────────────────────
  // MULTI-TENANT ISOLATION
  // ─────────────────────────────────────────────
  describe('multi-tenant isolation', () => {
    it('should throw NotFoundException when role not in company', async () => {
      mockRolesRepo.findById.mockResolvedValue(null);
      await expect(service.findById('role-1', 'other-company')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockRolesRepo.findById).toHaveBeenCalledWith(
        'role-1',
        'other-company',
      );
    });

    it('should scope findAll to companyId', async () => {
      mockRolesRepo.findAllByCompany.mockResolvedValue({ items: [], total: 0 });
      await service.findAll('company-a');
      expect(mockRolesRepo.findAllByCompany).toHaveBeenCalledWith(
        'company-a',
        expect.any(Object),
      );
    });
  });
});
