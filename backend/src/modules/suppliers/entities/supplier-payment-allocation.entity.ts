import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierPaymentAllocationEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  supplierId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  paymentId!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  purchaseInvoiceId!: string | null;

  @ApiProperty({ example: '50000.0000' })
  amount!: string;

  @ApiProperty({ example: 0 })
  rowVersion!: number;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ example: null })
  deletedAt!: Date | null;
}
