import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  Prisma,
  Stock,
  StockMovement,
  Warehouse,
  Batch,
  CostLayer,
  InventoryCount,
  InventoryCountItem,
  StockMovementType,
  StockStatus,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { toDecimal } from '../../../common/utils/decimal.util';

@Injectable()
export class InventoryRepository {
  constructor(private readonly prismaService: PrismaService) {}

  private prisma(tx?: Prisma.TransactionClient): Prisma.TransactionClient {
    return (tx ?? this.prismaService) as unknown as Prisma.TransactionClient;
  }

  // ════════════════════════════════════════
  // WAREHOUSE
  // ════════════════════════════════════════

  async findWarehouses(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Warehouse[]> {
    return this.prisma(tx).warehouse.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async findWarehouseById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Warehouse | null> {
    return this.prisma(tx).warehouse.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async createWarehouse(
    data: Prisma.WarehouseCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Warehouse> {
    return this.prisma(tx).warehouse.create({ data });
  }

  async updateWarehouse(
    id: string,
    data: Prisma.WarehouseUpdateInput,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Warehouse> {
    const client = this.prisma(tx);
    const result = await client.warehouse.updateMany({
      where: { id, companyId, rowVersion },
      data: { ...data, rowVersion: { increment: 1 } },
    });
    if (result.count === 0) {
      const existing = await client.warehouse.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Warehouse not found');
      throw new ConflictException(
        'Warehouse was modified by another user. Please refresh and retry.',
      );
    }
    return client.warehouse.findUnique({ where: { id } }) as Promise<Warehouse>;
  }

  async softDeleteWarehouse(
    id: string,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.prisma(tx);
    const result = await client.warehouse.updateMany({
      where: { id, companyId, rowVersion },
      data: { deletedAt: new Date(), rowVersion: { increment: 1 } },
    });
    if (result.count === 0) {
      const existing = await client.warehouse.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Warehouse not found');
      throw new ConflictException('Warehouse was modified by another user.');
    }
  }

  // ════════════════════════════════════════
  // STOCK
  // ════════════════════════════════════════

  async findStockByProduct(
    productId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Stock[]> {
    return this.prisma(tx).stock.findMany({
      where: { productId, companyId },
      include: { warehouse: true },
      orderBy: { warehouseId: 'asc' },
    });
  }

  async findStockByProductAndWarehouse(
    productId: string,
    warehouseId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Stock | null> {
    return this.prisma(tx).stock.findFirst({
      where: { productId, warehouseId, companyId },
    });
  }

  async findAllStock(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Stock[]> {
    return this.prisma(tx).stock.findMany({
      where: { companyId },
      include: { product: true, warehouse: true },
      orderBy: [{ productId: 'asc' }, { warehouseId: 'asc' }],
    });
  }

  async createStock(
    data: Prisma.StockCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Stock> {
    return this.prisma(tx).stock.create({ data });
  }

  async updateStock(
    id: string,
    data: Prisma.StockUpdateInput,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Stock> {
    const client = this.prisma(tx);
    const result = await client.stock.updateMany({
      where: { id, companyId, rowVersion },
      data: { ...data, rowVersion: { increment: 1 } },
    });
    if (result.count === 0) {
      const existing = await client.stock.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Stock record not found');
      throw new ConflictException(
        'Stock was modified by another user. Please refresh and retry.',
      );
    }
    return client.stock.findUnique({ where: { id } }) as Promise<Stock>;
  }

  // ════════════════════════════════════════
  // STOCK MOVEMENT
  // ════════════════════════════════════════

  async createStockMovement(
    data: Prisma.StockMovementCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<StockMovement> {
    return this.prisma(tx).stockMovement.create({ data });
  }

  async findStockMovements(
    companyId: string,
    options: {
      productId?: string;
      warehouseId?: string;
      type?: StockMovementType;
      limit?: number;
      offset?: number;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<StockMovement[]> {
    const where: Prisma.StockMovementWhereInput = { companyId };
    if (options.productId) where.productId = options.productId;
    if (options.warehouseId) where.warehouseId = options.warehouseId;
    if (options.type) where.type = options.type;
    return this.prisma(tx).stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });
  }

  // ════════════════════════════════════════
  // BATCH / LOT
  // ════════════════════════════════════════

  async createBatch(
    data: Prisma.BatchCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Batch> {
    return this.prisma(tx).batch.create({ data });
  }

  async findBatchesByProduct(
    productId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Batch[]> {
    return this.prisma(tx).batch.findMany({
      where: { productId, companyId, deletedAt: null },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async findBatchById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Batch | null> {
    return this.prisma(tx).batch.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async updateBatch(
    id: string,
    data: Prisma.BatchUpdateInput,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<Batch> {
    const client = this.prisma(tx);
    const result = await client.batch.updateMany({
      where: { id, companyId, rowVersion },
      data: { ...data, rowVersion: { increment: 1 } },
    });
    if (result.count === 0) {
      const existing = await client.batch.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Batch not found');
      throw new ConflictException('Batch was modified by another user.');
    }
    return client.batch.findUnique({ where: { id } }) as Promise<Batch>;
  }

  // ════════════════════════════════════════
  // COST LAYER
  // ════════════════════════════════════════

  async createCostLayer(
    data: Prisma.CostLayerCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<CostLayer> {
    return this.prisma(tx).costLayer.create({ data });
  }

  async findActiveCostLayers(
    productId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CostLayer[]> {
    return this.prisma(tx).costLayer.findMany({
      where: {
        productId,
        companyId,
        direction: 'IN',
        remainingQuantity: { gt: 0 },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async consumeCostLayer(
    id: string,
    remainingQuantity: number,
    expectedRemainingQuantity: number,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const client = this.prisma(tx);
    const result = await client.costLayer.updateMany({
      where: {
        id,
        remainingQuantity: expectedRemainingQuantity,
      },
      data: {
        remainingQuantity,
        rowVersion: { increment: 1 },
      },
    });
    return result.count > 0;
  }

  // ════════════════════════════════════════
  // INVENTORY COUNT
  // ════════════════════════════════════════

  async createInventoryCount(
    data: Prisma.InventoryCountCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryCount> {
    return this.prisma(tx).inventoryCount.create({ data });
  }

  async findInventoryCounts(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryCount[]> {
    return this.prisma(tx).inventoryCount.findMany({
      where: { companyId, deletedAt: null },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findInventoryCountById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<
    | (InventoryCount & {
        items: InventoryCountItem[];
        warehouse: Warehouse | null;
      })
    | null
  > {
    return this.prisma(tx).inventoryCount.findFirst({
      where: { id, companyId, deletedAt: null },
      include: { items: true, warehouse: true },
    });
  }

  async updateInventoryCount(
    id: string,
    data: Prisma.InventoryCountUpdateInput,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryCount> {
    const client = this.prisma(tx);
    const result = await client.inventoryCount.updateMany({
      where: { id, companyId, rowVersion },
      data: { ...data, rowVersion: { increment: 1 } },
    });
    if (result.count === 0) {
      const existing = await client.inventoryCount.findFirst({
        where: { id, companyId },
      });
      if (!existing) throw new NotFoundException('Inventory count not found');
      throw new ConflictException(
        'Inventory count was modified by another user.',
      );
    }
    return client.inventoryCount.findUnique({
      where: { id },
      include: { items: true },
    }) as Promise<InventoryCount>;
  }

  async createInventoryCountItem(
    data: Prisma.InventoryCountItemCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryCountItem> {
    return this.prisma(tx).inventoryCountItem.create({ data });
  }

  async updateInventoryCountItem(
    id: string,
    data: Prisma.InventoryCountItemUpdateInput,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<InventoryCountItem> {
    const client = this.prisma(tx);
    const result = await client.inventoryCountItem.updateMany({
      where: { id, rowVersion },
      data: { ...data, rowVersion: { increment: 1 } },
    });
    if (result.count === 0) {
      throw new ConflictException('Count item was modified by another user.');
    }
    return client.inventoryCountItem.findUnique({
      where: { id },
    }) as Promise<InventoryCountItem>;
  }

  // ════════════════════════════════════════
  // PRODUCT HELPERS
  // ════════════════════════════════════════

  async findProductById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{
    id: string;
    costPrice: string | Decimal | null;
    costingMethod: string | null;
  } | null> {
    return this.prisma(tx).product.findFirst({
      where: { id, companyId, deletedAt: null },
      select: { id: true, costPrice: true, costingMethod: true },
    });
  }

  async updateProductCost(
    id: string,
    costPrice: Decimal,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.prisma(tx).product.update({
      where: { id },
      data: { costPrice },
    });
  }

  async findProductsByIds(
    ids: string[],
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Array<{ id: string; costPrice: Decimal | null }>> {
    return this.prisma(tx).product.findMany({
      where: {
        id: { in: ids },
        companyId,
        deletedAt: null,
      },
      select: { id: true, costPrice: true },
    }) as Promise<Array<{ id: string; costPrice: Decimal | null }>>;
  }

  // ════════════════════════════════════════
  // UNIT OF MEASURE
  // ════════════════════════════════════════

  async findUnits(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Array<Record<string, unknown>>> {
    return this.prisma(tx).unitOfMeasure.findMany({
      where: { companyId, deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // ════════════════════════════════════════
  // PRODUCT VARIANT
  // ════════════════════════════════════════

  async findVariantsByProduct(
    productId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any[]> {
    return this.prisma(tx).productVariant.findMany({
      where: {
        productId,
        deletedAt: null,
        product: { companyId },
      } as Prisma.ProductVariantWhereInput,
      orderBy: { name: 'asc' },
    });
  }

  async countVariantsByProduct(
    productId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    return this.prisma(tx).productVariant.count({
      where: { productId, deletedAt: null },
    });
  }

  async findVariantById(
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    return this.prisma(tx).productVariant.findUnique({ where: { id } });
  }

  async createVariant(
    data: Prisma.ProductVariantCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    return this.prisma(tx).productVariant.create({ data });
  }

  async updateVariant(
    id: string,
    data: Record<string, unknown>,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = this.prisma(tx);
    const result = await client.productVariant.updateMany({
      where: { id, rowVersion },
      data: { ...data, rowVersion: { increment: 1 } },
    });
    return result.count;
  }

  async softDeleteVariant(
    id: string,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = this.prisma(tx);
    const result = await client.productVariant.updateMany({
      where: { id, product: { companyId }, rowVersion },
      data: { deletedAt: new Date(), rowVersion: { increment: 1 } },
    });
    return result.count;
  }

  // ════════════════════════════════════════
  // PRODUCT BARCODE
  // ════════════════════════════════════════

  async findBarcodesByProduct(
    productId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any[]> {
    return this.prisma(tx).productBarcode.findMany({
      where: { product: { id: productId, companyId, deletedAt: null } },
      orderBy: { isPrimary: 'desc' },
    });
  }

  async findBarcodeById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    return this.prisma(tx).productBarcode.findFirst({
      where: { id, product: { companyId } },
    });
  }

  async createBarcode(
    data: Prisma.ProductBarcodeCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    return this.prisma(tx).productBarcode.create({ data });
  }

  async updateBarcode(
    id: string,
    data: Record<string, unknown>,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = this.prisma(tx);
    const result = await client.productBarcode.updateMany({
      where: { id, rowVersion },
      data: { ...data, rowVersion: { increment: 1 } },
    });
    return result.count;
  }

  async softDeleteBarcode(
    id: string,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = this.prisma(tx);
    const result = await client.productBarcode.updateMany({
      where: { id, product: { companyId }, rowVersion },
      data: { rowVersion: { increment: 1 } },
    });
    return result.count;
  }

  async updateBarcodePrimaryFlag(
    productId: string,
    isPrimary: boolean,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.prisma(tx).productBarcode.updateMany({
      where: { productId, isPrimary: true },
      data: { isPrimary },
    });
  }

  async searchProductsByBarcode(
    barcode: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any[]> {
    return this.prisma(tx).product.findMany({
      where: {
        companyId,
        deletedAt: null,
        OR: [{ barcode: { contains: barcode, mode: 'insensitive' } }],
      },
      select: { id: true, name: true, sku: true, barcode: true },
      take: 20,
    });
  }

  async findProductForBarcode(
    productId: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    return this.prisma(tx).product.findFirst({
      where: { id: productId, companyId, deletedAt: null },
    });
  }

  async updateProductPrimaryBarcode(
    productId: string,
    barcode: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.prisma(tx).product.update({
      where: { id: productId },
      data: { barcode },
    });
  }

  // ════════════════════════════════════════
  // UNIT OF MEASURE (Full CRUD)
  // ════════════════════════════════════════

  async findAllUnits(
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any[]> {
    return this.prisma(tx).unitOfMeasure.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findUnitById(
    id: string,
    companyId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    return this.prisma(tx).unitOfMeasure.findFirst({
      where: { id, companyId, deletedAt: null },
    });
  }

  async createUnit(
    data: Prisma.UnitOfMeasureCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    return this.prisma(tx).unitOfMeasure.create({ data });
  }

  async updateUnit(
    id: string,
    companyId: string,
    data: Record<string, unknown>,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = this.prisma(tx);
    const result = await client.unitOfMeasure.updateMany({
      where: { id, companyId, rowVersion },
      data: { ...data, rowVersion: { increment: 1 } },
    });
    return result.count;
  }

  async softDeleteUnit(
    id: string,
    companyId: string,
    rowVersion: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = this.prisma(tx);
    const result = await client.unitOfMeasure.updateMany({
      where: { id, companyId, rowVersion },
      data: { deletedAt: new Date(), rowVersion: { increment: 1 } },
    });
    return result.count;
  }
}
