export interface CostedItem {
  productId: string;
  quantity: number;
  unitCost: string;
  totalCost: string;
}

export interface IInventoryCostingService {
  /**
   * Calculate the cost of goods sold for a set of sale items.
   * Returns the costed items with unit cost and total cost.
   */
  calculateCOGS(
    companyId: string,
    warehouseId: string,
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<CostedItem[]>;
}
