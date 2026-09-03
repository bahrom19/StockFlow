import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupplierAddress } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class SupplierAddressesRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prismaService;
  }

  async findAllBySupplier(
    supplierId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierAddress[]> {
    return this.getClient(tx).supplierAddress.findMany({
      where: { supplierId, deletedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findById(
    id: string,
    supplierId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierAddress | null> {
    return this.getClient(tx).supplierAddress.findFirst({
      where: { id, supplierId, deletedAt: null },
    });
  }

  async create(
    data: Prisma.SupplierAddressCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierAddress> {
    return this.getClient(tx).supplierAddress.create({ data });
  }

  async update(
    id: string,
    supplierId: string,
    data: Prisma.SupplierAddressUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierAddress> {
    const client = this.getClient(tx);
    const existing = await client.supplierAddress.findFirst({
      where: { id, supplierId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(
        `Supplier address with id ${id} not found`,
      );
    }
    return client.supplierAddress.update({ where: { id }, data });
  }

  async softDelete(
    id: string,
    supplierId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierAddress> {
    const client = this.getClient(tx);
    const existing = await client.supplierAddress.findFirst({
      where: { id, supplierId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(
        `Supplier address with id ${id} not found`,
      );
    }
    return client.supplierAddress.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findActiveDefault(
    supplierId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierAddress | null> {
    return this.getClient(tx).supplierAddress.findFirst({
      where: {
        supplierId,
        isDefault: true,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async clearDefault(
    supplierId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.getClient(tx).supplierAddress.updateMany({
      where: {
        supplierId,
        isDefault: true,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { isDefault: false },
    });
  }
}
