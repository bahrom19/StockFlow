import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ContactRepository } from '../repositories/contact.repository';
import { ContactMapper } from '../mappers/contact.mapper';
import { ContactEntity } from '../entities/contact.entity';
import {
  CreateContactDto,
  UpdateContactDto,
  ContactQueryDto,
} from '../dto/contact.dto';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EventBus, EVENT_BUS } from '../../../common/events';

@Injectable()
export class ContactService {
  constructor(
    private readonly repository: ContactRepository,
    private readonly mapper: ContactMapper,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreateContactDto,
    companyId: string,
    userId: string,
  ): Promise<ContactEntity> {
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.CustomerContactCreateInput = {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        position: dto.position,
        isPrimary: dto.isPrimary ?? false,
        notes: dto.notes,
        customer: { connect: { id: dto.customerId } },
      };
      const created = await this.repository.create(data, tx);
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'CustomerContact',
        entityId: created.id,
        action: 'CREATE',
        before: null,
        after: created,
      });
      return this.mapper.toEntity(created);
    });
  }

  async findAll(
    query: ContactQueryDto,
    companyId: string,
  ): Promise<{
    items: ContactEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      search,
      customerId,
      sortBy = 'createdAt',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.CustomerContactWhereInput = {};
    if (customerId) where.customerId = customerId;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
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

  async findOne(id: string, companyId: string): Promise<ContactEntity> {
    const entity = await this.repository.findByIdOrThrow(id, companyId);
    return this.mapper.toEntity(entity);
  }

  async update(
    id: string,
    dto: UpdateContactDto,
    companyId: string,
    userId: string,
  ): Promise<ContactEntity> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.repository.findByIdOrThrow(id, companyId);
      const data: Prisma.CustomerContactUpdateInput = {};
      if (dto.firstName !== undefined) data.firstName = dto.firstName;
      if (dto.lastName !== undefined) data.lastName = dto.lastName;
      if (dto.email !== undefined) data.email = dto.email;
      if (dto.phone !== undefined) data.phone = dto.phone;
      if (dto.position !== undefined) data.position = dto.position;
      if (dto.isPrimary !== undefined) data.isPrimary = dto.isPrimary;
      if (dto.notes !== undefined) data.notes = dto.notes;
      const updated = await this.repository.update({ id, companyId, data, tx });
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'CustomerContact',
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
        entityType: 'CustomerContact',
        entityId: id,
        action: 'DELETE',
        before,
        after: null,
      });
    });
  }
}
