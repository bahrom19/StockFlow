import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PurchaseInvoice,
  PurchaseInvoiceStatus,
  PurchaseOrderStatus,
  Currency,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { CreatePurchaseInvoiceDto } from '../dto/create-purchase-invoice.dto';
import { PurchaseInvoiceQueryDto } from '../dto/purchase-invoice-query.dto';
import { PurchaseInvoiceEntity } from '../entities/purchase-invoice.entity';
import { PurchaseInvoiceMapper } from '../mappers/purchase-invoice.mapper';
import { PurchaseInvoiceRepository } from '../repositories/purchase-invoice.repository';
import { PurchaseOrderRepository } from '../repositories/purchase-order.repository';
import { PurchasingFinanceService } from './purchasing-finance.service';
import { PurchaseInvoicePostedEvent } from '../events/purchase-invoice-posted.event';
import { AuditLogService } from '../../shared/services/audit-log.service';

function toDecimal(
  value: string | number | Decimal | null | undefined,
): Decimal {
  if (value == null) return new Decimal(0);
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

@Injectable()
export class PurchaseInvoiceService {
  private readonly logger = new Logger(PurchaseInvoiceService.name);

  constructor(
    private readonly repository: PurchaseInvoiceRepository,
    private readonly purchaseOrderRepository: PurchaseOrderRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly purchasingFinanceService: PurchasingFinanceService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreatePurchaseInvoiceDto,
    userId: string,
    companyId: string,
  ): Promise<PurchaseInvoiceEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const invoiceNumber =
        dto.invoiceNumber ??
        `INV-${companyId.substring(0, 8).toUpperCase()}-${Date.now()}`;
      const existing = await this.repository.findByInvoiceNumber(
        invoiceNumber,
        companyId,
        tx,
      );
      if (existing)
        throw new BadRequestException(
          `Invoice number "${invoiceNumber}" already exists`,
        );

      const po = await this.purchaseOrderRepository.findById(
        dto.purchaseOrderId,
        companyId,
        tx,
      );
      if (!po)
        throw new NotFoundException(
          `Purchase order ${dto.purchaseOrderId} not found`,
        );

      // Currency must match linked PO currency
      const invoiceCurrency = (dto.currency ?? po.currency) as Currency;
      if (invoiceCurrency !== po.currency) {
        throw new BadRequestException(
          `Invoice currency ${invoiceCurrency} does not match PO currency ${po.currency}`,
        );
      }

      // G9-D2 (P2-1): an invoice must never be created against a CANCELLED PO.
      if (po.status === PurchaseOrderStatus.CANCELLED) {
        throw new BadRequestException(
          `Cannot create invoice for purchase order in status CANCELLED`,
        );
      }

      // G9-D2 (P1-1): serialize concurrent invoice creates for the same PO.
      // Without a row lock, two parallel creates could both pass the
      // cumulative overrun check below (TOCTOU). The lock is held until the
      // transaction commits, so the second create re-reads a fresh state.
      await this.purchaseOrderRepository.lockById(
        dto.purchaseOrderId,
        companyId,
        tx,
      );

      // G14-02-02: invoice supplier must equal PO supplier. The DTO
      // carries supplierId and purchaseOrderId as an independent pair and
      // Prisma FKs cannot express cross-table equality, so a mismatched
      // pair would otherwise post AP to the wrong supplier. Reject before
      // any mutation.
      if (dto.supplierId !== po.supplierId) {
        throw new BadRequestException(
          'Invoice supplier must match purchase order supplier',
        );
      }

      // G9-C: supplier terms & credit foundation.
      // Resolve the due date with explicit precedence rules:
      //   1. An explicitly provided dto.dueDate ALWAYS wins.
      //   2. Otherwise fall back to supplier.defaultDueDays:
      //      dueDate = invoiceDate + defaultDueDays days.
      //   3. Otherwise the invoice stays undated (dueDate = null) and keeps
      //      landing in the G9-B2.1 `undated` aging bucket.
      // supplier.defaultDueDays is a write-time default only: changing it
      // never mutates already-created invoices (no retroactive recalc).
      const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
      // G14-02-02: mandatory tenant-scoped supplier validation. The lookup
      // previously served only due-date resolution (optional result), which
      // let foreign-tenant or soft-deleted supplierIds reach `connect`.
      // Missing, foreign-tenant and soft-deleted suppliers are
      // indistinguishable 404s (no tenant-existence oracle).
      const supplier = await tx.supplier.findFirst({
        where: { id: dto.supplierId, companyId, deletedAt: null },
        select: { defaultDueDays: true },
      });
      if (!supplier) {
        throw new NotFoundException(
          `Supplier with id ${dto.supplierId} not found`,
        );
      }
      let dueDate: Date | null = dto.dueDate ? new Date(dto.dueDate) : null;
      if (dueDate === null && supplier?.defaultDueDays != null) {
        dueDate = new Date(invoiceDate.getTime());
        dueDate.setUTCDate(dueDate.getUTCDate() + supplier.defaultDueDays);
      }

      let subtotal = new Decimal(0);
      let totalDiscount = new Decimal(0);
      let totalTax = new Decimal(0);

      const itemsData = dto.items.map((item) => {
        const unitCost = toDecimal(item.unitCost);
        const qty = new Decimal(item.quantity);
        const discountPct = toDecimal(item.discountPercent);
        const taxPct = toDecimal(item.taxPercent);

        const itemSubtotal = unitCost.mul(qty);
        const itemDiscount = itemSubtotal.mul(discountPct).div(100);
        const itemTax = itemSubtotal.sub(itemDiscount).mul(taxPct).div(100);

        subtotal = subtotal.add(itemSubtotal);
        totalDiscount = totalDiscount.add(itemDiscount);
        totalTax = totalTax.add(itemTax);

        return {
          productId: item.productId,
          purchaseOrderItemId: item.purchaseOrderItemId ?? null,
          quantity: item.quantity,
          unitCost,
          discountPercent:
            item.discountPercent != null
              ? new Decimal(item.discountPercent)
              : null,
          discountAmount: itemDiscount,
          taxPercent:
            item.taxPercent != null ? new Decimal(item.taxPercent) : null,
          taxAmount: itemTax,
          subtotal: itemSubtotal,
          total: itemSubtotal.sub(itemDiscount).add(itemTax),
          notes: item.notes,
        };
      });

      const proposedGrandTotal = subtotal.sub(totalDiscount).add(totalTax);

      // G9-D2 (P1-1): cumulative invoice-overrun guard on CREATE.
      // SUM(active APPROVED/PAID invoices for this PO) + proposed invoice
      // grandTotal must not exceed PO.grandTotal. DRAFT/CANCELLED invoices
      // and soft-deleted invoices do NOT reduce the available PO amount.
      // The PO row was locked (FOR UPDATE) above, so concurrent creates for
      // the same PO serialize — the second one sees the committed state of
      // the first and cannot both pass this check.
      const existingApprovedPaid = await this.repository.sumActiveApprovedPaidByPo(
        dto.purchaseOrderId,
        companyId,
        invoiceCurrency,
        tx,
      );
      if (
        existingApprovedPaid
          .add(proposedGrandTotal)
          .gt(new Decimal(po.grandTotal))
      ) {
        throw new BadRequestException(
          `Invoice total ${proposedGrandTotal.toString()} exceeds remaining purchase order amount. ` +
            `PO total: ${new Decimal(po.grandTotal).toString()}, ` +
            `already invoiced (approved/paid): ${existingApprovedPaid.toString()}`,
        );
      }

      const invoice = await this.repository.create(
        {
          invoiceNumber,
          invoiceDate,
          dueDate,
          status: PurchaseInvoiceStatus.DRAFT,
          subtotal,
          discountAmount: totalDiscount,
          taxAmount: totalTax,
          grandTotal: proposedGrandTotal,
          paidAmount: new Decimal(0),
          currency: invoiceCurrency,
          notes: dto.notes,
          company: { connect: { id: companyId } },
          purchaseOrder: { connect: { id: dto.purchaseOrderId } },
          supplier: { connect: { id: dto.supplierId } },
          items: { create: itemsData },
        },
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'PurchaseInvoice',
          entityId: invoice.id,
          action: 'CREATE',
          before: null,
          after: { invoiceNumber, grandTotal: invoice.grandTotal.toString() },
        },
        tx,
      );

      return PurchaseInvoiceMapper.toEntity(invoice);
    });
  }

  async findAll(
    query: PurchaseInvoiceQueryDto,
    companyId: string,
  ): Promise<{
    items: PurchaseInvoiceEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (page < 1 || limit < 1)
      throw new BadRequestException('Page and limit must be positive');

    const result = await this.repository.findAll({
      companyId,
      search: query.search,
      purchaseOrderId: query.purchaseOrderId,
      supplierId: query.supplierId,
      status: query.status as PurchaseInvoiceStatus | undefined,
      invoiceDateFrom: query.invoiceDateFrom
        ? new Date(query.invoiceDateFrom)
        : undefined,
      invoiceDateTo: query.invoiceDateTo
        ? new Date(query.invoiceDateTo)
        : undefined,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: PurchaseInvoiceMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(
    id: string,
    companyId: string,
  ): Promise<PurchaseInvoiceEntity> {
    const invoice = await this.repository.findById(id, companyId);
    if (!invoice)
      throw new NotFoundException(`Purchase invoice ${id} not found`);
    return PurchaseInvoiceMapper.toEntity(invoice);
  }

  async softDelete(id: string, companyId: string): Promise<void> {
    const existing = await this.repository.findById(id, companyId);
    if (!existing)
      throw new NotFoundException(`Purchase invoice ${id} not found`);
    if (existing.status !== PurchaseInvoiceStatus.DRAFT)
      throw new BadRequestException('Only DRAFT invoices can be deleted');
    await this.repository.softDelete(id, companyId);
  }

  async transitionStatus(
    id: string,
    newStatus: PurchaseInvoiceStatus,
    userId: string,
    companyId: string,
  ): Promise<PurchaseInvoiceEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const invoice = await this.repository.findById(id, companyId, tx);
      if (!invoice)
        throw new NotFoundException(`Purchase invoice ${id} not found`);

      const current = invoice.status as PurchaseInvoiceStatus;
      const allowed: Record<PurchaseInvoiceStatus, PurchaseInvoiceStatus[]> = {
        DRAFT: ['APPROVED', 'CANCELLED'],
        APPROVED: ['PAID', 'CANCELLED'],
        PAID: [],
        CANCELLED: [],
      };
      const allowedTransitions = allowed[current] ?? [];
      if (!allowedTransitions.includes(newStatus)) {
        throw new BadRequestException(
          `Cannot transition from ${current} to ${newStatus}`,
        );
      }

      // G9-D2 (P1-2): cumulative invoice-overrun guard on APPROVE.
      // Lock the linked PO row BEFORE the cumulative SUM so two concurrent
      // approvals for the same PO serialize and only one can pass. The
      // current DRAFT invoice is naturally excluded from the approval sum
      // (only APPROVED/PAID siblings are counted).
      if (newStatus === PurchaseInvoiceStatus.APPROVED) {
        await this.purchaseOrderRepository.lockById(
          invoice.purchaseOrderId,
          companyId,
          tx,
        );
        const po = await this.purchaseOrderRepository.findById(
          invoice.purchaseOrderId,
          companyId,
          tx,
        );
        if (!po) {
          throw new NotFoundException(
            `Purchase order ${invoice.purchaseOrderId} not found`,
          );
        }

        const existingApprovedPaid = await this.repository.sumActiveApprovedPaidByPo(
          invoice.purchaseOrderId,
          companyId,
          invoice.currency,
          tx,
        );
        const currentGrandTotal = new Decimal(invoice.grandTotal);
        if (
          existingApprovedPaid
            .add(currentGrandTotal)
            .gt(new Decimal(po.grandTotal))
        ) {
          throw new BadRequestException(
            `Cannot approve invoice ${invoice.invoiceNumber}: total approved/paid amount for purchase order ${po.orderNumber} would exceed its total. ` +
              `PO total: ${new Decimal(po.grandTotal).toString()}, ` +
              `approved/paid: ${existingApprovedPaid.toString()}, ` +
              `proposed: ${currentGrandTotal.toString()}`,
          );
        }
      }

      let updated: PurchaseInvoice;

      if (newStatus === PurchaseInvoiceStatus.APPROVED) {
        // G10-A: atomic CAS approval (rowVersion + status = DRAFT guard).
        // A concurrent duplicate approval loses the CAS and gets 409 BEFORE
        // any journal posting or event publication — no duplicate GL entry,
        // no duplicate purchase.invoice.posted event.
        updated = await this.repository.approveWithCas(
          id,
          companyId,
          invoice.rowVersion,
          userId,
          tx,
        );

        // G10-A: post the GRNI settlement journal inside the SAME
        // transaction, only after the CAS win. Failure here rolls back the
        // entire approval (no APPROVED invoice without its journal).
        // Phase 7 decision: direct in-transaction GL posting — no EventBus
        // subscriber; the event below remains an audit/future hook.
        await this.purchasingFinanceService.createInvoiceJournal(
          {
            companyId,
            invoiceNumber: updated.invoiceNumber,
            invoiceDate: updated.invoiceDate,
            subtotal: updated.subtotal.toString(),
            discountAmount: updated.discountAmount.toString(),
            taxAmount: updated.taxAmount.toString(),
            grandTotal: updated.grandTotal.toString(),
            createdBy: userId,
          },
          tx,
        );

        // Publish event on approval (after successful accounting/state flow).
        const items = await tx.purchaseInvoiceItem.findMany({
          where: { purchaseInvoiceId: id },
        });
        await this.eventBus.publish(
          new PurchaseInvoicePostedEvent({
            purchaseInvoiceId: id,
            companyId,
            purchaseOrderId: updated.purchaseOrderId,
            supplierId: updated.supplierId,
            invoiceNumber: updated.invoiceNumber,
            invoiceDate: updated.invoiceDate,
            subtotal: updated.subtotal.toString(),
            discountAmount: updated.discountAmount.toString(),
            taxAmount: updated.taxAmount.toString(),
            grandTotal: updated.grandTotal.toString(),
            items: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitCost: i.unitCost.toString(),
              total: i.total.toString(),
            })),
          }),
          { context: { transactionClient: tx } },
        );
      } else {
        const updateData: Prisma.PurchaseInvoiceUpdateInput = {
          status: newStatus,
        };
        if (newStatus === PurchaseInvoiceStatus.CANCELLED) {
          updateData.cancelledBy = userId;
          updateData.cancelledAt = new Date();
        }

        updated = await this.repository.update(
          id,
          updateData,
          companyId,
          tx,
        );
      }

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'PurchaseInvoice',
          entityId: id,
          action:
            newStatus === PurchaseInvoiceStatus.APPROVED
              ? 'APPROVED'
              : String(newStatus),
          before: { status: current },
          after: { status: newStatus },
        },
        tx,
      );

      return PurchaseInvoiceMapper.toEntity(updated);
    });
  }
}
