import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreditLimit, Prisma } from '@prisma/client';

@Injectable()
export class CreditLimitRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Tenant-safe customer existence check (CRM convention: foreign == 404). */
  async findCustomerCompany(
    customerId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ id: string } | null> {
    const prisma = tx ?? this.prisma;
    return prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
      select: { id: true },
    });
  }

  async findMany(params: {
    companyId: string;
    skip?: number;
    take?: number;
    where?: Prisma.CreditLimitWhereInput;
    orderBy?: Prisma.CreditLimitOrderByWithRelationInput;
  }): Promise<[CreditLimit[], number]> {
    const { companyId, skip, take, where, orderBy } = params;
    const tenantWhere: Prisma.CreditLimitWhereInput = {
      ...where,
      customer: { companyId, deletedAt: null },
    };
    const [items, total] = await Promise.all([
      this.prisma.creditLimit.findMany({
        where: tenantWhere,
        skip,
        take,
        orderBy,
      }),
      this.prisma.creditLimit.count({
        where: tenantWhere,
      }),
    ]);
    return [items, total];
  }

  async findById(id: string, companyId: string): Promise<CreditLimit | null> {
    return this.prisma.creditLimit.findFirst({
      where: { id, customer: { companyId } },
    });
  }

  async findByIdOrThrow(id: string, companyId: string): Promise<CreditLimit> {
    const entity = await this.findById(id, companyId);
    if (!entity) throw new NotFoundException('Credit limit not found');
    return entity;
  }

  async findByCustomerId(
    customerId: string,
    companyId: string,
  ): Promise<CreditLimit | null> {
    return this.prisma.creditLimit.findFirst({
      where: { customerId, customer: { companyId } },
    });
  }

  async create(
    data: Prisma.CreditLimitCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CreditLimit> {
    const prisma = tx ?? this.prisma;
    return prisma.creditLimit.create({ data });
  }

  async update(params: {
    id: string;
    data: Prisma.CreditLimitUpdateInput;
    tx?: Prisma.TransactionClient;
  }): Promise<CreditLimit> {
    const { id, data, tx } = params;
    const prisma = tx ?? this.prisma;
    return prisma.creditLimit.update({ where: { id }, data });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const prisma = tx ?? this.prisma;
    await this.findByIdOrThrow(id, companyId);
    await prisma.creditLimit.update({
      where: { id },
      data: { isActive: false } as Partial<Prisma.CreditLimitUpdateInput>,
    });
  }
}
