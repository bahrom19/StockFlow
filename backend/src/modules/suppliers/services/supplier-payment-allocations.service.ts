import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PurchaseInvoiceStatus, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { runWithIdempotency } from '../../../infrastructure/idempotency/idempotency.helper';
import { SupplierPaymentsRepository } from '../repositories/supplier-payments.repository';
import { SupplierPaymentAllocationsRepository } from '../repositories/supplier-payment-allocations.repository';
import { SupplierPaymentAllocationEntity } from '../entities/supplier-payment-allocation.entity';
import { toAllocationEntity } from '../mappers/supplier-payment-allocation.mapper';

@Injectable()
export class SupplierPaymentAllocationsService {
  private readonly logger = new Logger(SupplierPaymentAllocationsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly paymentsRepo: SupplierPaymentsRepository,
    private readonly allocationsRepo: SupplierPaymentAllocationsRepository,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  /**
   * Create an allocation between a payment and an invoice.
   *
   * Invariants enforced:
   * - payment and invoice belong to the same company and supplier
   * - SUM(active allocations) + new allocation <= payment.amount (no payment over-allocation)
   * - SUM(active allocations) + new allocation <= invoice.grandTotal - max(invoice.paidAmount, SUM(active allocations)) (no invoice over-allocation)
   * - invoice is not CANCELLED
   * - amount > 0
   *
   * Concurrency: uses SELECT ... FOR UPDATE on the payment row to serialize
   * concurrent allocation operations for the same payment, plus the shared
   * G14-02-12 invoice lock (invoice → payment order) to serialize against
   * concurrent supplier-payment creates for the same invoice.
   *
   * Idempotency: uses runWithIdempotency to prevent duplicate allocations.
   */
  async create(
    supplierId: string,
    companyId: string,
    paymentId: string,
    purchaseInvoiceId: string,
    amount: number,
    userId: string,
    idempotencyKey?: string,
  ): Promise<SupplierPaymentAllocationEntity> {
    const allocationAmount = new Decimal(amount);
    if (allocationAmount.lte(0)) {
      throw new BadRequestException('Allocation amount must be greater than zero');
    }

    // 1. Verify payment exists and belongs to the same company/supplier
    const payment = await this.paymentsRepo.findById(paymentId, supplierId, companyId);
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found for this supplier`);
    }

    if (payment.deletedAt) {
      throw new BadRequestException('Cannot allocate to a voided payment');
    }

    // 2. Verify invoice exists and belongs to the same company/supplier
    const invoice = await this.prismaService.purchaseInvoice.findFirst({
      where: {
        id: purchaseInvoiceId,
        companyId,
        supplierId,
        deletedAt: null,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Purchase invoice ${purchaseInvoiceId} not found for this supplier`);
    }

    // 3. Invoice must not be CANCELLED
    if (invoice.status === PurchaseInvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot allocate to a cancelled invoice');
    }

    // 4. Use idempotency for allocation creation
    const result = await runWithIdempotency({
      prisma: this.prismaService,
      idempotency: this.idempotencyService,
      companyId,
      idempotencyKey,
      endpoint: 'supplier-payment-allocation-create',
      requestHashPayload: {
        supplierId,
        paymentId,
        purchaseInvoiceId,
        amount,
        userId,
      },
      status: HttpStatus.CREATED,
      work: (tx) =>
        this.applyCreateAllocation({
          supplierId,
          companyId,
          paymentId,
          purchaseInvoiceId,
          allocationAmount,
          tx,
        }),
    });

