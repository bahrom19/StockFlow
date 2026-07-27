import { Injectable } from '@nestjs/common';
import { Prisma, Currency as PrismaCurrency } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreditLimitRepository } from '../repositories/credit-limit.repository';
import { CreditLimitMapper } from '../mappers/credit-limit.mapper';
import { CreditLimitEntity } from '../entities/credit-limit.entity';
import {
  CreateCreditLimitDto,
  UpdateCreditLimitDto,
  CreditLimitQueryDto,
} from '../dto/credit-limit.dto';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EventBus } from '../../../common/events/event-bus.interface';
import { CustomerCreditLimitChangedEvent } from '../events/customer-credit-limit-changed.event';

@Injectable()
export class CreditLimitService {
  constructor(
    private readonly repository: CreditLimitRepository,
    private readonly mapper: CreditLimitMapper,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreateCreditLimitDto,
    companyId: string,
    userId: string,
  ): Promise<CreditLimitEntity> {
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.CreditLimitCreateInput = {
        amount: dto.amount,
        currency: 'KZT',
        customer: { connect: { id: dto.customerId } },
      };
      if (dto.currency) data.currency = dto.currency as PrismaCurrency;
      const created = await this.repository.create(data, tx);
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'CreditLimit',
        entityId: created.id,
        action: 'CREATE',
        before: null,
        after: created,
      });
      return this.mapper.toEntity(created);
    });
  }

  async findAll(
    query: CreditLimitQueryDto,
    companyId: string,
  ): Promise<{
    items: CreditLimitEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;
    const [items, total] = await this.repository.findMany({
      skip,
      take: limit,
      where: { customer: { companyId } },
      orderBy: { [sortBy]: sortOrder },
    });
    return { items: this.mapper.toEntityList(items), total, page, limit };
  }

  async findOne(id: string, companyId: string): Promise<CreditLimitEntity> {
    const entity = await this.repository.findByIdOrThrow(id, companyId);
    return this.mapper.toEntity(entity);
  }

  async findByCustomer(customerId: string): Promise<CreditLimitEntity | null> {
    const entity = await this.repository.findByCustomerId(customerId);
    return entity ? this.mapper.toEntity(entity) : null;
  }

  async update(
    id: string,
    dto: UpdateCreditLimitDto,
    companyId: string,
    userId: string,
  ): Promise<CreditLimitEntity> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.repository.findByIdOrThrow(id, companyId);
      const data: Prisma.CreditLimitUpdateInput = {
        amount: dto.amount,
      };
      const updated = await this.repository.update({ id, data, tx });
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'CreditLimit',
        entityId: id,
        action: 'UPDATE',
        before,
        after: updated,
      });
      await this.eventBus.publish(
        new CustomerCreditLimitChangedEvent(
          before.customerId,
          companyId,
          before.amount.toNumber().toFixed(2),
          updated.amount.toNumber().toFixed(2),
          userId,
          tx,
        ),
      );
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
        entityType: 'CreditLimit',
        entityId: id,
        action: 'DELETE',
        before,
        after: null,
      });
    });
  }
}
