import { SupplierProduct } from '@prisma/client';
import { SupplierProductEntity } from '../entities/supplier-product.entity';

type SupplierProductWithProduct = SupplierProduct & { product: { id: string; name: string; sku: string | null } };

function toMoney(value: unknown): string | null {
  return value == null ? null : String(value);
}

export function toSupplierProductEntity(
  sp: SupplierProductWithProduct,
): SupplierProductEntity {
  return {
    id: sp.id,
    companyId: sp.companyId,
    supplierId: sp.supplierId,
    productId: sp.productId,
    supplierSku: sp.supplierSku,
    purchasePrice: toMoney(sp.purchasePrice),
    currency: sp.currency,
    isPreferred: sp.isPreferred,
    notes: sp.notes,
    lastPurchaseAt: sp.lastPurchaseAt,
    rowVersion: sp.rowVersion,
    createdAt: sp.createdAt,
    updatedAt: sp.updatedAt,
    deletedAt: sp.deletedAt,
    product: {
      id: sp.product.id,
      name: sp.product.name,
      sku: sp.product.sku,
    },
  };
}
