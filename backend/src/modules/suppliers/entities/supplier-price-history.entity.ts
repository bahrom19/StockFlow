import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PricePointEntity {
  @ApiProperty({ example: '2026-01-15T00:00:00.000Z' })
  invoiceDate!: string;

  @ApiProperty({ example: 'INV-00042' })
  invoiceNumber!: string;

  @ApiProperty({ example: '1400.0000' })
  unitCost!: string;

  @ApiProperty({ example: 100 })
  quantity!: number;

  @ApiProperty({ example: '140000.0000' })
  total!: string;
}

export class SupplierPriceHistoryEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  productId!: string;

  @ApiProperty({ example: 'Milk 1L' })
  productName!: string;

  @ApiProperty({ example: 'MLK-001' })
  sku!: string | null;

  @ApiProperty({ example: '2025-09-04' })
  dateFrom!: string;

  @ApiProperty({ example: '2026-09-04' })
  dateTo!: string;

  @ApiPropertyOptional({ example: '1400.0000' })
  currentQuotedPrice!: string | null;

  @ApiProperty({ example: '1450.0000' })
  averageUnitCost!: string;

  @ApiProperty({ example: '1350.0000' })
  minUnitCost!: string;

  @ApiProperty({ example: '1600.0000' })
  maxUnitCost!: string;

  @ApiProperty({ type: [PricePointEntity] })
  pricePoints!: PricePointEntity[];
}