    return result.body as SupplierPaymentAllocationEntity;
  }

  /**
   * G9-A: atomic allocation body. Runs inside the caller's transaction (the
   * idempotency reservation or the legacy transaction).
   *
   * Concurrency protection: uses SELECT ... FOR UPDATE on the payment row
   * to serialize concurrent allocation operations for the same payment.
   */
  private async applyCreateAllocation(params: {
    supplierId: string;
    companyId: string;
    paymentId: string;
    purchaseInvoiceId: string;
    allocationAmount: Decimal;
    tx: Prisma.TransactionClient;
  }): Promise<SupplierPaymentAllocationEntity> {
    const { supplierId, companyId, paymentId, purchaseInvoiceId, allocationAmount, tx } = params;

    // G14-02-12: shared invoice lock FIRST (canonical order:
    // invoice → payment). Serializes coverage reads below against
    // concurrent supplier-payment creates for the same invoice. Uses the
    // existing tx client directly (same inline $queryRaw precedent as the
    // payment lock below); see PurchaseInvoiceRepository.lockInvoiceById
    // for the canonical repository-level form. Held to commit.
    const lockedInvoice = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "PurchaseInvoice"
      WHERE id = ${purchaseInvoiceId}
        AND "companyId" = ${companyId}
        AND "deletedAt" IS NULL
      FOR UPDATE
    `;

    if (lockedInvoice.length === 0) {
      throw new NotFoundException(`Purchase invoice ${purchaseInvoiceId} not found`);
    }

    // 5. Lock the payment row with SELECT ... FOR UPDATE
    // This prevents concurrent allocations from reading the same state
    const lockedPayment = await tx.$queryRaw<
      { id: string; amount: Decimal; deletedAt: Date | null }[]
    >`
      SELECT id, amount, "deletedAt"
      FROM "SupplierPayment"
      WHERE id = ${paymentId}
        AND "companyId" = ${companyId}
        AND "deletedAt" IS NULL
      FOR UPDATE
    `;

    if (lockedPayment.length === 0) {
      throw new NotFoundException(`Payment ${paymentId} not found or voided`);
    }

    const paymentAmount = new Decimal(lockedPayment[0]!.amount);

    // 6. Sum existing allocations for this payment (within the same transaction)
    const existingAllocated = await tx.supplierPaymentAllocation.aggregate({
      where: { paymentId, companyId, deletedAt: null },
      _sum: { amount: true },
    });

    const totalAllocated = new Decimal(existingAllocated._sum.amount ?? 0);
    const newTotal = totalAllocated.add(allocationAmount);

    // 7. Check payment over-allocation
    if (newTotal.gt(paymentAmount)) {
      throw new BadRequestException(
        `Allocation would exceed payment amount. Payment: ${paymentAmount.toString()}, ` +
        `already allocated: ${totalAllocated.toString()}, requested: ${allocationAmount.toString()}`,
      );
    }

    // 8. Get current invoice state (within the same transaction)
    const currentInvoice = await tx.purchaseInvoice.findFirst({
      where: { id: purchaseInvoiceId, companyId, deletedAt: null },
    });

    if (!currentInvoice) {
      throw new NotFoundException(`Invoice ${purchaseInvoiceId} not found`);
    }

    // 9. Check invoice over-allocation
    // Account for both paidAmount and existing allocations
    // The invariant is: total coverage (paidAmount + new allocations) <= grandTotal
    // But we need to be careful about the relationship between paidAmount and allocations
    //
    // After G9-A migration:
    // - Legacy payments have allocations backfilled
    // - New payments create both paidAmount update and allocation
    //
    // So paidAmount should approximately equal SUM(allocations)
    // But during transition, paidAmount might be higher
    //
    // Safe invariant: SUM(active allocations) + new allocation <= grandTotal
    // AND: paidAmount + new allocation <= grandTotal (if paidAmount > SUM(allocations))
    const invoiceAllocated = await tx.supplierPaymentAllocation.aggregate({
      where: { purchaseInvoiceId, companyId, deletedAt: null },
      _sum: { amount: true },
    });

    const totalInvoiceAllocated = new Decimal(invoiceAllocated._sum.amount ?? 0);
    const newInvoiceTotal = totalInvoiceAllocated.add(allocationAmount);
    const invoiceGrandTotal = new Decimal(currentInvoice.grandTotal);
    const invoicePaidAmount = new Decimal(currentInvoice.paidAmount);

    // Check 1: allocations + new allocation <= grandTotal
    if (newInvoiceTotal.gt(invoiceGrandTotal)) {
      throw new BadRequestException(
        `Allocation would exceed invoice grand total. Invoice: ${invoiceGrandTotal.toString()}, ` +
        `already allocated: ${totalInvoiceAllocated.toString()}, requested: ${allocationAmount.toString()}`,
      );
    }

    // Check 2: paidAmount + new allocation <= grandTotal (safety net for transition period)
    // This catches the case where paidAmount > SUM(allocations) during migration
    const paidPlusNew = invoicePaidAmount.add(allocationAmount);
    if (paidPlusNew.gt(invoiceGrandTotal)) {
      throw new BadRequestException(
        `Allocation would exceed invoice outstanding. Invoice grand total: ${invoiceGrandTotal.toString()}, ` +
        `already paid: ${invoicePaidAmount.toString()}, requested: ${allocationAmount.toString()}`,
      );
    }

    // 10. Create the allocation
    const allocation = await tx.supplierPaymentAllocation.create({
      data: {
        company: { connect: { id: companyId } },
        supplier: { connect: { id: supplierId } },
        payment: { connect: { id: paymentId } },
        purchaseInvoice: { connect: { id: purchaseInvoiceId } },
        amount: allocationAmount.toString(),
      },
    });

    this.logger.log(
      `Allocation created: ${allocationAmount.toString()} for payment ${paymentId} → invoice ${purchaseInvoiceId}`,
    );

    return toAllocationEntity(allocation);
  }

  /**
   * Get all allocations for a payment (tenant-scoped).
   */
  async findByPayment(
    paymentId: string,
    supplierId: string,
    companyId: string,
  ): Promise<SupplierPaymentAllocationEntity[]> {
    // Verify payment exists and belongs to this supplier/company
    const payment = await this.paymentsRepo.findById(paymentId, supplierId, companyId);
    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found for this supplier`);
    }

    const allocations = await this.allocationsRepo.findByPayment(paymentId, companyId);
    return allocations.map(toAllocationEntity);
  }

  /**
   * Get all allocations for an invoice (tenant-scoped).
   */
  async findByInvoice(
    purchaseInvoiceId: string,
    supplierId: string,
    companyId: string,
  ): Promise<SupplierPaymentAllocationEntity[]> {
    // Verify invoice exists and belongs to this supplier/company
    const invoice = await this.prismaService.purchaseInvoice.findFirst({
      where: {
        id: purchaseInvoiceId,
        companyId,
        supplierId,
        deletedAt: null,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Purchase invoice ${purchaseInvoiceId} not found for this supplier`);
    }

    const allocations = await this.allocationsRepo.findByInvoice(purchaseInvoiceId, companyId);
    return allocations.map(toAllocationEntity);
  }

  /**
   * Soft-delete all allocations for a payment (used during void).
   * This is called internally by the payment void flow.
   */
  async voidAllocations(
    paymentId: string,
    companyId: string,
  ): Promise<number> {
    const count = await this.allocationsRepo.softDeleteByPayment(paymentId, companyId);
    this.logger.log(`Voided ${count} allocations for payment ${paymentId}`);
    return count;
  }
}
