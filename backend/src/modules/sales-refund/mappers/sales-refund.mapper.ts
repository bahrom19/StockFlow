import { SalesRefund, SalesRefundItem } from '@prisma/client';
import { SalesRefundEntity } from '../entities/sales-refund.entity';
import { SalesRefundItemEntity } from '../entities/sales-refund-item.entity';

type DecimalValue = { toString(): string } | string | number | null | undefined;

function toMoney(value: DecimalValue): string {
  if (value == null) return '0.0000';
  return typeof value === 'string' ? value : value.toString();
}

/**
 * G11-E E2: Prisma -> API entity mapping for refunds.
 * Mirrors `SaleMapper` money-as-string convention.
 */
export class SalesRefundMapper {
  static toItemEntity(item: SalesRefundItem): SalesRefundItemEntity {
    return {
      id: item.id,
      salesRefundId: item.salesRefundId,
      saleItemId: item.saleItemId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: toMoney(item.unitPrice),
      total: toMoney(item.total),
      fifoCost: toMoney(item.fifoCost),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  static toItemEntityList(items: SalesRefundItem[]): SalesRefundItemEntity[] {
    return items.map((i) => SalesRefundMapper.toItemEntity(i));
  }

  static toEntity(
    refund: SalesRefund & { items?: SalesRefundItem[] },
  ): SalesRefundEntity {
    return {
      id: refund.id,
      companyId: refund.companyId,
      saleId: refund.saleId,
      warehouseId: refund.warehouseId,
      refundNumber: refund.refundNumber,
      status: refund.status,
      total: toMoney(refund.total),
      currency: refund.currency,
      reason: refund.reason,
      reference: refund.reference,
      createdBy: refund.createdBy,
      rowVersion: refund.rowVersion,
      createdAt: refund.createdAt,
      updatedAt: refund.updatedAt,
      deletedAt: refund.deletedAt,
      items: refund.items
        ? SalesRefundMapper.toItemEntityList(refund.items)
        : undefined,
    };
  }
}