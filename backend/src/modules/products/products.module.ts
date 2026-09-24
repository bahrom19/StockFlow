import { Module } from '@nestjs/common';
import { ProductsController } from './controllers/products.controller';
import { ProductsService } from './services/products.service';
import { ProductsRepository } from './repositories/products.repository';
// InventoryModule exports StockService; the product update flow reuses the
// existing stock adjustment mechanism when a client sends stockQuantity on
// PATCH (see ProductsService.update) instead of writing the Stock table
// directly. There is no circular dependency: nothing in InventoryModule's
// dependency subtree imports ProductsModule.
import { InventoryModule } from '../inventory/inventory.module';
// FinanceModule exposes GlEngineService so product creation can post the
// canonical Opening Balance journal (Dr 1300 / Cr 3000) in the same
// transaction. One-directional: nothing in FinanceModule imports
// ProductsModule.
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [InventoryModule, FinanceModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
})
export class ProductsModule {}
