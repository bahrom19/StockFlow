import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PurchaseOrderStatus, StockMovementType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { UpdatePurchaseOrderDto } from '../dto/update-purchase-order.dto';
import { PurchaseOrderQueryDto } from '../dto/purchase-order-query.dto';
import { PurchaseOrderEntity } from '../entities/purchase-order.entity';
import { PurchaseOrderMapper } from '../mappers/purchase-order.mapper';
import { PurchaseOrderRepository } from '../repositories/purchase-order.repository';
import { PurchaseOrderCreatedEvent } from '../events/purchase-order-created.event';
import { PurchaseOrderApprovedEvent } from '../events/purchase-order-approved.event';
import { AuditLogService } from '../../shared/services/audit-log.service';

const VALID_TRANSITIONS: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['APPROVED', 'CANCELLED'],
  APPROVED: ['ORDERED', 'CANCELLED'],
  ORDERED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
};

function toDecimal(
  value: string | number | Decimal | null | undefined,
): Decimal {
  if (value == null) return new Decimal(0);
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

function nextOrderNumber(companyId: string, index: number): string {
  return `PO-${companyId.substring(0, 8).toUpperCase()}-${String(index).padStart(4, '0')}`;
}

@Injectable()
export class PurchaseOrderService {
  private readonly logger = new Logger(PurchaseOrderService.name);

  constructor(
    private readonly purchaseOrderRepository: PurchaseOrderRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreatePurchaseOrderDto,
    userId: string,
    companyId: string,
  ): Promise<PurchaseOrderEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const orderNumber =
        dto.orderNumber ?? nextOrderNumber(companyId, Date.now());
      const existing = await this.purchaseOrderRepository.findByOrderNumber(
        orderNumber,
        companyId,
        tx,
      );
      if (existing) {
        throw new BadRequestException(
          `Order number "${orderNumber}" already exists`,
        );
      }

      let subtotal = new Decimal(0);
      let totalDiscount = new Decimal(0);
      let totalTax = new Decimal(0);
      const grandTotal = new Decimal(0);

      const itemsData: Prisma.PurchaseOrderItemCreateWithoutPurchaseOrderInput[] =
        dto.items.map((item) => {
          const unitCost = toDecimal(item.unitCost);
          const qty = new Decimal(item.quantity);
          const discountPct = toDecimal(item.discountPercent);
          const taxPct = toDecimal(item.taxPercent);

          const itemSubtotal = unitCost.mul(qty);
          const itemDiscount = itemSubtotal.mul(discountPct).div(100);
          const itemTax = itemSubtotal.sub(itemDiscount).mul(taxPct).div(100);
          const itemTotal = itemSubtotal.sub(itemDiscount).add(itemTax);

          subtotal = subtotal.add(itemSubtotal);
          totalDiscount = totalDiscount.add(itemDiscount);
          totalTax = totalTax.add(itemTax);

          return {
            productId: item.productId,
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
            total: itemTotal,
            notes: item.notes,
          };
        });

      // Create PO items first to get IDs, then calculate grandTotal
      const po = await this.purchaseOrderRepository.create(
        {
          orderNumber,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          status: PurchaseOrderStatus.DRAFT,
          subtotal,
          discountAmount: totalDiscount,
          taxAmount: totalTax,
          grandTotal: subtotal.sub(totalDiscount).add(totalTax),
          paidAmount: new Decimal(0),
          notes: dto.notes,
          company: { connect: { id: companyId } },
          supplier: { connect: { id: dto.supplierId } },
          items: { create: itemsData },
        },
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'PurchaseOrder',
          entityId: po.id,
          action: 'CREATE',
          before: null,
          after: { orderNumber, grandTotal: po.grandTotal.toString() },
        },
        tx,
      );

      // Publish purchase.order.created event (for reference/analytics)
      try {
        await this.eventBus.publish(
          new PurchaseOrderCreatedEvent({
            purchaseOrderId: po.id,
            companyId,
            supplierId: dto.supplierId,
            orderNumber: po.orderNumber,
            orderDate: po.orderDate,
            expectedDate: po.expectedDate,
            subtotal: po.subtotal.toString(),
            discountAmount: po.discountAmount.toString(),
            taxAmount: po.taxAmount.toString(),
            grandTotal: po.grandTotal.toString(),
            currency: 'KZT',
            items: dto.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitCost: i.unitCost.toString(),
              total: new Decimal(i.unitCost).mul(i.quantity).toString(),
            })),
          }),
          { context: { transactionClient: tx } },
        );
      } catch (err) {
        this.logger.warn(
          `Failed to publish purchase.order.created: ${(err as Error).message}`,
        );
      }

      return PurchaseOrderMapper.toEntity(po);
    });
  }

  async findAll(
    query: PurchaseOrderQueryDto,
    companyId: string,
  ): Promise<{
    items: PurchaseOrderEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must be positive integers');
    }

    const result = await this.purchaseOrderRepository.findAll({
      companyId,
      search: query.search,
      supplierId: query.supplierId,
      status: query.status as PurchaseOrderStatus | undefined,
      orderDateFrom: query.orderDateFrom
        ? new Date(query.orderDateFrom)
        : undefined,
      orderDateTo: query.orderDateTo ? new Date(query.orderDateTo) : undefined,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: PurchaseOrderMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(id: string, companyId: string): Promise<PurchaseOrderEntity> {
    const order = await this.purchaseOrderRepository.findById(id, companyId);
    if (!order) {
      throw new NotFoundException(`Purchase order with id ${id} not found`);
    }
    return PurchaseOrderMapper.toEntity(order);
  }

  async update(
    id: string,
    dto: UpdatePurchaseOrderDto,
    userId: string,
    companyId: string,
  ): Promise<PurchaseOrderEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const existing = await this.purchaseOrderRepository.findById(
        id,
        companyId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException(`Purchase order with id ${id} not found`);
      }
      if (existing.status !== PurchaseOrderStatus.DRAFT) {
        throw new BadRequestException(
          'Only DRAFT purchase orders can be edited',
        );
      }

      const updateData: Prisma.PurchaseOrderUpdateInput = {};
      if (dto.supplierId)
        updateData.supplier = { connect: { id: dto.supplierId } };
      if (dto.orderDate) updateData.orderDate = new Date(dto.orderDate);
      if (dto.expectedDate)
        updateData.expectedDate = new Date(dto.expectedDate);
      if (dto.notes !== undefined) updateData.notes = dto.notes;

      if (dto.items) {
        // Delete old items and recreate
        await tx.purchaseOrderItem.deleteMany({
          where: { purchaseOrderId: id },
        });

        let subtotal = new Decimal(0);
        let totalDiscount = new Decimal(0);
        let totalTax = new Decimal(0);

        const itemsData = dto.items.map((item) => {
          const unitCost = toDecimal(item.unitCost);
          const qty = new Decimal(item.quantity ?? 0);
          const discountPct = toDecimal(item.discountPercent);
          const taxPct = toDecimal(item.taxPercent);

          const itemSubtotal = unitCost.mul(qty);
          const itemDiscount = itemSubtotal.mul(discountPct).div(100);
          const itemTax = itemSubtotal.sub(itemDiscount).mul(taxPct).div(100);
          const itemTotal = itemSubtotal.sub(itemDiscount).add(itemTax);

          subtotal = subtotal.add(itemSubtotal);
          totalDiscount = totalDiscount.add(itemDiscount);
          totalTax = totalTax.add(itemTax);

          return {
            purchaseOrderId: id,
            productId: item.productId ?? '',
            quantity: item.quantity ?? 0,
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
            total: itemTotal,
            notes: item.notes,
          };
        });

        await tx.purchaseOrderItem.createMany({ data: itemsData });

        updateData.subtotal = subtotal;
        updateData.discountAmount = totalDiscount;
        updateData.taxAmount = totalTax;
        updateData.grandTotal = subtotal.sub(totalDiscount).add(totalTax);
      }

      const rowVer = existing.rowVersion ?? 0;
      const updated = await this.purchaseOrderRepository.update(
        id,
        updateData,
        companyId,
        rowVer,
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'PurchaseOrder',
          entityId: id,
          action: 'UPDATE',
          before: { status: existing.status },
          after: { status: updated.status },
        },
        tx,
      );

      return PurchaseOrderMapper.toEntity(updated);
    });
  }

  async softDelete(id: string, companyId: string): Promise<void> {
    const existing = await this.purchaseOrderRepository.findById(id, companyId);
    if (!existing) {
      throw new NotFoundException(`Purchase order with id ${id} not found`);
    }
    if (existing.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT purchase orders can be deleted',
      );
    }
    await this.purchaseOrderRepository.softDelete(id, companyId);
  }

  async transitionStatus(
    id: string,
    newStatus: PurchaseOrderStatus,
    userId: string,
    companyId: string,
  ): Promise<PurchaseOrderEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const order = await this.purchaseOrderRepository.findById(
        id,
        companyId,
        tx,
      );
      if (!order) {
        throw new NotFoundException(`Purchase order with id ${id} not found`);
      }

      const currentStatus = order.status as PurchaseOrderStatus;
      const allowed = VALID_TRANSITIONS[currentStatus];
      if (!allowed || !allowed.includes(newStatus)) {
        throw new BadRequestException(
          `Cannot transition from ${currentStatus} to ${newStatus}. Allowed: ${(allowed ?? []).join(', ') || 'none'}`,
        );
      }

      const updateData: Prisma.PurchaseOrderUpdateInput = { status: newStatus };

      if (newStatus === PurchaseOrderStatus.APPROVED) {
        updateData.approvedBy = userId;
        updateData.approvedAt = new Date();
      }
      if (newStatus === PurchaseOrderStatus.CANCELLED) {
        updateData.cancelledBy = userId;
        updateData.cancelledAt = new Date();
      }

      const rowVer = order.rowVersion ?? 0;
      const updated = await this.purchaseOrderRepository.update(
        id,
        updateData,
        companyId,
        rowVer,
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'PurchaseOrder',
          entityId: id,
          action:
            newStatus === PurchaseOrderStatus.APPROVED
              ? 'APPROVED'
              : String(newStatus),
          before: { status: currentStatus },
          after: { status: newStatus },
        },
        tx,
      );

      // Publish purchase.order.approved event for finance integration
      if (newStatus === PurchaseOrderStatus.APPROVED) {
        const items = await tx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: id },
        });
        await this.eventBus.publish(
          new PurchaseOrderApprovedEvent({
            purchaseOrderId: id,
            companyId,
            supplierId: order.supplierId,
            orderNumber: order.orderNumber,
            orderDate: order.orderDate,
            expectedDate: order.expectedDate,
            approvedBy: userId,
            approvedAt: new Date(),
            subtotal: order.subtotal.toString(),
            discountAmount: order.discountAmount.toString(),
            taxAmount: order.taxAmount.toString(),
            grandTotal: order.grandTotal.toString(),
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

      return PurchaseOrderMapper.toEntity(updated);
    });
  }

  // Internal: update PO status when goods receipt is created
  async updateStatusAfterReceipt(
    id: string,
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const order = await this.purchaseOrderRepository.findById(
      id,
      companyId,
      tx,
    );
    if (!order) return;

    const allItems = await tx.purchaseOrderItem.findMany({
      where: { purchaseOrderId: id },
    });
    if (allItems.length === 0) return;

    const allReceived = allItems.every((i) => i.receivedQuantity >= i.quantity);
    const anyReceived = allItems.some((i) => i.receivedQuantity > 0);

    if (allReceived) {
      await this.purchaseOrderRepository.update(
        id,
        { status: PurchaseOrderStatus.RECEIVED },
        companyId,
        undefined, // rowVersion — use legacy path
        tx,
      );
    } else if (anyReceived) {
      await this.purchaseOrderRepository.update(
        id,
        { status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
        companyId,
        undefined, // rowVersion — use legacy path
        tx,
      );
    }
  }

  // Internal: generate next order number sequence
  async getNextOrderNumber(companyId: string): Promise<string> {
    const count = await this.purchaseOrderRepository.countByCompany(companyId);
    return nextOrderNumber(companyId, count + 1);
  }
}
