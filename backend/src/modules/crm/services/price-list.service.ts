import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PriceListRepository } from '../repositories/price-list.repository';
import { PriceListMapper } from '../mappers/price-list.mapper';
import { PriceListEntity } from '../entities/price-list.entity';
import {
  CreatePriceListDto,
  UpdatePriceListDto,
  PriceListQueryDto,
} from '../dto/price-list.dto';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EventBus, EVENT_BUS } from '../../../common/events';

@Injectable()
export class PriceListService {
  constructor(
    private readonly repository: PriceListRepository,
    private readonly mapper: PriceListMapper,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreatePriceListDto,
    companyId: string,
    userId: string,
  ): Promise<PriceListEntity> {
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.PriceListCreateInput = {
        name: dto.name,
        description: dto.description,
        isActive: true,
        customer: { connect: { id: dto.customerId } },
      };
      const created = await this.repository.create(data, tx);
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'PriceList',
        entityId: created.id,
        action: 'CREATE',
        before: null,
        after: created,
      });
      return this.mapper.toEntity(created);
    });
  }

  async findAll(
    query: PriceListQueryDto,
    companyId: string,
  ): Promise<{
    items: PriceListEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      search,
      sortBy = 'createdAt',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.PriceListWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.repository.findMany({
      skip,
      take: limit,
      where: { ...where, customer: { companyId } },
      orderBy: { [sortBy]: sortOrder },
    });
    return { items: this.mapper.toEntityList(items), total, page, limit };
  }

  async findOne(id: string, companyId: string): Promise<PriceListEntity> {
    const entity = await this.repository.findByIdOrThrow(id, companyId);
    return this.mapper.toEntity(entity);
  }

  async update(
    id: string,
    dto: UpdatePriceListDto,
    companyId: string,
    userId: string,
  ): Promise<PriceListEntity> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.repository.findByIdOrThrow(id, companyId);
      const data: Prisma.PriceListUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;
      const updated = await this.repository.update({ id, companyId, data, tx });
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'PriceList',
        entityId: id,
        action: 'UPDATE',
        before,
        after: updated,
      });
      return this.mapper.toEntity(updated);
    });
  }

  async remove(id: string, companyId: string, userId: string): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.repository.findByIdOrThrow(id, companyId);
      await this.repository.softDelete(id, companyId, tx);
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'PriceList',
        entityId: id,
        action: 'DELETE',
        before,
        after: null,
      });
    });
  }
}
