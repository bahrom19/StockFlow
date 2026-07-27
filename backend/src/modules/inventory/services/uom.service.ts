import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { InventoryRepository } from '../repositories/inventory.repository';

export class CreateUomDto {
  name!: string;
  abbreviation!: string;
  category?: string;
  decimalPlaces?: number;
}

export class UpdateUomDto {
  name?: string;
  abbreviation?: string;
  category?: string;
  decimalPlaces?: number;
  isActive?: boolean;
  rowVersion!: number;
}

@Injectable()
export class UomService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly inventoryRepository: InventoryRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  async findAll(companyId: string): Promise<any[]> {
    return this.inventoryRepository.findAllUnits(companyId);
  }

  async create(
    dto: CreateUomDto,
    companyId: string,
    userId: string,
  ): Promise<any> {
    return this.prismaService.$transaction(async (tx) => {
      const uom = await this.inventoryRepository.createUnit(
        {
          name: dto.name,
          abbreviation: dto.abbreviation,
          category: dto.category,
          decimalPlaces: dto.decimalPlaces ?? 2,
          company: { connect: { id: companyId } },
        },
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'UnitOfMeasure',
          entityId: uom.id,
          action: 'CREATE',
          before: null,
          after: { name: uom.name, abbreviation: uom.abbreviation },
        },
        tx,
      );

      return uom;
    });
  }

  async update(
    id: string,
    dto: UpdateUomDto,
    companyId: string,
    userId: string,
  ): Promise<any> {
    return this.prismaService.$transaction(async (tx) => {
      const existing = await this.inventoryRepository.findUnitById(
        id,
        companyId,
        tx,
      );
      if (!existing) throw new BadRequestException('Unit of measure not found');

      const data: Record<string, unknown> = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.abbreviation !== undefined) data.abbreviation = dto.abbreviation;
      if (dto.category !== undefined) data.category = dto.category;
      if (dto.decimalPlaces !== undefined)
        data.decimalPlaces = dto.decimalPlaces;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;

      const count = await this.inventoryRepository.updateUnit(
        id,
        companyId,
        data,
        dto.rowVersion,
        tx,
      );
      if (count === 0) throw new BadRequestException('Unit not found');

      const updated = await this.inventoryRepository.findUnitById(
        id,
        companyId,
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'UnitOfMeasure',
          entityId: id,
          action: 'UPDATE',
          before: { name: existing.name },
          after: { name: updated?.name },
        },
        tx,
      );

      return updated;
    });
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion: number,
    userId: string,
  ): Promise<void> {
    return this.prismaService.$transaction(async (tx) => {
      const count = await this.inventoryRepository.softDeleteUnit(
        id,
        companyId,
        rowVersion,
        tx,
      );
      if (count === 0) throw new BadRequestException('Unit not found');

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'UnitOfMeasure',
          entityId: id,
          action: 'DELETE',
          before: { id },
          after: null,
        },
        tx,
      );
    });
  }
}
