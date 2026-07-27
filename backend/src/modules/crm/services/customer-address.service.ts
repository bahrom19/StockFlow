import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CustomerAddressRepository } from '../repositories/customer-address.repository';
import { CustomerAddressMapper } from '../mappers/customer-address.mapper';
import { CustomerAddressEntity } from '../entities/customer-address.entity';
import {
  CreateCustomerAddressDto,
  UpdateCustomerAddressDto,
  CustomerAddressQueryDto,
} from '../dto/customer-address.dto';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EventBus } from '../../../common/events/event-bus.interface';

@Injectable()
export class CustomerAddressService {
  constructor(
    private readonly repository: CustomerAddressRepository,
    private readonly mapper: CustomerAddressMapper,
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreateCustomerAddressDto,
    companyId: string,
    userId: string,
  ): Promise<CustomerAddressEntity> {
    return this.prisma.$transaction(async (tx) => {
      const data: Prisma.CustomerAddressCreateInput = {
        city: dto.city,
        country: dto.country,
        street: dto.street,
        postalCode: dto.postalCode,
        isDefault: dto.isDefault ?? false,
        customer: { connect: { id: dto.customerId } },
      };
      const created = await this.repository.create(data, tx);
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'CustomerAddress',
        entityId: created.id,
        action: 'CREATE',
        before: null,
        after: created,
      });
      return this.mapper.toEntity(created);
    });
  }

  async findAll(
    query: CustomerAddressQueryDto,
    companyId: string,
  ): Promise<{
    items: CustomerAddressEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 20,
      customerId,
      sortBy = 'createdAt',
      sortOrder = 'asc',
    } = query;
    const skip = (page - 1) * limit;
    const where: Prisma.CustomerAddressWhereInput = {};
    if (customerId) where.customerId = customerId;
    const [items, total] = await this.repository.findMany({
      skip,
      take: limit,
      where,
      orderBy: { [sortBy]: sortOrder },
    });
    return { items: this.mapper.toEntityList(items), total, page, limit };
  }

  async findOne(id: string, companyId: string): Promise<CustomerAddressEntity> {
    const entity = await this.repository.findByIdOrThrow(id, companyId);
    return this.mapper.toEntity(entity);
  }

  async update(
    id: string,
    dto: UpdateCustomerAddressDto,
    companyId: string,
    userId: string,
  ): Promise<CustomerAddressEntity> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.repository.findByIdOrThrow(id, companyId);
      const data: Prisma.CustomerAddressUpdateInput = {};
      if (dto.city !== undefined) data.city = dto.city;
      if (dto.country !== undefined) data.country = dto.country;
      if (dto.street !== undefined) data.street = dto.street;
      if (dto.postalCode !== undefined) data.postalCode = dto.postalCode;
      if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
      const updated = await this.repository.update({ id, companyId, data, tx });
      await this.auditLog.log({
        companyId,
        userId,
        entityType: 'CustomerAddress',
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
        entityType: 'CustomerAddress',
        entityId: id,
        action: 'DELETE',
        before,
        after: null,
      });
    });
  }
}
