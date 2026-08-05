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
import { InventoryRepository } from '../repositories/inventory.repository';
import { InventoryAdjustedEvent } from '../events';

export class ReserveStockDto {
  productId!: string;
  warehouseId!: string;
  quantity!: number;
  referenceType?: string;
  referenceId?: string;
  expiresAt?: string;
}

export class ReleaseReservationDto {
  productId!: string;
  warehouseId!: string;
  quantity!: number;
  referenceType?: string;
  referenceId?: string;
}

@Injectable()
export class ReservationService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
  ) {}

  async reserve(
    dto: ReserveStockDto,
    companyId: string,
    userId: string,
  ): Promise<any> {
    return this.prismaService.$transaction(async (tx) => {
      const stock =
        await this.inventoryRepository.findStockByProductAndWarehouse(
          dto.productId,
          dto.warehouseId,
          companyId,
          tx,
        );
      if (!stock) throw new NotFoundException('No stock record found');

      const available = stock.quantity - stock.reservedQuantity;
      if (available < dto.quantity) {
        throw new BadRequestException(
          `Insufficient available stock. Available: ${available}, Requested: ${dto.quantity}`,
        );
      }

      const newReserved = stock.reservedQuantity + dto.quantity;
      const newAvailable = stock.quantity - newReserved;

      const rowVer = stock.rowVersion ?? 0;
      await this.inventoryRepository.updateStock(
        stock.id,
        {
          reservedQuantity: newReserved,
          availableQuantity: Math.max(0, newAvailable),
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
          type: StockMovementType.RESERVATION,
          quantity: dto.quantity,
          beforeQuantity: stock.reservedQuantity,
          afterQuantity: newReserved,
          referenceType: dto.referenceType ?? 'RESERVATION',
          referenceId: dto.referenceId,
          comment: `Reserved ${dto.quantity} units`,
          user: userId ? { connect: { id: userId } } : undefined,
        },
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'Stock',
          entityId: stock.id,
          action: 'RESERVE',
          before: { reservedQuantity: stock.reservedQuantity },
          after: { reservedQuantity: newReserved },
        },
        tx,
      );

      return {
        id: movement.id,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        quantity: dto.quantity,
        reservedQuantity: newReserved,
        availableQuantity: newAvailable,
      };
    });
  }

  async release(
    dto: ReleaseReservationDto,
    companyId: string,
    userId: string,
  ): Promise<any> {
    return this.prismaService.$transaction(async (tx) => {
      const stock =
        await this.inventoryRepository.findStockByProductAndWarehouse(
          dto.productId,
          dto.warehouseId,
          companyId,
          tx,
        );
      if (!stock) throw new NotFoundException('No stock record found');

      const releaseQty = Math.min(dto.quantity, stock.reservedQuantity);
      const newReserved = stock.reservedQuantity - releaseQty;
      const newAvailable = stock.quantity - newReserved;

      const rowVer = stock.rowVersion ?? 0;
      await this.inventoryRepository.updateStock(
        stock.id,
        {
          reservedQuantity: newReserved,
          availableQuantity: newAvailable,
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
          type: StockMovementType.UNRESERVATION,
          quantity: -releaseQty,
          beforeQuantity: stock.reservedQuantity,
          afterQuantity: newReserved,
          referenceType: dto.referenceType ?? 'RELEASE',
          referenceId: dto.referenceId,
          comment: `Released ${releaseQty} units`,
          user: userId ? { connect: { id: userId } } : undefined,
        },
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'Stock',
          entityId: stock.id,
          action: 'RELEASE',
          before: { reservedQuantity: stock.reservedQuantity },
          after: { reservedQuantity: newReserved },
        },
        tx,
      );

      return {
        id: movement.id,
        productId: dto.productId,
        warehouseId: dto.warehouseId,
        quantity: releaseQty,
        reservedQuantity: newReserved,
        availableQuantity: newAvailable,
      };
    });
  }
}
