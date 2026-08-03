import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ProductQueryDto } from '../dto/product-query.dto';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductEntity } from '../entities/product.entity';
import { ProductMapper } from '../mappers/product.mapper';
import { ProductsRepository } from '../repositories/products.repository';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';

@Injectable()
export class ProductsService {
  constructor(private readonly productsRepository: ProductsRepository) {}

  async create(
    createProductDto: CreateProductDto,
    currentUser: JwtPayload,
  ): Promise<ProductEntity> {
    this.assertCompanyId(createProductDto.companyId, currentUser.companyId);

    // Resolve the unit of measure by name (find-or-create scoped to the
    // company) — the Product.unit field is a relation to UnitOfMeasure, so a
    // name like "kg" must be mapped to a unitId.
    let unitId: string | undefined;
    if (createProductDto.unit) {
      const unit = await this.productsRepository.findOrCreateUnitByName(
        createProductDto.unit,
        currentUser.companyId,
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
      );
      if (!targetWarehouse) {
        throw new UnprocessableEntityException(
          'Cannot persist stockQuantity: no active warehouse exists for this ' +
            'company. Create a warehouse first, or create the product without ' +
            'stockQuantity.',
        );
      }
    }

    const product = await this.productsRepository.create({
      name: createProductDto.name,
      description: createProductDto.description,
      sku: createProductDto.sku,
      barcode: createProductDto.barcode,
      price: createProductDto.price,
      costPrice: createProductDto.costPrice,
      unit: unitId ? { connect: { id: unitId } } : undefined,
      category: createProductDto.category,
      brand: createProductDto.brand,
      isActive: createProductDto.isActive ?? true,
      company: {
        connect: { id: currentUser.companyId },
      },
    });

    // Persist the initial stock quantity when requested, attributed to the
    // warehouse resolved above (default or first active one).
    let created: typeof product = product;
    if (targetWarehouse) {
      await this.productsRepository.createInitialStock({
        productId: product.id,
        warehouseId: targetWarehouse.id,
        companyId: currentUser.companyId,
        quantity: createProductDto.stockQuantity as number,
        userId: currentUser.userId,
      });
      // Re-read with relations so the response reflects the persisted stock.
      const refreshed = await this.productsRepository.findById(
        product.id,
        currentUser.companyId,
      );
      if (refreshed) created = refreshed;
    }

    return ProductMapper.toEntity(created);
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
    // stockQuantity and unit are managed via the inventory module,
    // not through product updates.
    delete updateData.stockQuantity;
    delete updateData.unit;
    const rowVer = existing.rowVersion ?? 0;
    const updatedProduct = await this.productsRepository.update(
      id,
      updateData,
      currentUser.companyId,
      rowVer,
    );

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
}
