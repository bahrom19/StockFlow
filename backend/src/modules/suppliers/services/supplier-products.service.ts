import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { SupplierProductsRepository } from '../repositories/supplier-products.repository';
import { SupplierProductEntity } from '../entities/supplier-product.entity';
import { CreateSupplierProductDto } from '../dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from '../dto/update-supplier-product.dto';
import { toSupplierProductEntity } from '../mappers/supplier-product.mapper';

@Injectable()
export class SupplierProductsService {
  private readonly logger = new Logger(SupplierProductsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly suppliersRepo: SuppliersRepository,
    private readonly supplierProductsRepo: SupplierProductsRepository,
  ) {}

  // ─────────────────────────────────────────────
  // LIST
  // ─────────────────────────────────────────────

  async findAll(
    supplierId: string,
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isPreferred?: boolean;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {},
  ): Promise<{
    items: SupplierProductEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const supplier = await this.suppliersRepo.findById(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    const page = options.page ?? 1;
    const limit = options.limit ?? 20;

    const { items, total } = await this.supplierProductsRepo.findMany(
      companyId,
      supplierId,
      { ...options, page, limit },
    );

    return {
      items: items.map(toSupplierProductEntity),
      total,
      page,
      limit,
    };
  }

  // ─────────────────────────────────────────────
  // GET BY ID
  // ─────────────────────────────────────────────

  async findById(
    id: string,
    supplierId: string,
    companyId: string,
  ): Promise<SupplierProductEntity> {
    const sp = await this.supplierProductsRepo.findById(id, companyId, supplierId);
    if (!sp) {
      throw new NotFoundException(`Supplier product ${id} not found`);
    }
    return toSupplierProductEntity(sp);
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────

  async create(
    supplierId: string,
    dto: CreateSupplierProductDto,
    companyId: string,
  ): Promise<SupplierProductEntity> {
    // 1. Validate supplier
    const supplier = await this.suppliersRepo.findById(supplierId, companyId);
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    // 2. Validate product belongs to company
    const product = await this.prismaService.product.findFirst({
      where: { id: dto.productId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    // 3. Validate currency (KZT only)
    if (dto.currency && dto.currency !== 'KZT') {
      throw new BadRequestException('Only KZT currency is supported');
    }

    // 4. Validate purchasePrice
    if (dto.purchasePrice !== undefined && dto.purchasePrice !== null && dto.purchasePrice <= 0) {
      throw new BadRequestException('Purchase price must be greater than zero');
    }

    // 5. Check duplicate active relation
    const existing = await this.supplierProductsRepo.findBySupplierAndProduct(
      supplierId,
      dto.productId,
      companyId,
    );
    if (existing) {
      throw new ConflictException(
        'This product is already linked to this supplier',
      );
    }

    return this.prismaService.$transaction(async (tx) => {
      // 6. Handle preferred switching
      if (dto.isPreferred) {
        await this.supplierProductsRepo.clearPreferred(
          dto.productId,
          companyId,
          undefined,
          tx,
        );
      }

      // 7. Create
      const sp = await this.supplierProductsRepo.create(
        {
          company: { connect: { id: companyId } },
          supplier: { connect: { id: supplierId } },
          product: { connect: { id: dto.productId } },
          supplierSku: dto.supplierSku ?? null,
          purchasePrice: dto.purchasePrice?.toString() ?? null,
          currency: dto.currency ?? 'KZT',
          isPreferred: dto.isPreferred ?? false,
          notes: dto.notes ?? null,
        },
        tx,
      );

      this.logger.log(
        `SupplierProduct created: supplier=${supplierId} product=${dto.productId}`,
      );

      return toSupplierProductEntity(sp);
    });
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────

  async update(
    id: string,
    supplierId: string,
    companyId: string,
    dto: UpdateSupplierProductDto,
  ): Promise<SupplierProductEntity> {
    // 1. Verify existing
    const existing = await this.supplierProductsRepo.findById(
      id,
      companyId,
      supplierId,
    );
    if (!existing) {
      throw new NotFoundException(`Supplier product ${id} not found`);
    }

    // 2. Validate purchasePrice
    if (dto.purchasePrice !== undefined && dto.purchasePrice !== null && dto.purchasePrice <= 0) {
      throw new BadRequestException('Purchase price must be greater than zero');
    }

    return this.prismaService.$transaction(async (tx) => {
      // 3. Handle preferred switching
      if (dto.isPreferred === true && !existing.isPreferred) {
        await this.supplierProductsRepo.clearPreferred(
          existing.productId,
          companyId,
          id,
          tx,
        );
      }

      // 4. Update with rowVersion CAS
      const updateData: Prisma.SupplierProductUpdateInput = {};
      if (dto.supplierSku !== undefined) updateData.supplierSku = dto.supplierSku;
      if (dto.purchasePrice !== undefined) {
        updateData.purchasePrice = dto.purchasePrice?.toString() ?? null;
      }
      if (dto.isPreferred !== undefined) updateData.isPreferred = dto.isPreferred;
      if (dto.notes !== undefined) updateData.notes = dto.notes;

      const sp = await this.supplierProductsRepo.update(
        id,
        companyId,
        updateData,
        existing.rowVersion,
        tx,
      );

      return toSupplierProductEntity(sp);
    });
  }

  // ─────────────────────────────────────────────
  // DELETE (soft)
  // ─────────────────────────────────────────────

  async remove(
    id: string,
    supplierId: string,
    companyId: string,
  ): Promise<void> {
    const existing = await this.supplierProductsRepo.findById(
      id,
      companyId,
      supplierId,
    );
    if (!existing) {
      throw new NotFoundException(`Supplier product ${id} not found`);
    }

    await this.supplierProductsRepo.softDelete(
      id,
      companyId,
      existing.rowVersion,
    );

    this.logger.log(`SupplierProduct soft-deleted: ${id}`);
  }
}
