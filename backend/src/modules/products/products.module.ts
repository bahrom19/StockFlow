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

@Module({
  imports: [InventoryModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductsRepository],
})
export class ProductsModule {}
