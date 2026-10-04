import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma';
import { PermissionsService } from '../services/permissions.service';
import { PermissionsRepository } from '../repositories/permissions.repository';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let mockRepo: jest.Mocked<PermissionsRepository>;
  let auditCreate: jest.Mock;
  let txPermissionDelete: jest.Mock;
  let txAuditCreate: jest.Mock;

  beforeEach(async () => {
    auditCreate = jest.fn().mockResolvedValue({});
    txAuditCreate = jest.fn().mockResolvedValue({});
    txPermissionDelete = jest.fn().mockResolvedValue({});

    mockRepo = {
      findByCode: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<PermissionsRepository>;

    const prisma = {
      auditLog: { create: auditCreate },
      permission: { delete: txPermissionDelete },
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<void>) =>
        cb({
          auditLog: { create: txAuditCreate },
          permission: { delete: txPermissionDelete },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: PermissionsRepository, useValue: mockRepo },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  describe('create', () => {
    it('should create a new permission', async () => {
      mockRepo.findByCode.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue({
        id: 'perm-1',
        code: 'sales:create',
        name: 'Create Sales',
        module: 'sales',
      } as any);

      const result = await service.create(
        {
          code: 'sales:create',
          name: 'Create Sales',
          module: 'sales',
        },
        'user-1',
      );
      expect(result.code).toBe('sales:create');
    });

    it('should throw ConflictException when code already exists', async () => {
      mockRepo.findByCode.mockResolvedValue({ id: 'existing' } as any);
      await expect(
        service.create(
          { code: 'sales:create', name: 'Duplicate' } as any,
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated permissions', async () => {
      mockRepo.findAll.mockResolvedValue({
        items: [
          {
            id: 'perm-1',
            code: 'sales:create',
            name: 'Create Sales',
            module: 'sales',
          },
        ],
        total: 1,
      } as any);

      const result = await service.findAll({ page: 1, limit: 50 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter by module', async () => {
      mockRepo.findAll.mockResolvedValue({ items: [], total: 0 });
      await service.findAll({ module: 'inventory' });
      expect(mockRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ module: 'inventory' }),
      );
    });
  });

  describe('findById', () => {
    it('should return permission if found', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'perm-1',
        code: 'sales:create',
      } as any);
      const result = await service.findById('perm-1');
      expect(result.id).toBe('perm-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findById('perm-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByCode', () => {
    it('should return permission by code', async () => {
      mockRepo.findByCode.mockResolvedValue({
        id: 'perm-1',
        code: 'sales:create',
      } as any);
      const result = await service.findByCode('sales:create');
      expect(result.id).toBe('perm-1');
    });

    it('should throw NotFoundException when code not found', async () => {
      mockRepo.findByCode.mockResolvedValue(null);
      await expect(service.findByCode('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update permission fields', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'perm-1',
        code: 'old',
        name: 'Old',
      } as any);
      mockRepo.update.mockResolvedValue({
        id: 'perm-1',
        code: 'new',
        name: 'New',
      } as any);

      const result = await service.update(
        'perm-1',
        {
          code: 'new',
          name: 'New',
        },
        'user-1',
      );
      expect(result.code).toBe('new');
    });

    it('should throw ConflictException on duplicate code', async () => {
      mockRepo.findById.mockResolvedValue({ id: 'perm-1', code: 'old' } as any);
      mockRepo.findByCode.mockResolvedValue({ id: 'perm-2' } as any);
      await expect(
        service.update('perm-1', { code: 'existing' }, 'user-1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should delete a permission', async () => {
      mockRepo.findById.mockResolvedValue({ id: 'perm-1' } as any);
      await service.delete('perm-1', 'user-1');
      expect(txPermissionDelete).toHaveBeenCalledWith({
        where: { id: 'perm-1' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.delete('perm-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── G16-N-4 P0-A: global authorization-substrate audit provenance ───────
  describe('audit provenance for the GLOBAL permission catalog (G16-N-4 P0-A)', () => {
    it('T25: PERMISSION_CREATED records the actor and companyId NULL', async () => {
      mockRepo.findByCode.mockResolvedValue(null);
      mockRepo.create.mockResolvedValue({
        id: 'perm-1',
        code: 'x:y',
        name: 'X',
        module: 'x',
      } as any);

      await service.create(
        { code: 'x:y', name: 'X', module: 'x' },
        'operator-1',
      );

      expect(auditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PERMISSION_CREATED',
          entity: 'Permission',
          entityId: 'perm-1',
          companyId: null,
          userId: 'operator-1',
          newValues: expect.objectContaining({ code: 'x:y' }),
        }),
      });
    });

    it('T26: PERMISSION_UPDATED records before/after codes and companyId NULL', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'perm-1',
        code: 'x:y',
        name: 'X',
        module: 'x',
      } as any);
      mockRepo.update.mockResolvedValue({
        id: 'perm-1',
        code: 'x:z',
        name: 'X',
        module: 'x',
      } as any);

      await service.update('perm-1', { code: 'x:z' }, 'operator-1');

      expect(auditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PERMISSION_UPDATED',
          entity: 'Permission',
          entityId: 'perm-1',
          companyId: null,
          userId: 'operator-1',
          oldValues: expect.objectContaining({ code: 'x:y' }),
          newValues: expect.objectContaining({ code: 'x:z' }),
        }),
      });
    });

    it('T27: PERMISSION_DELETED records the actor and companyId NULL', async () => {
      mockRepo.findById.mockResolvedValue({
        id: 'perm-1',
        code: 'x:y',
        name: 'X',
        module: 'x',
      } as any);

      await service.delete('perm-1', 'operator-1');

      expect(txAuditCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'PERMISSION_DELETED',
          entity: 'Permission',
          entityId: 'perm-1',
          companyId: null,
          userId: 'operator-1',
          oldValues: expect.objectContaining({ code: 'x:y' }),
        }),
      });
    });

    it('T27b: the audit row is written BEFORE the destructive delete', async () => {
      const order: string[] = [];
      txAuditCreate.mockImplementation(async () => {
        order.push('audit');
        return {};
      });
      txPermissionDelete.mockImplementation(async () => {
        order.push('delete');
        return {};
      });
      mockRepo.findById.mockResolvedValue({ id: 'perm-1', code: 'x:y' } as any);

      await service.delete('perm-1', 'operator-1');

      expect(order).toEqual(['audit', 'delete']);
    });

    it('T27c: the audit and the delete share one transaction', async () => {
      const prisma = (
        service as unknown as { prismaService: { $transaction: jest.Mock } }
      ).prismaService;
      mockRepo.findById.mockResolvedValue({ id: 'perm-1', code: 'x:y' } as any);

      await service.delete('perm-1', 'operator-1');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(auditCreate).not.toHaveBeenCalled();
    });

    it('T27d: a failing audit write rolls back the authorization-substrate delete', async () => {
      mockRepo.findById.mockResolvedValue({ id: 'perm-1', code: 'x:y' } as any);
      const prisma = (
        service as unknown as {
          prismaService: {
            $transaction: jest.Mock;
          };
        }
      ).prismaService;

      prisma.$transaction.mockImplementationOnce(async (cb: any) =>
        cb({
          auditLog: {
            create: jest.fn().mockRejectedValue(new Error('audit unavailable')),
          },
          permission: { delete: txPermissionDelete },
        }),
      );

      await expect(service.delete('perm-1', 'operator-1')).rejects.toThrow(
        'audit unavailable',
      );
      expect(txPermissionDelete).not.toHaveBeenCalled();
    });
  });
});
