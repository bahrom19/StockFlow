import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { CostLayer, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { CostingService } from '../services/costing.service';
import { InventoryRepository } from '../repositories/inventory.repository';
import { PrismaService } from '../../../common/prisma';

/**
 * G9-F1 — costing foundation primitives.
 *
 * Canonical cost = FIFO CostLayer (architecture review decision 1).
 * consumeFifoLayers must return the canonical consumed cost, the consumed
 * layer detail, and an explicit FALLBACK B amount (shortfall priced at
 * product.costPrice) instead of failing legacy-stock operations.
 * restoreLayer + findOutLayerByReference prepare refund restoration without
 * touching any production flow.
 */
describe('CostingService — G9-F1 foundation', () => {
  let service: CostingService;
  let repo: {
    findActiveCostLayers: jest.Mock;
    consumeCostLayer: jest.Mock;
    createCostLayer: jest.Mock;
    findProductById: jest.Mock;
    findOutLayerByReference: jest.Mock;
  };

  const layer = (
    id: string,
    unitCost: string,
    remainingQuantity: number,
    createdAt = new Date('2026-01-01T00:00:00Z'),
  ): CostLayer =>
    ({
      id,
      companyId: 'company-1',
      productId: 'prod-1',
      batchId: null,
      direction: 'IN',
      quantity: remainingQuantity,
      remainingQuantity,
      unitCost: new Decimal(unitCost),
      totalCost: new Decimal(unitCost).mul(remainingQuantity),
      referenceType: 'PURCHASE',
      referenceId: 'po-1',
      rowVersion: 0,
      createdAt,
      updatedAt: createdAt,
    }) as unknown as CostLayer;

  // Existing consumeFifoLayers writes its OUT summary layer directly through
  // the tx client (pre-existing behavior, preserved); restoreLayer uses the
  // repository createCostLayer helper. Mock both surfaces.
  const outLayerCreate = jest.fn().mockResolvedValue({});
  const tx = {
    costLayer: { create: outLayerCreate },
  } as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    outLayerCreate.mockClear();
    repo = {
      findActiveCostLayers: jest.fn().mockResolvedValue([]),
      consumeCostLayer: jest.fn().mockResolvedValue(true),
      createCostLayer: jest
        .fn()
        .mockImplementation((_data, client) => Promise.resolve({})),
      findProductById: jest.fn().mockResolvedValue(null),
      findOutLayerByReference: jest.fn().mockResolvedValue(null),
    };
    service = new CostingService(
      repo as unknown as InventoryRepository,
      { $transaction: jest.fn() } as unknown as PrismaService,
    );
  });

  // ── FIFO consumption ────────────────────────────────────────────────

  it('consumes multiple layers FIFO and returns canonical cost with zero fallback (10×100 + 10×150, consume 12)', async () => {
    repo.findActiveCostLayers.mockResolvedValue([
      layer('layer-a', '100', 10, new Date('2026-01-01T00:00:00Z')),
      layer('layer-b', '150', 10, new Date('2026-02-01T00:00:00Z')),
    ]);

    const result = await service.consumeFifoLayers(
      'prod-1',
      'company-1',
      12,
      'SALE',
      'sale-1',
      tx,
    );

    expect(result.layers).toEqual([
      { layerId: 'layer-a', quantity: 10, unitCost: '100', cost: '1000' },
      { layerId: 'layer-b', quantity: 2, unitCost: '150', cost: '300' },
    ]);
    expect(result.totalCost.toString()).toBe('1300');
    expect(result.fallbackCost.toString()).toBe('0');
    // CAS: full drain of layer A (remaining 0), partial of layer B (remaining 8)
    expect(repo.consumeCostLayer).toHaveBeenNthCalledWith(
      1,
      'layer-a',
      0,
      10,
      tx,
    );
    expect(repo.consumeCostLayer).toHaveBeenNthCalledWith(
      2,
      'layer-b',
      8,
      10,
      tx,
    );
    // Immutable OUT summary layer records the canonical average cost
    expect(outLayerCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'company-1',
        direction: 'OUT',
        quantity: 12,
        remainingQuantity: 0,
        unitCost: expect.any(Decimal),
        totalCost: expect.any(Decimal),
        referenceType: 'SALE',
        referenceId: 'sale-1',
      }),
    });
    const outData = outLayerCreate.mock.calls[0][0].data;
    expect((outData.unitCost as Decimal).toString()).toBe(
      new Decimal('1300').div(12).toString(),
    );
  });

  it('partially consumes a single layer (10×100, consume 4 → remaining 6)', async () => {
    repo.findActiveCostLayers.mockResolvedValue([layer('layer-a', '100', 10)]);

    const result = await service.consumeFifoLayers(
      'prod-1',
      'company-1',
      4,
      'ADJUSTMENT',
      'ref-1',
      tx,
    );

    expect(result.totalCost.toString()).toBe('400');
    expect(result.fallbackCost.toString()).toBe('0');
    expect(result.layers).toEqual([
      { layerId: 'layer-a', quantity: 4, unitCost: '100', cost: '400' },
    ]);
    expect(repo.consumeCostLayer).toHaveBeenCalledWith('layer-a', 6, 10, tx);
  });

  it('handles the exact layer boundary (10×100, consume 10 → remaining 0, fallback 0)', async () => {
    repo.findActiveCostLayers.mockResolvedValue([layer('layer-a', '100', 10)]);

    const result = await service.consumeFifoLayers(
      'prod-1',
      'company-1',
      10,
      'ADJUSTMENT',
      'ref-1',
      tx,
    );

    expect(result.totalCost.toString()).toBe('1000');
    expect(result.fallbackCost.toString()).toBe('0');
    expect(repo.consumeCostLayer).toHaveBeenCalledWith('layer-a', 0, 10, tx);
  });

  it('keeps Decimal precision across multiple layers with fractional unit costs', async () => {
    repo.findActiveCostLayers.mockResolvedValue([
      layer('layer-a', '100.3333', 10),
      layer('layer-b', '150.7777', 10),
    ]);

    const result = await service.consumeFifoLayers(
      'prod-1',
      'company-1',
      12,
      'SALE',
      'sale-1',
      tx,
    );

    // 10 × 100.3333 + 2 × 150.7777 — exact Decimal arithmetic, no float drift
    const expected = new Decimal('100.3333')
      .mul(10)
      .add(new Decimal('150.7777').mul(2));
    expect(result.totalCost.toString()).toBe(expected.toString());
    expect(result.totalCost.toString()).toBe('1304.8884');
    expect(result.fallbackCost.toString()).toBe('0');
  });

  // ── FALLBACK B ──────────────────────────────────────────────────────

  it('applies FALLBACK B for the shortfall when layers are insufficient (5×100 available, 8 requested, costPrice 120)', async () => {
    repo.findActiveCostLayers.mockResolvedValue([layer('layer-a', '100', 5)]);
    repo.findProductById.mockResolvedValue({
      id: 'prod-1',
      costPrice: new Decimal('120'),
      costingMethod: 'AVERAGE',
    });

    const result = await service.consumeFifoLayers(
      'prod-1',
      'company-1',
      8,
      'SALE',
      'sale-1',
      tx,
    );

    expect(result.layers).toEqual([
      { layerId: 'layer-a', quantity: 5, unitCost: '100', cost: '500' },
    ]);
    // layered 500 + fallback 3 × 120 = 360 → total 860
    expect(result.fallbackCost.toString()).toBe('360');
    expect(result.totalCost.toString()).toBe('860');
    expect(repo.findProductById).toHaveBeenCalledWith(
      'prod-1',
      'company-1',
      tx,
    );
    const outData = outLayerCreate.mock.calls[0][0].data;
    expect((outData.totalCost as Decimal).toString()).toBe('860');
  });

  it('fully falls back when no layers exist (8 requested, costPrice 120 → total 960, layers [])', async () => {
    repo.findActiveCostLayers.mockResolvedValue([]);
    repo.findProductById.mockResolvedValue({
      id: 'prod-1',
      costPrice: new Decimal('120'),
      costingMethod: 'AVERAGE',
    });

    const result = await service.consumeFifoLayers(
      'prod-1',
      'company-1',
      8,
      'SALE',
      'sale-1',
      tx,
    );

    expect(result.layers).toEqual([]);
    expect(result.fallbackCost.toString()).toBe('960');
    expect(result.totalCost.toString()).toBe('960');
    expect(repo.consumeCostLayer).not.toHaveBeenCalled();
    expect(outLayerCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        direction: 'OUT',
        quantity: 8,
        totalCost: expect.any(Decimal),
      }),
    });
  });

  it('G16-H-3 T2: fully falls back with costPrice = Decimal(0) — valid zero-cost basis, total 0', async () => {
    repo.findActiveCostLayers.mockResolvedValue([]);
    repo.findProductById.mockResolvedValue({
      id: 'prod-1',
      costPrice: new Decimal('0'),
      costingMethod: 'AVERAGE',
    });

    const result = await service.consumeFifoLayers(
      'prod-1',
      'company-1',
      8,
      'SALE',
      'sale-1',
      tx,
    );

    expect(result.layers).toEqual([]);
    expect(result.fallbackCost.toString()).toBe('0');
    expect(result.totalCost.toString()).toBe('0');
    expect(repo.consumeCostLayer).not.toHaveBeenCalled();
    const outData = outLayerCreate.mock.calls[0][0].data;
    expect(outData.direction).toBe('OUT');
    expect(outData.quantity).toBe(8);
    expect((outData.totalCost as Decimal).toString()).toBe('0');
    expect((outData.unitCost as Decimal).toString()).toBe('0');
  });

  it('G16-H-3 T4: partial FIFO + zero-cost fallback — shortfall valued at 0, total = layered cost', async () => {
    repo.findActiveCostLayers.mockResolvedValue([layer('layer-a', '100', 5)]);
    repo.findProductById.mockResolvedValue({
      id: 'prod-1',
      costPrice: new Decimal('0'),
      costingMethod: 'AVERAGE',
    });

    const result = await service.consumeFifoLayers(
      'prod-1',
      'company-1',
      8,
      'SALE',
      'sale-1',
      tx,
    );

    // layered 500 + fallback 3 × 0 = 0 → total 500; no false no-basis error
    expect(result.layers).toEqual([
      { layerId: 'layer-a', quantity: 5, unitCost: '100', cost: '500' },
    ]);
    expect(result.fallbackCost.toString()).toBe('0');
    expect(result.totalCost.toString()).toBe('500');
    const outData = outLayerCreate.mock.calls[0][0].data;
    expect((outData.totalCost as Decimal).toString()).toBe('500');
    // deterministic blended unitCost = totalCost / requestedQty = 500 / 8
    expect((outData.unitCost as Decimal).toString()).toBe('62.5');
  });

  it('throws when layers are insufficient and no product.costPrice basis exists', async () => {
    repo.findActiveCostLayers.mockResolvedValue([layer('layer-a', '100', 5)]);
    repo.findProductById.mockResolvedValue({
      id: 'prod-1',
      costPrice: null,
      costingMethod: 'AVERAGE',
    });

    // G16-F: the no-basis gap is a typed business validation failure (400),
    // not an untyped infrastructure error — that untyped Error was what the
    // adjustment path used to swallow, silently desyncing Stock from layers.
    await expect(
      service.consumeFifoLayers('prod-1', 'company-1', 8, 'SALE', 'sale-1', tx),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.consumeFifoLayers('prod-1', 'company-1', 8, 'SALE', 'sale-1', tx),
    ).rejects.toThrow(/no costPrice basis/);
    expect(outLayerCreate).not.toHaveBeenCalled();
  });

  // ── G16-H-1: resolvePositiveEntryUnitCost (shared positive-entry ladder) ──

  it('G16-H-1 resolver: valued layers → AVERAGE (costPrice not consulted)', async () => {
    repo.findActiveCostLayers.mockResolvedValue([
      { unitCost: new Decimal('100'), remainingQuantity: 5 } as CostLayer,
    ]);

    const r = await service.resolvePositiveEntryUnitCost(
      'prod-1',
      'company-1',
      tx,
    );

    expect(r).toEqual({ unitCost: new Decimal('100'), source: 'AVERAGE' });
    expect(repo.findProductById).not.toHaveBeenCalled();
  });

  it('G16-H-1 resolver: no layers + positive costPrice → COST_PRICE', async () => {
    repo.findActiveCostLayers.mockResolvedValue([]);
    repo.findProductById.mockResolvedValue({
      id: 'prod-1',
      costPrice: new Decimal('120'),
    } as any);

    const r = await service.resolvePositiveEntryUnitCost(
      'prod-1',
      'company-1',
      tx,
    );

    expect(r).toEqual({ unitCost: new Decimal('120'), source: 'COST_PRICE' });
  });

  it('G16-H-1 resolver: Decimal(0) costPrice is a VALID COST_PRICE basis (null-check, not truthiness)', async () => {
    repo.findActiveCostLayers.mockResolvedValue([]);
    repo.findProductById.mockResolvedValue({
      id: 'prod-1',
      costPrice: new Decimal('0'),
    } as any);

    const r = await service.resolvePositiveEntryUnitCost(
      'prod-1',
      'company-1',
      tx,
    );

    expect(r).toEqual({ unitCost: new Decimal('0'), source: 'COST_PRICE' });
  });

  it('G16-H-1 resolver: no layers + null costPrice → NONE', async () => {
    repo.findActiveCostLayers.mockResolvedValue([]);
    repo.findProductById.mockResolvedValue({
      id: 'prod-1',
      costPrice: null,
    } as any);

    const r = await service.resolvePositiveEntryUnitCost(
      'prod-1',
      'company-1',
      tx,
    );

    expect(r).toEqual({ unitCost: null, source: 'NONE' });
  });

  it('G16-H-1 resolver: tenant-scoped lookups (companyId passed through)', async () => {
    repo.findActiveCostLayers.mockResolvedValue([]);
    repo.findProductById.mockResolvedValue(null as any);

    await service.resolvePositiveEntryUnitCost('prod-1', 'company-1', tx);

    expect(repo.findActiveCostLayers).toHaveBeenCalledWith(
      'prod-1',
      'company-1',
      tx,
    );
    expect(repo.findProductById).toHaveBeenCalledWith(
      'prod-1',
      'company-1',
      tx,
    );
  });

  it('propagates ConflictException on layer CAS loss without writing the OUT layer', async () => {
    repo.findActiveCostLayers.mockResolvedValue([layer('layer-a', '100', 10)]);
    repo.consumeCostLayer.mockResolvedValue(false); // concurrent modification

    await expect(
      service.consumeFifoLayers('prod-1', 'company-1', 4, 'SALE', 'sale-1', tx),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(outLayerCreate).not.toHaveBeenCalled();
  });

  // ── restoreLayer ────────────────────────────────────────────────────

  it('creates a restoration IN layer with exact quantity, cost and reference metadata', async () => {
    await service.restoreLayer(
      'prod-1',
      'company-1',
      12,
      new Decimal('108.3333333333'),
      'REFUND_RESTORE',
      'sale-1',
      tx,
    );

    expect(repo.createCostLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        company: { connect: { id: 'company-1' } },
        product: { connect: { id: 'prod-1' } },
        direction: 'IN',
        quantity: 12,
        remainingQuantity: 12,
        unitCost: expect.any(Decimal),
        totalCost: expect.any(Decimal),
        referenceType: 'REFUND_RESTORE',
        referenceId: 'sale-1',
      }),
      tx,
    );
    const data = repo.createCostLayer.mock.calls[0][0];
    expect((data.totalCost as Decimal).toString()).toBe(
      new Decimal('108.3333333333').mul(12).toString(),
    );
  });

  it('rejects non-positive restore quantities', async () => {
    await expect(
      service.restoreLayer(
        'prod-1',
        'company-1',
        0,
        new Decimal('100'),
        'REFUND_RESTORE',
        'sale-1',
        tx,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.createCostLayer).not.toHaveBeenCalled();
  });

  // ── findOutLayerByReference ─────────────────────────────────────────

  it('delegates OUT lookup to the repository scoped by company + reference', async () => {
    await service.findOutLayerByReference('company-1', 'SALE', 'sale-1', tx);
    expect(repo.findOutLayerByReference).toHaveBeenCalledWith(
      'company-1',
      'SALE',
      'sale-1',
      tx,
    );
  });

  it('returns null for a foreign company or mismatched reference (repository contract)', async () => {
    // The repository WHERE clause carries companyId + direction + reference;
    // a foreign company / other reference simply finds nothing.
    repo.findOutLayerByReference.mockResolvedValue(null);
    const foreign = await service.findOutLayerByReference(
      'company-2',
      'SALE',
      'sale-1',
      tx,
    );
    const otherRef = await service.findOutLayerByReference(
      'company-1',
      'SALE',
      'sale-999',
      tx,
    );
    expect(foreign).toBeNull();
    expect(otherRef).toBeNull();
    // direction=IN layers can never satisfy the OUT lookup (WHERE direction: 'OUT')
    expect(repo.findOutLayerByReference).toHaveBeenCalledWith(
      'company-2',
      'SALE',
      'sale-1',
      tx,
    );
  });
});
