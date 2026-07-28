import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CustomerGroupRepository } from '../repositories/customer-group.repository';
import { CustomerGroupMapper } from '../mappers/customer-group.mapper';
import { CustomerGroupEntity } from '../entities/customer-group.entity';
import {
  CreateCustomerGroupDto,
  UpdateCustomerGroupDto,
  CustomerGroupQueryDto,
} from '../dto/customer-group.dto';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EventBus, EVENT_BUS } from '../../../common/events';

@Injectable()
export class CustomerGroupService {
  constructor(
    private readonly repository: CustomerGroupRepository,
    private readonly mapper: CustomerGroupMapper,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreateCustomerGroupDto,
    companyId: string,
    userId: string,
  ): Promise<CustomerGroupEntity> {
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.CustomerGroupCreateInput = {
        name: dto.name,
        description: dto.description,
        discountPercent: dto.discountPercent,
        company: { connect: { id: companyId } },
      };
      const created = await this.repository.create(data, tx);
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'CustomerGroup',
        entityId: created.id,
        action: 'CREATE',
        before: null,
        after: created,
      });
      return this.mapper.toEntity(created);
    });
  }

  async findAll(
    query: CustomerGroupQueryDto,
    companyId: string,
  ): Promise<{
    items: CustomerGroupEntity[];
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
    const where: Prisma.CustomerGroupWhereInput = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [items, total] = await this.repository.findMany({
      companyId,
      skip,
      take: limit,
      where,
      orderBy: { [sortBy]: sortOrder },
    });
    return { items: this.mapper.toEntityList(items), total, page, limit };
  }

  async findOne(id: string, companyId: string): Promise<CustomerGroupEntity> {
    const entity = await this.repository.findByIdOrThrow(id, companyId);
    return this.mapper.toEntity(entity);
  }

  async update(
    id: string,
    dto: UpdateCustomerGroupDto,
    companyId: string,
    userId: string,
  ): Promise<CustomerGroupEntity> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.repository.findByIdOrThrow(id, companyId);
      const data: Prisma.CustomerGroupUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.discountPercent !== undefined)
        data.discountPercent = dto.discountPercent;
      const updated = await this.repository.update({ id, companyId, data, tx });
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'CustomerGroup',
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
        entityType: 'CustomerGroup',
        entityId: id,
        action: 'DELETE',
        before,
        after: null,
      });
    });
  }
}
