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
      ntin: product.ntin ?? null,
      price: this.toMoneyValue(product.price),
      costPrice: this.toMoneyValue(product.costPrice),
      // The unit relation is included on product reads; expose the unit NAME
      // ("kg") rather than the raw unitId UUID.
      unit: product.unit?.name ?? null,
      category: product.category,
      brand: product.brand,
      // Sum across warehouses — Product has no stockQuantity column; stock is
      // tracked in the Stock table (relation included on reads).
      stockQuantity: Array.isArray(product.stocks)
        ? product.stocks.reduce(
            (sum: number, s: { quantity?: number | null }) =>
              sum + (s?.quantity ?? 0),
            0,
          )
        : 0,
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
