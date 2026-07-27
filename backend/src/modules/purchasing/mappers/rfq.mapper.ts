import { RFQ, RFQItem } from '@prisma/client';
import { RFQEntity, RFQItemEntity } from '../entities/rfq.entity';

export class RFQMapper {
  static toItemEntity(item: RFQItem): RFQItemEntity {
    return {
      id: item.id,
      rfqId: item.rfqId,
      productId: item.productId,
      quantity: item.quantity,
      notes: item.notes,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  static toItemEntityList(items: RFQItem[]): RFQItemEntity[] {
    return items.map((i) => RFQMapper.toItemEntity(i));
  }

  static toEntity(rfq: RFQ & { items?: RFQItem[] }): RFQEntity {
    return {
      id: rfq.id,
      companyId: rfq.companyId,
      rfqNumber: rfq.rfqNumber,
      rfqDate: rfq.rfqDate,
      expectedDate: rfq.expectedDate,
      status: rfq.status,
      notes: rfq.notes,
      createdBy: rfq.createdBy,
      approvedBy: rfq.approvedBy,
      approvedAt: rfq.approvedAt,
      createdAt: rfq.createdAt,
      updatedAt: rfq.updatedAt,
      deletedAt: rfq.deletedAt,
      items: rfq.items ? RFQMapper.toItemEntityList(rfq.items) : undefined,
    };
  }

  static toEntityList(rfqs: (RFQ & { items?: RFQItem[] })[]): RFQEntity[] {
    return rfqs.map((r) => RFQMapper.toEntity(r));
  }
}
