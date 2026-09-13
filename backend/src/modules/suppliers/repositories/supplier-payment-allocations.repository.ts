import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SupplierPaymentAllocation } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class SupplierPaymentAllocationsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx ?? this.prismaService;
  }

  /**
   * Create a new allocation. Runs inside the caller's transaction.
   * The caller MUST have already validated:
   * - payment and invoice belong to the same company and supplier
   * - payment amount is sufficient (no over-allocation)
   * - invoice is not CANCELLED
   * - tenant isolation
   */
  async create(
    data: Prisma.SupplierPaymentAllocationCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierPaymentAllocation> {
    return this.getClient(tx).supplierPaymentAllocation.create({ data });
  }

  /**
   * Find all active allocations for a payment (tenant-scoped).
   */
  async findByPayment(
    paymentId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierPaymentAllocation[]> {
    return this.getClient(tx).supplierPaymentAllocation.findMany({
      where: {
        paymentId,
        companyId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find all active allocations for an invoice (tenant-scoped).
   */
  async findByInvoice(
    purchaseInvoiceId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierPaymentAllocation[]> {
    return this.getClient(tx).supplierPaymentAllocation.findMany({
      where: {
        purchaseInvoiceId,
        companyId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Sum allocated amounts for a payment (tenant-scoped).
   * Returns the total of all active (non-voided, non-deleted) allocations.
   */
  async sumAllocatedByPayment(
    paymentId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await this.getClient(tx).supplierPaymentAllocation.aggregate({
      where: {
        paymentId,
        companyId,
        deletedAt: null,
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  /**
   * Sum allocated amounts for an invoice (tenant-scoped).
   * Returns the total of all active (non-voided, non-deleted) allocations.
   */
  async sumAllocatedByInvoice(
    purchaseInvoiceId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await this.getClient(tx).supplierPaymentAllocation.aggregate({
      where: {
        purchaseInvoiceId,
        companyId,
        deletedAt: null,
      },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  /**
   * Soft-delete all allocations for a payment (used during void).
   * Returns the count of deleted allocations.
   */
  async softDeleteByPayment(
    paymentId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const result = await this.getClient(tx).supplierPaymentAllocation.updateMany({
      where: {
        paymentId,
        companyId,
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    return result.count;
  }

  /**
   * Find a single allocation by ID (tenant-scoped).
   */
  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<SupplierPaymentAllocation | null> {
    return this.getClient(tx).supplierPaymentAllocation.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }
}
