import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '@prisma/client';

export class SupplierProductEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  companyId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  supplierId!: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  productId!: string;

  @ApiPropertyOptional({ example: 'SUP-SKU-001' })
  supplierSku!: string | null;

  @ApiPropertyOptional({ example: '1500.0000' })
  purchasePrice!: string | null;

  @ApiProperty({ enum: Currency, example: Currency.KZT })
  currency!: Currency;

  @ApiProperty({ example: false })
  isPreferred!: boolean;

  @ApiPropertyOptional({ example: 'Main bread supplier' })
  notes!: string | null;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00.000Z' })
  lastPurchaseAt!: Date | null;

  @ApiProperty({ example: 0 })
  rowVersion!: number;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-01T00:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ example: null })
  deletedAt!: Date | null;

  // Embedded product info for display
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  product!: {
    id: string;
    name: string;
    sku: string | null;
  };
}
