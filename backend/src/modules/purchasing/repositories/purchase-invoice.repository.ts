import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Currency, Prisma, PurchaseInvoice, PurchaseInvoiceStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';

@Injectable()
export class PurchaseInvoiceRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private getClient(tx?: Prisma.TransactionClient) {
    return tx || this.prismaService;
  }

  async create(
    data: Prisma.PurchaseInvoiceCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseInvoice> {
    return this.getClient(tx).purchaseInvoice.create({
      data,
      include: { items: true },
    });
  }

  async findById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseInvoice | null> {
    return this.getClient(tx).purchaseInvoice.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true },
    });
  }

  async findByInvoiceNumber(
    invoiceNumber: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseInvoice | null> {
    return this.getClient(tx).purchaseInvoice.findFirst({
      where: { invoiceNumber, companyId, deletedAt: null },
      include: { items: true },
    });
  }

  // G14-02-12: pessimistic row-level lock on the PurchaseInvoice row used to
  // serialize concurrent supplier-payment and allocation coverage checks for
  // the same invoice. Prisma findUnique cannot express FOR UPDATE, so we use
  // a tenant-scoped raw SELECT ... FOR UPDATE inside the caller's
  // transaction. The lock is held until that transaction commits/rolls back.
  // Follows the existing purchase-order.repository.ts lockById precedent.
  // Canonical lock order is invoice → payment: callers MUST acquire this
  // lock BEFORE any payment-row FOR UPDATE to avoid lock-order inversion.
  async lockInvoiceById(
    id: string,
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const rows = await this.getClient(tx).$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "PurchaseInvoice" WHERE id = ${id} AND "companyId" = ${companyId} AND "deletedAt" IS NULL FOR UPDATE`;
    if (!rows || rows.length === 0) {
      throw new NotFoundException(`Purchase invoice with id ${id} not found`);
    }
  }

  async findAll(params: {
    companyId: string;
    search?: string;
    purchaseOrderId?: string;
    supplierId?: string;
    status?: PurchaseInvoiceStatus;
    invoiceDateFrom?: Date;
    invoiceDateTo?: Date;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ items: PurchaseInvoice[]; total: number }> {
    const {
      companyId,
      search,
      purchaseOrderId,
      supplierId,
      status,
      invoiceDateFrom,
      invoiceDateTo,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = params;

    const where: Prisma.PurchaseInvoiceWhereInput = {
      companyId,
      deletedAt: null,
    };

    if (search)
      where.OR = [{ invoiceNumber: { contains: search, mode: 'insensitive' } }];
    if (purchaseOrderId) where.purchaseOrderId = purchaseOrderId;
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;
    if (invoiceDateFrom || invoiceDateTo) {
      where.invoiceDate = {};
      if (invoiceDateFrom) where.invoiceDate.gte = invoiceDateFrom;
      if (invoiceDateTo) where.invoiceDate.lte = invoiceDateTo;
    }

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.purchaseInvoice.findMany({
        where,
        include: { items: true },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prismaService.purchaseInvoice.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Prisma.PurchaseInvoiceUpdateInput,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseInvoice> {
    const existing = await this.findById(id, companyId, tx);
    if (!existing)
      throw new NotFoundException(`Purchase invoice with id ${id} not found`);
    return this.getClient(tx).purchaseInvoice.update({
      where: { id },
      data,
      include: { items: true },
    });
  }

  async softDelete(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseInvoice> {
    const existing = await this.findById(id, companyId, tx);
    if (!existing)
      throw new NotFoundException(`Purchase invoice with id ${id} not found`);
    return this.getClient(tx).purchaseInvoice.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { items: true },
    });
  }

  async updateStatus(
    id: string,
    status: PurchaseInvoiceStatus,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseInvoice> {
    return this.update(id, { status }, companyId, tx);
  }

  // G10-A: atomic DRAFT → APPROVED transition. The WHERE clause carries
  // id + companyId + rowVersion + status = DRAFT, so exactly one concurrent
  // approval can win; the loser gets count = 0 → ConflictException. Mirrors
  // the CAS updateMany pattern used by supplier payments and stock.
  async approveWithCas(
    id: string,
    companyId: string,
    expectedRowVersion: number,
    approvedBy: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseInvoice> {
    const result = await this.getClient(tx).purchaseInvoice.updateMany({
      where: {
        id,
        companyId,
        rowVersion: expectedRowVersion,
        status: PurchaseInvoiceStatus.DRAFT,
      },
      data: {
        status: PurchaseInvoiceStatus.APPROVED,
        approvedBy,
        approvedAt: new Date(),
        rowVersion: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new ConflictException(
        'Invoice was modified or approved by another user. Please refresh and retry.',
      );
    }

    // Re-read the authoritative row inside the same transaction for the
    // journal/event payload.
    const approved = await this.findById(id, companyId, tx);
    if (!approved) {
      throw new NotFoundException(`Purchase invoice with id ${id} not found`);
    }
    return approved;
  }

  // G9-D2 (P1): cumulative SUM of APPROVED/PAID.active (deletedAt IS NULL)
  // invoices for a purchase order — used by the invoice overrun guard.
  // DRAFT/CANCELLED invoices intentionally do NOT reduce the available PO
  // amount. The optional currency filter keeps the comparison consistent
  // with the PO currency (every invoice must already match the PO currency
  // at creation, this is a defensive extra guard).
  async sumActiveApprovedPaidByPo(
    purchaseOrderId: string,
    companyId: string,
    currency: Currency | string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.Decimal> {
    const agg = await this.getClient(tx).purchaseInvoice.aggregate({
      where: {
        purchaseOrderId,
        companyId,
        deletedAt: null,
        status: {
          in: [PurchaseInvoiceStatus.APPROVED, PurchaseInvoiceStatus.PAID],
        },
        currency: currency as Currency,
      },
      _sum: { grandTotal: true },
    });
    return (agg._sum?.grandTotal as Prisma.Decimal) ?? new Prisma.Decimal(0);
  }
}
