import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { AdjustStockDto, TransferStockDto, StockQueryDto } from '../dto';
import { StockEntity, StockMovementEntity } from '../entities';
import { StockMapper } from '../mappers/stock.mapper';
import { StockMovementMapper } from '../mappers/stock-movement.mapper';
import { InventoryRepository } from '../repositories/inventory.repository';
import { CostingService } from './costing.service';
import { InventoryAdjustedEvent, InventoryTransferredEvent } from '../events';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly costingService: CostingService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async findAll(
    companyId: string,
    query?: StockQueryDto,
  ): Promise<{ items: StockEntity[]; total: number }> {
    const stock = await this.inventoryRepository.findAllStock(companyId);
    let filtered = StockMapper.toEntityList(stock);

    if (query?.search) {
      const s = query.search.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.productName.toLowerCase().includes(s) ||
          i.productSku.toLowerCase().includes(s),
      );
    }
    if (query?.warehouseId) {
      filtered = filtered.filter((i) => i.warehouseId === query.warehouseId);
    }
    if (query?.lowStock === 'true') {
      filtered = filtered.filter((i) => i.availableQuantity <= i.minQuantity);
    }

    return { items: filtered, total: filtered.length };
  }

  async findByProduct(
    productId: string,
    companyId: string,
  ): Promise<StockEntity[]> {
    const stock = await this.inventoryRepository.findStockByProduct(
      productId,
      companyId,
    );
    return StockMapper.toEntityList(
      stock.map((s: any) => ({ ...s, product: { name: '', sku: '' } })),
    );
  }

  async getMovements(
    companyId: string,
    options?: { productId?: string; warehouseId?: string; limit?: number },
  ): Promise<StockMovementEntity[]> {
    const movements = await this.inventoryRepository.findStockMovements(
      companyId,
      {
        productId: options?.productId,
        warehouseId: options?.warehouseId,
        limit: options?.limit ?? 100,
      },
    );
    return StockMovementMapper.toEntityList(movements);
  }

  async adjustStock(
    dto: AdjustStockDto,
    companyId: string,
    userId: string,
  ): Promise<StockMovementEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const product = await this.inventoryRepository.findProductById(
        dto.productId,
        companyId,
        tx,
      );
      if (!product) throw new NotFoundException('Product not found');

      const warehouse = await this.inventoryRepository.findWarehouseById(
        dto.warehouseId,
        companyId,
        tx,
      );
      if (!warehouse) throw new NotFoundException('Warehouse not found');

      let stock = await this.inventoryRepository.findStockByProductAndWarehouse(
        dto.productId,
        dto.warehouseId,
        companyId,
        tx,
      );

      if (!stock) {
        stock = await this.inventoryRepository.createStock(
          {
            product: { connect: { id: dto.productId } },
            warehouse: { connect: { id: dto.warehouseId } },
            company: { connect: { id: companyId } },
            quantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
          },
          tx,
        );
      }

      const beforeQuantity = stock.quantity;
      const afterQuantity = Math.max(0, beforeQuantity + dto.quantity);

      if (afterQuantity < 0) {
        throw new BadRequestException('Stock quantity cannot become negative');
      }

      const rowVer = (stock as Record<string, any>).rowVersion ?? 0;
      const updated = await this.inventoryRepository.updateStock(
        stock.id,
        {
          quantity: afterQuantity,
          availableQuantity: afterQuantity - stock.reservedQuantity,
        },
        companyId,
        rowVer,
        tx,
      );

      const movement = await this.inventoryRepository.createStockMovement(
        {
          company: { connect: { id: companyId } },
          product: { connect: { id: dto.productId } },
          warehouse: { connect: { id: dto.warehouseId } },
          type: StockMovementType.ADJUSTMENT,
          quantity: dto.quantity,
          beforeQuantity,
          afterQuantity,
          referenceType: dto.referenceType ?? 'ADJUSTMENT',
          referenceId: dto.referenceId ?? stock.id,
          comment: dto.comment ?? dto.reason ?? 'Stock adjustment',
          user: userId ? { connect: { id: userId } } : undefined,
        },
        tx,
      );

      // Source of truth for unit cost is the costing engine (weighted average
      // of active cost layers). Fall back to the static product costPrice, then
      // to null (journal skipped by the zero-amount guard in the handler).
      const averageCost = await this.costingService.calculateAverageCost(
        dto.productId,
        companyId,
        tx,
      );
      const unitCost = !averageCost.isZero()
        ? averageCost.toString()
        : product.costPrice?.toString();

      // ── Step 2: keep cost layers in sync with the adjustment ──────────
      // Positive adjustments create an inbound cost layer; negative
      // adjustments consume layers via the existing FIFO mechanism (the same
      // engine used for valuation and COGS). Runs inside this transaction so
      // a layer failure rolls back the whole adjustment.
      const layerReferenceId = dto.referenceId ?? stock.id;
      if (dto.quantity > 0) {
        if (unitCost) {
          await this.costingService.recordInboundLayer(
            dto.productId,
            companyId,
            dto.quantity,
            new Decimal(unitCost),
            'ADJUSTMENT',
            layerReferenceId,
            undefined,
            tx,
          );
        } else {
          // No cost basis (no layers, no costPrice) — same as finance:
          // skip rather than create a zero-cost layer that would distort
          // valuation and future COGS.
          this.logger.warn(
            `No cost basis for positive adjustment of product ${dto.productId} — skipping inbound cost layer`,
          );
        }
      } else if (dto.quantity < 0) {
        try {
          await this.costingService.consumeFifoLayers(
            dto.productId,
            companyId,
            Math.abs(dto.quantity),
            'ADJUSTMENT',
            layerReferenceId,
            tx,
          );
        } catch (err) {
          // Real concurrency conflicts must propagate; insufficient layers
          // keep the pre-Step-2 behaviour (adjustment still succeeds).
          if (err instanceof ConflictException) throw err;
          this.logger.warn(
            `Cost layer consumption skipped for product ${dto.productId}: ${(err as Error).message}`,
          );
        }
      }

      await this.eventBus.publish(
        new InventoryAdjustedEvent({
          productId: dto.productId,
          companyId,
          warehouseId: dto.warehouseId,
          quantity: dto.quantity,
          beforeQuantity,
          afterQuantity,
          reason: dto.reason ?? 'manual',
          adjustedBy: userId,
          referenceType: dto.referenceType,
          referenceId: dto.referenceId,
          comment: dto.comment,
          unitCost,
        }),
        { context: { transactionClient: tx } },
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'Stock',
          entityId: stock.id,
          action: 'ADJUST',
          before: { quantity: beforeQuantity },
          after: { quantity: afterQuantity },
        },
        tx,
      );

      return StockMovementMapper.toEntity(movement);
    });
  }

  async transferStock(
    dto: TransferStockDto,
    companyId: string,
    userId: string,
  ): Promise<StockMovementEntity[]> {
    if (dto.fromWarehouseId === dto.toWarehouseId) {
      throw new BadRequestException(
        'Source and destination warehouses must be different',
      );
    }

    return this.prismaService.$transaction(async (tx) => {
      const product = await this.inventoryRepository.findProductById(
        dto.productId,
        companyId,
        tx,
      );
      if (!product) throw new NotFoundException('Product not found');

      const sourceStock =
        await this.inventoryRepository.findStockByProductAndWarehouse(
          dto.productId,
          dto.fromWarehouseId,
          companyId,
          tx,
        );
      if (!sourceStock)
        throw new NotFoundException('No stock in source warehouse');

      let destStock =
        await this.inventoryRepository.findStockByProductAndWarehouse(
          dto.productId,
          dto.toWarehouseId,
          companyId,
          tx,
        );

      const sourceBefore = sourceStock.quantity;
      const sourceAfter = sourceBefore - dto.quantity;
      if (sourceAfter < 0)
        throw new BadRequestException('Insufficient stock in source warehouse');

      const destBefore = destStock?.quantity ?? 0;
      const destAfter = destBefore + dto.quantity;

      const srcRowVer = (sourceStock as Record<string, any>).rowVersion ?? 0;
      await this.inventoryRepository.updateStock(
        sourceStock.id,
        {
          quantity: sourceAfter,
          availableQuantity: Math.max(
            0,
            sourceAfter - sourceStock.reservedQuantity,
          ),
        },
        companyId,
        srcRowVer,
        tx,
      );

      if (destStock) {
        const dstRowVer = (destStock as Record<string, any>).rowVersion ?? 0;
        await this.inventoryRepository.updateStock(
          destStock.id,
          {
            quantity: destAfter,
            availableQuantity: destAfter - destStock.reservedQuantity,
          },
          companyId,
          dstRowVer,
          tx,
        );
      } else {
        destStock = await this.inventoryRepository.createStock(
          {
            product: { connect: { id: dto.productId } },
            warehouse: { connect: { id: dto.toWarehouseId } },
            company: { connect: { id: companyId } },
            quantity: dto.quantity,
            reservedQuantity: 0,
            availableQuantity: dto.quantity,
          },
          tx,
        );
      }

      const refId = `${dto.fromWarehouseId}:${dto.toWarehouseId}`;

      const outMovement = await this.inventoryRepository.createStockMovement(
        {
          company: { connect: { id: companyId } },
          product: { connect: { id: dto.productId } },
          warehouse: { connect: { id: dto.fromWarehouseId } },
          type: StockMovementType.TRANSFER_OUT,
          quantity: dto.quantity,
          beforeQuantity: sourceBefore,
          afterQuantity: sourceAfter,
          referenceType: 'TRANSFER',
          referenceId: refId,
          comment: dto.comment ?? 'Stock transfer',
          user: userId ? { connect: { id: userId } } : undefined,
        },
        tx,
      );

      const inMovement = await this.inventoryRepository.createStockMovement(
        {
          company: { connect: { id: companyId } },
          product: { connect: { id: dto.productId } },
          warehouse: { connect: { id: dto.toWarehouseId } },
          type: StockMovementType.TRANSFER_IN,
          quantity: dto.quantity,
          beforeQuantity: destBefore,
          afterQuantity: destAfter,
          referenceType: 'TRANSFER',
          referenceId: refId,
          comment: dto.comment ?? 'Stock transfer',
          user: userId ? { connect: { id: userId } } : undefined,
        },
        tx,
      );

      await this.eventBus.publish(
        new InventoryTransferredEvent({
          productId: dto.productId,
          companyId,
          fromWarehouseId: dto.fromWarehouseId,
          toWarehouseId: dto.toWarehouseId,
          quantity: dto.quantity,
          transferredBy: userId,
          comment: dto.comment,
        }),
        { context: { transactionClient: tx } },
      );

      return [
        StockMovementMapper.toEntity(outMovement),
        StockMovementMapper.toEntity(inMovement),
      ];
    });
  }
}
