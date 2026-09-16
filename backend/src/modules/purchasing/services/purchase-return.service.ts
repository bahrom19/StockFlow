import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PurchaseReturnStatus,
  StockMovementType,
  Currency,
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
import { CompaniesService } from '../../companies/services/companies.service';
import { PurchasingFinanceService } from './purchasing-finance.service';
import { CostingService } from '../../inventory/services/costing.service';
import { AuditLogService } from '../../shared/services/audit-log.service';

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
    private readonly auditLog: AuditLogService,
  ) {}

  async create(
    dto: CreatePurchaseReturnDto,
    userId: string,
    companyId: string,
  ): Promise<PurchaseReturnEntity> {
    return this.prismaService.$transaction(async (tx) => {
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
    });
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
      if (dto.warehouseId)
        updateData.warehouse = { connect: { id: dto.warehouseId } };
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

      if (dto.items) {
        await tx.purchaseReturnItem.deleteMany({
          where: { purchaseReturnId: id },
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

        await tx.purchaseReturnItem.createMany({ data: itemsData });

        updateData.subtotal = subtotal;
        updateData.discountAmount = totalDiscount;
        updateData.taxAmount = totalTax;
        updateData.grandTotal = subtotal.sub(totalDiscount).add(totalTax);
      }

      const updated = await this.purchaseReturnRepository.update(
        id,
        updateData,
        companyId,
        tx,
      );
      return PurchaseReturnMapper.toEntity(updated);
    });
  }

  async transitionStatus(
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

      // G9-E1: APPROVED → COMPLETED is made atomic/idempotent with a
      // status-conditional CAS. The CAS write must WIN before any side
      // effects (stock mutation, StockMovement, GL journal, event) run, so
      // two concurrent COMPLETED requests can never both pass the status
      // check and double-decrement stock / double-post the journal. The CAS
      // and every side effect share the same $transaction below — a failure
      // in any later step rolls the transition (and the status write) back.
      let completedTransition = false;
      if (newStatus === PurchaseReturnStatus.COMPLETED) {
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
            `Cannot transition from ${current} to ${newStatus}. Allowed: ${(allowed ?? []).join(', ') || 'none'}`,
          );
        }
        completedTransition = true;
      }

      // When COMPLETED, decrease stock
      if (newStatus === PurchaseReturnStatus.COMPLETED) {
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
      if (completedTransition) {
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
      }

      // Publish purchase.returned event
      if (newStatus === PurchaseReturnStatus.COMPLETED) {
        try {
          const items = await tx.purchaseReturnItem.findMany({
            where: { purchaseReturnId: id },
          });
          await this.eventBus.publish(
            new PurchaseReturnedEvent({
              purchaseReturnId: id,
              companyId,
              supplierId: ret.supplierId,
              warehouseId: ret.warehouseId,
              returnNumber: ret.returnNumber,
              items: items.map((i) => ({
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
          action: String(newStatus),
          before: { status: current },
          after: { status: newStatus },
        },
        tx,
      );

      // G9-E1: the COMPLETED status write already happened via the CAS
      // (completeIfApproved) — skip the redundant generic status update so
      // the final update only carries audit fields (and so CANCELLED/
      // APPROVED transitions keep the previous behavior unchanged).
      if (!completedTransition) {
        const updated = await this.purchaseReturnRepository.update(
          id,
          updateData,
          companyId,
          tx,
        );
        return PurchaseReturnMapper.toEntity(updated);
      }

      const completed = await this.purchaseReturnRepository.findById(
        id,
        companyId,
        tx,
      );
      return PurchaseReturnMapper.toEntity(completed!);
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
