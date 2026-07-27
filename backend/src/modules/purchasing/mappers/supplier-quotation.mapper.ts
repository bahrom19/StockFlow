import { SupplierQuotation, SupplierQuotationItem } from '@prisma/client';
import {
  SupplierQuotationEntity,
  SupplierQuotationItemEntity,
} from '../entities/supplier-quotation.entity';

type DecimalValue = { toString(): string } | string | number | null | undefined;

function toMoney(value: DecimalValue): string {
  if (value == null) return '0.0000';
  return typeof value === 'string' ? value : value.toString();
}

function toMoneyNullable(value: DecimalValue): string | null {
  if (value == null) return null;
  return typeof value === 'string' ? value : value.toString();
}

export class SupplierQuotationMapper {
  static toItemEntity(
    item: SupplierQuotationItem,
  ): SupplierQuotationItemEntity {
    return {
      id: item.id,
      supplierQuotationId: item.supplierQuotationId,
      productId: item.productId,
      quantity: item.quantity,
      unitCost: toMoney(item.unitCost),
      discountPercent: toMoneyNullable(item.discountPercent),
      discountAmount: toMoney(item.discountAmount),
      taxPercent: toMoneyNullable(item.taxPercent),
      taxAmount: toMoney(item.taxAmount),
      subtotal: toMoney(item.subtotal),
      total: toMoney(item.total),
      notes: item.notes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  static toItemEntityList(
    items: SupplierQuotationItem[],
  ): SupplierQuotationItemEntity[] {
    return items.map((i) => SupplierQuotationMapper.toItemEntity(i));
  }

  static toEntity(
    q: SupplierQuotation & { items?: SupplierQuotationItem[] },
  ): SupplierQuotationEntity {
    return {
      id: q.id,
      companyId: q.companyId,
      rfqId: q.rfqId,
      supplierId: q.supplierId,
      quotationNumber: q.quotationNumber,
      quotationDate: q.quotationDate,
      validUntil: q.validUntil,
      status: q.status,
      subtotal: toMoney(q.subtotal),
      discountAmount: toMoney(q.discountAmount),
      taxAmount: toMoney(q.taxAmount),
      grandTotal: toMoney(q.grandTotal),
      notes: q.notes,
      acceptedAt: q.acceptedAt,
      rejectedAt: q.rejectedAt,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
      deletedAt: q.deletedAt,
      items: q.items
        ? SupplierQuotationMapper.toItemEntityList(q.items)
        : undefined,
    };
  }

  static toEntityList(
    quotations: (SupplierQuotation & { items?: SupplierQuotationItem[] })[],
  ): SupplierQuotationEntity[] {
    return quotations.map((q) => SupplierQuotationMapper.toEntity(q));
  }
}
