import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { CreateInventoryCountDto, CompleteInventoryCountDto } from '../dto';
import { InventoryCountEntity } from '../entities';
import { InventoryCountMapper } from '../mappers/inventory-count.mapper';
import { InventoryRepository } from '../repositories/inventory.repository';
import { InventoryCountedEvent, InventoryAdjustedEvent } from '../events';
import { CostingService, FifoConsumptionResult } from './costing.service';

@Injectable()
export class InventoryCountService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly costingService: CostingService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async findAll(companyId: string): Promise<InventoryCountEntity[]> {
    const counts =
      await this.inventoryRepository.findInventoryCounts(companyId);
    return InventoryCountMapper.toEntityList(counts);
  }

  async findById(id: string, companyId: string): Promise<InventoryCountEntity> {
    const count = await this.inventoryRepository.findInventoryCountById(
      id,
      companyId,
    );
    if (!count) throw new NotFoundException('Inventory count not found');
    return InventoryCountMapper.toEntity(count);
  }

  async create(
    dto: CreateInventoryCountDto,
    companyId: string,
    userId: string,
  ): Promise<InventoryCountEntity> {
    return this.prismaService.$transaction(async (tx) => {
      // G16-B-02 PH3 (B02-08): client-supplied warehouse/product references
      // must be validated before any persistence — Prisma `connect` proves
      // existence only, never tenant ownership.
      await this.assertReferencesBelongToCompany(
        dto.warehouseId,
        dto.items.map((item) => item.productId),
        companyId,
        tx,
      );

      const count = await this.inventoryRepository.createInventoryCount(
        {
          countNumber: dto.countNumber,
          status: 'DRAFT',
          notes: dto.notes,
          warehouse: { connect: { id: dto.warehouseId } },
          company: { connect: { id: companyId } },
          countedBy: userId,
        },
        tx,
      );

      for (const item of dto.items) {
        await this.inventoryRepository.createInventoryCountItem(
          {
            productId: item.productId,
            expectedQuantity: item.expectedQuantity,
            actualQuantity: item.actualQuantity,
            difference: item.actualQuantity - item.expectedQuantity,
            notes: item.notes,
            inventoryCount: { connect: { id: count.id } },
          },
          tx,
        );
      }

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'InventoryCount',
          entityId: count.id,
          action: 'CREATE',
          before: null,
          after: { countNumber: dto.countNumber, itemsCount: dto.items.length },
        },
        tx,
      );

      const fullCount = await this.inventoryRepository.findInventoryCountById(
        count.id,
        companyId,
        tx,
      );
      if (!fullCount)
        throw new NotFoundException('Inventory count not found after creation');
      return InventoryCountMapper.toEntity(fullCount);
    });
  }

  async complete(
    id: string,
    dto: CompleteInventoryCountDto,
    companyId: string,
    userId: string,
  ): Promise<InventoryCountEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const count = await this.inventoryRepository.findInventoryCountById(
        id,
        companyId,
        tx,
      );
      if (!count) throw new NotFoundException('Inventory count not found');
      if (count.status !== 'DRAFT')
        throw new BadRequestException('Only DRAFT counts can be completed');

      // G16-B-02 PH3 (B02-08): persisted references are untrusted — a count
      // created before this guard (or otherwise poisoned) must not reach the
      // Stock mutation loop with a foreign/inactive/deleted warehouse or a
      // foreign/deleted product.
      await this.assertReferencesBelongToCompany(
        count.warehouseId,
        count.items.map((item) => item.productId),
        companyId,
        tx,
      );

      await this.inventoryRepository.updateInventoryCount(
        id,
        { status: 'COMPLETED', approvedBy: userId },
        companyId,
        dto.rowVersion,
        tx,
      );

      for (const item of count.items) {
        if (item.difference === 0) continue;

        // G15-05-04 (Option A, same invariant as StockService.applyAdjustStock):
        // a missing Stock row is materialized as a zero row instead of
        // silently recording a movement against non-existent stock.
        let stock =
          await this.inventoryRepository.findStockByProductAndWarehouse(
            item.productId,
            count.warehouseId,
            companyId,
            tx,
          );
        if (!stock) {
          stock = await this.inventoryRepository.createStock(
            {
              product: { connect: { id: item.productId } },
              warehouse: { connect: { id: count.warehouseId } },
              company: { connect: { id: companyId } },
              quantity: 0,
              reservedQuantity: 0,
              availableQuantity: 0,
            },
            tx,
          );
        }

        // G15-05-A valuation ladder, G16-H-1-centralized: positive
        // differences resolve cost through the shared ladder (layers →
        // costPrice incl. Decimal(0)) and are REFUSED when no basis exists —
        // a count must not create unvalued positive stock. Negative
        // differences consume via consumeFifoLayers below (unchanged).
        let unitCost: string | undefined;
        // G16-N-4 P1-A: audit-only classification of the actual basis used.
        let costBasis: 'AVERAGE' | 'COST_PRICE' | undefined;
        if (item.difference > 0) {
          const resolved =
            await this.costingService.resolvePositiveEntryUnitCost(
              item.productId,
              companyId,
              tx,
            );
          if (resolved.source === 'NONE') {
            throw new BadRequestException(
              `Cannot complete count ${count.countNumber}: no cost basis for product ${item.productId}. Set product costPrice or receive stock with a unit cost first.`,
            );
          }
          unitCost = resolved.unitCost!.toString();
          costBasis = resolved.source;
        }

        const afterQty = item.actualQuantity;
        await this.inventoryRepository.updateStock(
          stock.id,
          {
            quantity: afterQty,
            availableQuantity: Math.max(0, afterQty - stock.reservedQuantity),
          },
          companyId,
          ((stock as Record<string, unknown>).rowVersion as number) ?? 0,
          tx,
        );

        // G15-05-A cost-layer sync. Strict: any failure rolls back the
        // entire count — stock must never move without its valuation.
        let fifo: FifoConsumptionResult | null = null;
        if (item.difference > 0) {
          if (unitCost) {
            await this.costingService.recordInboundLayer(
              item.productId,
              companyId,
              item.difference,
              new Decimal(unitCost),
              'INVENTORY_COUNT',
              count.id,
              undefined,
              tx,
            );
          }
          // No cost basis: stock + movement only, explicitly no layer/GL.
        } else {
          // G16-N-4 P1-A: capture the canonical consumption result —
          // fifo.totalCost is the authoritative financial cost of the
          // shrinkage (layered cost + FALLBACK B), exactly what the GL must
          // post. Not recalculated from average cost or unitCost × quantity.
          fifo = await this.costingService.consumeFifoLayers(
            item.productId,
            companyId,
            Math.abs(item.difference),
            'INVENTORY_COUNT',
            count.id,
            tx,
          );
        }

        await this.inventoryRepository.createStockMovement(
          {
            company: { connect: { id: companyId } },
            product: { connect: { id: item.productId } },
            warehouse: { connect: { id: count.warehouseId } },
            type: StockMovementType.COUNT_ADJUSTMENT,
            quantity: item.difference,
            beforeQuantity: item.expectedQuantity,
            afterQuantity: item.actualQuantity,
            referenceType: 'INVENTORY_COUNT',
            referenceId: count.id,
            comment: `Count adjustment for ${count.countNumber}`,
            user: userId ? { connect: { id: userId } } : undefined,
          },
          tx,
        );

        // G15-05-A financial leg: reuse the canonical inventory.adjusted
        // path so the existing InventoryFinanceHandler posts Dr/Cr 1300/5100
        // (plus AccountBalance) inside this same transaction.
        //
        // G16-N-4 P1-A: the event is now published UNCONDITIONALLY. Before
        // this fix it was gated on `if (unitCost)` — and unitCost is resolved
        // only for positive differences — so shrinkage never reached the
        // finance handler: inventory valuation fell (FIFO) while the GL
        // inventory balance stayed inflated. Negative differences now carry
        // the authoritative FIFO consumption cost (totalCost + derived
        // unitCost for observability); zero/missing-cost cases are handled by
        // the handler's canonical zero-amount skip (GL_SKIP_ZERO_AMOUNT).
        await this.eventBus.publish(
          new InventoryAdjustedEvent({
            productId: item.productId,
            companyId,
            warehouseId: count.warehouseId,
            quantity: item.difference,
            beforeQuantity: item.expectedQuantity,
            afterQuantity: item.actualQuantity,
            reason: `count ${count.countNumber}`,
            adjustedBy: userId,
            referenceType: 'INVENTORY_COUNT',
            referenceId: count.id,
            comment: `Count adjustment for ${count.countNumber}`,
            ...(item.difference > 0
              ? {
                  unitCost,
                  costBasis,
                }
              : {
                  unitCost: fifo!.totalCost
                    .div(Math.abs(item.difference))
                    .toString(),
                  totalCost: fifo!.totalCost.toString(),
                  costBasis: 'FIFO' as const,
                }),
          }),
          { context: { transactionClient: tx } },
        );

        await this.eventBus.publish(
          new InventoryCountedEvent({
            productId: item.productId,
            companyId,
            warehouseId: count.warehouseId,
            expectedQuantity: item.expectedQuantity,
            actualQuantity: item.actualQuantity,
            difference: item.difference,
            countNumber: count.countNumber,
            countedBy: userId,
          }),
          { context: { transactionClient: tx } },
        );
      }

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'InventoryCount',
          entityId: id,
          action: 'COMPLETE',
          before: { status: 'DRAFT' },
          after: { status: 'COMPLETED' },
        },
        tx,
      );

      const updated = await this.inventoryRepository.findInventoryCountById(
        id,
        companyId,
        tx,
      );
      if (!updated)
        throw new NotFoundException('Inventory count not found after update');
      return InventoryCountMapper.toEntity(updated);
    });
  }

  /**
   * G16-B-02 PH3 (B02-08): Inventory Count references are client-supplied and
   * persisted verbatim, so they are validated against the caller's company
   * before any write — and re-validated at completion, because persisted
   * references are untrusted. Prisma `connect` only proves existence, never
   * tenant ownership, so without this a foreign warehouse/product could reach
   * `createStock`. Foreign, missing and soft-deleted rows are indistinguishable
   * 404s (no tenant-existence oracle).
   */
  private async assertReferencesBelongToCompany(
    warehouseId: string,
    productIds: string[],
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const warehouse = await this.inventoryRepository.findWarehouseById(
      warehouseId,
      companyId,
      tx,
    );
    if (!warehouse) throw new NotFoundException('Warehouse not found');
    if (!warehouse.isActive)
      throw new NotFoundException('Warehouse is inactive');

    const uniqueProductIds = [...new Set(productIds)];
    if (uniqueProductIds.length === 0) return;

    const products = await this.inventoryRepository.findProductsByIds(
      uniqueProductIds,
      companyId,
      tx,
    );
    if (products.length !== uniqueProductIds.length) {
      const found = new Set(products.map((product) => product.id));
      const missing = uniqueProductIds.find((id) => !found.has(id));
      throw new NotFoundException(`Product with id ${missing} not found`);
    }

    // G16-B-02 PH3 (B02-08 remediation): an inactive product is unusable for a
    // count. Surfaced as the same indistinguishable 404 as foreign/missing/
    // deleted so no tenant- or state-existence oracle is exposed.
    const inactive = products.find(
      (product) => product.isActive === false,
    );
    if (inactive) throw new NotFoundException(`Product with id ${inactive.id} not found`);
  }
}
