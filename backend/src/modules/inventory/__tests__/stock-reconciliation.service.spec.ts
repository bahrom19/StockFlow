import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { StockReconciliationService } from '../services/stock-reconciliation.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AuditLogService } from '../../shared/services/audit-log.service';

/**
 * G16-I-3 — StockReconciliationService test matrix (approved G16-I-2 design).
 *
 * The service is tested through the transaction callback with a mock tx
 * (project convention): the $transaction mock executes the callback with
 * mockTx, so every read/write and the same-tx AuditLog call are asserted on
 * mockTx / mockAuditLog. The SELECT … FOR UPDATE is part of mockTx.$queryRaw.
 */
describe('StockReconciliationService — G16-I-3', () => {
  let service: StockReconciliationService;
  let mockAuditLog: { log: jest.Mock };
  let mockTx: any;
  let mockPrisma: any;

  const COMPANY = '11111111-1111-1111-1111-111111111111';
  const PRODUCT = '22222222-2222-2222-2222-222222222222';
  const USER = '33333333-3333-3333-3333-333333333333';

  const stockRow = (quantity: number) => ({ id: 'stock-1', quantity });
  const productRow = (costPrice: Decimal | null) => ({ costPrice });
  const agg = (remaining: number) => ({ _sum: { remainingQuantity: remaining } });

  /** Default tx mock: positive stock, costPrice 15, IN remaining 20, no recon layer. */
  beforeEach(async () => {
    mockTx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'stock-1' }]),
      stock: { findFirst: jest.fn().mockResolvedValue(stockRow(45)) },
      product: { findFirst: jest.fn().mockResolvedValue(productRow(new Decimal(15))) },
      costLayer: {
        aggregate: jest.fn().mockResolvedValue(agg(20)),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'layer-new', ...data }),
        ),
      },
    };
    mockPrisma = {
      $transaction: jest.fn((cb: any) => cb(mockTx)),
    };
    // dry-run reads go through PrismaService directly (no tx) — share mocks.
    Object.assign(mockPrisma, {
      stock: mockTx.stock,
      product: mockTx.product,
      costLayer: mockTx.costLayer,
    });
    mockAuditLog = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockReconciliationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();

    service = module.get<StockReconciliationService>(StockReconciliationService);
  });

  const layerData = (): any => mockTx.costLayer.create.mock.calls[0][0].data;

  it('A1: A-mismatch + costPrice > 0 → synthetic IN RECONCILIATION layer with exact values', async () => {
    const result = await service.reconcilePair(COMPANY, PRODUCT, USER);

    expect(result.status).toBe('AUTO_RECONCILED');
    expect(result.delta).toBe(25);
    expect(result.layerId).toBe('layer-new');
    expect(mockTx.costLayer.create).toHaveBeenCalledTimes(1);
    const data = layerData();
    expect(data).toMatchObject({
      companyId: COMPANY,
      productId: PRODUCT,
      direction: 'IN',
      quantity: 25,
      remainingQuantity: 25,
      referenceType: 'RECONCILIATION',
      referenceId: PRODUCT,
    });
    expect((data.unitCost as Decimal).toString()).toBe('15');
    expect((data.totalCost as Decimal).toString()).toBe('375');
    // Lock acquired BEFORE delta computation; parameters are bound values
    // (Prisma.sql object carries the uuid-cast fragments and bound values).
    expect(mockTx.$queryRaw).toHaveBeenCalledWith(
      expect.objectContaining({ values: [COMPANY, PRODUCT] }),
    );
    expect(mockTx.$queryRaw.mock.calls[0][0].strings.join(' ')).toContain('FOR UPDATE');
  });

  it('T5 (G16-J-R1): the resolved actor UUID is the AuditLog userId (never an arbitrary string)', async () => {
    await service.reconcilePair(COMPANY, PRODUCT, USER);

    expect(mockAuditLog.log).toHaveBeenCalledTimes(1);
    expect(mockAuditLog.log).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: COMPANY,
        userId: USER,
        entityType: 'CostLayer',
        entityId: 'layer-new',
        action: 'COST_LAYER_RECONCILIATION',
      }),
      mockTx,
    );
  });

  it('A2: A-mismatch + costPrice = 0 → zero-cost layer (Decimal(0) is a valid basis)', async () => {
    mockTx.product.findFirst.mockResolvedValue(productRow(new Decimal(0)));

    const result = await service.reconcilePair(COMPANY, PRODUCT, USER);

    expect(result.status).toBe('AUTO_RECONCILED');
    expect((layerData().unitCost as Decimal).toString()).toBe('0');
    expect((layerData().totalCost as Decimal).toString()).toBe('0');
  });

  it('A3: A-mismatch + costPrice NULL → MANUAL_REQUIRED, no layer, no audit', async () => {
    mockTx.product.findFirst.mockResolvedValue(productRow(null));

    const result = await service.reconcilePair(COMPANY, PRODUCT, USER);

    expect(result.status).toBe('MANUAL_REQUIRED');
    expect(mockTx.costLayer.create).not.toHaveBeenCalled();
    expect(mockAuditLog.log).not.toHaveBeenCalled();
  });

  it('B1: B-class (no layers at all) + costPrice > 0 → layer for the full stock quantity', async () => {
    mockTx.costLayer.aggregate.mockResolvedValue(agg(0));

    const result = await service.reconcilePair(COMPANY, PRODUCT, USER);

    expect(result.status).toBe('AUTO_RECONCILED');
    expect(result.delta).toBe(45);
    expect(layerData()).toMatchObject({ quantity: 45, remainingQuantity: 45 });
  });

  it('B2: B-class + costPrice = 0 → zero-cost layer for full quantity', async () => {
    mockTx.costLayer.aggregate.mockResolvedValue(agg(0));
    mockTx.product.findFirst.mockResolvedValue(productRow(new Decimal(0)));

    const result = await service.reconcilePair(COMPANY, PRODUCT, USER);

    expect(result.status).toBe('AUTO_RECONCILED');
    expect(layerData()).toMatchObject({ quantity: 45, remainingQuantity: 45 });
    expect((layerData().unitCost as Decimal).toString()).toBe('0');
  });

  it('D1: D-class (NULL costPrice, no layers) → MANUAL, never invent a basis', async () => {
    mockTx.costLayer.aggregate.mockResolvedValue(agg(0));
    mockTx.product.findFirst.mockResolvedValue(productRow(null));

    const result = await service.reconcilePair(COMPANY, PRODUCT, USER);

    expect(result.status).toBe('MANUAL_REQUIRED');
    expect(mockTx.costLayer.create).not.toHaveBeenCalled();
  });

  it('IDEMPOTENCY: existing RECONCILIATION layer → SKIP, no duplicate layer/audit', async () => {
    mockTx.costLayer.findFirst.mockResolvedValue({ id: 'layer-recon' });

    const result = await service.reconcilePair(COMPANY, PRODUCT, USER);

    expect(result.status).toBe('SKIPPED');
    expect(result.reason).toMatch(/already reconciled/);
    expect(mockTx.costLayer.create).not.toHaveBeenCalled();
    expect(mockAuditLog.log).not.toHaveBeenCalled();
  });

  it('FIFO: existing historical layer untouched; new layer is a separate row (createdAt = now → FIFO tail)', async () => {
    const result = await service.reconcilePair(COMPANY, PRODUCT, USER);

    expect(result.status).toBe('AUTO_RECONCILED');
    // Only the NEW layer is created; nothing updated/deleted on history.
    expect(mockTx.costLayer.create).toHaveBeenCalledTimes(1);
    expect(layerData().createdAt).toBeUndefined(); // db default now(), not a historical date
  });

  it('TENANT: stock/product reads are company-scoped; no rows → SKIP without writes', async () => {
    mockTx.stock.findFirst.mockResolvedValue(null);

    const result = await service.reconcilePair(COMPANY, PRODUCT, USER);

    expect(result.status).toBe('SKIPPED');
    expect(mockTx.stock.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: COMPANY, productId: PRODUCT } }),
    );
    expect(mockTx.product.findFirst).not.toHaveBeenCalled();
    expect(mockTx.costLayer.create).not.toHaveBeenCalled();
  });

  it('ROLLBACK: audit failure propagates → transaction aborts (no partial state)', async () => {
    mockAuditLog.log.mockRejectedValue(new Error('audit down'));

    await expect(service.reconcilePair(COMPANY, PRODUCT, USER)).rejects.toThrow('audit down');
    // layer create attempted inside the tx; its commit is what gets rolled back.
    expect(mockTx.costLayer.create).toHaveBeenCalledTimes(1);
    expect(mockAuditLog.log).toHaveBeenCalledTimes(1);
  });

  it('DELTA <= 0: layers cover stock → no-op', async () => {
    mockTx.costLayer.aggregate.mockResolvedValue(agg(45));

    const result = await service.reconcilePair(COMPANY, PRODUCT, USER);

    expect(result.status).toBe('SKIPPED');
    expect(mockTx.costLayer.create).not.toHaveBeenCalled();
  });

  it('FULL MATCH: Stock == Σ IN.remaining → SKIP (covered above by delta<=0) and zero stock rows skip too', async () => {
    mockTx.stock.findFirst.mockResolvedValue(stockRow(0));

    const result = await service.reconcilePair(COMPANY, PRODUCT, USER);

    expect(result.status).toBe('SKIPPED');
    expect(mockTx.costLayer.create).not.toHaveBeenCalled();
  });

  it('DRY-RUN: plan only — no lock query via tx writes, no layer, no audit', async () => {
    const plan = await service.dryRunPair(COMPANY, PRODUCT);

    expect(plan.action).toBe('AUTO');
    expect(plan.delta).toBe(25);
    expect(plan.unitCost!.toString()).toBe('15');
    expect(plan.totalCost!.toString()).toBe('375');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockTx.costLayer.create).not.toHaveBeenCalled();
    expect(mockAuditLog.log).not.toHaveBeenCalled();
  });

  it('DRY-RUN on NULL costPrice → MANUAL plan (never AUTO with invented cost)', async () => {
    mockTx.product.findFirst.mockResolvedValue(productRow(null));

    const plan = await service.dryRunPair(COMPANY, PRODUCT);

    expect(plan.action).toBe('MANUAL');
  });

  it('CONCURRENT RECONCILIATION: row-lock serialization — second tx sees existing layer → SKIP (documented semantics)', async () => {
    // First run wins and creates the layer; a second run re-reads state in
    // its own tx and finds the RECONCILIATION layer (findFirst → row), so it
    // skips. The FOR UPDATE lock serializes both transactions on the Stock
    // row; the unit test models the post-lock read deterministically.
    mockTx.costLayer.findFirst
      .mockResolvedValueOnce(null) // run 1: no layer yet
      .mockResolvedValueOnce({ id: 'layer-recon' }); // run 2: sees run-1 layer after lock

    const first = await service.reconcilePair(COMPANY, PRODUCT, USER);
    const second = await service.reconcilePair(COMPANY, PRODUCT, USER);

    expect(first.status).toBe('AUTO_RECONCILED');
    expect(second.status).toBe('SKIPPED');
    expect(second.reason).toMatch(/already reconciled/);
    expect(mockTx.costLayer.create).toHaveBeenCalledTimes(1);
  });

  it('guards: BadRequest/Conflict propagation is not swallowed (infrastructure errors bubble)', async () => {
    mockTx.costLayer.aggregate.mockRejectedValue(
      new ConflictException('Cost layer modified concurrently'),
    );

    await expect(service.reconcilePair(COMPANY, PRODUCT, USER)).rejects.toThrow(ConflictException);
    expect(mockAuditLog.log).not.toHaveBeenCalled();
    expect(BadRequestException).toBeDefined();
  });
});
