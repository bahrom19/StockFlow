import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupplierPayment } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class SupplierPaymentsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prismaService;
  }

  async findAllBySupplier(
    supplierId: string,
    companyId: string,
    page = 1,
    limit = 20,
    tx?: Prisma.TransactionClient,
  ): Promise<{ items: SupplierPayment[]; total: number }> {
    const client = this.getClient(tx);
    const where: Prisma.SupplierPaymentWhereInput = {
      supplierId,
      companyId,
      deletedAt: null,
    };
    const [items, total] = await Promise.all([
      client.supplierPayment.findMany({
        where,
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      client.supplierPayment.count({ where }),
    ]);
    return { items, total };
  }

  async findById(
    id: string,
    supplierId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierPayment | null> {
    return this.getClient(tx).supplierPayment.findFirst({
      where: { id, supplierId, companyId, deletedAt: null },
    });
  }

  async findByIdIncludeDeleted(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierPayment | null> {
    return this.getClient(tx).supplierPayment.findFirst({
      where: { id, companyId },
    });
  }

  async create(
    data: Prisma.SupplierPaymentCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierPayment> {
    return this.getClient(tx).supplierPayment.create({ data });
  }

  async update(
    id: string,
    supplierId: string,
    companyId: string,
    data: Prisma.SupplierPaymentUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierPayment> {
    const client = this.getClient(tx);
    const result = await client.supplierPayment.updateMany({
      where: { id, supplierId, companyId, deletedAt: null },
      data,
    });
    if (result.count === 0) {
      throw new NotFoundException(`Supplier payment with id ${id} not found`);
    }
    return client.supplierPayment.findUnique({
      where: { id },
    }) as unknown as SupplierPayment;
  }

  async softDelete(
    id: string,
    supplierId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierPayment> {
    const client = this.getClient(tx);
    const result = await client.supplierPayment.updateMany({
      where: { id, supplierId, companyId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) {
      throw new NotFoundException(`Supplier payment with id ${id} not found`);
    }
    return client.supplierPayment.findUnique({
      where: { id },
    }) as unknown as SupplierPayment;
  }

  async countBySupplier(
    supplierId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return this.getClient(tx).supplierPayment.count({
      where: { supplierId, companyId, deletedAt: null },
    });
  }

  async sumPaidByInvoice(
    purchaseInvoiceId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await this.getClient(tx).supplierPayment.aggregate({
      where: { purchaseInvoiceId, companyId, deletedAt: null },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }
}
