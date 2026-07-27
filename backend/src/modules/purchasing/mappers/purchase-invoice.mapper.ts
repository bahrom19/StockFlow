import { PurchaseInvoice, PurchaseInvoiceItem } from '@prisma/client';
import {
  PurchaseInvoiceEntity,
  PurchaseInvoiceItemEntity,
} from '../entities/purchase-invoice.entity';

type DecimalValue = { toString(): string } | string | number | null | undefined;

function toMoney(value: DecimalValue): string {
  if (value == null) return '0.0000';
  return typeof value === 'string' ? value : value.toString();
}

function toMoneyNullable(value: DecimalValue): string | null {
  if (value == null) return null;
  return typeof value === 'string' ? value : value.toString();
}

export class PurchaseInvoiceMapper {
  static toItemEntity(item: PurchaseInvoiceItem): PurchaseInvoiceItemEntity {
    return {
      id: item.id,
      purchaseInvoiceId: item.purchaseInvoiceId,
      productId: item.productId,
      purchaseOrderItemId: item.purchaseOrderItemId,
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
    items: PurchaseInvoiceItem[],
  ): PurchaseInvoiceItemEntity[] {
    return items.map((i) => PurchaseInvoiceMapper.toItemEntity(i));
  }

  static toEntity(
    invoice: PurchaseInvoice & { items?: PurchaseInvoiceItem[] },
  ): PurchaseInvoiceEntity {
    return {
      id: invoice.id,
      companyId: invoice.companyId,
      purchaseOrderId: invoice.purchaseOrderId,
      supplierId: invoice.supplierId,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      subtotal: toMoney(invoice.subtotal),
      discountAmount: toMoney(invoice.discountAmount),
      taxAmount: toMoney(invoice.taxAmount),
      grandTotal: toMoney(invoice.grandTotal),
      paidAmount: toMoney(invoice.paidAmount),
      notes: invoice.notes,
      approvedBy: invoice.approvedBy,
      approvedAt: invoice.approvedAt,
      cancelledBy: invoice.cancelledBy,
      cancelledAt: invoice.cancelledAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
      deletedAt: invoice.deletedAt,
      items: invoice.items
        ? PurchaseInvoiceMapper.toItemEntityList(invoice.items)
        : undefined,
    };
  }

  static toEntityList(
    invoices: (PurchaseInvoice & { items?: PurchaseInvoiceItem[] })[],
  ): PurchaseInvoiceEntity[] {
    return invoices.map((i) => PurchaseInvoiceMapper.toEntity(i));
  }
}
