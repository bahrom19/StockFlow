import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  GoodsReceiptStatus,
  Prisma,
  PurchaseOrderStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../common/prisma';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { runWithIdempotency } from '../../../infrastructure/idempotency/idempotency.helper';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { CreateGoodsReceiptDto } from '../dto/create-goods-receipt.dto';
import { GoodsReceiptQueryDto } from '../dto/goods-receipt-query.dto';
import { UpdateGoodsReceiptDto } from '../dto/update-goods-receipt.dto';
import { GoodsReceiptEntity } from '../entities/goods-receipt.entity';
import { GoodsReceiptMapper } from '../mappers/purchase-order.mapper';
import { GoodsReceiptRepository } from '../repositories/goods-receipt.repository';
import { PurchaseOrderRepository } from '../repositories/purchase-order.repository';
import { PurchaseOrderService } from './purchase-order.service';
import { PurchaseReceivedEvent } from '../events/purchase-received.event';
import { PurchasingFinanceService } from './purchasing-finance.service';

@Injectable()
export class GoodsReceiptService {
  private readonly logger = new Logger(GoodsReceiptService.name);

  constructor(
    private readonly goodsReceiptRepository: GoodsReceiptRepository,
    private readonly purchaseOrderRepository: PurchaseOrderRepository,
    private readonly purchaseOrderService: PurchaseOrderService,
    private readonly prismaService: PrismaService,
    private readonly financeService: PurchasingFinanceService,
    private readonly idempotencyService: IdempotencyService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async create(
    dto: CreateGoodsReceiptDto,
    userId: string,
    companyId: string,
    idempotencyKey?: string,
  ): Promise<GoodsReceiptEntity> {
    const result = await runWithIdempotency({
      prisma: this.prismaService,
      idempotency: this.idempotencyService,
      companyId,
      idempotencyKey,
      endpoint: 'goods-receipt',
      requestHashPayload: { ...dto, userId },
      status: HttpStatus.CREATED,
      work: (tx) => this.applyCreateGoodsReceipt(dto, userId, companyId, tx),
    });
    return result.body as GoodsReceiptEntity;
  }

  private async applyCreateGoodsReceipt(
    dto: CreateGoodsReceiptDto,
    userId: string,
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<GoodsReceiptEntity> {
    // Verify purchase order exists and is in a valid state
    const po = await this.purchaseOrderRepository.findById(
      dto.purchaseOrderId,
      companyId,
      tx,
    );
    if (!po) {
      throw new NotFoundException(
        `Purchase order with id ${dto.purchaseOrderId} not found`,
      );
    }
    const poStatus = po.status as PurchaseOrderStatus;
    const validReceiptStatuses: PurchaseOrderStatus[] = [
      PurchaseOrderStatus.ORDERED,
      PurchaseOrderStatus.PARTIALLY_RECEIVED,
    ];
    if (!validReceiptStatuses.includes(poStatus)) {
      throw new BadRequestException(
        `Cannot receive goods for order in status "${poStatus}". Must be ORDERED or PARTIALLY_RECEIVED.`,
      );
    }

    // Verify warehouse exists
    const warehouse = await tx.warehouse.findFirst({
      where: {
        id: dto.warehouseId,
        companyId,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse with id ${dto.warehouseId} not found`,
      );
    }

    // Validate that all receipt items correspond to PO items
    for (const item of dto.items) {
      const poItem = await tx.purchaseOrderItem.findFirst({
        where: {
          id: item.purchaseOrderItemId,
          purchaseOrderId: dto.purchaseOrderId,
          productId: item.productId,
        },
      });
      if (!poItem) {
        throw new NotFoundException(
          `Purchase order item with id ${item.purchaseOrderItemId} not found in this order`,
        );
      }
      const remaining = poItem.quantity - poItem.receivedQuantity;
      if (item.quantity > remaining) {
        throw new BadRequestException(
          `Cannot receive ${item.quantity} of product "${item.productId}": only ${remaining} remaining`,
        );
      }
    }

    // Calculate totals
    let subtotal = new Decimal(0);
    const receiptItemsData: Prisma.GoodsReceiptItemCreateWithoutGoodsReceiptInput[] =
      [];
    const poItemUpdates: { id: string; receivedQuantity: number }[] = [];

    for (const item of dto.items) {
      const poItem = await tx.purchaseOrderItem.findFirst({
        where: { id: item.purchaseOrderItemId },
      });
      if (!poItem) continue;

      const unitCost = new Decimal(item.unitCost);
      const qty = new Decimal(item.quantity);
      const itemSubtotal = unitCost.mul(qty);
      subtotal = subtotal.add(itemSubtotal);

      receiptItemsData.push({
        purchaseOrderItemId: item.purchaseOrderItemId,
        productId: item.productId,
        quantity: item.quantity,
        unitCost,
        subtotal: itemSubtotal,
        notes: item.notes,
      });

      poItemUpdates.push({
        id: item.purchaseOrderItemId,
        receivedQuantity: item.quantity,
      });
    }

    // Create the goods receipt. receiptNumber must be unique even for two
    // concurrent requests in the same millisecond (Date.now() alone collided
    // and surfaced as P2002 → 400 instead of the rowVersion 409 conflict).
    const receiptNumber =
      dto.receiptNumber ??
      `GR-${companyId.substring(0, 8).toUpperCase()}-${Date.now()}-${randomUUID().slice(0, 8)}`;

    let receipt: Awaited<ReturnType<GoodsReceiptRepository['create']>> | null =
      null;
    try {
      receipt = await this.goodsReceiptRepository.create(
        {
          receiptNumber,
          receiptDate: dto.receiptDate ? new Date(dto.receiptDate) : new Date(),
          status: GoodsReceiptStatus.DRAFT,
          notes: dto.notes,
          company: { connect: { id: companyId } },
          purchaseOrder: { connect: { id: dto.purchaseOrderId } },
          warehouse: { connect: { id: dto.warehouseId } },
          receivedBy: userId,
          items: { create: receiptItemsData },
        },
        tx,
      );
    } catch (err) {
      // Rare defense-in-depth: any unique collision (e.g. a client-supplied
      // duplicate receiptNumber) is a concurrency conflict → 409, not 400/500.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(
          'Goods receipt number already exists. Please refresh and retry.',
        );
      }
      throw err;
    }

    // Update PO items received quantities — atomically (H3).
    // The check (remaining capacity) and the increment happen in one
    // updateMany guarded by rowVersion, so two concurrent goods receipts
    // for the same PO item cannot both pass the remaining check and
    // double-receive. The loser gets HTTP 409 Conflict instead of 500.
    for (const update of poItemUpdates) {
      const poItem = await tx.purchaseOrderItem.findUnique({
        where: { id: update.id },
      });
      if (!poItem) continue;
      const newReceived = poItem.receivedQuantity + update.receivedQuantity;
      const result = await tx.purchaseOrderItem.updateMany({
        where: {
          id: update.id,
          rowVersion: poItem.rowVersion ?? 0,
          // DB-level guard: never exceed the ordered quantity
          quantity: { gte: newReceived },
        },
        data: {
          receivedQuantity: newReceived,
          rowVersion: { increment: 1 },
        },
      });
      if (result.count === 0) {
        const fresh = await tx.purchaseOrderItem.findUnique({
          where: { id: update.id },
        });
        if (!fresh) continue;
        const remaining = fresh.quantity - fresh.receivedQuantity;
        throw new ConflictException(
          `Purchase order item ${update.id} was modified concurrently. Only ${remaining} remaining. Please refresh and retry.`,
        );
      }
    }

    // NOTE (Blocker B7): Stock + stock movements are NOT mutated here.
    // They are applied once by PurchaseReceivedEventHandler (subscribed to
    // `purchase.received` in InventoryModule), which runs synchronously
    // inside this same transaction via the eventBus context.transactionClient.
    // Mutating stock both here AND in the handler double-posted every
    // receipt (stock increased by 2× quantity, two movements).

    // Complete the goods receipt automatically
    await this.goodsReceiptRepository.updateStatus(
      receipt.id,
      GoodsReceiptStatus.COMPLETED,
      companyId,
      tx,
    );

    // Update purchase order status based on received quantities
    await this.purchaseOrderService.updateStatusAfterReceipt(
      dto.purchaseOrderId,
      companyId,
      tx,
    );

    // Publish purchase.received event for inventory and finance integration
    const items = dto.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      unitCost: i.unitCost.toString(),
    }));

    // NOTE: no try/catch here on purpose (Blocker B7). The handler
    // PurchaseReceivedEventHandler is the single source of truth for stock —
    // if it fails, the whole goods-receipt transaction must roll back rather
    // than commit a receipt whose stock was never updated (fail fast).
    await this.eventBus.publish(
      new PurchaseReceivedEvent({
        purchaseOrderId: dto.purchaseOrderId,
        companyId,
        warehouseId: dto.warehouseId,
        receivedBy: userId,
        receiptNumber,
        items,
      }),
      { context: { transactionClient: tx } },
    );

    // Create finance journal entries
    try {
      await this.financeService.createGoodsReceiptJournal(
        {
          companyId,
          warehouseId: dto.warehouseId,
          receiptNumber,
          receiptDate: new Date(),
          items,
          createdBy: userId,
        },
        tx,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to create finance journal: ${(err as Error).message}`,
      );
    }

    // Fetch the final receipt with items
    const finalReceipt = await this.goodsReceiptRepository.findById(
      receipt.id,
      companyId,
      tx,
    );
    return GoodsReceiptMapper.toEntity(finalReceipt!);
  }

  async findAll(
    query: GoodsReceiptQueryDto,
    companyId: string,
  ): Promise<{
    items: GoodsReceiptEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must be positive integers');
    }

    const result = await this.goodsReceiptRepository.findAll({
      companyId,
      search: query.search,
      purchaseOrderId: query.purchaseOrderId,
      warehouseId: query.warehouseId,
      status: query.status as GoodsReceiptStatus | undefined,
      receiptDateFrom: query.receiptDateFrom
        ? new Date(query.receiptDateFrom)
        : undefined,
      receiptDateTo: query.receiptDateTo
        ? new Date(query.receiptDateTo)
        : undefined,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: GoodsReceiptMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(id: string, companyId: string): Promise<GoodsReceiptEntity> {
    const receipt = await this.goodsReceiptRepository.findById(id, companyId);
    if (!receipt) {
      throw new NotFoundException(`Goods receipt with id ${id} not found`);
    }
    return GoodsReceiptMapper.toEntity(receipt);
  }

  async softDelete(id: string, companyId: string): Promise<void> {
    const existing = await this.goodsReceiptRepository.findById(id, companyId);
    if (!existing) {
      throw new NotFoundException(`Goods receipt with id ${id} not found`);
    }
    if (existing.status !== GoodsReceiptStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT goods receipts can be deleted');
    }
    await this.goodsReceiptRepository.softDelete(id, companyId);
  }
}
