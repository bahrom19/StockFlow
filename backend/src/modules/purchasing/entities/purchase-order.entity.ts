import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseOrderItemEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  purchaseOrderId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty({ example: 10 })
  quantity!: number;

  @ApiProperty({ example: 0, description: 'Already received quantity' })
  receivedQuantity!: number;

  @ApiProperty({
    example: '49.9900',
    description: 'String representation of Decimal',
  })
  unitCost!: string;

  @ApiPropertyOptional({ example: '5.00' })
  discountPercent!: string | null;

  @ApiProperty({ example: '0.00' })
  discountAmount!: string;

  @ApiPropertyOptional({ example: '12.00' })
  taxPercent!: string | null;

  @ApiProperty({ example: '0.00' })
  taxAmount!: string;

  @ApiProperty({ example: '0.00' })
  subtotal!: string;

  @ApiProperty({ example: '0.00' })
  total!: string;

  @ApiPropertyOptional()
  notes!: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PurchaseOrderEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  supplierId!: string;

  @ApiProperty({ example: 'PO-0001' })
  orderNumber!: string;

  @ApiProperty()
  orderDate!: Date;

  @ApiPropertyOptional()
  expectedDate!: Date | null;

  @ApiProperty({
    enum: [
      'DRAFT',
      'PENDING',
      'APPROVED',
      'ORDERED',
      'PARTIALLY_RECEIVED',
      'RECEIVED',
      'CANCELLED',
    ],
  })
  status!: string;

  @ApiProperty({ example: '100.0000' })
  subtotal!: string;

  @ApiProperty({ example: '0.0000' })
  discountAmount!: string;

  @ApiProperty({ example: '0.0000' })
  taxAmount!: string;

  @ApiProperty({ example: '100.0000' })
  grandTotal!: string;

  @ApiProperty({ example: '0.0000' })
  paidAmount!: string;

  @ApiProperty({ enum: ['KZT', 'USD', 'EUR', 'RUB', 'CNY', 'AED', 'AUD', 'VND'], example: 'KZT' })
  currency!: string;

  @ApiPropertyOptional()
  notes!: string | null;

  @ApiPropertyOptional()
  approvedBy!: string | null;

  @ApiPropertyOptional()
  approvedAt!: Date | null;

  @ApiPropertyOptional()
  cancelledBy!: string | null;

  @ApiPropertyOptional()
  cancelledAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional()
  deletedAt!: Date | null;

  @ApiPropertyOptional({ type: [PurchaseOrderItemEntity] })
  items?: PurchaseOrderItemEntity[];
}
