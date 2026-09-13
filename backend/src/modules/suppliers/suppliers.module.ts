import { Module } from '@nestjs/common';
import { SuppliersController } from './controllers/suppliers.controller';
import { SupplierContactsController } from './controllers/supplier-contacts.controller';
import { SupplierAddressesController } from './controllers/supplier-addresses.controller';
import { SupplierPaymentsController } from './controllers/supplier-payments.controller';
import { SupplierPaymentAllocationsController } from './controllers/supplier-payment-allocations.controller';
import { SupplierProductsController } from './controllers/supplier-products.controller';
import { SupplierAnalyticsController } from './controllers/supplier-analytics.controller';
import { SupplierStatementController } from './controllers/supplier-statement.controller';
import { SupplierCreditSummaryController } from './controllers/supplier-credit-summary.controller';
import { SuppliersService } from './services/suppliers.service';
import { SupplierContactsService } from './services/supplier-contacts.service';
import { SupplierAddressesService } from './services/supplier-addresses.service';
import { SupplierPaymentsService } from './services/supplier-payments.service';
import { SupplierPaymentAllocationsService } from './services/supplier-payment-allocations.service';
import { SupplierProductsService } from './services/supplier-products.service';
import { SupplierAnalyticsService } from './services/supplier-analytics.service';
import { SupplierStatementService } from './services/supplier-statement.service';
import { SupplierCreditSummaryService } from './services/supplier-credit-summary.service';
import { SupplierStatementRepository } from './repositories/supplier-statement.repository';
import { SupplierCreditSummaryRepository } from './repositories/supplier-credit-summary.repository';
import { SuppliersRepository } from './repositories/suppliers.repository';
import { SupplierContactsRepository } from './repositories/supplier-contacts.repository';
import { SupplierAddressesRepository } from './repositories/supplier-addresses.repository';
import { SupplierPaymentsRepository } from './repositories/supplier-payments.repository';
import { SupplierPaymentAllocationsRepository } from './repositories/supplier-payment-allocations.repository';
import { SupplierProductsRepository } from './repositories/supplier-products.repository';
import { FinanceModule } from '../finance/finance.module';
import { SharedModule } from '../shared/shared.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [FinanceModule, SharedModule, CompaniesModule],
  controllers: [
    SuppliersController,
    SupplierContactsController,
    SupplierAddressesController,
    SupplierPaymentsController,
    SupplierPaymentAllocationsController,
    SupplierProductsController,
    SupplierAnalyticsController,
    SupplierStatementController,
    SupplierCreditSummaryController,
  ],
  providers: [
    SuppliersService,
    SuppliersRepository,
    SupplierContactsService,
    SupplierContactsRepository,
    SupplierAddressesService,
    SupplierAddressesRepository,
    SupplierPaymentsService,
    SupplierPaymentsRepository,
    SupplierPaymentAllocationsService,
    SupplierPaymentAllocationsRepository,
    SupplierProductsService,
    SupplierProductsRepository,
    SupplierAnalyticsService,
    SupplierStatementService,
    SupplierStatementRepository,
    SupplierCreditSummaryRepository,
    SupplierCreditSummaryService,
  ],
  exports: [SuppliersService, SupplierPaymentAllocationsService],
})
export class SuppliersModule {}
