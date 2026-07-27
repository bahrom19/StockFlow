import { Injectable } from '@nestjs/common';
import {
  CostedItem,
  IInventoryCostingService,
} from './inventory-costing.interface';
import { Decimal } from '@prisma/client/runtime/library';
import { InventoryRepository } from '../../inventory/repositories/inventory.repository';

@Injectable()
export class InventoryCostingService implements IInventoryCostingService {
  constructor(private readonly inventoryRepository: InventoryRepository) {}

  async calculateCOGS(
    companyId: string,
    warehouseId: string,
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<CostedItem[]> {
    const productIds = items.map((i) => i.productId);
    const products = await this.inventoryRepository.findProductsByIds(
      productIds,
      companyId,
    );

    const costMap = new Map<string, string>();
    for (const p of products) {
      costMap.set(p.id, p.costPrice?.toString() ?? '0');
    }

    return items.map((item) => {
      const unitCost = costMap.get(item.productId) ?? '0';
      const totalCost = new Decimal(unitCost).mul(item.quantity).toString();
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitCost,
        totalCost,
      };
    });
  }
}
