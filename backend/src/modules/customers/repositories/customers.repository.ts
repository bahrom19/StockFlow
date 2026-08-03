import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

// Scalar field names of the Customer model — used to separate scalar updates
// from relation writes in update() because updateMany accepts only scalar
// fields (CustomerUpdateManyMutationInput).
const CUSTOMER_SCALAR_KEYS = new Set<string>(
  Object.values(Prisma.CustomerScalarFieldEnum),
);

@Injectable()
export class CustomersRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prismaService;
  }

  async create(
    data: Prisma.CustomerCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Customer> {
    return this.getClient(tx).customer.create({ data });
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    firstName?: string;
    lastName?: string;
    type?: Prisma.CustomerWhereInput['type'];
    isActive?: boolean;
    page?: number;
    limit?: number;
    sortBy?:
      | 'createdAt'
      | 'updatedAt'
      | 'firstName'
      | 'lastName'
      | 'companyName'
      | 'email';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: Customer[]; total: number }> {
    const {
      companyId,
      search,
      firstName,
      lastName,
      type,
      isActive,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      companyId,
      ...(firstName
        ? { firstName: { contains: firstName, mode: 'insensitive' } }
        : {}),
      ...(lastName
        ? { lastName: { contains: lastName, mode: 'insensitive' } }
        : {}),
      ...(type ? { type } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { companyName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.customer.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.customer.count({ where }),
    ]);

    return { items, total };
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Customer | null> {
    return this.getClient(tx).customer.findFirst({
      where: {
        id,
        deletedAt: null,
        companyId,
      },
    });
  }

  async update(
    id: string,
    data: Prisma.CustomerUpdateInput,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Customer> {
    const client = this.getClient(tx);

    // If rowVersion is provided, use optimistic locking
    if (rowVersion !== undefined) {
      // updateMany only accepts scalar fields (CustomerUpdateManyMutationInput).
      // Relation writes (e.g. group: { connect }) must be applied via
      // customer.update after the optimistic-lock check succeeds, otherwise
      // Prisma throws "Unknown argument `group`" (Blocker B1 pattern).
      const scalarData: Record<string, unknown> = {};
      const relationData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (CUSTOMER_SCALAR_KEYS.has(key)) {
          scalarData[key] = value;
        } else {
          relationData[key] = value;
        }
      }

      const result = await client.customer.updateMany({
        where: { id, companyId, rowVersion },
        data: { ...scalarData, rowVersion: { increment: 1 } },
      });

      if (result.count === 0) {
        const existing = await client.customer.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Customer with id ${id} not found`);
        }
        throw new ConflictException(
          `Customer ${id} was modified by another user. Please refresh and retry.`,
        );
      }

      // Apply relation writes (updateMany cannot touch relations)
      if (Object.keys(relationData).length > 0) {
        await client.customer.update({ where: { id }, data: relationData });
      }

      return client.customer.findUnique({
        where: { id },
      }) as unknown as Customer;
    }

    // Legacy path without rowVersion (for create-only flows)
    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }
    return client.customer.update({ where: { id }, data });
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Customer> {
    const client = this.getClient(tx);

    if (rowVersion !== undefined) {
      const result = await client.customer.updateMany({
        where: { id, companyId, rowVersion },
        data: {
          deletedAt: new Date(),
          isActive: false,
          rowVersion: { increment: 1 },
        },
      });
      if (result.count === 0) {
        const existing = await client.customer.findFirst({
          where: { id, companyId },
        });
        if (!existing) {
          throw new NotFoundException(`Customer with id ${id} not found`);
        }
        throw new ConflictException(
          `Customer ${id} was modified by another user. Please refresh and retry.`,
        );
      }
      return client.customer.findUnique({
        where: { id },
      }) as unknown as Customer;
    }

    const existing = await this.findById(id, companyId, tx);
    if (!existing) {
      throw new NotFoundException(`Customer with id ${id} not found`);
    }
    return client.customer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }
}
