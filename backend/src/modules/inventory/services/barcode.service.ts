import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { InventoryRepository } from '../repositories/inventory.repository';
import { randomInt } from 'crypto';

export class CreateBarcodeDto {
  productId!: string;
  barcode!: string;
  isPrimary?: boolean;
}

export class UpdateBarcodeDto {
  barcode?: string;
  isPrimary?: boolean;
  rowVersion!: number;
}

@Injectable()
export class BarcodeService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly inventoryRepository: InventoryRepository,
    private readonly auditLog: AuditLogService,
  ) {}

  async findByProduct(productId: string, companyId: string): Promise<any[]> {
    const barcodes = await this.inventoryRepository.findBarcodesByProduct(
      productId,
      companyId,
    );
    return barcodes.map((b) => ({
      id: b.id,
      productId: b.productId,
      barcode: b.barcode,
      isPrimary: b.isPrimary,
      rowVersion: b.rowVersion ?? 0,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));
  }

  async search(barcode: string, companyId: string): Promise<any[]> {
    return this.inventoryRepository.searchProductsByBarcode(barcode, companyId);
  }

  async generate(
    productId: string,
    companyId: string,
  ): Promise<{ barcode: string }> {
    const product = await this.inventoryRepository.findProductForBarcode(
      productId,
      companyId,
    );
    if (!product) throw new NotFoundException('Product not found');

    const prefix = product.sku?.slice(0, 3) ?? 'PRD';
    const random = randomInt(100000, 999999).toString();
    const barcode = `${prefix}${random}`;

    return { barcode };
  }

  validate(barcode: string): boolean {
    return /^[A-Za-z0-9]{6,50}$/.test(barcode);
  }

  async create(
    dto: CreateBarcodeDto,
    companyId: string,
    userId: string,
  ): Promise<any> {
    const product = await this.inventoryRepository.findProductForBarcode(
      dto.productId,
      companyId,
    );
    if (!product) throw new NotFoundException('Product not found');

    if (!this.validate(dto.barcode)) {
      throw new BadRequestException(
        'Invalid barcode format. Must be 6-50 alphanumeric characters.',
      );
    }

    return this.prismaService.$transaction(async (tx) => {
      // If isPrimary, unset other primary barcodes
      if (dto.isPrimary) {
        await this.inventoryRepository.updateBarcodePrimaryFlag(
          dto.productId,
          false,
          tx,
        );
      }

      const barcode = await this.inventoryRepository.createBarcode(
        {
          product: { connect: { id: dto.productId } },
          barcode: dto.barcode,
          isPrimary: dto.isPrimary ?? false,
        },
        tx,
      );

      // Update product's primary barcode if set as primary
      if (dto.isPrimary) {
        await this.inventoryRepository.updateProductPrimaryBarcode(
          dto.productId,
          dto.barcode,
          tx,
        );
      }

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'ProductBarcode',
          entityId: barcode.id,
          action: 'CREATE',
          before: null,
          after: { barcode: dto.barcode, isPrimary: dto.isPrimary },
        },
        tx,
      );

      return {
        id: barcode.id,
        productId: barcode.productId,
        barcode: barcode.barcode,
        isPrimary: barcode.isPrimary,
        rowVersion: barcode.rowVersion ?? 0,
        createdAt: barcode.createdAt,
        updatedAt: barcode.updatedAt,
      };
    });
  }

  async update(
    id: string,
    dto: UpdateBarcodeDto,
    companyId: string,
    userId: string,
  ): Promise<any> {
    return this.prismaService.$transaction(async (tx) => {
      const existing = await this.inventoryRepository.findBarcodeById(
        id,
        companyId,
        tx,
      );
      if (!existing) throw new NotFoundException('Barcode not found');

      const data: Record<string, unknown> = {};
      if (dto.barcode !== undefined) {
        if (!this.validate(dto.barcode))
          throw new BadRequestException('Invalid barcode format');
        data.barcode = dto.barcode;
      }
      if (dto.isPrimary !== undefined) {
        if (dto.isPrimary) {
          await this.inventoryRepository.updateBarcodePrimaryFlag(
            existing.productId,
            false,
            tx,
          );
        }
        data.isPrimary = dto.isPrimary;
      }

      const result = await this.inventoryRepository.updateBarcode(
        id,
        data,
        dto.rowVersion,
        tx,
      );
      if (result === 0)
        throw new BadRequestException('Barcode was modified by another user');

      if (dto.isPrimary) {
        await this.inventoryRepository.updateProductPrimaryBarcode(
          existing.productId,
          dto.barcode ?? existing.barcode,
          tx,
        );
      }

      const updated = await this.inventoryRepository.findBarcodeById(
        id,
        companyId,
        tx,
      );
      if (!updated) throw new NotFoundException('Barcode not found');

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'ProductBarcode',
          entityId: id,
          action: 'UPDATE',
          before: { barcode: existing.barcode },
          after: { barcode: updated.barcode },
        },
        tx,
      );

      return {
        id: updated.id,
        productId: updated.productId,
        barcode: updated.barcode,
        isPrimary: updated.isPrimary,
        rowVersion: updated.rowVersion ?? 0,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });
  }

  async softDelete(
    id: string,
    companyId: string,
    rowVersion: number,
    userId: string,
  ): Promise<void> {
    return this.prismaService.$transaction(async (tx) => {
      const count = await this.inventoryRepository.softDeleteBarcode(
        id,
        companyId,
        rowVersion,
        tx,
      );
      if (count === 0) throw new NotFoundException('Barcode not found');

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'ProductBarcode',
          entityId: id,
          action: 'DELETE',
          before: { id },
          after: null,
        },
        tx,
      );
    });
  }
}
