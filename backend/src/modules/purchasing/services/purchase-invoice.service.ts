import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseInvoiceStatus, Currency } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { CreatePurchaseInvoiceDto } from '../dto/create-purchase-invoice.dto';
import { PurchaseInvoiceQueryDto } from '../dto/purchase-invoice-query.dto';
import { PurchaseInvoiceEntity } from '../entities/purchase-invoice.entity';
import { PurchaseInvoiceMapper } from '../mappers/purchase-invoice.mapper';
import { PurchaseInvoiceRepository } from '../repositories/purchase-invoice.repository';
import { PurchaseOrderRepository } from '../repositories/purchase-order.repository';
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

      const invoice = await this.repository.create(
        {
          invoiceNumber,
          invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          status: PurchaseInvoiceStatus.DRAFT,
          subtotal,
          discountAmount: totalDiscount,
          taxAmount: totalTax,
          grandTotal: subtotal.sub(totalDiscount).add(totalTax),
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

      const updateData: Prisma.PurchaseInvoiceUpdateInput = {
        status: newStatus,
      };
      if (newStatus === PurchaseInvoiceStatus.APPROVED) {
        updateData.approvedBy = userId;
        updateData.approvedAt = new Date();
      }
      if (newStatus === PurchaseInvoiceStatus.CANCELLED) {
        updateData.cancelledBy = userId;
        updateData.cancelledAt = new Date();
      }

      const updated = await this.repository.update(
        id,
        updateData,
        companyId,
        tx,
      );

      // Publish event on approval
      if (newStatus === PurchaseInvoiceStatus.APPROVED) {
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
