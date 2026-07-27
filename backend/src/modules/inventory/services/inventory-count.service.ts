import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { CreateInventoryCountDto, CompleteInventoryCountDto } from '../dto';
import { InventoryCountEntity } from '../entities';
import { InventoryCountMapper } from '../mappers/inventory-count.mapper';
import { InventoryRepository } from '../repositories/inventory.repository';
import { InventoryCountedEvent } from '../events';

@Injectable()
export class InventoryCountService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
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

      await this.inventoryRepository.updateInventoryCount(
        id,
        { status: 'COMPLETED', approvedBy: userId },
        companyId,
        dto.rowVersion,
        tx,
      );

      for (const item of count.items) {
        if (item.difference === 0) continue;

        const stock =
          await this.inventoryRepository.findStockByProductAndWarehouse(
            item.productId,
            count.warehouseId,
            companyId,
            tx,
          );

        if (stock) {
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
}
