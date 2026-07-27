import { Inject, Injectable } from '@nestjs/common';
import { Prisma, OpportunityStatus, OpportunityPriority } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { OpportunityRepository } from '../repositories/opportunity.repository';
import { OpportunityMapper } from '../mappers/opportunity.mapper';
import { SalesOpportunityEntity } from '../entities/sales-opportunity.entity';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  OpportunityQueryDto,
} from '../dto/opportunity.dto';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EventBus, EVENT_BUS } from '../../../common/events';

@Injectable()
export class OpportunityService {
  constructor(
    private readonly repository: OpportunityRepository,
    private readonly mapper: OpportunityMapper,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreateOpportunityDto,
    companyId: string,
    userId: string,
  ): Promise<SalesOpportunityEntity> {
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.SalesOpportunityCreateInput = {
        title: dto.title,
        status: (dto.status as OpportunityStatus) ?? OpportunityStatus.NEW,
        priority:
          (dto.priority as OpportunityPriority) ?? OpportunityPriority.MEDIUM,
        value: dto.value,
        probability: dto.probability ?? 0,
        description: dto.description,
        expectedCloseDate: dto.expectedCloseDate
          ? new Date(dto.expectedCloseDate)
          : undefined,
        assignedTo: dto.assignedTo,
        notes: dto.notes,
        company: { connect: { id: companyId } },
        customer: { connect: { id: dto.customerId } },
      };
      const created = await this.repository.create(data, tx);
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'SalesOpportunity',
        entityId: created.id,
        action: 'CREATE',
        before: null,
        after: created,
      });
      return this.mapper.toEntity(created);
    });
  }

  async findAll(
    query: OpportunityQueryDto,
    companyId: string,
  ): Promise<{
    items: SalesOpportunityEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      search,
      customerId,
      status,
      sortBy = 'createdAt',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.SalesOpportunityWhereInput = {};
    if (customerId) where.customerId = customerId;
    if (status) where.status = status as OpportunityStatus;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
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

  async findOne(
    id: string,
    companyId: string,
  ): Promise<SalesOpportunityEntity> {
    const entity = await this.repository.findByIdOrThrow(id, companyId);
    return this.mapper.toEntity(entity);
  }

  async update(
    id: string,
    dto: UpdateOpportunityDto,
    companyId: string,
    userId: string,
  ): Promise<SalesOpportunityEntity> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.repository.findByIdOrThrow(id, companyId);
      const data: Prisma.SalesOpportunityUpdateInput = {};
      if (dto.title !== undefined) data.title = dto.title;
      if (dto.description !== undefined) data.description = dto.description;
      if (dto.status !== undefined)
        data.status = dto.status as OpportunityStatus;
      if (dto.priority !== undefined)
        data.priority = dto.priority as OpportunityPriority;
      if (dto.probability !== undefined) data.probability = dto.probability;
      if (dto.value !== undefined) data.value = dto.value;
      if (dto.expectedCloseDate !== undefined)
        data.expectedCloseDate = new Date(dto.expectedCloseDate);
      if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;
      if (dto.notes !== undefined) data.notes = dto.notes;
      const updated = await this.repository.update({ id, companyId, data, tx });
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'SalesOpportunity',
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
        entityType: 'SalesOpportunity',
        entityId: id,
        action: 'DELETE',
        before,
        after: null,
      });
    });
  }
}
