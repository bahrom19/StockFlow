import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MonthlySpendEntity {
  @ApiProperty({ example: '2026-01' })
  month!: string;

  @ApiProperty({ example: '250000.0000' })
  amount!: string;
}

export class SupplierPurchaseSummaryEntity {
  @ApiProperty({ example: '2025-09-04' })
  dateFrom!: string;

  @ApiProperty({ example: '2026-09-04' })
  dateTo!: string;

  @ApiProperty({ example: '2500000.0000' })
  totalInvoiced!: string;

  @ApiProperty({ example: '150000.0000' })
  totalReturned!: string;

  @ApiProperty({ example: '2350000.0000' })
  netPurchaseSpend!: string;

  @ApiProperty({ example: 1250 })
  totalPurchasedQuantity!: number;

  @ApiProperty({ example: '1880.0000' })
  weightedAverageUnitCost!: string;

  @ApiProperty({ example: 12 })
  invoiceCount!: number;

  @ApiProperty({ example: 2 })
  returnCount!: number;

  @ApiPropertyOptional({ example: '2025-10-15T00:00:00.000Z' })
  firstPurchaseDate!: string | null;

  @ApiPropertyOptional({ example: '2026-08-28T00:00:00.000Z' })
  lastPurchaseDate!: string | null;

  @ApiProperty({ type: [MonthlySpendEntity] })
  monthlySpend!: MonthlySpendEntity[];

  @ApiProperty({ example: '1800000.0000' })
  currentTotalPaid!: string;

  @ApiProperty({ example: '550000.0000' })
  currentOutstanding!: string;
}
