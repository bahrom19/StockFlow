import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Currency,
  PaymentMethod,
  Prisma,
  Sale,
  SaleStatus,
  StockMovementType,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { CashShiftRepository } from '../repositories/cash-shift.repository';
import { SalesRepository } from '../repositories/sales.repository';
import { CreateSaleDto } from '../dto/create-sale.dto';
import { SaleQueryDto } from '../dto/sale-query.dto';
import { SaleEntity } from '../entities/sale.entity';
import { SaleMapper } from '../mappers/sale.mapper';
import { SaleCompletedEvent } from '../events/sale-completed.event';
import { SaleRefundedEvent } from '../events/sale-refunded.event';

const VALID_TRANSITIONS: Record<SaleStatus, SaleStatus[]> = {
  DRAFT: ['PENDING', 'CANCELLED', 'COMPLETED'],
  PENDING: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  REFUNDED: [],
  CANCELLED: [],
  PARTIALLY_REFUNDED: ['REFUNDED'],
};

function toDecimal(
  value: string | number | Decimal | null | undefined,
): Decimal {
  if (value == null) return new Decimal(0);
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

@Injectable()
export class SalesService {
  constructor(
    private readonly salesRepository: SalesRepository,
    private readonly cashShiftRepository: CashShiftRepository,
    private readonly prismaService: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreateSaleDto,
    userId: string,
    companyId: string,
  ): Promise<SaleEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const saleNumber =
        dto.saleNumber ??
        (await this.salesRepository.getNextSaleNumber(companyId));

      // Validate warehouse
      const warehouse = await tx.warehouse.findFirst({
        where: {
          id: dto.warehouseId,
          companyId,
          deletedAt: null,
          isActive: true,
        },
      });
      if (!warehouse)
        throw new NotFoundException(`Warehouse ${dto.warehouseId} not found`);

      // Validate customer if provided
      if (dto.customerId) {
        const customer = await tx.customer.findFirst({
          where: { id: dto.customerId, companyId, deletedAt: null },
        });
        if (!customer)
          throw new NotFoundException(`Customer ${dto.customerId} not found`);
      }

      // Calculate items
      let subtotal = new Decimal(0);
      let totalDiscount = new Decimal(0);
      const itemsData: Prisma.SaleItemCreateWithoutSaleInput[] = [];

      for (const item of dto.items) {
        const product = await tx.product.findFirst({
          where: { id: item.productId, companyId, deletedAt: null },
        });
        if (!product)
          throw new NotFoundException(`Product ${item.productId} not found`);

        const qty = new Decimal(item.quantity);
        const unitPrice = toDecimal(item.unitPrice);
        const costPrice = toDecimal(item.costPrice ?? product.costPrice);
        const itemDiscount = toDecimal(item.discount);
        const itemSubtotal = unitPrice.mul(qty);
        const itemTotal = itemSubtotal.sub(itemDiscount);
        const margin = itemTotal.sub(costPrice.mul(qty));

        subtotal = subtotal.add(itemSubtotal);
        totalDiscount = totalDiscount.add(itemDiscount);

        itemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice,
          costPrice,
          discount: itemDiscount,
          subtotal: itemSubtotal,
          total: itemTotal,
          margin,
        });
      }

      const total = subtotal.sub(totalDiscount);
      const paymentsData: Prisma.PaymentCreateWithoutSaleInput[] =
        dto.payments.map((p) => ({
          method: p.method as PaymentMethod,
          amount: toDecimal(p.amount),
          reference: p.reference,
        }));

      // Calculate paid amount from all payments
      let paidAmount = new Decimal(0);
      for (const p of paymentsData) {
        paidAmount = paidAmount.add(p.amount as Decimal);
      }

      // Business validation: a sale cannot be paid for less than its total.
      // Reject at creation (before any journal entry exists) with a clear 400,
      // instead of failing later with an opaque "journal entry is unbalanced".
      if (paidAmount.lt(total)) {
        throw new BadRequestException(
          `Insufficient payment: paid ${paidAmount.toString()} is less than sale total ${total.toString()}`,
        );
      }

      const changeAmount = paidAmount.gt(total)
        ? paidAmount.sub(total)
        : new Decimal(0);

      const sale = await this.salesRepository.create(
        {
          saleNumber,
          status: SaleStatus.DRAFT,
          currency: (dto.currency ?? 'KZT') as Currency,
          notes: dto.notes,
          subtotal,
          discount: totalDiscount,
          tax: new Decimal(0),
          total,
          paidAmount,
          changeAmount,
          company: { connect: { id: companyId } },
          warehouse: { connect: { id: dto.warehouseId } },
          cashier: { connect: { id: userId } },
          ...(dto.customerId
            ? { customer: { connect: { id: dto.customerId } } }
            : {}),
          items: { create: itemsData },
          payments: { create: paymentsData },
        },
        tx,
      );

      return SaleMapper.toEntity(sale);
    });
  }

  async findAll(
    query: SaleQueryDto,
    companyId: string,
  ): Promise<{
    items: SaleEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    if (page < 1 || limit < 1)
      throw new BadRequestException('Page and limit must be positive');

    const result = await this.salesRepository.findAll({
      companyId,
      search: query.search,
      warehouseId: query.warehouseId,
      cashierId: query.cashierId,
      customerId: query.customerId,
      status: query.status as SaleStatus | undefined,
      paymentMethod: query.paymentMethod as PaymentMethod,
      dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
      dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: SaleMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(id: string, companyId: string): Promise<SaleEntity> {
    const sale = await this.salesRepository.findById(id, companyId);
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    return SaleMapper.toEntity(sale);
  }

  async softDelete(id: string, companyId: string): Promise<void> {
    const existing = await this.salesRepository.findById(id, companyId);
    if (!existing) throw new NotFoundException(`Sale ${id} not found`);
    if (existing.status !== SaleStatus.DRAFT)
      throw new BadRequestException('Only DRAFT sales can be deleted');
    const rowVer = existing.rowVersion ?? 0;
    await this.salesRepository.softDelete(id, companyId, rowVer);
  }

  async transitionStatus(
    id: string,
    newStatus: SaleStatus,
    userId: string,
    companyId: string,
  ): Promise<SaleEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const sale = await this.salesRepository.findById(id, companyId, tx);
      if (!sale) throw new NotFoundException(`Sale ${id} not found`);

      const current = sale.status as SaleStatus;
      const allowed = VALID_TRANSITIONS[current];
      if (!allowed || !allowed.includes(newStatus)) {
        throw new BadRequestException(
          `Cannot transition from ${current} to ${newStatus}. Allowed: ${(allowed ?? []).join(', ') || 'none'}`,
        );
      }

      // COMPLETED: decrease inventory, stock movements, receipt, cash shift, audit log
      let cashShiftId: string | null = null;
      if (newStatus === SaleStatus.COMPLETED) {
        const result = await this.completeSale(sale, userId, tx, companyId);
        cashShiftId = result.cashShiftId;
      }

      // REFUNDED: reverse inventory + audit log
      if (newStatus === SaleStatus.REFUNDED) {
        await this.refundSale(sale, userId, tx, companyId);
      }

      const updateData: Prisma.SaleUpdateInput = { status: newStatus };
      if (cashShiftId) {
        updateData.cashShift = { connect: { id: cashShiftId } };
      }
      const rowVer = sale.rowVersion ?? 0;
      const updated = await this.salesRepository.update(
        id,
        updateData,
        companyId,
        rowVer,
        tx,
      );
      return SaleMapper.toEntity(updated);
    });
  }

  private async completeSale(
    sale: Sale,
    userId: string,
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<{ cashShiftId: string | null }> {
    const items = await tx.saleItem.findMany({ where: { saleId: sale.id } });

    // NOTE: Inventory changes (stock deduction + stock movement) are handled
    // by the SaleCompletedEventHandler in the Inventory module via the EventBus.
    // This service ONLY publishes the event — it no longer directly mutates stock.

    // Create receipt
    const receiptNumber = `RCP-${sale.saleNumber}`;
    await tx.receipt.create({
      data: { receiptNumber, status: 'DRAFT', saleId: sale.id },
    });

    // Find open cash shift and link sale to it
    let cashShiftId: string | null = null;
    const cashShift = await tx.cashShift.findFirst({
      where: {
        warehouseId: sale.warehouseId,
        cashierId: userId,
        companyId,
        status: 'OPEN',
      },
    });
    if (cashShift) {
      cashShiftId = cashShift.id;
      const payments = await tx.payment.findMany({
        where: { saleId: sale.id },
      });
      let cashTotal = new Decimal(0);
      let cardTotal = new Decimal(0);
      for (const p of payments) {
        if (p.method === 'CASH') cashTotal = cashTotal.add(p.amount);
        else cardTotal = cardTotal.add(p.amount);
      }
      const saleTotal = new Decimal(sale.total.toString());
      // Change is dispensed from the cash drawer: shift cash sales must be
      // net of change (tendered − change), matching the journal posting.
      // When change exceeds cash tendered (partly drawn from the drawer
      // float), cashSalesNet is intentionally negative — this mirrors the
      // journal's "change dispensed from float" credit and keeps the shift
      // reconciled with the GL. Do not clamp: clamping would desync them.
      const changeAmount = new Decimal(sale.changeAmount.toString());
      const cashSalesNet = cashTotal.sub(changeAmount);

      // H2: update shift totals through optimistic locking. The repository
      // write is guarded by rowVersion, so two sales completing concurrently
      // on the same shift cannot silently lose each other's amounts. On a
      // conflict the repository throws ConflictException and this sale's
      // transaction rolls back (HTTP 409, not a lost update).
      await this.cashShiftRepository.update(
        cashShift.id,
        {
          cashSales: new Decimal(cashShift.cashSales.toString()).add(
            cashSalesNet,
          ),
          cardSales: new Decimal(cashShift.cardSales.toString()).add(cardTotal),
          totalSales: new Decimal(cashShift.totalSales.toString()).add(
            saleTotal,
          ),
        },
        companyId,
        cashShift.rowVersion ?? 0,
        tx,
      );
    }

    // Publish SaleCompletedEvent — handlers (Finance, Inventory, Loyalty, etc.)
    // execute inside this transaction via the context.transactionClient
    const payments = await tx.payment.findMany({ where: { saleId: sale.id } });
    await this.eventBus.publish(
      new SaleCompletedEvent({
        saleId: sale.id,
        companyId,
        warehouseId: sale.warehouseId,
        cashierId: userId,
        customerId: sale.customerId,
        saleNumber: sale.saleNumber,
        subtotal: sale.subtotal.toString(),
        discount: sale.discount.toString(),
        total: sale.total.toString(),
        paidAmount: sale.paidAmount.toString(),
        changeAmount: sale.changeAmount.toString(),
        currency: sale.currency,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toString(),
          costPrice: i.costPrice.toString(),
          discount: i.discount.toString(),
          subtotal: i.subtotal.toString(),
          total: i.total.toString(),
          margin: i.margin.toString(),
        })),
        payments: payments.map((p) => ({
          method: p.method,
          amount: p.amount.toString(),
        })),
      }),
      { context: { transactionClient: tx } },
    );

    // Audit log
    await tx.auditLog.create({
      data: {
        companyId,
        userId,
        entity: 'Sale',
        entityId: sale.id,
        action: 'COMPLETED',
        newValues: {
          status: 'COMPLETED',
          saleNumber: sale.saleNumber,
          total: sale.total.toString(),
        },
      },
    });

    return { cashShiftId };
  }

  private async refundSale(
    sale: Sale,
    userId: string,
    tx: Prisma.TransactionClient,
    companyId: string,
  ): Promise<void> {
    const items = await tx.saleItem.findMany({ where: { saleId: sale.id } });

    // NOTE: Inventory changes (stock restoration + stock movement) are handled
    // by the SaleRefundedEventHandler in the Inventory module via the EventBus.
    // This service ONLY publishes the event — it no longer directly mutates stock.

    // Net the refunded amounts out of the linked cash shift, reversing the
    // exact allocation applied at completion: cash sales are net of change
    // (tendered − change), all non-cash methods (CARD/QR/…) are netted from
    // cardSales, and totalSales is reduced by the sale total. Only an OPEN
    // shift is touched — a closed shift's Z report is final. The write is
    // guarded by rowVersion (optimistic locking): a stale version throws
    // ConflictException and rolls the whole transaction back, so a refund can
    // never be double-counted against a concurrently-mutated shift.
    if (sale.cashShiftId) {
      const shift = await tx.cashShift.findFirst({
        where: { id: sale.cashShiftId, companyId },
      });
      if (shift && shift.status === 'OPEN') {
        const payments = await tx.payment.findMany({
          where: { saleId: sale.id },
        });
        let cashTotal = new Decimal(0);
        let cardTotal = new Decimal(0);
        for (const p of payments) {
          if (p.method === 'CASH') cashTotal = cashTotal.add(p.amount);
          else cardTotal = cardTotal.add(p.amount);
        }
        const changeAmount = new Decimal(sale.changeAmount.toString());
        const cashSalesNet = cashTotal.sub(changeAmount);
        const saleTotal = new Decimal(sale.total.toString());

        await this.cashShiftRepository.update(
          shift.id,
          {
            cashSales: new Decimal(shift.cashSales.toString()).sub(
              cashSalesNet,
            ),
            cardSales: new Decimal(shift.cardSales.toString()).sub(cardTotal),
            totalSales: new Decimal(shift.totalSales.toString()).sub(saleTotal),
          },
          companyId,
          shift.rowVersion ?? 0,
          tx,
        );
      }
    }

    // Publish SaleRefundedEvent
    const payments = await tx.payment.findMany({ where: { saleId: sale.id } });
    await this.eventBus.publish(
      new SaleRefundedEvent({
        saleId: sale.id,
        companyId,
        warehouseId: sale.warehouseId,
        cashierId: userId,
        saleNumber: sale.saleNumber,
        total: sale.total.toString(),
        currency: sale.currency,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice.toString(),
          costPrice: i.costPrice.toString(),
          discount: i.discount.toString(),
          subtotal: i.subtotal.toString(),
          total: i.total.toString(),
          margin: i.margin.toString(),
        })),
        payments: payments.map((p) => ({
          method: p.method,
          amount: p.amount.toString(),
        })),
      }),
      { context: { transactionClient: tx } },
    );
  }

  async getReceipt(saleId: string, companyId: string): Promise<SaleEntity> {
    const sale = await this.salesRepository.getReceiptBySaleId(
      saleId,
      companyId,
    );
    if (!sale) throw new NotFoundException(`Sale ${saleId} not found`);
    return SaleMapper.toEntity(sale);
  }

  async getNextSaleNumber(companyId: string): Promise<{ saleNumber: string }> {
    const saleNumber = await this.salesRepository.getNextSaleNumber(companyId);
    return { saleNumber };
  }

  async update(
    id: string,
    dto: { customerId?: string; notes?: string; currency?: string },
    companyId: string,
  ): Promise<SaleEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const existing = await this.salesRepository.findById(id, companyId, tx);
      if (!existing) throw new NotFoundException(`Sale ${id} not found`);
      if (existing.status !== SaleStatus.DRAFT) {
        throw new BadRequestException('Only DRAFT sales can be edited');
      }

      const updateData: Prisma.SaleUpdateInput = {};
      if (dto.notes !== undefined) updateData.notes = dto.notes;
      if (dto.currency !== undefined)
        updateData.currency = dto.currency as Currency;
      if (dto.customerId !== undefined) {
        updateData.customer = dto.customerId
          ? { connect: { id: dto.customerId } }
          : { disconnect: true };
      }

      const rowVer = existing.rowVersion ?? 0;
      const updated = await this.salesRepository.update(
        id,
        updateData,
        companyId,
        rowVer,
        tx,
      );
      return SaleMapper.toEntity(updated);
    });
  }
}
