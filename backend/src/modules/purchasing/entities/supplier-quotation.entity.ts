import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierQuotationItemEntity {
  @ApiProperty() id!: string;
  @ApiProperty() supplierQuotationId!: string;
  @ApiProperty() productId!: string;
  @ApiProperty({ example: 10 }) quantity!: number;
  @ApiProperty({ example: '45.0000' }) unitCost!: string;
  @ApiPropertyOptional({ example: '0.00' }) discountPercent!: string | null;
  @ApiProperty({ example: '0.0000' }) discountAmount!: string;
  @ApiPropertyOptional({ example: '0.00' }) taxPercent!: string | null;
  @ApiProperty({ example: '0.0000' }) taxAmount!: string;
  @ApiProperty({ example: '450.0000' }) subtotal!: string;
  @ApiProperty({ example: '450.0000' }) total!: string;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class SupplierQuotationEntity {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() rfqId!: string;
  @ApiProperty() supplierId!: string;
  @ApiProperty({ example: 'QTN-0001' }) quotationNumber!: string;
  @ApiProperty() quotationDate!: Date;
  @ApiPropertyOptional() validUntil!: Date | null;
  @ApiProperty({ enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CANCELLED'] })
  status!: string;
  @ApiProperty({ example: '450.0000' }) subtotal!: string;
  @ApiProperty({ example: '0.0000' }) discountAmount!: string;
  @ApiProperty({ example: '0.0000' }) taxAmount!: string;
  @ApiProperty({ example: '450.0000' }) grandTotal!: string;
  @ApiPropertyOptional() notes!: string | null;
  @ApiPropertyOptional() acceptedAt!: Date | null;
  @ApiPropertyOptional() rejectedAt!: Date | null;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() deletedAt!: Date | null;
  @ApiPropertyOptional({ type: [SupplierQuotationItemEntity] })
  items?: SupplierQuotationItemEntity[];
}
