import { Module, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { EventBus, EVENT_BUS } from '../../common/events';
import { PrismaModule } from '../../common/prisma';
import { SharedModule } from '../shared/shared.module';
import { GoodsReceiptController } from './controllers/goods-receipt.controller';
import { PurchaseOrderController } from './controllers/purchase-order.controller';
import { PurchaseReturnController } from './controllers/purchase-return.controller';
import { PurchaseInvoiceController } from './controllers/purchase-invoice.controller';
import { RFQController } from './controllers/rfq.controller';
import { SupplierQuotationController } from './controllers/supplier-quotation.controller';
import { GoodsReceiptRepository } from './repositories/goods-receipt.repository';
import { PurchaseOrderRepository } from './repositories/purchase-order.repository';
import { PurchaseReturnRepository } from './repositories/purchase-return.repository';
import { PurchaseInvoiceRepository } from './repositories/purchase-invoice.repository';
import { RFQRepository } from './repositories/rfq.repository';
import { SupplierQuotationRepository } from './repositories/supplier-quotation.repository';
import { GoodsReceiptService } from './services/goods-receipt.service';
import { PurchaseOrderService } from './services/purchase-order.service';
import { PurchaseReturnService } from './services/purchase-return.service';
import { PurchaseInvoiceService } from './services/purchase-invoice.service';
import { RFQService } from './services/rfq.service';
import { SupplierQuotationService } from './services/supplier-quotation.service';
import { AuditLogService } from '../shared/services/audit-log.service';

@Module({
  imports: [PrismaModule, SharedModule],
  controllers: [
    PurchaseOrderController,
    GoodsReceiptController,
    PurchaseReturnController,
    PurchaseInvoiceController,
    RFQController,
    SupplierQuotationController,
  ],
  providers: [
    // Repositories
    PurchaseOrderRepository,
    GoodsReceiptRepository,
    PurchaseReturnRepository,
    PurchaseInvoiceRepository,
    RFQRepository,
    SupplierQuotationRepository,
    // Services
    PurchaseOrderService,
    GoodsReceiptService,
    PurchaseReturnService,
    PurchaseInvoiceService,
    RFQService,
    SupplierQuotationService,
    AuditLogService,
  ],
  exports: [
    PurchaseOrderRepository,
    GoodsReceiptRepository,
    PurchaseReturnRepository,
    PurchaseInvoiceRepository,
    RFQRepository,
    SupplierQuotationRepository,
    PurchaseOrderService,
    GoodsReceiptService,
    PurchaseReturnService,
  ],
})
export class PurchasingModule implements OnModuleInit {
  constructor(@Inject(EVENT_BUS) private readonly eventBus: EventBus) {}

  onModuleInit(): void {
    // Purchasing module subscribes to cross-module events
    // Future: this.eventBus.subscribe('inventory.adjusted', ...);
    // Future: this.eventBus.subscribe('supplier.created', ...);
  }
}
