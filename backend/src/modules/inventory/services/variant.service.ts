import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { InventoryRepository } from '../repositories/inventory.repository';

export class CreateVariantDto {
  productId!: string;
  sku?: string;
  barcode?: string;
  name!: string;
  price!: string;
  costPrice?: string;
  attributes?: Record<string, any>;
  isActive?: boolean;
}

export class UpdateVariantDto {
  sku?: string;
  barcode?: string;
  name?: string;
  price?: string;
  costPrice?: string;
  attributes?: Record<string, any>;
  isActive?: boolean;
  rowVersion!: number;
}

@Injectable()
export class VariantService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly prismaService: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async findByProduct(productId: string, companyId: string): Promise<any[]> {
    const variants = await this.inventoryRepository.findVariantsByProduct(
      productId,
      companyId,
    );
    return variants.map((v: any) => ({
      id: v.id,
      productId: v.productId,
      sku: v.sku,
      barcode: v.barcode,
      name: v.name,
      price: (v.price as unknown as Decimal).toString(),
      costPrice: v.costPrice
        ? (v.costPrice as unknown as Decimal).toString()
        : null,
      attributes: v.attributes,
      isActive: v.isActive,
      rowVersion: (v as Record<string, any>).rowVersion ?? 0,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));
  }

  async generateSku(
    productId: string,
    companyId: string,
  ): Promise<{ sku: string }> {
    const product = await this.inventoryRepository.findProductById(
      productId,
      companyId,
    );
    if (!product) throw new NotFoundException('Product not found');

    const count =
      await this.inventoryRepository.countVariantsByProduct(productId);
    const sku = `VAR-${productId.slice(0, 8)}-${count + 1}`;
    return { sku };
  }

  async create(
    dto: CreateVariantDto,
    companyId: string,
    userId: string,
  ): Promise<any> {
    const product = await this.inventoryRepository.findProductById(
      dto.productId,
      companyId,
    );
    if (!product) throw new NotFoundException('Product not found');

    return this.prismaService.$transaction(async (tx) => {
      const variant = await this.inventoryRepository.createVariant(
        {
          product: { connect: { id: dto.productId } },
          sku: dto.sku ?? null,
          barcode: dto.barcode ?? null,
          name: dto.name,
          price: new Decimal(dto.price),
          costPrice: dto.costPrice ? new Decimal(dto.costPrice) : null,
          attributes: dto.attributes ?? undefined,
          isActive: dto.isActive ?? true,
        } as Prisma.ProductVariantCreateInput,
        tx,
      );

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'ProductVariant',
          entityId: variant.id,
          action: 'CREATE',
          before: null,
          after: { id: variant.id, name: variant.name, sku: variant.sku },
        },
        tx,
      );

      return {
        id: variant.id,
        productId: variant.productId,
        sku: variant.sku,
        barcode: variant.barcode,
        name: variant.name,
        price: variant.price.toString(),
        costPrice: variant.costPrice?.toString() ?? null,
        attributes: variant.attributes,
        isActive: variant.isActive,
        rowVersion: (variant as Record<string, any>).rowVersion ?? 0,
        createdAt: variant.createdAt,
        updatedAt: variant.updatedAt,
      };
    });
  }

  async update(
    id: string,
    dto: UpdateVariantDto,
    companyId: string,
    userId: string,
  ): Promise<any> {
    return this.prismaService.$transaction(async (tx) => {
      const variant = await this.inventoryRepository.findVariantById(id, tx);
      if (!variant) throw new NotFoundException('Variant not found');

      // Verify company ownership
      const product = await this.inventoryRepository.findProductById(
        variant.productId,
        companyId,
        tx,
      );
      if (!product) throw new NotFoundException('Variant not found');

      const data: Record<string, unknown> = {};
      if (dto.sku !== undefined) data.sku = dto.sku;
      if (dto.barcode !== undefined) data.barcode = dto.barcode;
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.price !== undefined) data.price = new Decimal(dto.price);
      if (dto.costPrice !== undefined)
        data.costPrice = new Decimal(dto.costPrice);
      if (dto.attributes !== undefined) data.attributes = dto.attributes;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;

      const result = await this.inventoryRepository.updateVariant(
        id,
        data,
        dto.rowVersion,
        tx,
      );
      if (result === 0)
        throw new BadRequestException('Variant was modified by another user');

      const updated = await this.inventoryRepository.findVariantById(id, tx);
      if (!updated) throw new NotFoundException('Variant not found');

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'ProductVariant',
          entityId: id,
          action: 'UPDATE',
          before: { name: variant.name },
          after: { name: updated.name },
        },
        tx,
      );

      return {
        id: updated.id,
        productId: updated.productId,
        sku: updated.sku,
        barcode: updated.barcode,
        name: updated.name,
        price: updated.price.toString(),
        costPrice: updated.costPrice?.toString() ?? null,
        attributes: updated.attributes,
        isActive: updated.isActive,
        rowVersion: (updated as Record<string, any>).rowVersion ?? 0,
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
      const count = await this.inventoryRepository.softDeleteVariant(
        id,
        companyId,
        rowVersion,
        tx,
      );
      if (count === 0) throw new NotFoundException('Variant not found');

      await this.auditLog.log(
        {
          companyId,
          userId,
          entityType: 'ProductVariant',
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
