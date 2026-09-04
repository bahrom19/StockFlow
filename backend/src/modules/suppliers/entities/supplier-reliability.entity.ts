import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecentDeliveryEntity {
  @ApiProperty({ example: 'PO-00042' })
  orderNumber!: string;

  @ApiProperty({ example: '2026-08-20T00:00:00.000Z' })
  orderDate!: string;

  @ApiPropertyOptional({ example: '2026-08-25T00:00:00.000Z' })
  expectedDate!: string | null;

  @ApiPropertyOptional({ example: '2026-08-24T00:00:00.000Z' })
  receiptDate!: string | null;

  @ApiPropertyOptional({ example: 4 })
  leadTimeDays!: number | null;

  @ApiProperty({ example: true })
  onTime!: boolean | null;

  @ApiProperty({ example: 'RECEIVED' })
  status!: string;

  @ApiProperty({ example: '450000.0000' })
  grandTotal!: string;
}

export class SupplierReliabilityEntity {
  @ApiProperty({ example: '2025-09-04' })
  dateFrom!: string;

  @ApiProperty({ example: '2026-09-04' })
  dateTo!: string;

  @ApiProperty({ example: 24 })
  totalOrders!: number;

  @ApiProperty({ example: 22 })
  totalReceipts!: number;

  @ApiProperty({ example: 87.5 })
  onTimeDeliveryRate!: number;

  @ApiProperty({ example: 5.3 })
  averageLeadTimeDays!: number;

  @ApiProperty({ example: 2 })
  minLeadTimeDays!: number | null;

  @ApiProperty({ example: 14 })
  maxLeadTimeDays!: number | null;

  @ApiProperty({ example: 20 })
  ordersReceived!: number;

  @ApiProperty({ example: 2 })
  ordersPartiallyReceived!: number;

  @ApiProperty({ example: 2 })
  ordersCancelled!: number;

  @ApiProperty({ example: 8.3 })
  cancellationRate!: number;

  @ApiProperty({ type: [RecentDeliveryEntity] })
  recentDeliveries!: RecentDeliveryEntity[];
}
