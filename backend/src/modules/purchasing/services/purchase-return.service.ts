import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PurchaseReturnStatus,
  GoodsReceiptStatus,
  StockMovementType,
  Currency,
  JournalEntryStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { CreatePurchaseReturnDto } from '../dto/create-purchase-return.dto';
import { PurchaseReturnQueryDto } from '../dto/purchase-return-query.dto';
import { UpdatePurchaseReturnDto } from '../dto/update-purchase-return.dto';
import { PurchaseReturnEntity } from '../entities/purchase-return.entity';
import { PurchaseReturnMapper } from '../mappers/purchase-order.mapper';
import { PurchaseReturnRepository } from '../repositories/purchase-return.repository';
import { PurchaseReturnedEvent } from '../events/purchase-returned.event';
import { PurchaseReturnCancelledEvent } from '../events/purchase-return-cancelled.event';
import { CompaniesService } from '../../companies/services/companies.service';
import { PurchasingFinanceService } from './purchasing-finance.service';
import { CostingService } from '../../inventory/services/costing.service';
import { GlEngineService } from '../../finance/services/gl-engine.service';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { runWithIdempotency } from '../../../infrastructure/idempotency/idempotency.helper';

const VALID_RETURN_TRANSITIONS: Record<
  PurchaseReturnStatus,
  PurchaseReturnStatus[]
