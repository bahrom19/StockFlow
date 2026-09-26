import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PrismaService } from '../../../common/prisma';
import { EventBus, EVENT_BUS } from '../../../common/events';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { InventoryRepository } from '../repositories/inventory.repository';
import { InventoryAdjustedEvent } from '../events';

// G16-B-02 PH3 (B02-12): the global ValidationPipe only validates classes
// carrying class-validator metadata, so these DTOs were previously accepted
// verbatim (any quantity, unknown fields). Decorators align them with the
// other inventory DTOs (IsInt/Min(1) quantity, non-empty string IDs).
export class ReserveStockDto {
  @IsString() @IsNotEmpty() productId!: string;
  @IsString() @IsNotEmpty() warehouseId!: string;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() referenceType?: string;
  @IsOptional() @IsString() referenceId?: string;
  @IsOptional() @IsString() expiresAt?: string;
}

export class ReleaseReservationDto {
  @IsString() @IsNotEmpty() productId!: string;
  @IsString() @IsNotEmpty() warehouseId!: string;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsString() referenceType?: string;
  @IsOptional() @IsString() referenceId?: string;
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
      // G16-B-02 PH3 (B02-12): client-supplied references are untrusted —
      // validated (ownership + active state) before any Stock mutation so a
      // poisoned/foreign product or warehouse cannot reach StockMovement.
      await this.assertReferencesBelongToCompany(
        dto.warehouseId,
        dto.productId,
        companyId,
        tx,
      );

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
      // G16-B-02 PH3 (B02-12): same fail-closed guard as reserve() — release
      // must not trust persisted-looking references either.
      await this.assertReferencesBelongToCompany(
        dto.warehouseId,
        dto.productId,
        companyId,
        tx,
      );

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

  /**
   * G16-B-02 PH3 (B02-12): Reservation (reserve/release) references are
   * client-supplied and reach `createStockMovement` connects verbatim, so
   * they are validated against the caller's company before any write.
   * Prisma `connect` only proves existence, never tenant ownership. Foreign,
   * missing and soft-deleted rows are indistinguishable 404s (no
   * tenant-existence oracle), and inactive rows fail closed with the same
   * semantics as B02-07/B02-08.
   */
  private async assertReferencesBelongToCompany(
    warehouseId: string,
    productId: string,
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

    const products = await this.inventoryRepository.findProductsByIds(
      [productId],
      companyId,
      tx,
    );
    if (products.length !== 1 || products[0]?.isActive === false) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }
  }
}
