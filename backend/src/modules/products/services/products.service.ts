import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { ProductQueryDto } from '../dto/product-query.dto';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { SetCostPriceDto } from '../dto/set-cost-price.dto';
import { ProductEntity } from '../entities/product.entity';
import { ProductMapper } from '../mappers/product.mapper';
import { ProductsRepository } from '../repositories/products.repository';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../../../common/prisma';
import { IdempotencyService } from '../../../infrastructure/idempotency/idempotency.service';
import { runWithIdempotency } from '../../../infrastructure/idempotency/idempotency.helper';
import { GlEngineService } from '../../finance/services/gl-engine.service';
// Reused so PATCH /products/:id with stockQuantity goes through the SAME
// adjustment mechanism as POST /inventory/stock/adjust (ADJUSTMENT ledger
// movement, strict no-negative-stock policy, cost layer sync) instead of a
// parallel direct write to the Stock table.
import { StockService } from '../../inventory/services';
import { CostingService } from '../../inventory/services';
import { AuditLogService } from '../../shared/services/audit-log.service';

/**
 * Normalize a product identifier (SKU / barcode):
 *  - trim whitespace
 *  - collapse empty/whitespace-only to null
 *  - preserve original casing
 */
function normalizeProductIdentifier(
  value: string | null | undefined,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly productsRepository: ProductsRepository,
    private readonly stockService: StockService,
    private readonly prismaService: PrismaService,
    private readonly idempotencyService: IdempotencyService,
    private readonly glEngine: GlEngineService,
    private readonly costingService: CostingService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async create(
    createProductDto: CreateProductDto,
    currentUser: JwtPayload,
    idempotencyKey?: string,
  ): Promise<ProductEntity> {
    // G15-05-C: product creation (including opening stock) runs inside one
    // idempotent transaction so a timeout/retry never duplicates the product,
    // the opening stock, its cost layer or its GL posting.
    const result = await runWithIdempotency({
      prisma: this.prismaService,
      idempotency: this.idempotencyService,
      companyId: currentUser.companyId,
      idempotencyKey,
      endpoint: 'product-create',
      requestHashPayload: { ...createProductDto, userId: currentUser.userId },
      status: HttpStatus.CREATED,
      work: (tx) => this.applyCreateProduct(createProductDto, currentUser, tx),
    });
    return result.body as ProductEntity;
  }

  private async applyCreateProduct(
    createProductDto: CreateProductDto,
    currentUser: JwtPayload,
    tx: Prisma.TransactionClient,
  ): Promise<ProductEntity> {
    this.assertCompanyId(createProductDto.companyId, currentUser.companyId);

    // Normalize SKU and barcode: trim whitespace, collapse empty to null.
    const sku = normalizeProductIdentifier(createProductDto.sku);
    const barcode = normalizeProductIdentifier(createProductDto.barcode);

    // Application-level duplicate pre-check (DB unique index is the safety net
    // for race conditions, but this provides a user-friendly error message).
    if (sku) {
      const conflict =
        await this.productsRepository.findActiveBySkuAndCompany(
          sku,
          currentUser.companyId,
          undefined,
          tx,
        );
      if (conflict) {
        throw new ConflictException(
          `A product with SKU "${sku}" already exists (${conflict.name}).`,
        );
      }
    }
    if (barcode) {
      const conflict =
        await this.productsRepository.findActiveByBarcodeAndCompany(
          barcode,
          currentUser.companyId,
          undefined,
          tx,
        );
      if (conflict) {
        throw new ConflictException(
          `A product with barcode "${barcode}" already exists (${conflict.name}).`,
        );
      }
    }

    // Resolve the unit of measure by name (find-or-create scoped to the
    // company) — the Product.unit field is a relation to UnitOfMeasure, so a
    // name like "kg" must be mapped to a unitId.
    let unitId: string | undefined;
    if (createProductDto.unit) {
      const unit = await this.productsRepository.findOrCreateUnitByName(
        createProductDto.unit,
        currentUser.companyId,
        tx,
      );
      unitId = unit.id;
    }

    // Resolve the target warehouse BEFORE creating the product so we can fail
    // fast when an initial stock is requested but no warehouse exists — instead
    // of silently dropping the quantity (previously data was lost: the Product
    // was created, the Stock row never was). Stock is tracked per warehouse
    // (Stock.warehouseId is a required FK), so an explicit stockQuantity has no
    // home without a warehouse.
    let targetWarehouse: { id: string } | null = null;
    if (createProductDto.stockQuantity && createProductDto.stockQuantity > 0) {
      targetWarehouse = await this.productsRepository.findDefaultWarehouse(
        currentUser.companyId,
        tx,
      );
      if (!targetWarehouse) {
        throw new UnprocessableEntityException(
          'Cannot persist stockQuantity: no active warehouse exists for this ' +
            'company. Create a warehouse first, or create the product without ' +
            'stockQuantity.',
        );
      }
    }

    const product = await this.productsRepository.create(
      {
        name: createProductDto.name,
        description: createProductDto.description,
        sku,
        barcode,
        ntin: createProductDto.ntin,
        price: createProductDto.price,
        costPrice: createProductDto.costPrice,
        unit: unitId ? { connect: { id: unitId } } : undefined,
        category: createProductDto.category,
        brand: createProductDto.brand,
        isActive: createProductDto.isActive ?? true,
        company: {
          connect: { id: currentUser.companyId },
        },
      },
      tx,
    );

    // Persist the initial stock quantity when requested, attributed to the
    // warehouse resolved above (default or first active one). G15-05-B: stock,
    // movement, cost layer and opening GL post in this SAME transaction.
    let created: typeof product = product;
    if (targetWarehouse) {
      await this.applyOpeningStock(
        product.id,
        targetWarehouse.id,
        currentUser,
        createProductDto.stockQuantity as number,
        createProductDto.costPrice,
        tx,
      );
      // Re-read with relations so the response reflects the persisted stock.
      const refreshed = await this.productsRepository.findById(
        product.id,
        currentUser.companyId,
        tx,
      );
      if (refreshed) created = refreshed;
    }

    return ProductMapper.toEntity(created);
  }

  /**
   * G15-05-B: recognize opening inventory for a newly created product.
   * Uniform semantics — initial stock supplied without a purchase document is
   * an Opening Balance event regardless of company age. Stock + movement are
   * always written; CostLayer + GL (Dr 1300 / Cr 3000 Opening Balance Equity)
   * require a costPrice basis, otherwise they are explicitly skipped (never
   * invented). A missing 3000 account fails closed — never falls back to 5100.
   */
  private async applyOpeningStock(
    productId: string,
    warehouseId: string,
    currentUser: JwtPayload,
    quantity: number,
    costPrice: number | string | undefined,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const companyId = currentUser.companyId;

    const existing = await tx.stock.findFirst({
      where: { productId, warehouseId, companyId },
    });
    const beforeQuantity = existing?.quantity ?? 0;

    await tx.stock.upsert({
      where: {
        productId_warehouseId: { productId, warehouseId },
      },
      create: {
        companyId,
        productId,
        warehouseId,
        quantity,
        reservedQuantity: 0,
        availableQuantity: quantity,
      },
      update: {
        quantity: { increment: quantity },
        availableQuantity: { increment: quantity },
      },
    });

    await tx.stockMovement.create({
      data: {
        companyId,
        productId,
        warehouseId,
        type: 'OPENING_BALANCE',
        quantity,
        beforeQuantity,
        afterQuantity: beforeQuantity + quantity,
        referenceType: 'PRODUCT',
        referenceId: productId,
        comment: 'Initial stock on product creation',
        createdBy: currentUser.userId,
      },
    });

    // G16-H-1: opening stock must not create unvalued positive stock.
    // costPrice NULL/undefined = NO basis → typed failure inside this tx
    // (Stock/StockMovement above roll back together with the product).
    // Decimal(0) is a legitimate zero-cost basis: Stock + Movement are kept,
    // no valued layer/GL is written (zero-amount valuation — consistent with
    // the adjustment/count paths and the GL zero-amount observable-skip).
    if (quantity > 0 && (costPrice === undefined || costPrice === null)) {
      throw new BadRequestException(
        'Opening stock requires a cost basis: set costPrice or create the product without stockQuantity.',
      );
    }

    if (costPrice === undefined || costPrice === null) return;

    const unitCost = new Decimal(costPrice);
    const amount = unitCost.mul(quantity);
    if (amount.isZero()) return;

    await this.costingService.recordInboundLayer(
      productId,
      companyId,
      quantity,
      unitCost,
      'OPENING_BALANCE',
      productId,
      undefined,
      tx,
    );

    const inventoryAccount = await tx.chartOfAccount.findFirst({
      where: { companyId, code: '1300', isActive: true, deletedAt: null },
      select: { id: true },
    });
    const obeAccount = await tx.chartOfAccount.findFirst({
      where: { companyId, code: '3000', isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!inventoryAccount || !obeAccount) {
      throw new BadRequestException(
        'Opening Balance Equity account (3000) is required to recognize ' +
          'opening inventory. Create the account first, or create the ' +
          'product without stockQuantity.',
      );
    }

    const openPeriod = await tx.financialPeriod.findFirst({
      where: { companyId, status: 'OPEN' },
      orderBy: { startDate: 'desc' },
      select: { id: true },
    });
    if (!openPeriod) {
      throw new BadRequestException(
        'No open financial period found for opening inventory. ' +
          'A GL posting requires an OPEN period.',
      );
    }

    await this.glEngine.post(
      {
        companyId,
        financialPeriodId: openPeriod.id,
        entryDate: new Date(),
        description: `Opening inventory for product ${productId}`,
        referenceType: 'OPENING_BALANCE',
        referenceId: productId,
        createdBy: currentUser.userId,
        lines: [
          {
            accountId: inventoryAccount.id,
            debit: amount.toString(),
            credit: '0',
            description: `Opening inventory: ${productId}`,
          },
          {
            accountId: obeAccount.id,
            debit: '0',
            credit: amount.toString(),
            description: `Opening balance equity: ${productId}`,
          },
        ],
      },
      tx,
    );
  }

  async findAll(
    query: ProductQueryDto,
    currentUser: JwtPayload,
  ): Promise<{
    items: ProductEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (page < 1 || limit < 1) {
      throw new BadRequestException('Page and limit must be positive integers');
    }

    const result = await this.productsRepository.findAll({
      companyId: currentUser.companyId,
      search: query.search,
      name: query.name,
      sku: query.sku,
      barcode: query.barcode,
      ntin: query.ntin,
      category: query.category,
      isActive: query.isActive,
      page,
      limit,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    });

    return {
      items: ProductMapper.toEntityList(result.items),
      total: result.total,
      page,
      limit,
    };
  }

  async findById(id: string, currentUser: JwtPayload): Promise<ProductEntity> {
    const product = await this.productsRepository.findById(
      id,
      currentUser.companyId,
    );

    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    return ProductMapper.toEntity(product);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    currentUser: JwtPayload,
  ): Promise<ProductEntity> {
    const existing = await this.productsRepository.findById(
      id,
      currentUser.companyId,
    );
    if (!existing) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }

    // Normalize SKU and barcode if provided.
    const sku = normalizeProductIdentifier(updateProductDto.sku);
    const barcode = normalizeProductIdentifier(updateProductDto.barcode);

    // Application-level duplicate pre-check for SKU (skip if unchanged or null).
    if (sku !== undefined && sku !== existing.sku) {
      if (sku) {
        const conflict =
          await this.productsRepository.findActiveBySkuAndCompany(
            sku,
            currentUser.companyId,
            id, // exclude self
          );
        if (conflict) {
          throw new ConflictException(
            `A product with SKU "${sku}" already exists (${conflict.name}).`,
          );
        }
      }
    }

    // Application-level duplicate pre-check for barcode (skip if unchanged or null).
    if (barcode !== undefined && barcode !== existing.barcode) {
      if (barcode) {
        const conflict =
          await this.productsRepository.findActiveByBarcodeAndCompany(
            barcode,
            currentUser.companyId,
            id, // exclude self
          );
        if (conflict) {
          throw new ConflictException(
            `A product with barcode "${barcode}" already exists (${conflict.name}).`,
          );
        }
      }
    }

    // Build the update payload from only the fields the client actually sent.
    // class-transformer materializes unset DTO fields as `undefined`; passing
    // them through would turn `price: undefined` into `price: null` inside
    // normalizeDecimalPayload, breaking partial updates with a Prisma
    // "Argument price must not be null" error.
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updateProductDto)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }
    // unit is managed via the inventory module's UoM endpoints, not through
    // product updates.
    delete updateData.unit;

    // Apply normalized SKU/barcode to the update payload.
    if ('sku' in updateData) {
      updateData.sku = sku;
    }
    if ('barcode' in updateData) {
      updateData.barcode = barcode;
    }

    // stockQuantity is NOT a Product column — stock lives in the Stock table
    // (per warehouse) and every change must produce a StockMovement ledger
    // entry. When the client explicitly sends a quantity we reconcile the
    // current total across warehouses to the requested value through the
    // EXISTING adjustment mechanism (StockService.adjustStock), which writes
    // an ADJUSTMENT movement, keeps cost layers/finance in sync and enforces
    // the strict no-negative-stock policy. Omitting the field leaves stock
    // untouched (partial update semantics, same as name/sku/barcode/ntin).
    let adjusted = false;
    if (updateProductDto.stockQuantity !== undefined) {
      // findById includes the per-warehouse stock rows (PRODUCT_INCLUDE);
      // the declared Prisma Product type just does not surface them.
      const stocks = (
        existing as unknown as { stocks?: { quantity?: number | null }[] }
      ).stocks;
      const currentTotal = Array.isArray(stocks)
        ? stocks.reduce((sum, s) => sum + (s?.quantity ?? 0), 0)
        : 0;
      const delta = updateProductDto.stockQuantity - currentTotal;

      if (delta !== 0) {
        // Resolve the warehouse BEFORE any write so an absent warehouse fails
        // the whole request without a partial save (same fail-fast contract
        // and message as create()).
        const targetWarehouse =
          await this.productsRepository.findDefaultWarehouse(
            currentUser.companyId,
          );
        if (!targetWarehouse) {
          throw new UnprocessableEntityException(
            'Cannot persist stockQuantity: no active warehouse exists for ' +
              'this company. Create a warehouse first.',
          );
        }

        await this.stockService.adjustStock(
          {
            productId: id,
            warehouseId: targetWarehouse.id,
            quantity: delta,
            referenceType: 'PRODUCT',
            referenceId: id,
            comment: 'Stock reconciled from product card edit',
          },
          currentUser.companyId,
          currentUser.userId,
        );
        adjusted = true;
      }
      // The raw field must never reach Prisma — Product has no such column.
      delete updateData.stockQuantity;
    }

    const rowVer = existing.rowVersion ?? 0;
    const updatedProduct = await this.productsRepository.update(
      id,
      updateData,
      currentUser.companyId,
      rowVer,
    );

    // After an adjustment the nested stocks snapshot inside updatedProduct is
    // stale (it was read during the product-row update), so re-read to return
    // the fresh total — same response contract as create().
    if (adjusted) {
      const refreshed = await this.productsRepository.findById(
        id,
        currentUser.companyId,
      );
      if (refreshed) {
        return ProductMapper.toEntity(refreshed);
      }
    }

    return ProductMapper.toEntity(updatedProduct);
  }

  /**
   * Ensures an optional client-supplied companyId (kept for backward
   * compatibility with existing clients) matches the authenticated tenant.
   * The tenant is always derived from the JWT, never from the request body.
   */
  private assertCompanyId(
    bodyCompanyId: string | undefined,
    jwtCompanyId: string,
  ): void {
    if (bodyCompanyId && bodyCompanyId !== jwtCompanyId) {
      throw new BadRequestException(
        'companyId does not match the authenticated company',
      );
    }
  }

  async softDelete(
    id: string,
    currentUser: JwtPayload,
  ): Promise<ProductEntity> {
    const existing = await this.productsRepository.findById(
      id,
      currentUser.companyId,
    );
    if (!existing) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    const rowVer = existing.rowVersion ?? 0;
    const deletedProduct = await this.productsRepository.softDelete(
      id,
      currentUser.companyId,
      rowVer,
    );

    return ProductMapper.toEntity(deletedProduct);
  }

  /**
   * G16-H-2 (B4): manual cost-price reconciliation for a currently unvalued
   * product. Sets Product.costPrice (NULL -> explicit value, Decimal(0)
   * allowed) with an AuditLog record in the SAME transaction. No accounting
   * side effects: no CostLayer, no Stock/StockMovement writes, no GL, no
   * events — future valuation relies on the existing FALLBACK B safety net.
   * Idempotency: repeat with the same value is a no-op (no AuditLog); a
   * different value over an existing non-NULL costPrice is a 409 (no
   * overwrite, no override mechanism). Row-version CAS prevents lost
   * updates under concurrency.
   */
  async remediateCostPrice(
    productId: string,
    dto: SetCostPriceDto,
    currentUser: JwtPayload,
  ): Promise<ProductEntity> {
    const companyId = currentUser.companyId;
    const userId = currentUser.userId;

    // Decimal-safe parsing: malformed/NaN/Infinity/negative are rejected;
    // zero is a VALID explicit zero-cost basis (no truthiness shortcuts).
    let parsed: Decimal;
    try {
      parsed = new Decimal(dto.costPrice as string | number);
    } catch {
      throw new BadRequestException('costPrice must be a valid decimal number');
    }
    if (!parsed.isFinite()) {
      throw new BadRequestException('costPrice must be a finite number');
    }
    if (parsed.isNegative()) {
      throw new BadRequestException('costPrice must not be negative');
    }

    return this.prismaService.$transaction(async (tx) => {
      // Tenant-scoped lookup: id + companyId + not deleted (404 otherwise).
      const product = await this.productsRepository.findById(
        productId,
        companyId,
        tx,
      );
      if (!product) {
        throw new NotFoundException(`Product with id ${productId} not found`);
      }

      // Class B safety: an existing costPrice is never silently overwritten.
      // (Explicit null checks only — Decimal(0) is a legitimate value.)
      if (product.costPrice !== null && product.costPrice !== undefined) {
        const existingCost = new Decimal(product.costPrice.toString());
        if (existingCost.eq(parsed)) {
          // Idempotent no-op: nothing changed, no AuditLog.
          return ProductMapper.toEntity(product);
        }
        throw new ConflictException(
          `Product ${productId} already has a cost price. Use the regular product update flow to change it.`,
        );
      }

      // Row-version CAS convention: pass the loaded rowVersion explicitly.
      const rowVersion = product.rowVersion ?? 0;
      const updated = await this.productsRepository.update(
        productId,
        { costPrice: parsed } as Prisma.ProductUpdateInput,
        companyId,
        rowVersion,
        tx,
      );

      await this.auditLogService.log(
        {
          companyId,
          userId,
          entityType: 'Product',
          entityId: productId,
          action: 'PRODUCT_COST_PRICE_REMEDIATION',
          before: { costPrice: null },
          after: {
            costPrice: parsed.toString(),
            reason: dto.reason,
            remediation: 'B4_MANUAL',
          },
        },
        tx,
      );

      return ProductMapper.toEntity(updated);
    });
  }
}