> = {
  DRAFT: ['APPROVED', 'CANCELLED'],
  APPROVED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

function toDecimal(
  value: string | number | Decimal | null | undefined,
): Decimal {
  if (value == null) return new Decimal(0);
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

@Injectable()
export class PurchaseReturnService {
  constructor(
    private readonly purchaseReturnRepository: PurchaseReturnRepository,
    private readonly prismaService: PrismaService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly companiesService: CompaniesService,
    private readonly purchasingFinanceService: PurchasingFinanceService,
    private readonly costingService: CostingService,
    private readonly glEngine: GlEngineService,
    private readonly auditLog: AuditLogService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async create(
    dto: CreatePurchaseReturnDto,
    userId: string,
    companyId: string,
    idempotencyKey?: string,
  ): Promise<PurchaseReturnEntity> {
    const result = await runWithIdempotency({
      prisma: this.prismaService,
      idempotency: this.idempotencyService,
      companyId,
      idempotencyKey,
      endpoint: 'purchase-return',
      requestHashPayload: { ...dto, userId },
      status: HttpStatus.CREATED,
      work: (tx) => this.applyCreatePurchaseReturn(dto, userId, companyId, tx),
    });
    return result.body as PurchaseReturnEntity;
  }

  private async applyCreatePurchaseReturn(
    dto: CreatePurchaseReturnDto,
    userId: string,
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<PurchaseReturnEntity> {
    const returnNumber =
      dto.returnNumber ??
      `PR-${companyId.substring(0, 8).toUpperCase()}-${Date.now()}`;

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

    // G9-E2: tenant-scoped supplier validation. The raw Prisma `connect`
    // only guarantees FK existence — never tenant ownership — so a
    // foreign-tenant or soft-deleted supplierId would otherwise be
    // accepted and a nonexistent one would surface as P2025/500. Missing,
    // foreign-tenant and soft-deleted suppliers are indistinguishable
    // 404s (no tenant-existence oracle) — same semantics as the
    // purchase-invoice create path.
    const supplier = await tx.supplier.findFirst({
      where: {
        id: dto.supplierId,
        companyId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!supplier) {
      throw new NotFoundException(
        `Supplier with id ${dto.supplierId} not found`,
      );
    }

    // Enforce document currency == Company.currency
    const companyCurrency = await this.companiesService.getBaseCurrency(companyId);
    if (dto.currency && dto.currency !== companyCurrency) {
      throw new BadRequestException(
        `Currency ${dto.currency} does not match company currency ${companyCurrency}`,
      );
    }

    let subtotal = new Decimal(0);
    let totalDiscount = new Decimal(0);
    let totalTax = new Decimal(0);

    // G9-E2: tenant-scoped product validation. PurchaseReturnItem.productId
    // has no FK in the schema, so invalid product references would
    // otherwise be silently accepted. One batched lookup (not N+1) covers
    // all items: missing, foreign-tenant and soft-deleted products are
    // indistinguishable 404s — same semantics as the supplier check.
    const requestedProductIds = [...new Set(dto.items.map((i) => i.productId))];
    const foundProducts = await tx.product.findMany({
      where: {
        id: { in: requestedProductIds },
        companyId,
        deletedAt: null,
      },
      select: { id: true },
    });
    const foundProductIds = new Set(foundProducts.map((p) => p.id));
    const missingProductId = requestedProductIds.find(
      (id) => !foundProductIds.has(id),
    );
    if (missingProductId !== undefined) {
      throw new NotFoundException(
        `Product with id ${missingProductId} not found`,
      );
    }

    const itemsData: Prisma.PurchaseReturnItemCreateWithoutPurchaseReturnInput[] =
      [];

    for (const item of dto.items) {
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

      itemsData.push({
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
      });
    }

    const ret = await this.purchaseReturnRepository.create(
      {
        returnNumber,
        returnDate: dto.returnDate ? new Date(dto.returnDate) : new Date(),
        status: PurchaseReturnStatus.DRAFT,
        subtotal,
        discountAmount: totalDiscount,
        taxAmount: totalTax,
        grandTotal: subtotal.sub(totalDiscount).add(totalTax),
        currency: companyCurrency as Currency,
        notes: dto.notes,
        company: { connect: { id: companyId } },
        supplier: { connect: { id: dto.supplierId } },
        warehouse: { connect: { id: dto.warehouseId } },
        items: { create: itemsData },
      },
      tx,
    );

    // G11-A: creation audit trail, written inside the SAME transaction as
    // the document (a rolled-back create leaves no audit row behind).
    await this.auditLog.log(
      {
        companyId,
        userId,
        entityType: 'PurchaseReturn',
        entityId: ret.id,
        action: 'CREATE',
        before: null,
        after: {
          returnNumber,
          status: PurchaseReturnStatus.DRAFT,
          supplierId: dto.supplierId,
          warehouseId: dto.warehouseId,
          total: ret.grandTotal.toString(),
        },
      },
      tx,
    );

    return PurchaseReturnMapper.toEntity(ret);
  }

  async findAll(
    query: PurchaseReturnQueryDto,
    companyId: string,
  ): Promise<{
    items: PurchaseReturnEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must be positive integers');
    }

    const result = await this.purchaseReturnRepository.findAll({
      companyId,
      search: query.search,
      supplierId: query.supplierId,
      warehouseId: query.warehouseId,
      status: query.status as PurchaseReturnStatus | undefined,
      returnDateFrom: query.returnDateFrom
        ? new Date(query.returnDateFrom)
        : undefined,
      returnDateTo: query.returnDateTo
        ? new Date(query.returnDateTo)
        : undefined,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: PurchaseReturnMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(id: string, companyId: string): Promise<PurchaseReturnEntity> {
    const ret = await this.purchaseReturnRepository.findById(id, companyId);
    if (!ret) {
      throw new NotFoundException(`Purchase return with id ${id} not found`);
    }
    return PurchaseReturnMapper.toEntity(ret);
  }

  async update(
    id: string,
    dto: UpdatePurchaseReturnDto,
    companyId: string,
    userId: string,
  ): Promise<PurchaseReturnEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const existing = await this.purchaseReturnRepository.findById(
        id,
        companyId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException(`Purchase return with id ${id} not found`);
      }
      if (existing.status !== PurchaseReturnStatus.DRAFT) {
        throw new BadRequestException(
          'Only DRAFT purchase returns can be edited',
        );
      }

      const updateData: Prisma.PurchaseReturnUpdateInput = {};
      if (dto.returnDate) updateData.returnDate = new Date(dto.returnDate);
      if (dto.warehouseId) {
        // G14-03-05-B: revalidate warehouse on update (create-time check
        // must not be bypassable by editing a valid DRAFT return).
        const warehouse = await tx.warehouse.findFirst({
          where: {
            id: dto.warehouseId,
            companyId,
            deletedAt: null,
            isActive: true,
          },
          select: { id: true },
        });
        if (!warehouse) {
          throw new NotFoundException(
            `Warehouse with id ${dto.warehouseId} not found`,
          );
        }
        updateData.warehouse = { connect: { id: dto.warehouseId } };
      }
      if (dto.notes !== undefined) updateData.notes = dto.notes;
      if (dto.currency) {
        const companyCurrency = await this.companiesService.getBaseCurrency(companyId);
        if (dto.currency !== companyCurrency) {
          throw new BadRequestException(
            `Currency ${dto.currency} does not match company currency ${companyCurrency}`,
          );
        }
        updateData.currency = dto.currency as Currency;
      }

      // G14-03-05-B: map phase (no writes yet). Row write goes first so a
      // CAS failure leaves nothing mutated — including the items below.
      let itemsData:
        | Array<{
            purchaseReturnId: string;
            productId: string;
            quantity: number;
            unitCost: Decimal;
            discountPercent: Decimal | null;
            discountAmount: Decimal;
            taxPercent: Decimal | null;
            taxAmount: Decimal;
            subtotal: Decimal;
            total: Decimal;
            notes?: string | null;
          }>
        | null = null;

      if (dto.items) {
        // G14-03-05-B: revalidate products BEFORE any item write — an invalid
        // productId must reject the whole operation with old items intact
        // (same batched tenant-scoped check as create; '' never matches).
        const requestedProductIds = [
          ...new Set(dto.items.map((i) => i.productId ?? '')),
        ];
        const foundProducts = await tx.product.findMany({
          where: {
            id: { in: requestedProductIds },
            companyId,
            deletedAt: null,
          },
          select: { id: true },
        });
        const foundProductIds = new Set(foundProducts.map((p) => p.id));
        const missingProductId = requestedProductIds.find(
          (pid) => !foundProductIds.has(pid),
        );
        if (missingProductId !== undefined) {
          throw new NotFoundException(
            `Product with id ${missingProductId} not found`,
          );
        }

        let subtotal = new Decimal(0);
        let totalDiscount = new Decimal(0);
        let totalTax = new Decimal(0);

        itemsData = dto.items.map((item) => {
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
            purchaseReturnId: id,
            productId: item.productId ?? '',
            quantity: item.quantity ?? 1,
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

        updateData.subtotal = subtotal;
        updateData.discountAmount = totalDiscount;
        updateData.taxAmount = totalTax;
        updateData.grandTotal = subtotal.sub(totalDiscount).add(totalTax);

        // G14-03-05-B: re-check the procurement invariant for the replacement
        // item set — a valid DRAFT must not become returnable-beyond-received
        // through update. Supplier is immutable on update; self excluded.
        await this.validateReturnableQuantities(
          existing.supplierId,
          companyId,
          dto.items.map((i) => ({
            productId: i.productId ?? '',
            quantity: i.quantity ?? 1,
          })),
          tx,
          id,
        );
      }

      // G14-03-05-B: optimistic concurrency. When the caller supplies the
      // rowVersion it observed, a concurrent modification fails the CAS and
      // nothing is mutated. Without rowVersion the legacy path applies.
      if (dto.rowVersion !== undefined) {
        const casResult = await tx.purchaseReturn.updateMany({
          where: { id, companyId, rowVersion: dto.rowVersion, deletedAt: null },
          data: { ...updateData, rowVersion: { increment: 1 } },
        });
        if (casResult.count === 0) {
          const stillThere = await tx.purchaseReturn.findFirst({
            where: { id, companyId },
            select: { id: true },
          });
          if (!stillThere) {
            throw new NotFoundException(
              `Purchase return with id ${id} not found`,
            );
          }
          throw new ConflictException(
            'Purchase return was modified by another user. Please refresh and retry.',
          );
        }
      } else {
        await this.purchaseReturnRepository.update(
          id,
          updateData,
          companyId,
          tx,
        );
      }

      // Items are replaced only after the row write won, so a CAS failure
      // leaves old items intact (in addition to the transaction rollback).
      if (itemsData) {
        await tx.purchaseReturnItem.deleteMany({
          where: { purchaseReturnId: id },
        });
        await tx.purchaseReturnItem.createMany({ data: itemsData });
      }

      const updated = await this.purchaseReturnRepository.findById(
        id,
        companyId,
        tx,
      );
      if (!updated) {
        throw new NotFoundException(
          `Purchase return with id ${id} not found`,
        );
      }

      // G14-03-05-B: update audit trail in the same transaction, same style
      // as create/status transitions (a rollback leaves no audit row).
      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'PurchaseReturn',
          entityId: id,
          action: 'UPDATE',
          before: { status: existing.status },
          after: { status: existing.status },
        },
        tx,
      );
      return PurchaseReturnMapper.toEntity(updated!);
    });
  }

  async transitionStatus(
    id: string,
    newStatus: PurchaseReturnStatus,
    userId: string,
    companyId: string,
    idempotencyKey?: string,
  ): Promise<PurchaseReturnEntity> {
    // For non-COMPLETED transitions, use legacy behavior (no idempotency)
    if (newStatus !== PurchaseReturnStatus.COMPLETED) {
      return this.transitionStatusLegacy(id, newStatus, userId, companyId);
    }

    // COMPLETED transition: apply idempotency if key provided
    const result = await runWithIdempotency({
      prisma: this.prismaService,
      idempotency: this.idempotencyService,
      companyId,
      idempotencyKey,
      endpoint: 'purchase-return-complete',
      requestHashPayload: { id, newStatus, userId },
      status: HttpStatus.OK,
      work: (tx) => this.applyCompleteTransition(id, userId, companyId, tx),
    });
    return result.body as PurchaseReturnEntity;
  }

  private async transitionStatusLegacy(
    id: string,
    newStatus: PurchaseReturnStatus,
    userId: string,
    companyId: string,
  ): Promise<PurchaseReturnEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const ret = await this.purchaseReturnRepository.findById(
        id,
        companyId,
        tx,
      );
      if (!ret) {
        throw new NotFoundException(`Purchase return with id ${id} not found`);
      }

      const current = ret.status as PurchaseReturnStatus;
      const allowed = VALID_RETURN_TRANSITIONS[current];
      if (!allowed || !allowed.includes(newStatus)) {
        throw new BadRequestException(
          `Cannot transition from ${current} to ${newStatus}. Allowed: ${(allowed ?? []).join(', ') || 'none'}`,
        );
      }

      // G14-03-05: APPROVED returns already reduce AP in read models, so the
      // procurement invariant applies here, not only at COMPLETED.
      if (newStatus === PurchaseReturnStatus.APPROVED) {
        const items = await tx.purchaseReturnItem.findMany({
          where: { purchaseReturnId: id },
          select: { productId: true, quantity: true },
        });
        await this.validateReturnableQuantities(
          ret.supplierId,
          companyId,
          items,
          tx,
          id,
        );
      }

      const updateData: Prisma.PurchaseReturnUpdateInput = {
        status: newStatus,
      };
      if (newStatus === PurchaseReturnStatus.APPROVED) {
        updateData.approvedBy = userId;
        updateData.approvedAt = new Date();
      }
      if (newStatus === PurchaseReturnStatus.CANCELLED) {
        updateData.cancelledBy = userId;
        updateData.cancelledAt = new Date();
      }

      const updated = await this.purchaseReturnRepository.update(
        id,
        updateData,
        companyId,
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'PurchaseReturn',
          entityId: id,
          action: String(newStatus),
          before: { status: current },
          after: { status: newStatus },
        },
        tx,
      );

      return PurchaseReturnMapper.toEntity(updated);
    });
  }

  private async applyCompleteTransition(
    id: string,
    userId: string,
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<PurchaseReturnEntity> {
    const ret = await this.purchaseReturnRepository.findById(
      id,
      companyId,
      tx,
    );
    if (!ret) {
      throw new NotFoundException(`Purchase return with id ${id} not found`);
    }

    const current = ret.status as PurchaseReturnStatus;
    const allowed = VALID_RETURN_TRANSITIONS[current];
    if (!allowed || !allowed.includes(PurchaseReturnStatus.COMPLETED)) {
      throw new BadRequestException(
        `Cannot transition from ${current} to COMPLETED. Allowed: ${(allowed ?? []).join(', ') || 'none'}`,
      );
    }

    // G9-E1: APPROVED → COMPLETED is made atomic/idempotent with a
    // status-conditional CAS. The CAS write must WIN before any side
    // effects (stock mutation, StockMovement, GL journal, event) run, so
    // two concurrent COMPLETED requests can never both pass the status
    // check and double-decrement stock / double-post the journal. The CAS
    // and every side effect share the same $transaction below — a failure
    // in any later step rolls the transition (and the status write) back.
    const casCount = await this.purchaseReturnRepository.completeIfApproved(
      id,
      companyId,
      tx,
    );
    if (casCount === 0) {
      // Lost the race: the return is no longer APPROVED (already
      // COMPLETED/CANCELLED, or concurrently transitioned by another
      // request). No stock mutation, no StockMovement, no GL journal,
      // no event — surface the same business conflict the transition
      // validation above would produce.
      throw new BadRequestException(
        `Cannot transition from ${current} to COMPLETED. Allowed: ${(allowed ?? []).join(', ') || 'none'}`,
      );
    }

    // G14-03-05: procurement invariant after the CAS win (covers rows
    // approved before this guard existed) and before any stock mutation.
    // The on-hand stock guard below remains as the second, independent
    // layer: received quantity and physical stock are different checks.
    const completeItems = await tx.purchaseReturnItem.findMany({
      where: { purchaseReturnId: id },
      select: { productId: true, quantity: true },
    });
    await this.validateReturnableQuantities(
      ret.supplierId,
      companyId,
      completeItems,
      tx,
      id,
    );

    // When COMPLETED, decrease stock
    const items = await tx.purchaseReturnItem.findMany({
      where: { purchaseReturnId: id },
    });
    for (const item of items) {
      const stock = await tx.stock.findFirst({
        where: {
          productId: item.productId,
          warehouseId: ret.warehouseId,
          companyId,
        },
      });

      const beforeQty = stock?.quantity ?? 0;
      const reservedQty = stock?.reservedQuantity ?? 0;

      // Strict stock (Policy A): a purchase return can never drive the
      // balance negative — reject and roll back the whole return instead
      // of silently clamping.
      if (beforeQty - reservedQty < item.quantity) {
        throw new BadRequestException('Insufficient stock');
      }

      const afterQty = beforeQty - item.quantity;

      if (stock) {
        // Atomic decrement with a quantity guard — safe under concurrent
        // stock changes on the same row.
        const result = await tx.stock.updateMany({
          where: {
            id: stock.id,
            companyId,
            quantity: { gte: item.quantity + reservedQty },
          },
          data: {
            quantity: { decrement: item.quantity },
            availableQuantity: { decrement: item.quantity },
            rowVersion: { increment: 1 },
          },
        });
        if (result.count === 0) {
          throw new BadRequestException('Insufficient stock');
        }
      }

      await tx.stockMovement.create({
        data: {
          companyId,
          productId: item.productId,
          warehouseId: ret.warehouseId,
          type: StockMovementType.RETURN,
          quantity: -item.quantity,
          beforeQuantity: beforeQty,
          afterQuantity: afterQty,
          referenceType: 'PURCHASE_RETURN',
          referenceId: id,
          comment: `Return to supplier ${ret.supplierId}`,
          createdBy: userId,
        },
      });
    }

    // G9-E1: post the purchase-return GL journal (Dr AP / Cr Inventory —
    // Accounting Model C) inside the same transaction, only after the CAS
    // win. A journal failure rolls back the stock mutation, movements and
    // the status transition.
    //
    // G9-F4: the Inventory relief is priced at the ACTUAL FIFO consumed
    // cost — for each item, consume the same quantity the stock decrement
    // removed from the canonical FIFO pool (referenceType='PURCHASE_RETURN',
    // referenceId=return id), then hand Σ totalCost to the journal as the
    // canonical Inventory credit. The declared supplier return value (Dr AP)
    // stays untouched; any difference posts as an explicit 5200 variance
    // leg. Consumption runs strictly after the stock guard/decrement and
    // inside the same transaction, so a FIFO failure rolls back the whole
    // COMPLETE transition. Shortfalls ride the existing G9-F1 FALLBACK B
    // (tenant-scoped product.costPrice, folded into totalCost, warn-logged);
    // no cost basis at all throws per the existing contract.
    const journalItems = await tx.purchaseReturnItem.findMany({
      where: { purchaseReturnId: id },
    });
    const fifoCostItems: Array<{
      productId: string;
      quantity: number;
      totalCost: string;
    }> = [];
    for (const item of journalItems) {
      const consumed = await this.costingService.consumeFifoLayers(
        item.productId,
        companyId,
        item.quantity,
        'PURCHASE_RETURN',
        id,
        tx,
      );
      fifoCostItems.push({
        productId: item.productId,
        quantity: item.quantity,
        totalCost: consumed.totalCost.toString(),
      });
    }
    await this.purchasingFinanceService.createPurchaseReturnJournal(
      {
        companyId,
        returnNumber: ret.returnNumber,
        returnDate: ret.returnDate,
        items: journalItems.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitCost: i.unitCost.toString(),
        })),
        fifoCostItems,
        createdBy: userId,
      },
      tx,
    );

    // Publish purchase.returned event
    try {
      const eventItems = await tx.purchaseReturnItem.findMany({
        where: { purchaseReturnId: id },
      });
      await this.eventBus.publish(
        new PurchaseReturnedEvent({
          purchaseReturnId: id,
          companyId,
          supplierId: ret.supplierId,
          warehouseId: ret.warehouseId,
          returnNumber: ret.returnNumber,
          items: eventItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitCost: i.unitCost.toString(),
            total: i.total.toString(),
          })),
        }),
        { context: { transactionClient: tx } },
      );
    } catch (_err) {
      // Non-critical event
    }

    // G11-A: status-transition audit trail. Written inside the SAME
    // transaction and AFTER every business side effect (CAS, stock
    // decrement, StockMovement, FIFO consumption, GL journal, event) — a
    // rolled-back transition leaves no audit row behind. Action naming
    // mirrors the PurchaseOrder/PurchaseInvoice convention
    // (action = the new status, before/after carry the status pair).
    await this.auditLog.log(
      {
        companyId,
        userId,
        entityType: 'PurchaseReturn',
        entityId: id,
        action: String(PurchaseReturnStatus.COMPLETED),
        before: { status: current },
        after: { status: PurchaseReturnStatus.COMPLETED },
      },
      tx,
    );

    const completed = await this.purchaseReturnRepository.findById(
      id,
      companyId,
      tx,
    );
    return PurchaseReturnMapper.toEntity(completed!);
  }

  // G14-03-05: procurement coverage — a return must not exceed what was
  // actually received through the GoodsReceipt flow. Canonical invariant:
  //   returnable(product) = received(product) − alreadyReturned(product)
  // Grouping is (supplier, product) company-scoped, NOT per-warehouse:
  // stock transfers move goods between warehouses, so a per-warehouse
  // received check would false-reject legitimate returns of transferred
  // stock. The COMPLETED on-hand stock guard independently protects the
  // return warehouse from going negative. One batched aggregate per side
  // (no N+1). Runs inside the caller's transaction.
  private async validateReturnableQuantities(
    supplierId: string,
    companyId: string,
    items: Array<{ productId: string; quantity: number }>,
    tx: Prisma.TransactionClient,
    excludeReturnId?: string,
  ): Promise<void> {
    const requestedByProduct = new Map<string, number>();
    for (const item of items) {
      requestedByProduct.set(
        item.productId,
        (requestedByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }
    const requestedProductIds = [...requestedByProduct.keys()];
    if (requestedProductIds.length === 0) return;

    // Received side: COMPLETED, non-deleted receipts whose PO belongs to
    // the same supplier/company (PO quantity alone is NOT received).
    const receivedRows = await tx.goodsReceiptItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: requestedProductIds },
        goodsReceipt: {
          companyId,
          deletedAt: null,
          status: GoodsReceiptStatus.COMPLETED,
          purchaseOrder: { supplierId, companyId, deletedAt: null },
        },
      },
      _sum: { quantity: true },
    });
    const receivedByProduct = new Map<string, number>(
      receivedRows.map((r) => [r.productId, r._sum.quantity ?? 0]),
    );

    // Consumed side: prior committed returns (APPROVED/COMPLETED only —
    // DRAFT is mutable, CANCELLED/deleted never consumed). The return
    // under validation is excluded so re-validation never counts itself.
    const consumedRows = await tx.purchaseReturnItem.groupBy({
      by: ['productId'],
      where: {
        productId: { in: requestedProductIds },
        purchaseReturn: {
          supplierId,
          companyId,
          deletedAt: null,
          status: {
            in: [
              PurchaseReturnStatus.APPROVED,
              PurchaseReturnStatus.COMPLETED,
            ],
          },
          isCancelled: false,
          ...(excludeReturnId ? { id: { not: excludeReturnId } } : {}),
        },
      },
      _sum: { quantity: true },
    });
    const consumedByProduct = new Map<string, number>(
      consumedRows.map((r) => [r.productId, r._sum.quantity ?? 0]),
    );

    for (const productId of requestedProductIds) {
      const requested = requestedByProduct.get(productId) ?? 0;
      const received = receivedByProduct.get(productId) ?? 0;
      const consumed = consumedByProduct.get(productId) ?? 0;
      if (requested > received - consumed) {
        throw new BadRequestException(
          `Return quantity ${requested} for product ${productId} exceeds ` +
            `returnable quantity ${received - consumed} ` +
            `(received ${received}, already returned ${consumed})`,
        );
      }
    }
  }

  // G15-02-B: Cancel a COMPLETED purchase return — full atomic reversal of
  // stock, FIFO cost layers, GL journal, with CAS concurrency protection.
  // Status remains COMPLETED; the isCancelled flag records the reversal.
  async cancelCompleted(
    id: string,
    userId: string,
    companyId: string,
  ): Promise<PurchaseReturnEntity> {
    return this.prismaService.$transaction(async (tx) => {
      // 1. Load return (tenant-scoped)
      const ret = await this.purchaseReturnRepository.findById(
        id,
        companyId,
        tx,
      );
      if (!ret) {
        throw new NotFoundException(`Purchase return with id ${id} not found`);
      }

      // 2. Validate status
      if (ret.status !== PurchaseReturnStatus.COMPLETED) {
        throw new BadRequestException(
          `Cannot cancel purchase return ${ret.returnNumber}: only COMPLETED returns can be cancelled. Current status: ${ret.status}`,
        );
      }

      // 3. Validate not already cancelled
      if (ret.isCancelled) {
        throw new BadRequestException(
          `Purchase return ${ret.returnNumber} has already been cancelled`,
        );
      }

      // 4. CAS: atomically set isCancelled = true. Exactly one concurrent
      // cancellation can win; the loser gets count = 0 → ConflictException.
      // CAS runs BEFORE any side effects so a failed CAS incurs no cost.
      const casCount = await this.purchaseReturnRepository.cancelIfCompleted(
        id,
        companyId,
        userId,
        tx,
      );
      if (casCount === 0) {
        throw new ConflictException(
          `Cannot cancel purchase return ${ret.returnNumber}: it was concurrently modified or already cancelled`,
        );
      }

      // 5. Load items for restoration
      const items = await tx.purchaseReturnItem.findMany({
        where: { purchaseReturnId: id },
      });

      // 6. Restore stock + create reversal StockMovement for each item
      for (const item of items) {
        const stock = await tx.stock.findFirst({
          where: {
            productId: item.productId,
            warehouseId: ret.warehouseId,
            companyId,
          },
        });

        // G15-02-B P2-01: a COMPLETED return must have a corresponding Stock
        // row (completion decremented it). A missing row is an integrity
        // violation — throw and roll back rather than creating an orphan
        // StockMovement against a non-existent stock record.
        if (!stock) {
          throw new ConflictException(
            `Cannot cancel return ${ret.returnNumber}: no stock record found for product ${item.productId} in warehouse ${ret.warehouseId}`,
          );
        }

        const beforeQty = stock.quantity;

        // Atomic increment
        const result = await tx.stock.updateMany({
          where: {
            id: stock.id,
            companyId,
          },
          data: {
            quantity: { increment: item.quantity },
            availableQuantity: { increment: item.quantity },
            rowVersion: { increment: 1 },
          },
        });
        if (result.count === 0) {
          throw new ConflictException(
            `Failed to restore stock for product ${item.productId}: concurrent modification`,
          );
        }

        const afterQty = beforeQty + item.quantity;

        await tx.stockMovement.create({
          data: {
            companyId,
            productId: item.productId,
            warehouseId: ret.warehouseId,
            type: StockMovementType.ADJUSTMENT,
            quantity: item.quantity,
            beforeQuantity: beforeQty,
            afterQuantity: afterQty,
            referenceType: 'PURCHASE_RETURN_REVERSAL',
            referenceId: id,
            comment: `Reversal of return ${ret.returnNumber}`,
            createdBy: userId,
          },
        });
      }

      // 7. Restore FIFO cost layers
      //    Find the OUT CostLayers created during the original COMPLETED transition.
      for (const item of items) {
        const outLayers =
          await this.costingService.findOutLayersByReferenceAndProduct(
            companyId,
            'PURCHASE_RETURN',
            id,
            item.productId,
            tx,
          );

        if (outLayers.length === 0) {
          // No OUT layers found — data anomaly. Throw and rollback.
          throw new ConflictException(
            `Cannot cancel return ${ret.returnNumber}: no FIFO OUT layers found for product ${item.productId}. ` +
              `The original completion may have used a legacy cost path.`,
          );
        }

        // Aggregate across all OUT layers for this product
        let totalQty = 0;
        let totalCost = new Decimal(0);
        for (const layer of outLayers) {
          totalQty += layer.quantity;
          totalCost = totalCost.add(new Decimal(layer.totalCost.toString()));
        }

        if (totalQty !== item.quantity) {
          throw new ConflictException(
            `Cannot cancel return ${ret.returnNumber}: FIFO OUT layer quantity mismatch for product ${item.productId}. ` +
              `Expected ${item.quantity}, found ${totalQty}`,
          );
        }

        // Restore at weighted average unit cost
        const avgUnitCost = totalQty > 0 ? totalCost.div(totalQty) : new Decimal(0);
        await this.costingService.restoreLayer(
          item.productId,
          companyId,
          totalQty,
          avgUnitCost,
          'PURCHASE_RETURN_REVERSAL',
          id,
          tx,
        );
      }

      // 8. Find original GL journal
      const originalJournal = await tx.journalEntry.findFirst({
        where: {
          companyId,
          referenceType: 'PURCHASE_RETURN',
          referenceId: ret.returnNumber,
          status: JournalEntryStatus.POSTED,
        },
        include: { lines: true },
      });

      if (!originalJournal) {
        throw new ConflictException(
          `Cannot cancel return ${ret.returnNumber}: no posted journal entry found. ` +
            `The original approval journal may have been manually reversed or removed.`,
        );
      }

      // 9. Find current OPEN financial period
      const openPeriod = await tx.financialPeriod.findFirst({
        where: { companyId, status: 'OPEN' },
        orderBy: { startDate: 'desc' },
        select: { id: true },
      });

      if (!openPeriod) {
        throw new BadRequestException(
          `Cannot cancel return ${ret.returnNumber}: no open financial period found. ` +
            `A GL reversal requires an OPEN period.`,
        );
      }

      // 10. Construct exact negation of the original journal lines
      const reversalLines = (originalJournal.lines ?? []).map((line) => ({
        accountId: line.accountId,
        debit: line.credit.toString(),
        credit: line.debit.toString(),
        description: `REVERSAL: ${line.description || `Return ${ret.returnNumber}`}`,
      }));

      // 11. Post reversal journal into the current OPEN period
      await this.glEngine.post(
        {
          companyId,
          financialPeriodId: openPeriod.id,
          entryDate: new Date(),
          description: `Reversal of purchase return: ${ret.returnNumber}`,
          referenceType: 'PURCHASE_RETURN_REVERSAL',
          referenceId: originalJournal.id,
          createdBy: userId,
          lines: reversalLines,
        },
        tx,
      );

      // 12. Mark original journal as REVERSED
      await tx.journalEntry.update({
        where: { id: originalJournal.id },
        data: {
          status: JournalEntryStatus.REVERSED,
          rowVersion: { increment: 1 },
        },
      });

      // 13. Audit log
      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'PurchaseReturn',
          entityId: id,
          action: 'CANCELLED',
          before: { status: PurchaseReturnStatus.COMPLETED, isCancelled: false },
          after: { status: PurchaseReturnStatus.COMPLETED, isCancelled: true },
        },
        tx,
      );

      // 14. Publish event (non-critical — failure does not break transaction)
      try {
        await this.eventBus.publish(
          new PurchaseReturnCancelledEvent({
            purchaseReturnId: id,
            companyId,
            supplierId: ret.supplierId,
            warehouseId: ret.warehouseId,
            returnNumber: ret.returnNumber,
            items: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
            })),
          }),
          { context: { transactionClient: tx } },
        );
      } catch (_err) {
        // Non-critical event
      }

      // 15. Re-fetch and return
      const cancelled = await this.purchaseReturnRepository.findById(
        id,
        companyId,
        tx,
      );
      return PurchaseReturnMapper.toEntity(cancelled!);
    });
  }

  async softDelete(id: string, companyId: string): Promise<void> {
    const existing = await this.purchaseReturnRepository.findById(
      id,
      companyId,
    );
    if (!existing) {
      throw new NotFoundException(`Purchase return with id ${id} not found`);
    }
    if (existing.status !== PurchaseReturnStatus.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT purchase returns can be deleted',
      );
    }
    await this.purchaseReturnRepository.softDelete(id, companyId);
  }
}
