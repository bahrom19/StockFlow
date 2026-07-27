import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CustomerNoteRepository } from '../repositories/customer-note.repository';
import { CustomerNoteMapper } from '../mappers/customer-note.mapper';
import { CustomerNoteEntity } from '../entities/customer-note.entity';
import {
  CreateCustomerNoteDto,
  CustomerNoteQueryDto,
} from '../dto/customer-note.dto';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EventBus } from '../../../common/events/event-bus.interface';

@Injectable()
export class CustomerNoteService {
  constructor(
    private readonly repository: CustomerNoteRepository,
    private readonly mapper: CustomerNoteMapper,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreateCustomerNoteDto,
    customerId: string,
    companyId: string,
    userId: string,
  ): Promise<CustomerNoteEntity> {
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.CustomerNoteCreateInput = {
        title: dto.title,
        content: dto.content,
        createdBy: userId,
        customer: { connect: { id: customerId } },
      };
      const created = await this.repository.create(data, tx);
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'CustomerNote',
        entityId: created.id,
        action: 'CREATE',
        before: null,
        after: created,
      });
      return this.mapper.toEntity(created);
    });
  }

  async findAll(
    query: CustomerNoteQueryDto,
    companyId: string,
  ): Promise<{
    items: CustomerNoteEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;
    const [items, total] = await this.repository.findMany({
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    });
    return { items: this.mapper.toEntityList(items), total, page, limit };
  }

  async remove(id: string, companyId: string, userId: string): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.repository.findByIdOrThrow(id, companyId);
      await this.repository.softDelete(id, companyId, tx);
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'CustomerNote',
        entityId: id,
        action: 'DELETE',
        before,
        after: null,
      });
    });
  }
}
