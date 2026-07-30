import { ConflictException, NotFoundException } from '@nestjs/common';
import { WarehouseController } from '../controllers/warehouse.controller';
import { WarehouseService } from '../services/warehouse.service';

describe('WarehouseController — create() — B4 regression', () => {
  let controller: WarehouseController;
  let mockService: jest.Mocked<WarehouseService>;

  const mockUser = {
    userId: 'user-1',
    companyId: 'company-1',
    roles: ['Admin'],
    email: 'admin@test.com',
  };

  const mockWarehouse = {
    id: 'wh-1',
    companyId: 'company-1',
    name: 'Test Warehouse',
    code: 'WH-TEST',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    mockService = {
      create: jest.fn().mockResolvedValue(mockWarehouse),
      findAll: jest.fn().mockResolvedValue([mockWarehouse]),
      findById: jest.fn().mockResolvedValue(mockWarehouse),
      update: jest.fn().mockResolvedValue(mockWarehouse),
      softDelete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<WarehouseService>;

    controller = new WarehouseController(mockService);
  });

  describe('create — requires inventory:create permission', () => {
    it('should delegate to service.create with JWT companyId', async () => {
      const dto = { name: 'Test Warehouse', code: 'WH-TEST' };
      const result = await controller.create(dto, mockUser);

      expect(mockService.create).toHaveBeenCalledWith(
        dto,
        mockUser.companyId,
        mockUser.userId,
      );
      expect(result).toEqual(mockWarehouse);
    });

    it('should use companyId from JWT even if body contains companyId', async () => {
      const dtoWithCompanyId = {
        name: 'Test',
        code: 'WH-TEST',
        companyId: 'hacker-company',
      };
      await controller.create(dtoWithCompanyId, mockUser);

      // Service must receive the JWT companyId, NOT the one from the body
      const createCall = mockService.create.mock.calls[0];
      expect(createCall).toBeDefined();
      const callArg = createCall![1];
      expect(callArg).toBe(mockUser.companyId);
      expect(callArg).not.toBe('hacker-company');
    });

    it('should propagate service errors', async () => {
      mockService.create.mockRejectedValue(
        new ConflictException('Warehouse code already exists'),
      );

      await expect(
        controller.create({ name: 'Test', code: 'DUP' }, mockUser),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll — requires inventory:read permission', () => {
    it('should delegate to service.findAll with companyId', async () => {
      const result = await controller.findAll(mockUser);
      expect(mockService.findAll).toHaveBeenCalledWith(mockUser.companyId);
      expect(result).toEqual([mockWarehouse]);
    });
  });

  describe('findById — requires inventory:read permission', () => {
    it('should delegate to service.findById', async () => {
      const result = await controller.findById('wh-1', mockUser);
      expect(mockService.findById).toHaveBeenCalledWith(
        'wh-1',
        mockUser.companyId,
      );
      expect(result).toEqual(mockWarehouse);
    });

    it('should propagate NotFoundException', async () => {
      mockService.findById.mockRejectedValue(
        new NotFoundException('Warehouse not found'),
      );
      await expect(controller.findById('bad-id', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
