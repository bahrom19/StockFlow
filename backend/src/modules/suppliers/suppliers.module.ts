import { Module } from '@nestjs/common';
import { SuppliersController } from './controllers/suppliers.controller';
import { SupplierContactsController } from './controllers/supplier-contacts.controller';
import { SupplierAddressesController } from './controllers/supplier-addresses.controller';
import { SuppliersService } from './services/suppliers.service';
import { SupplierContactsService } from './services/supplier-contacts.service';
import { SupplierAddressesService } from './services/supplier-addresses.service';
import { SuppliersRepository } from './repositories/suppliers.repository';
import { SupplierContactsRepository } from './repositories/supplier-contacts.repository';
import { SupplierAddressesRepository } from './repositories/supplier-addresses.repository';

@Module({
  controllers: [
    SuppliersController,
    SupplierContactsController,
    SupplierAddressesController,
  ],
  providers: [
    SuppliersService,
    SuppliersRepository,
    SupplierContactsService,
    SupplierContactsRepository,
    SupplierAddressesService,
    SupplierAddressesRepository,
  ],
  exports: [SuppliersService],
})
export class SuppliersModule {}
