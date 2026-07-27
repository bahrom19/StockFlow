import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { CreateBatchDto } from '../dto';
import { BatchEntity } from '../entities';
import { InventoryRepository } from '../repositories/inventory.repository';

@Injectable()
export class BatchService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findByProduct(
    productId: string,
    companyId: string,
  ): Promise<BatchEntity[]> {
    const batches = await this.inventoryRepository.findBatchesByProduct(
      productId,
      companyId,
    );
    return batches.map((b) => ({
      id: b.id,
      companyId: b.companyId,
      productId: b.productId,
      batchNumber: b.batchNumber,
      quantity: b.quantity,
      availableQuantity: b.availableQuantity,
      unitCost: (b.unitCost as unknown as Decimal).toString(),
      manufactureDate: b.manufactureDate,
      expiryDate: b.expiryDate,
      receivedDate: b.receivedDate,
      status: b.status,
      notes: b.notes,
      rowVersion: (b as Record<string, any>).rowVersion ?? 0,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));
  }

  async create(
    dto: CreateBatchDto,
    companyId: string,
    userId: string,
  ): Promise<BatchEntity> {
    return this.prismaService.$transaction(async (tx) => {
      const product = await this.inventoryRepository.findProductById(
        dto.productId,
        companyId,
        tx,
      );
      if (!product) throw new NotFoundException('Product not found');

      const batch = await this.inventoryRepository.createBatch(
        {
          batchNumber: dto.batchNumber,
          quantity: dto.quantity,
          availableQuantity: dto.quantity,
          unitCost: new Decimal(dto.unitCost),
          manufactureDate: dto.manufactureDate
            ? new Date(dto.manufactureDate)
            : null,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          notes: dto.notes,
          company: { connect: { id: companyId } },
          product: { connect: { id: dto.productId } },
        },
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'Batch',
          entityId: batch.id,
          action: 'CREATE',
          before: null,
          after: { id: batch.id, batchNumber: batch.batchNumber },
        },
        tx,
      );

      return {
        id: batch.id,
        companyId: batch.companyId,
        productId: batch.productId,
        batchNumber: batch.batchNumber,
        quantity: batch.quantity,
        availableQuantity: batch.availableQuantity,
        unitCost: batch.unitCost.toString(),
        manufactureDate: batch.manufactureDate,
        expiryDate: batch.expiryDate,
        receivedDate: batch.receivedDate,
        status: batch.status,
        notes: batch.notes,
        rowVersion: (batch as Record<string, any>).rowVersion ?? 0,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      };
    });
  }
}
