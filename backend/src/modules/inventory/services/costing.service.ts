import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../common/prisma';
import { InventoryRepository } from '../repositories/inventory.repository';

@Injectable()
export class CostingService {
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
  ): Promise<{
    totalCost: Decimal;
    layers: Array<{
      layerId: string;
      quantity: number;
      unitCost: string;
      cost: string;
    }>;
  }> {
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

    if (remaining > 0) {
      throw new Error(
        `Insufficient cost layers. Short ${remaining} units for product ${productId}`,
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

    return { totalCost, layers: consumed };
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
