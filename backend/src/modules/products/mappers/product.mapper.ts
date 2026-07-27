import { Product } from '@prisma/client';
import { ProductEntity } from '../entities/product.entity';

export class ProductMapper {
  private static toMoneyValue(value: any): string | null {
    if (!value) return null;
    return value.toString();
  }

  static toEntity(product: any): ProductEntity {
    return {
      id: product.id,
      companyId: product.companyId,
      name: product.name,
      description: product.description,
      sku: product.sku,
      barcode: product.barcode,
      price: this.toMoneyValue(product.price),
      costPrice: this.toMoneyValue(product.costPrice),
      unit: product.unitId ?? product.unit ?? null,
      category: product.category,
      brand: product.brand,
      stockQuantity: 0,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      deletedAt: product.deletedAt,
    };
  }

  static toEntityList(products: any[]): ProductEntity[] {
    return products.map((product) => this.toEntity(product));
  }
}
