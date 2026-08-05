import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import {
  CreateWarehouseDto,
  UpdateWarehouseDto,
} from '../dto/create-warehouse.dto';
import { WarehouseEntity } from '../entities/warehouse.entity';
import { WarehouseMapper } from '../mappers/warehouse.mapper';
import { InventoryRepository } from '../repositories/inventory.repository';

@Injectable()
export class WarehouseService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(companyId: string): Promise<WarehouseEntity[]> {
    const warehouses = await this.inventoryRepository.findWarehouses(companyId);
    return WarehouseMapper.toEntityList(warehouses);
  }

  async findById(id: string, companyId: string): Promise<WarehouseEntity> {
    const warehouse = await this.inventoryRepository.findWarehouseById(
      id,
      companyId,
    );
    if (!warehouse) throw new BadRequestException('Warehouse not found');
    return WarehouseMapper.toEntity(warehouse);
  }

  async create(
    dto: CreateWarehouseDto,
    companyId: string,
    userId: string,
  ): Promise<WarehouseEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const warehouse = await this.inventoryRepository.createWarehouse(
        {
          name: dto.name,
          code: dto.code,
          address: dto.address,
          phone: dto.phone,
          managerName: dto.managerName,
          isDefault: dto.isDefault ?? false,
          company: { connect: { id: companyId } },
        },
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'Warehouse',
          entityId: warehouse.id,
          action: 'CREATE',
          before: null,
          after: {
            id: warehouse.id,
            name: warehouse.name,
            code: warehouse.code,
          },
        },
        tx,
      );

      return WarehouseMapper.toEntity(warehouse);
    });
  }

  async update(
    id: string,
    dto: UpdateWarehouseDto,
    companyId: string,
    userId: string,
  ): Promise<WarehouseEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const before = await this.inventoryRepository.findWarehouseById(
        id,
        companyId,
        tx,
      );
      if (!before) throw new BadRequestException('Warehouse not found');

      const rowVer: number = before.rowVersion ?? 0;
      const data: Record<string, unknown> = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.code !== undefined) data.code = dto.code;
      if (dto.address !== undefined) data.address = dto.address;
      if (dto.phone !== undefined) data.phone = dto.phone;
      if (dto.managerName !== undefined) data.managerName = dto.managerName;
      if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;

      const warehouse = await this.inventoryRepository.updateWarehouse(
        id,
        data,
        companyId,
        rowVer,
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'Warehouse',
          entityId: id,
          action: 'UPDATE',
          before: { name: before.name },
          after: { name: warehouse.name },
        },
        tx,
      );

      return WarehouseMapper.toEntity(warehouse);
    });
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion: number,
    userId: string,
  ): Promise<void> {
    return this.prismaService.$transaction(async (tx) => {
      const before = await this.inventoryRepository.findWarehouseById(
        id,
        companyId,
        tx,
      );
      if (!before) throw new BadRequestException('Warehouse not found');

      await this.inventoryRepository.softDeleteWarehouse(
        id,
        companyId,
        rowVersion,
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'Warehouse',
          entityId: id,
          action: 'DELETE',
          before: { id: before.id, name: before.name, code: before.code },
          after: null,
        },
        tx,
      );
    });
  }
}
