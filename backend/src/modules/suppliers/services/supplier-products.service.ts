import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Currency, Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { SuppliersRepository } from '../repositories/suppliers.repository';
import { SupplierProductsRepository } from '../repositories/supplier-products.repository';
import { SupplierProductEntity } from '../entities/supplier-product.entity';
import { CreateSupplierProductDto } from '../dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from '../dto/update-supplier-product.dto';
import { toSupplierProductEntity } from '../mappers/supplier-product.mapper';
import { CompaniesService } from '../../companies/services/companies.service';
import { SupplierProduct } from '@prisma/client';

// G1 (P3-04): bounded audit diff; notes is free-form user text and is
// never written to the audit trail.
type ProductAuditFields = Pick<
  SupplierProduct,
  'supplierId' | 'productId' | 'supplierSku' | 'purchasePrice' | 'currency' | 'isPreferred' | 'rowVersion'
>;

function productAuditFields(sp: SupplierProduct): ProductAuditFields {
  return {
    supplierId: sp.supplierId,
    productId: sp.productId,
    supplierSku: sp.supplierSku,
    purchasePrice: sp.purchasePrice,
    currency: sp.currency,
    isPreferred: sp.isPreferred,
    rowVersion: sp.rowVersion,
  };
}

/** G1 (P3-04): actor identity forwarded by the controller from the JWT. */
export interface SupplierProductActor {
  userId: string;
}

@Injectable()
export class SupplierProductsService {
  private readonly logger = new Logger(SupplierProductsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly suppliersRepo: SuppliersRepository,
    private readonly supplierProductsRepo: SupplierProductsRepository,
    private readonly companiesService: CompaniesService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async audit(
    action: string,
    entityId: string,
    before: ProductAuditFields | null,
    after: ProductAuditFields | null,
    actor: SupplierProductActor | undefined,
    companyId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    if (!actor) {
      // Actor is always provided by the controller; kept optional only so
      // legacy internal callers/tests without an actor stay compatible.
      return;
    }
    await this.auditLogService.log(
      {
        companyId,
        userId: actor.userId,
        entityType: 'SupplierProduct',
        entityId,
        action,
        before,
        after,
      },
      tx,
    );
  }

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
    actor?: SupplierProductActor,
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

    // 3. Validate currency == Company.currency
    const companyCurrency = await this.companiesService.getBaseCurrency(companyId);
    if (dto.currency && dto.currency !== companyCurrency) {
      throw new BadRequestException(
        `Currency ${dto.currency} does not match company currency ${companyCurrency}`,
      );
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
          currency: companyCurrency as Currency,
          isPreferred: dto.isPreferred ?? false,
          notes: dto.notes ?? null,
        },
        tx,
      );

      // G1 (P3-04): audit in the SAME transaction as the business write.
      await this.audit('supplier_product.create', sp.id, null, productAuditFields(sp), actor, companyId, tx);
      if (dto.isPreferred) {
        await this.audit('supplier_product.preferred_change', sp.id, null, productAuditFields(sp), actor, companyId, tx);
      }

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
    actor?: SupplierProductActor,
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

      // G1 (P3-04): audit in the SAME transaction as the business write.
      await this.audit('supplier_product.update', sp.id, productAuditFields(existing as unknown as SupplierProduct), productAuditFields(sp), actor, companyId, tx);
      if (dto.isPreferred === true && !existing.isPreferred) {
        await this.audit('supplier_product.preferred_change', sp.id, productAuditFields(existing as unknown as SupplierProduct), productAuditFields(sp), actor, companyId, tx);
      }

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
    actor?: SupplierProductActor,
  ): Promise<void> {
    const existing = await this.supplierProductsRepo.findById(
      id,
      companyId,
      supplierId,
    );
    if (!existing) {
      throw new NotFoundException(`Supplier product ${id} not found`);
    }

    // G1 (P3-04): tombstone + audit commit/roll back together.
    await this.prismaService.$transaction(async (tx) => {
      await this.supplierProductsRepo.softDelete(
        id,
        companyId,
        existing.rowVersion,
        tx,
      );
      await this.audit(
        'supplier_product.delete',
        id,
        productAuditFields(existing as unknown as SupplierProduct),
        null,
        actor,
        companyId,
        tx,
      );
    });

    this.logger.log(`SupplierProduct soft-deleted: ${id}`);
  }
}
