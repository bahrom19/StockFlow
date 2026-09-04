import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SupplierProductPurchaseEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  productId!: string;

  @ApiProperty({ example: 'Milk 1L' })
  productName!: string;

  @ApiProperty({ example: 'MLK-001' })
  sku!: string | null;

  @ApiProperty({ example: 500 })
  totalPurchasedQuantity!: number;

  @ApiProperty({ example: '750000.0000' })
  totalPurchaseSpend!: string;

  @ApiProperty({ example: '1500.0000' })
  weightedAverageUnitCost!: string;

  @ApiProperty({ example: '1400.0000' })
  minUnitCost!: string;

  @ApiProperty({ example: '1650.0000' })
  maxUnitCost!: string;

  @ApiProperty({ example: 20 })
  totalReturnedQuantity!: number;

  @ApiProperty({ example: '30000.0000' })
  totalReturnedSpend!: string;

  @ApiProperty({ example: 480 })
  netPurchasedQuantity!: number;

  @ApiProperty({ example: '720000.0000' })
  netPurchaseSpend!: string;

  @ApiProperty({ example: 12 })
  invoiceCount!: number;

  @ApiPropertyOptional({ example: '2025-10-15T00:00:00.000Z' })
  firstPurchaseDate!: string | null;

  @ApiPropertyOptional({ example: '2026-08-28T00:00:00.000Z' })
  lastPurchaseDate!: string | null;
}

export class SupplierProductPurchaseListEntity {
  @ApiProperty({ type: [SupplierProductPurchaseEntity] })
  items!: SupplierProductPurchaseEntity[];

  @ApiProperty({ example: 45 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;
}
