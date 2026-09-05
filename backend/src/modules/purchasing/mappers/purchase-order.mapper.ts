import {
  GoodsReceipt,
  GoodsReceiptItem,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseReturn,
  PurchaseReturnItem,
} from '@prisma/client';
import {
  GoodsReceiptEntity,
  GoodsReceiptItemEntity,
} from '../entities/goods-receipt.entity';
import {
  PurchaseOrderEntity,
  PurchaseOrderItemEntity,
} from '../entities/purchase-order.entity';
import {
  PurchaseReturnEntity,
  PurchaseReturnItemEntity,
} from '../entities/purchase-return.entity';

type DecimalValue = { toString(): string } | string | number | null | undefined;

function toMoney(value: DecimalValue): string {
  if (value == null) return '0.0000';
  return typeof value === 'string' ? value : value.toString();
}

function toMoneyNullable(value: DecimalValue): string | null {
  if (value == null) return null;
  return typeof value === 'string' ? value : value.toString();
}

export class PurchaseOrderMapper {
  static toItemEntity(item: PurchaseOrderItem): PurchaseOrderItemEntity {
    return {
      id: item.id,
      purchaseOrderId: item.purchaseOrderId,
      productId: item.productId,
      quantity: item.quantity,
      receivedQuantity: item.receivedQuantity,
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
    items: PurchaseOrderItem[],
  ): PurchaseOrderItemEntity[] {
    return items.map((i) => PurchaseOrderMapper.toItemEntity(i));
  }

  static toEntity(
    order: PurchaseOrder & { items?: PurchaseOrderItem[] },
  ): PurchaseOrderEntity {
    return {
      id: order.id,
      companyId: order.companyId,
      supplierId: order.supplierId,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      expectedDate: order.expectedDate,
      status: order.status,
      subtotal: toMoney(order.subtotal),
      discountAmount: toMoney(order.discountAmount),
      taxAmount: toMoney(order.taxAmount),
      grandTotal: toMoney(order.grandTotal),
      paidAmount: toMoney(order.paidAmount),
      currency: order.currency,
      notes: order.notes,
      approvedBy: order.approvedBy,
      approvedAt: order.approvedAt,
      cancelledBy: order.cancelledBy,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      deletedAt: order.deletedAt,
      items: order.items
        ? PurchaseOrderMapper.toItemEntityList(order.items)
        : undefined,
    };
  }

  static toEntityList(
    orders: (PurchaseOrder & { items?: PurchaseOrderItem[] })[],
  ): PurchaseOrderEntity[] {
    return orders.map((o) => PurchaseOrderMapper.toEntity(o));
  }
}

export class GoodsReceiptMapper {
  static toItemEntity(item: GoodsReceiptItem): GoodsReceiptItemEntity {
    return {
      id: item.id,
      goodsReceiptId: item.goodsReceiptId,
      purchaseOrderItemId: item.purchaseOrderItemId,
      productId: item.productId,
      quantity: item.quantity,
      unitCost: toMoney(item.unitCost),
      subtotal: toMoney(item.subtotal),
      notes: item.notes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  static toItemEntityList(items: GoodsReceiptItem[]): GoodsReceiptItemEntity[] {
    return items.map((i) => GoodsReceiptMapper.toItemEntity(i));
  }

  static toEntity(
    receipt: GoodsReceipt & { items?: GoodsReceiptItem[] },
  ): GoodsReceiptEntity {
    return {
      id: receipt.id,
      companyId: receipt.companyId,
      purchaseOrderId: receipt.purchaseOrderId,
      receiptNumber: receipt.receiptNumber,
      receiptDate: receipt.receiptDate,
      warehouseId: receipt.warehouseId,
      status: receipt.status,
      notes: receipt.notes,
      receivedBy: receipt.receivedBy,
      createdAt: receipt.createdAt,
      updatedAt: receipt.updatedAt,
      deletedAt: receipt.deletedAt,
      items: receipt.items
        ? GoodsReceiptMapper.toItemEntityList(receipt.items)
        : undefined,
    };
  }

  static toEntityList(
    receipts: (GoodsReceipt & { items?: GoodsReceiptItem[] })[],
  ): GoodsReceiptEntity[] {
    return receipts.map((r) => GoodsReceiptMapper.toEntity(r));
  }
}

export class PurchaseReturnMapper {
  static toItemEntity(item: PurchaseReturnItem): PurchaseReturnItemEntity {
    return {
      id: item.id,
      purchaseReturnId: item.purchaseReturnId,
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
    items: PurchaseReturnItem[],
  ): PurchaseReturnItemEntity[] {
    return items.map((i) => PurchaseReturnMapper.toItemEntity(i));
  }

  static toEntity(
    ret: PurchaseReturn & { items?: PurchaseReturnItem[] },
  ): PurchaseReturnEntity {
    return {
      id: ret.id,
      companyId: ret.companyId,
      supplierId: ret.supplierId,
      returnNumber: ret.returnNumber,
      returnDate: ret.returnDate,
      warehouseId: ret.warehouseId,
      status: ret.status,
      subtotal: toMoney(ret.subtotal),
      discountAmount: toMoney(ret.discountAmount),
      taxAmount: toMoney(ret.taxAmount),
      grandTotal: toMoney(ret.grandTotal),
      currency: ret.currency,
      notes: ret.notes,
      approvedBy: ret.approvedBy,
      approvedAt: ret.approvedAt,
      cancelledBy: ret.cancelledBy,
      cancelledAt: ret.cancelledAt,
      createdAt: ret.createdAt,
      updatedAt: ret.updatedAt,
      deletedAt: ret.deletedAt,
      items: ret.items
        ? PurchaseReturnMapper.toItemEntityList(ret.items)
        : undefined,
    };
  }

  static toEntityList(
    returns: (PurchaseReturn & { items?: PurchaseReturnItem[] })[],
  ): PurchaseReturnEntity[] {
    return returns.map((r) => PurchaseReturnMapper.toEntity(r));
  }
}
