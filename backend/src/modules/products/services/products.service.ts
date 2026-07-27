import {
  BadRequestException,
  Injectable,
  NotFoundException,
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
    const product = await this.productsRepository.create({
      name: createProductDto.name,
      description: createProductDto.description,
      sku: createProductDto.sku,
      barcode: createProductDto.barcode,
      price: createProductDto.price,
      costPrice: createProductDto.costPrice,
      category: createProductDto.category,
      brand: createProductDto.brand,
      isActive: createProductDto.isActive ?? true,
      company: {
        connect: { id: currentUser.companyId },
      },
    });

    return ProductMapper.toEntity(product);
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, unknown> = { ...updateProductDto };
    delete updateData.stockQuantity;
    if (updateData.unit !== undefined) {
      delete updateData.unit;
    }
    const rowVer = existing.rowVersion ?? 0;
    const updatedProduct = await this.productsRepository.update(
      id,
      updateData,
      currentUser.companyId,
      rowVer,
    );

    return ProductMapper.toEntity(updatedProduct);
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
