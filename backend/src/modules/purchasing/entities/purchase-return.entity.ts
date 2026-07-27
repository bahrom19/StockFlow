import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseReturnItemEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  purchaseReturnId!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty({ example: 5 })
  quantity!: number;

  @ApiProperty({ example: '49.9900' })
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

export class PurchaseReturnEntity {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  companyId!: string;

  @ApiProperty()
  supplierId!: string;

  @ApiProperty({ example: 'PR-0001' })
  returnNumber!: string;

  @ApiProperty()
  returnDate!: Date;

  @ApiProperty()
  warehouseId!: string;

  @ApiProperty({ enum: ['DRAFT', 'APPROVED', 'COMPLETED', 'CANCELLED'] })
  status!: string;

  @ApiProperty({ example: '100.0000' })
  subtotal!: string;

  @ApiProperty({ example: '0.0000' })
  discountAmount!: string;

  @ApiProperty({ example: '0.0000' })
  taxAmount!: string;

  @ApiProperty({ example: '100.0000' })
  grandTotal!: string;

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

  @ApiPropertyOptional({ type: [PurchaseReturnItemEntity] })
  items?: PurchaseReturnItemEntity[];
}
