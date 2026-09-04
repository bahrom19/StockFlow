import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TopReturnedProductEntity {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  productId!: string;

  @ApiProperty({ example: 'Milk 1L' })
  productName!: string;

  @ApiProperty({ example: 'MLK-001' })
  sku!: string | null;

  @ApiProperty({ example: 100 })
  returnedQuantity!: number;

  @ApiProperty({ example: '150000.0000' })
  returnedAmount!: string;

  @ApiProperty({ example: 3 })
  returnCount!: number;
}

export class SupplierReturnSummaryEntity {
  @ApiProperty({ example: '2025-09-04' })
  dateFrom!: string;

  @ApiProperty({ example: '2026-09-04' })
  dateTo!: string;

  @ApiProperty({ example: '350000.0000' })
  totalReturnedAmount!: string;

  @ApiProperty({ example: 250 })
  totalReturnedQuantity!: number;

  @ApiProperty({ example: 5 })
  returnCount!: number;

  @ApiProperty({ example: '5000000.0000' })
  totalPurchaseSpend!: string;

  @ApiProperty({ example: 3000 })
  totalPurchasedQuantity!: number;

  @ApiProperty({ example: 7.0 })
  amountReturnRate!: number;

  @ApiProperty({ example: 8.3 })
  quantityReturnRate!: number;

  @ApiProperty({ type: [TopReturnedProductEntity] })
  topReturnedProducts!: TopReturnedProductEntity[];
}
