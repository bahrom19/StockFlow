import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PermissionsService } from '../services/permissions.service';
import { PermissionsRepository } from '../repositories/permissions.repository';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let mockRepo: jest.Mocked<PermissionsRepository>;

  beforeEach(async () => {
    mockRepo = {
      findByCode: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<PermissionsRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: PermissionsRepository, useValue: mockRepo },
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

      const result = await service.create({
        code: 'sales:create',
        name: 'Create Sales',
        module: 'sales',
      });
      expect(result.code).toBe('sales:create');
    });

    it('should throw ConflictException when code already exists', async () => {
      mockRepo.findByCode.mockResolvedValue({ id: 'existing' } as any);
      await expect(
        service.create({ code: 'sales:create', name: 'Duplicate' } as any),
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

      const result = await service.update('perm-1', {
        code: 'new',
        name: 'New',
      });
      expect(result.code).toBe('new');
    });

    it('should throw ConflictException on duplicate code', async () => {
      mockRepo.findById.mockResolvedValue({ id: 'perm-1', code: 'old' } as any);
      mockRepo.findByCode.mockResolvedValue({ id: 'perm-2' } as any);
      await expect(
        service.update('perm-1', { code: 'existing' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should delete a permission', async () => {
      mockRepo.findById.mockResolvedValue({ id: 'perm-1' } as any);
      await service.delete('perm-1');
      expect(mockRepo.delete).toHaveBeenCalledWith('perm-1');
    });

    it('should throw NotFoundException when not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.delete('perm-1')).rejects.toThrow(NotFoundException);
    });
  });
});
