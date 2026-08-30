import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma';
import { IdempotencyModule } from '../../infrastructure/idempotency/idempotency.module';
import { SharedModule } from '../shared/shared.module';
import { FinanceModule } from '../finance/finance.module';
import { EventBus, EVENT_BUS } from '../../common/events';
import {
  StockController,
  WarehouseController,
  BatchController,
  InventoryCountController,
  VariantController,
  BarcodeController,
  UomController,
  ReservationController,
  CostingController,
} from './controllers';
import {
  StockService,
  WarehouseService,
  BatchService,
  InventoryCountService,
  VariantService,
  BarcodeService,
  UomService,
  ReservationService,
  CostingService,
} from './services';
import { InventoryRepository } from './repositories/inventory.repository';
import {
  SaleCompletedEventHandler,
  SaleRefundedEventHandler,
  PurchaseReceivedEventHandler,
  InventoryFinanceHandler,
} from './events';

@Module({
  imports: [PrismaModule, SharedModule, FinanceModule, IdempotencyModule],
  controllers: [
    StockController,
    WarehouseController,
    BatchController,
    InventoryCountController,
    VariantController,
    BarcodeController,
    UomController,
    ReservationController,
    CostingController,
  ],
  providers: [
    InventoryRepository,
    StockService,
    WarehouseService,
    BatchService,
    InventoryCountService,
    VariantService,
    BarcodeService,
    UomService,
    ReservationService,
    CostingService,
    SaleCompletedEventHandler,
    SaleRefundedEventHandler,
    PurchaseReceivedEventHandler,
    InventoryFinanceHandler,
  ],
  exports: [
    InventoryRepository,
    StockService,
    WarehouseService,
    CostingService,
  ],
})
export class InventoryModule implements OnModuleInit {
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly saleCompletedHandler: SaleCompletedEventHandler,
    private readonly saleRefundedHandler: SaleRefundedEventHandler,
    private readonly purchaseReceivedHandler: PurchaseReceivedEventHandler,
    private readonly inventoryFinanceHandler: InventoryFinanceHandler,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe('sale.completed', this.saleCompletedHandler);
    this.eventBus.subscribe('sale.refunded', this.saleRefundedHandler);
    this.eventBus.subscribe('purchase.received', this.purchaseReceivedHandler);
    this.eventBus.subscribe('inventory.adjusted', this.inventoryFinanceHandler);
  }
}
