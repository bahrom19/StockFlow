import { ApiProperty } from '@nestjs/swagger';

/**
 * G11-E E2: one refunded line of a SalesRefund.
 *
 * `fifoCost` is the immutable historical cost attributed to THIS refund and is
 * the value E3 consumes for inventory/CostLayer restoration.
 */
export class SalesRefundItemEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  salesRefundId!: string;

  @ApiProperty()
  saleItemId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ example: '1499.0000' })
  unitPrice!: string;

  @ApiProperty({ example: '2998.0000' })
  total!: string;

  @ApiProperty({ example: '1000.0000' })
  fifoCost!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}