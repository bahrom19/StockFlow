import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { CustomerQueryDto } from '../dto/customer-query.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { CustomerEntity } from '../entities/customer.entity';
import { CustomersRepository } from '../repositories/customers.repository';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { CustomerCreatedEvent } from '../../crm/events/customer-created.event';
import { CustomerUpdatedEvent } from '../../crm/events/customer-updated.event';
import { CustomerDeletedEvent } from '../../crm/events/customer-deleted.event';

@Injectable()
export class CustomersService {
  constructor(
    private readonly customersRepository: CustomersRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLogService: AuditLogService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(
    createCustomerDto: CreateCustomerDto,
    currentUser: JwtPayload,
  ): Promise<CustomerEntity> {
    const existingCustomer = await this.customersRepository.findAll({
      companyId: currentUser.companyId,
      search:
        createCustomerDto.email ??
        createCustomerDto.phone ??
        createCustomerDto.bin ??
        createCustomerDto.iin,
    });

    if (existingCustomer.total > 0) {
      throw new ConflictException(
        'Customer with similar identity already exists',
      );
    }

    const customer = await this.prismaService.$transaction(async (tx) => {
      const createdCustomer = await this.customersRepository.create(
        {
          company: { connect: { id: currentUser.companyId } },
          ...(createCustomerDto.groupId
            ? { group: { connect: { id: createCustomerDto.groupId } } }
            : {}),
          type: createCustomerDto.type,
          firstName: createCustomerDto.firstName,
          lastName: createCustomerDto.lastName,
          companyName: createCustomerDto.companyName,
          iin: createCustomerDto.iin,
          bin: createCustomerDto.bin,
          email: createCustomerDto.email,
          phone: createCustomerDto.phone,
          mobile: createCustomerDto.mobile,
          discount: createCustomerDto.discount as
            | Prisma.Decimal
            | string
            | number
            | undefined,
          creditLimit: createCustomerDto.creditLimit as
            | Prisma.Decimal
            | string
            | number
            | undefined,
          currentDebt: createCustomerDto.currentDebt as
            | Prisma.Decimal
            | string
            | number
            | undefined,
          bonusPoints: createCustomerDto.bonusPoints ?? 0,
          notes: createCustomerDto.notes,
          isActive: createCustomerDto.isActive ?? true,
        } as Prisma.CustomerCreateInput,
        tx,
      );

      await this.auditLogService.log({
        companyId: currentUser.companyId,
        userId: currentUser.userId,
        entityType: 'Customer',
        entityId: createdCustomer.id,
        action: 'CREATE',
        before: null,
        after: createdCustomer,
      });

      await this.eventBus.publish(
        new CustomerCreatedEvent({
          customerId: createdCustomer.id,
          companyId: currentUser.companyId,
          type: createCustomerDto.type,
          firstName: createCustomerDto.firstName ?? null,
          lastName: createCustomerDto.lastName ?? null,
          companyName: createCustomerDto.companyName ?? null,
          email: createCustomerDto.email ?? null,
          phone: createCustomerDto.phone ?? null,
          groupId: createCustomerDto.groupId ?? null,
          createdBy: currentUser.userId ?? null,
        }),
      );

      return createdCustomer;
    });

    return this.toEntity(customer);
  }

  async findAll(
    query: CustomerQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    items: CustomerEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must be positive integers');
    }

    const result = await this.customersRepository.findAll({
      companyId: currentUser.companyId,
      search: query.search,
      firstName: query.firstName,
      lastName: query.lastName,
      type: query.type,
      isActive: query.isActive,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: result.items.map((customer) => this.toEntity(customer)),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(id: string, currentUser: JwtPayload): Promise<CustomerEntity> {
    const customer = await this.customersRepository.findById(
      id,
      currentUser.companyId,
    );

    if (!customer) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    return this.toEntity(customer);
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
    currentUser: JwtPayload,
  ): Promise<CustomerEntity> {
    await this.findById(id, currentUser);

    const before = await this.customersRepository.findById(
      id,
      currentUser.companyId,
    );
    if (!before) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    const updatedCustomer = await this.prismaService.$transaction(
      async (tx) => {
        const existing = await this.customersRepository.findById(
          id,
          currentUser.companyId,
          tx,
        );
        const rowVer = existing?.rowVersion ?? 0;
        const updated = await this.customersRepository.update(
          id,
          {
            ...(updateCustomerDto.groupId
              ? { group: { connect: { id: updateCustomerDto.groupId } } }
              : {}),
            ...(updateCustomerDto.type ? { type: updateCustomerDto.type } : {}),
            firstName: updateCustomerDto.firstName,
            lastName: updateCustomerDto.lastName,
            companyName: updateCustomerDto.companyName,
            iin: updateCustomerDto.iin,
            bin: updateCustomerDto.bin,
            email: updateCustomerDto.email,
            phone: updateCustomerDto.phone,
            mobile: updateCustomerDto.mobile,
            discount: updateCustomerDto.discount as
              | Prisma.Decimal
              | string
              | number
              | undefined,
            creditLimit: updateCustomerDto.creditLimit as
              | Prisma.Decimal
              | string
              | number
              | undefined,
            currentDebt: updateCustomerDto.currentDebt as
              | Prisma.Decimal
              | string
              | number
              | undefined,
            bonusPoints: updateCustomerDto.bonusPoints,
            notes: updateCustomerDto.notes,
            isActive: updateCustomerDto.isActive,
          } as Prisma.CustomerUpdateInput,
          currentUser.companyId,
          rowVer,
          tx,
        );

        await this.auditLogService.log({
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'Customer',
          entityId: id,
          action: 'UPDATE',
          before,
          after: updated,
        });

        await this.eventBus.publish(
          new CustomerUpdatedEvent({
            customerId: id,
            companyId: currentUser.companyId,
            changes: updateCustomerDto as Record<string, unknown>,
            updatedBy: currentUser.userId ?? null,
          }),
        );

        return updated;
      },
    );

    return this.toEntity(updatedCustomer);
  }

  async softDelete(
    id: string,
    currentUser: JwtPayload,
  ): Promise<CustomerEntity> {
    await this.findById(id, currentUser);
    const before = await this.customersRepository.findById(
      id,
      currentUser.companyId,
    );
    if (!before) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }

    const deletedCustomer = await this.prismaService.$transaction(
      async (tx) => {
        const existing = await this.customersRepository.findById(
          id,
          currentUser.companyId,
          tx,
        );
        const rowVer = existing?.rowVersion ?? 0;
        const deleted = await this.customersRepository.softDelete(
          id,
          currentUser.companyId,
          rowVer,
          tx,
        );

        await this.auditLogService.log({
          companyId: currentUser.companyId,
          userId: currentUser.userId,
          entityType: 'Customer',
          entityId: id,
          action: 'DELETE',
          before,
          after: null,
        });

        await this.eventBus.publish(
          new CustomerDeletedEvent({
            customerId: id,
            companyId: currentUser.companyId,
            deletedBy: currentUser.userId ?? null,
          }),
        );

        return deleted;
      },
    );

    return this.toEntity(deletedCustomer);
  }

  private toEntity(customer: Customer): CustomerEntity {
    return {
      id: customer.id,
      companyId: customer.companyId,
      groupId: customer.groupId,
      type: customer.type,
      firstName: customer.firstName,
      lastName: customer.lastName,
      companyName: customer.companyName,
      iin: customer.iin,
      bin: customer.bin,
      email: customer.email,
      phone: customer.phone,
      mobile: customer.mobile,
      discount: customer.discount?.toString() ?? null,
      creditLimit: customer.creditLimit?.toString() ?? null,
      currentDebt: customer.currentDebt?.toString() ?? null,
      bonusPoints: customer.bonusPoints,
      notes: customer.notes,
      isActive: customer.isActive,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      deletedAt: customer.deletedAt,
    };
  }
}
