import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GoodsReceiptItemEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  goodsReceiptId!: string;

  @ApiProperty()
  purchaseOrderItemId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty({ example: 10 })
  quantity!: number;

  @ApiProperty({ example: '49.9900' })
  unitCost!: string;

  @ApiProperty({ example: '499.9000' })
  subtotal!: string;

  @ApiPropertyOptional()
  notes!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class GoodsReceiptEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  purchaseOrderId!: string;

  @ApiProperty({ example: 'GR-0001' })
  receiptNumber!: string;

  @ApiProperty()
  receiptDate!: Date;

  @ApiProperty()
  warehouseId!: string;

  @ApiProperty({ enum: ['DRAFT', 'COMPLETED', 'CANCELLED'] })
  status!: string;

  @ApiPropertyOptional()
  notes!: string | null;

  @ApiPropertyOptional()
  receivedBy!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt!: Date | null;

  @ApiPropertyOptional({ type: [GoodsReceiptItemEntity] })
  items?: GoodsReceiptItemEntity[];
}
