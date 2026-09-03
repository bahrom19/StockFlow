import { Module } from '@nestjs/common';
import { SuppliersController } from './controllers/suppliers.controller';
import { SupplierContactsController } from './controllers/supplier-contacts.controller';
import { SupplierAddressesController } from './controllers/supplier-addresses.controller';
import { SupplierPaymentsController } from './controllers/supplier-payments.controller';
import { SupplierProductsController } from './controllers/supplier-products.controller';
import { SuppliersService } from './services/suppliers.service';
import { SupplierContactsService } from './services/supplier-contacts.service';
import { SupplierAddressesService } from './services/supplier-addresses.service';
import { SupplierPaymentsService } from './services/supplier-payments.service';
import { SupplierProductsService } from './services/supplier-products.service';
import { SuppliersRepository } from './repositories/suppliers.repository';
import { SupplierContactsRepository } from './repositories/supplier-contacts.repository';
import { SupplierAddressesRepository } from './repositories/supplier-addresses.repository';
import { SupplierPaymentsRepository } from './repositories/supplier-payments.repository';
import { SupplierProductsRepository } from './repositories/supplier-products.repository';
import { FinanceModule } from '../finance/finance.module';
import { SharedModule } from '../shared/shared.module';

@Module({
  imports: [FinanceModule, SharedModule],
  controllers: [
    SuppliersController,
    SupplierContactsController,
    SupplierAddressesController,
    SupplierPaymentsController,
    SupplierProductsController,
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
    SupplierProductsService,
    SupplierProductsRepository,
  ],
  exports: [SuppliersService],
})
export class SuppliersModule {}
