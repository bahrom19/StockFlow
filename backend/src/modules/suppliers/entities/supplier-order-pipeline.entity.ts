import { ApiProperty } from '@nestjs/swagger';

export class OrderPipelineSummaryEntity {
  @ApiProperty({ example: 15 })
  totalOrders!: number;

  @ApiProperty({ example: '7500000.0000' })
  totalOrderValue!: string;

  @ApiProperty({ example: 2 })
  draftCount!: number;

  @ApiProperty({ example: 1 })
  pendingCount!: number;

  @ApiProperty({ example: 3 })
  approvedCount!: number;

  @ApiProperty({ example: 4 })
  orderedCount!: number;

  @ApiProperty({ example: 2 })
  partiallyReceivedCount!: number;

  @ApiProperty({ example: 2 })
  receivedCount!: number;

  @ApiProperty({ example: 1 })
  cancelledCount!: number;
}

export class RecentOrderEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  orderId!: string;

  @ApiProperty({ example: 'PO-00042' })
  orderNumber!: string;

  @ApiProperty({ example: '2026-08-15' })
  orderDate!: string;

  @ApiProperty({ example: '2026-08-25', nullable: true })
  expectedDate!: string | null;

  @ApiProperty({ example: 'ORDERED' })
  status!: string;

  @ApiProperty({ example: '500000.0000' })
  grandTotal!: string;
}

export class SupplierOrderPipelineEntity {
  @ApiProperty({ example: '2025-09-04' })
  dateFrom!: string;

  @ApiProperty({ example: '2026-09-04' })
  dateTo!: string;

  @ApiProperty({ type: OrderPipelineSummaryEntity })
  summary!: OrderPipelineSummaryEntity;

  @ApiProperty({ type: [RecentOrderEntity] })
  recentOrders!: RecentOrderEntity[];
}
