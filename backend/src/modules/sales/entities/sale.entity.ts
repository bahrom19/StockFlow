import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaleItemEntity {
  @ApiProperty() id!: string;
  @ApiProperty() saleId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty({ example: 2 }) quantity!: number;
  @ApiProperty({ example: '1499.0000' }) unitPrice!: string;
  @ApiProperty({ example: '1000.0000' }) costPrice!: string;
  @ApiProperty({ example: '0.0000' }) discount!: string;
  @ApiProperty({ example: '2998.0000' }) subtotal!: string;
  @ApiProperty({ example: '2998.0000' }) total!: string;
  @ApiProperty({ example: '998.0000' }) margin!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class PaymentEntity {
  @ApiProperty() id!: string;
  @ApiProperty() saleId!: string;
  @ApiProperty({
    enum: [
      'CASH',
      'CARD',
      'QR',
      'BANK_TRANSFER',
      'MOBILE_WALLET',
      'GIFT_CARD',
      'STORE_CREDIT',
    ],
  })
  method!: string;
  @ApiProperty({ example: '2998.0000' }) amount!: string;
  @ApiPropertyOptional({ example: 'Card last4: 4242' }) reference!:
    | string
    | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class ReceiptEntity {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'RCP-0001' }) receiptNumber!: string;
  @ApiProperty() saleId!: string;
  @ApiProperty({ enum: ['DRAFT', 'PRINTED', 'EMAILED', 'CANCELLED'] })
  status!: string;
  @ApiProperty({ example: false }) printed!: boolean;
  @ApiProperty({ example: false }) emailed!: boolean;
  @ApiPropertyOptional() pdfUrl!: string | null;
  @ApiPropertyOptional() qrCode!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class SaleEntity {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() warehouseId!: string;
  @ApiProperty() cashierId!: string;
  @ApiPropertyOptional() customerId!: string | null;
  @ApiProperty({ example: 'SALE-0001' }) saleNumber!: string;
  @ApiProperty({
    enum: [
      'DRAFT',
      'PENDING',
      'COMPLETED',
      'REFUNDED',
      'CANCELLED',
      'PARTIALLY_REFUNDED',
    ],
  })
  status!: string;
  @ApiProperty({ example: '2998.0000' }) subtotal!: string;
  @ApiProperty({ example: '0.0000' }) discount!: string;
  @ApiProperty({ example: '0.0000' }) tax!: string;
  @ApiProperty({ example: '2998.0000' }) total!: string;
  @ApiProperty({ example: '3000.0000' }) paidAmount!: string;
  @ApiProperty({ example: '2.0000' }) changeAmount!: string;
  @ApiProperty({ example: 'KZT' }) currency!: string;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty({ example: 0 }) rowVersion!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() deletedAt!: Date | null;

  @ApiPropertyOptional({ type: [SaleItemEntity] }) items?: SaleItemEntity[];
  @ApiPropertyOptional({ type: [PaymentEntity] }) payments?: PaymentEntity[];
  @ApiPropertyOptional({ type: [ReceiptEntity] }) receipts?: ReceiptEntity[];
}
