import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseInvoiceItemEntity {
  @ApiProperty() id!: string;
  @ApiProperty() purchaseInvoiceId!: string;
  @ApiProperty() productId!: string;
  @ApiPropertyOptional() purchaseOrderItemId!: string | null;
  @ApiProperty({ example: 5 }) quantity!: number;
  @ApiProperty({ example: '49.9900' }) unitCost!: string;
  @ApiPropertyOptional({ example: '0.00' }) discountPercent!: string | null;
  @ApiProperty({ example: '0.0000' }) discountAmount!: string;
  @ApiPropertyOptional({ example: '0.00' }) taxPercent!: string | null;
  @ApiProperty({ example: '0.0000' }) taxAmount!: string;
  @ApiProperty({ example: '249.9500' }) subtotal!: string;
  @ApiProperty({ example: '249.9500' }) total!: string;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class PurchaseInvoiceEntity {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() purchaseOrderId!: string;
  @ApiProperty() supplierId!: string;
  @ApiProperty({ example: 'INV-0001' }) invoiceNumber!: string;
  @ApiProperty() invoiceDate!: Date;
  @ApiPropertyOptional() dueDate!: Date | null;
  @ApiProperty({ enum: ['DRAFT', 'APPROVED', 'PAID', 'CANCELLED'] })
  status!: string;
  @ApiProperty({ example: '249.9500' }) subtotal!: string;
  @ApiProperty({ example: '0.0000' }) discountAmount!: string;
  @ApiProperty({ example: '0.0000' }) taxAmount!: string;
  @ApiProperty({ example: '249.9500' }) grandTotal!: string;
  @ApiProperty({ example: '0.0000' }) paidAmount!: string;
  @ApiPropertyOptional() notes!: string | null;
  @ApiPropertyOptional() approvedBy!: string | null;
  @ApiPropertyOptional() approvedAt!: Date | null;
  @ApiPropertyOptional() cancelledBy!: string | null;
  @ApiPropertyOptional() cancelledAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() deletedAt!: Date | null;
  @ApiPropertyOptional({ type: [PurchaseInvoiceItemEntity] })
  items?: PurchaseInvoiceItemEntity[];
}
