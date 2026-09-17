import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SalesRefundItemEntity } from './sales-refund-item.entity';

/**
 * G11-E E2: the SalesRefund aggregate root.
 *
 * SalesRefund + SalesRefundItem are the canonical refund history — there is no
 * `Sale.refundedQuantity` / `SaleItem.refundedQuantity`; remaining refundable
 * quantity is derived from the SUM of COMPLETED SalesRefundItem rows.
 *
 * Money values are serialized as strings, matching the existing sales/purchasing
 * API convention (Prisma Decimal is never exposed directly).
 */
export class SalesRefundEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  saleId!: string;

  @ApiProperty()
  warehouseId!: string;

  @ApiProperty({ example: 'REF-ABCD1234-0001' })
  refundNumber!: string;

  @ApiProperty({ enum: ['COMPLETED', 'CANCELLED'], example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ example: '2998.0000' })
  total!: string;

  @ApiProperty({ example: 'KZT' })
  currency!: string;

  @ApiPropertyOptional()
  reason!: string | null;

  @ApiPropertyOptional()
  reference!: string | null;

  @ApiProperty()
  createdBy!: string;

  @ApiProperty({ example: 0 })
  rowVersion!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt!: Date | null;

  @ApiPropertyOptional({ type: [SalesRefundItemEntity] })
  items?: SalesRefundItemEntity[];
}