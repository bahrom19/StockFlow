import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CostLayer, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { InventoryRepository } from '../repositories/inventory.repository';

/**
 * Result of a FIFO consumption. G9-F1 (architecture review decision 2/11):
 *
 * - `totalCost` is the canonical actual cost of the consumed quantity and is
 *   the single source of truth for COGS/GL in later phases
 *   (totalCost = layeredCost + fallbackCost).
 * - `layers` records which IN layers were consumed (id, quantity, unit cost,
 *   total cost) — persisted as the immutable OUT summary layer so refunds can
 *   restore the exact cost later (review decision 3/10).
 * - `fallbackCost` is the value of the shortfall quantity priced at the
 *   legacy product.costPrice basis (FALLBACK B). It is zero when layers fully
 *   cover the request. It is returned explicitly and logged — never silently
 *   mixed into the layered cost.
 */
export interface FifoConsumptionResult {
  totalCost: Decimal;
  layers: Array<{
    layerId: string;
    quantity: number;
    unitCost: string;
    cost: string;
  }>;
  fallbackCost: Decimal;
}

@Injectable()
export class CostingService {
  private readonly logger = new Logger(CostingService.name);

  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly prismaService: PrismaService,
  ) {}

  async recordInboundLayer(
    productId: string,
    companyId: string,
    quantity: number,
    unitCost: Decimal,
    referenceType: string,
    referenceId: string,
    batchId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const totalCost = unitCost.mul(quantity);
    const client = tx ?? this.prismaService;

    await client.costLayer.create({
      data: {
        companyId,
        productId,
        batchId: batchId ?? null,
        direction: 'IN',
        quantity,
        remainingQuantity: quantity,
        unitCost,
        totalCost,
        referenceType,
        referenceId,
      },
    });
  }

  async consumeFifoLayers(
    productId: string,
    companyId: string,
    quantity: number,
    referenceType: string,
    referenceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<FifoConsumptionResult> {
    const client = tx ?? this.prismaService;
    const layers = await this.inventoryRepository.findActiveCostLayers(
      productId,
      companyId,
      client,
    );
    let remaining = quantity;
    let totalCost = new Decimal(0);
    const consumed: Array<{
      layerId: string;
      quantity: number;
      unitCost: string;
      cost: string;
    }> = [];

    for (const layer of layers) {
      if (remaining <= 0) break;

      const consumeQty = Math.min(remaining, layer.remainingQuantity);
      const newRemaining = layer.remainingQuantity - consumeQty;
      const cost = layer.unitCost.mul(consumeQty);
      totalCost = totalCost.add(cost);

      // Optimistic lock on remainingQuantity — atomic check-and-update
      const updated = await this.inventoryRepository.consumeCostLayer(
        layer.id,
        newRemaining,
        layer.remainingQuantity,
        client,
      );

      if (!updated) {
        throw new ConflictException(
          `Cost layer ${layer.id} was modified concurrently. Please retry the transaction.`,
        );
      }

      consumed.push({
        layerId: layer.id,
        quantity: consumeQty,
        unitCost: layer.unitCost.toString(),
        cost: cost.toString(),
      });

      remaining -= consumeQty;
    }

    // G9-F1 FALLBACK B (architecture review decision 2): when active layers
    // do not cover the requested quantity, the shortfall is priced at the
    // legacy product.costPrice basis instead of failing the consuming
    // operation. This handles legacy stock that predates cost layers without
    // inventing a second costing system: the fallback amount is explicit in
    // the result, logged, and folded into totalCost so downstream consumers
    // see exactly one canonical cost. New receipts always create layers, so
    // the fallback domain is bounded and shrinks as stock turns over.
    let fallbackCost = new Decimal(0);
    if (remaining > 0) {
      const product = await this.inventoryRepository.findProductById(
        productId,
        companyId,
        client,
      );
      if (!product?.costPrice) {
        // No cost basis at all (no layers, no costPrice): keep the existing
        // adjustment-path behaviour — surface the gap rather than fabricate
        // a zero-cost layer that would distort valuation and future COGS.
        throw new Error(
          `Insufficient cost layers and no costPrice basis. Short ${remaining} units for product ${productId}`,
        );
      }
      fallbackCost = new Decimal(product.costPrice.toString()).mul(remaining);
      totalCost = totalCost.add(fallbackCost);
      this.logger.warn(
        `FIFO fallback for product ${productId}: consumed ${quantity - remaining} of ${quantity} units from layers; shortfall ${remaining} units priced at product.costPrice (${product.costPrice.toString()}) — fallback cost ${fallbackCost.toString()}`,
      );
    }

    await client.costLayer.create({
      data: {
        companyId,
        productId,
        direction: 'OUT',
        quantity,
        remainingQuantity: 0,
        unitCost: quantity > 0 ? totalCost.div(quantity) : new Decimal(0),
        totalCost,
        referenceType,
        referenceId,
      },
    });

    return { totalCost, layers: consumed, fallbackCost };
  }

  async calculateAverageCost(
    productId: string,
    companyId: string,
    tx?: any,
  ): Promise<Decimal> {
    const client = tx ?? this.prismaService;
    const layers = await this.inventoryRepository.findActiveCostLayers(
      productId,
      companyId,
      client,
    );

    if (layers.length === 0) return new Decimal(0);

    let totalCost = new Decimal(0);
    let totalQty = 0;
    for (const layer of layers) {
      totalCost = totalCost.add(layer.unitCost.mul(layer.remainingQuantity));
      totalQty += layer.remainingQuantity;
    }

    return totalQty > 0 ? totalCost.div(totalQty) : new Decimal(0);
  }

  /**
   * G9-F1 restore primitive (architecture review decision 3): creates a new
   * IN layer that restores the *value* of a previously consumed quantity at
   * a given unit cost — e.g. the OUT summary layer's average unitCost of the
   * original sale. It intentionally does NOT try to rebuild the physical
   * FIFO composition of the original consumption; company-level FIFO
   * valuation only requires the restored value to re-enter the remaining-
   * layer pool at the correct unit cost.
   *
   * Must run inside the caller's transaction (tx) so the restore commits or
   * rolls back together with the consuming business operation.
   */
  async restoreLayer(
    productId: string,
    companyId: string,
    quantity: number,
    unitCost: Decimal,
    referenceType: string,
    referenceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (quantity <= 0) {
      throw new NotFoundException(
        `Restore quantity must be positive (got ${quantity}) for product ${productId}`,
      );
    }
    await this.inventoryRepository.createCostLayer(
      {
        company: { connect: { id: companyId } },
        product: { connect: { id: productId } },
        direction: 'IN',
        quantity,
        remainingQuantity: quantity,
        unitCost,
        totalCost: unitCost.mul(quantity),
        referenceType,
        referenceId,
      },
      tx,
    );
  }

  /**
   * G9-F1 OUT-layer lookup (architecture review decision 10): finds the
   * immutable historical costing record (direction OUT) for a consuming
   * document, e.g. the sale's summary layer (referenceType='SALE',
   * referenceId=saleId). Later phases use its average unitCost to restore
   * cost on refunds.
   *
   * Company-scoped by construction. The current model assumes ONE canonical
   * OUT summary layer per consuming document (completion is guarded by a
   * rowVersion CAS, so the layer is written exactly once); if the earliest
   * record is returned here, callers of later phases must treat any additional
   * matching OUT rows as a data anomaly rather than silently consuming them —
   * the assumption is kept explicit, not hidden.
   */
  async findOutLayerByReference(
    companyId: string,
    referenceType: string,
    referenceId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CostLayer | null> {
    return this.inventoryRepository.findOutLayerByReference(
      companyId,
      referenceType,
      referenceId,
      tx,
    );
  }

  async getValuation(companyId: string): Promise<any[]> {
    const stock = await this.inventoryRepository.findAllStock(companyId);
    const valuations: any[] = [];

    for (const item of stock) {
      const avgCost = await this.calculateAverageCost(
        item.productId,
        companyId,
      );
      const value = avgCost.mul(item.quantity);

      valuations.push({
        productId: item.productId,
        warehouseId: item.warehouseId,
        quantity: item.quantity,
        averageCost: avgCost.toString(),
        inventoryValue: value.toString(),
      });
    }

    return valuations;
  }

  async getProductValuation(
    productId: string,
    companyId: string,
  ): Promise<Record<string, unknown>> {
    const stock = await this.inventoryRepository.findStockByProduct(
      productId,
      companyId,
    );
    const avgCost = await this.calculateAverageCost(productId, companyId);

    let totalQty = 0;
    for (const s of stock) {
      totalQty += s.quantity;
    }

    return {
      productId,
      quantity: totalQty,
      averageCost: avgCost.toString(),
      inventoryValue: avgCost.mul(totalQty).toString(),
      stockByWarehouse: stock.map((s) => ({
        warehouseId: s.warehouseId,
        quantity: s.quantity,
        value: avgCost.mul(s.quantity).toString(),
      })),
    };
  }
}
