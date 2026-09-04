import { ApiProperty } from '@nestjs/swagger';

export class PurchasePerformanceEntity {
  @ApiProperty({ example: '15000000.0000' })
  netPurchaseSpend!: string;

  @ApiProperty({ example: 4500 })
  totalPurchasedQuantity!: number;

  @ApiProperty({ example: 24 })
  invoiceCount!: number;
}

export class DeliveryPerformanceEntity {
  @ApiProperty({ example: 87.5 })
  onTimeDeliveryRate!: number;

  @ApiProperty({ example: 5.2 })
  averageLeadTimeDays!: number;

  @ApiProperty({ example: 4.2 })
  cancellationRate!: number;
}

export class ReturnPerformanceEntity {
  @ApiProperty({ example: 3.1 })
  amountReturnRate!: number;

  @ApiProperty({ example: 2.8 })
  quantityReturnRate!: number;

  @ApiProperty({ example: 5 })
  returnCount!: number;
}

export class FinancialRiskEntity {
  @ApiProperty({ example: '2500000.0000' })
  totalOutstanding!: string;

  @ApiProperty({ example: 3 })
  overdueCount!: number;

  @ApiProperty({ example: '50000.0000' })
  overdue90plus!: string;
}

export class SupplierPerformanceEntity {
  @ApiProperty({ example: '2025-09-04' })
  dateFrom!: string;

  @ApiProperty({ example: '2026-09-04' })
  dateTo!: string;

  @ApiProperty({ type: PurchasePerformanceEntity })
  purchase!: PurchasePerformanceEntity;

  @ApiProperty({ type: DeliveryPerformanceEntity })
  delivery!: DeliveryPerformanceEntity;

  @ApiProperty({ type: ReturnPerformanceEntity })
  returns!: ReturnPerformanceEntity;

  @ApiProperty({ type: FinancialRiskEntity })
  financialRisk!: FinancialRiskEntity;
}
