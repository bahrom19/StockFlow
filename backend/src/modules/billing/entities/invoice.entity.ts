import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InvoiceLineEntity {
  @ApiProperty() id!: string;
  @ApiProperty() invoiceId!: string;
  @ApiProperty({ example: 'Starter plan - Monthly' }) description!: string;
  @ApiProperty({ example: 1 }) quantity!: number;
  @ApiProperty({ example: '29.0000' }) unitPrice!: string;
  @ApiProperty({ example: '0.0000' }) discountAmount!: string;
  @ApiProperty({ example: '0.0000' }) taxAmount!: string;
  @ApiProperty({ example: '29.0000' }) total!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class InvoiceEntity {
  @ApiProperty() id!: string;
  @ApiProperty() companyId!: string;
  @ApiProperty() subscriptionId!: string;
  @ApiProperty({ example: 'INV-20260801-0001' }) invoiceNumber!: string;
  @ApiProperty({
    enum: ['DRAFT', 'PENDING', 'PAID', 'REFUNDED', 'DISPUTED', 'CANCELLED'],
  })
  status!: string;
  @ApiProperty({ example: '29.0000' }) subtotal!: string;
  @ApiProperty({ example: '0.0000' }) discountAmount!: string;
  @ApiProperty({ example: '0.0000' }) taxAmount!: string;
  @ApiProperty({ example: '29.0000' }) totalAmount!: string;
  @ApiProperty({ example: '0.0000' }) paidAmount!: string;
  @ApiProperty({ example: 'USD' }) currency!: string;
  @ApiPropertyOptional() dueDate!: Date | null;
  @ApiPropertyOptional() paidAt!: Date | null;
  @ApiPropertyOptional() providerInvoiceId!: string | null;
  @ApiPropertyOptional() notes!: string | null;
  @ApiProperty() rowVersion!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @ApiPropertyOptional() deletedAt!: Date | null;
  @ApiPropertyOptional({ type: [InvoiceLineEntity] })
  lines?: InvoiceLineEntity[];
}
