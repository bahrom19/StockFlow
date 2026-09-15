import { Decimal } from '@prisma/client/runtime/library';
import { FinanceIntegrationService } from '../services/finance-integration.service';
import {
  SaleCompletedEventPayload,
  SaleItemEvent,
} from '../../sales/interfaces/sale-event.interface';

/**
 * G9-F2.2.1 — Finance COGS from canonical FIFO OUT CostLayers.
 *
 * Approved policy under test:
 * - PRIMARY: COGS = SUM(OUT.totalCost) where the OUT CostLayers were written
 *   by the Inventory handler in the SAME transaction
 *   (companyId, direction='OUT', referenceType='SALE', referenceId=saleId);
 * - NO OUT layers  → legacy fallback Σ(item.costPrice × quantity) + warn;
 * - PARTIAL OUT    → anomaly: error + FULL legacy basis (never mix FIFO/legacy);
 * - Decimal-only money math; the passed transactionClient reaches glEngine.post
 *   untouched; glEngine failures propagate (rollback upstream).
 *
 * The Inventory/FIFO engine itself is covered by costing-foundation.spec.ts;
 * G9-F2.1 handler behavior by sale-completed-fifo.spec.ts.
 */
describe('FinanceIntegrationService.onSaleCompleted — G9-F2.2.1 canonical FIFO COGS', () => {
  let service: FinanceIntegrationService;
  let periods: { findCurrent: jest.Mock };
  let gl: { post: jest.Mock };
  let tx: {
    chartOfAccount: { findMany: jest.Mock };
    costLayer: { findMany: jest.Mock };
  };
  let warnSpy: jest.Mock;
  let errorSpy: jest.Mock;

  const accounts = [
    { id: 'acc-cash', code: '1010' },
    { id: 'acc-bank', code: '1020' },
    { id: 'acc-ar', code: '1200' },
    { id: 'acc-revenue', code: '4000' },
    { id: 'acc-cogs', code: '5000' },
    { id: 'acc-inventory', code: '1300' },
  ];

  const item = (
    productId: string,
    quantity: number,
    costPrice: string,
  ): SaleItemEvent => ({
    productId,
    quantity,
    unitPrice: '100',
    costPrice,
    discount: '0',
    subtotal: new Decimal('100').mul(quantity).toString(),
    total: new Decimal('100').mul(quantity).toString(),
    margin: '0',
  });

  const payload = (items: SaleItemEvent[]): SaleCompletedEventPayload => ({
    saleId: 'sale-1',
    companyId: 'comp-1',
    warehouseId: 'wh-1',
    cashierId: 'user-1',
    customerId: null,
    saleNumber: 'SALE-001',
    subtotal: '0',
    discount: '0',
    total: '100',
    paidAmount: '100',
    changeAmount: '0',
    currency: 'KZT',
    items,
    payments: [{ method: 'CASH', amount: '100' }],
  });

  const outLayer = (totalCost: string) => ({
    id: `out-${totalCost}`,
    totalCost: new Decimal(totalCost),
  });

  const cogsLine = (): { accountId: string; debit: string; credit: string } | undefined => {
    const lines = gl.post.mock.calls[0][0].lines;
    return lines.find((l: { accountId: string }) => l.accountId === 'acc-cogs');
  };

  const inventoryLine = (): { accountId: string; credit: string } | undefined => {
    const lines = gl.post.mock.calls[0][0].lines;
    return lines.find(
      (l: { accountId: string }) => l.accountId === 'acc-inventory',
    );
  };

  beforeEach(() => {
    periods = { findCurrent: jest.fn().mockResolvedValue({ id: 'fp-1' }) };
    gl = {
      post: jest.fn().mockResolvedValue({
        id: 'je-1',
        entryNumber: 1,
        status: 'POSTED',
        totalDebit: '0',
        totalCredit: '0',
      }),
    };
    tx = {
      chartOfAccount: { findMany: jest.fn().mockResolvedValue(accounts) },
      costLayer: { findMany: jest.fn().mockResolvedValue([]) },
    };
    warnSpy = jest.fn();
    errorSpy = jest.fn();
    service = new FinanceIntegrationService(
      periods as never,
      gl as never,
    );
    (service as unknown as { logger: unknown }).logger = {
      warn: warnSpy,
      error: errorSpy,
    };
  });

  // ── TEST 1: Full OUT — canonical SUM, legacy ignored ────────────────

  it('uses SUM(OUT.totalCost) as COGS (100.25 + 50.75 = 151) and ignores legacy costPrice', async () => {
    tx.costLayer.findMany.mockResolvedValue([outLayer('100.25'), outLayer('50.75')]);

    await service.onSaleCompleted(
      payload([item('prod-a', 1, '999'), item('prod-b', 1, '999')]),
      tx as never,
    );

    const cogs = cogsLine();
    expect(cogs).toBeDefined();
    expect(new Decimal(cogs!.debit).toString()).toBe('151');
    // FIFO-only: legacy basis (999 × 2 = 1998) must NOT appear anywhere
    expect(cogs!.debit).not.toBe('1998');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
  // ── TEST 2: Multi-item aggregation ──────────────────────────────────

  it('aggregates multiple OUT layers for a multi-item sale (10 + 20 + 30 = 60)', async () => {
    tx.costLayer.findMany.mockResolvedValue([
      outLayer('10'),
      outLayer('20'),
      outLayer('30'),
    ]);

    await service.onSaleCompleted(
      payload([
        item('prod-a', 1, '5'),
        item('prod-b', 2, '6'),
        item('prod-c', 1, '7'),
      ]),
      tx as never,
    );

    expect(new Decimal(cogsLine()!.debit).toString()).toBe('60');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  // ── TEST 3: No OUT layers → legacy fallback + warn ──────────────────

  it('falls back to legacy Σ(costPrice × quantity) with a warn when no OUT layers exist', async () => {
    tx.costLayer.findMany.mockResolvedValue([]);

    await service.onSaleCompleted(
      payload([item('prod-a', 2, '100'), item('prod-b', 1, '50')]),
      tx as never,
    );

    // 2×100 + 1×50 = 250
    expect(new Decimal(cogsLine()!.debit).toString()).toBe('250');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('sale-1');
    expect(warnSpy.mock.calls[0][0]).toContain('no OUT cost layers');
  });

  // ── TEST 4: Partial OUT → anomaly: error + FULL legacy, never mixed ─

  it('treats partial OUT as anomaly: error logged and FULL legacy used without mixing', async () => {
    // OUT layers would sum to 333 if (wrongly) mixed with legacy — must not happen
    tx.costLayer.findMany.mockResolvedValue([outLayer('111'), outLayer('222')]);

    await service.onSaleCompleted(
      payload([
        item('prod-a', 1, '10'),
        item('prod-b', 1, '20'),
        item('prod-c', 1, '30'),
      ]),
      tx as never,
    );

    // full legacy: 10 + 20 + 30 = 60 (NOT 111+222+30, NOT 111+222)
    expect(new Decimal(cogsLine()!.debit).toString()).toBe('60');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain('sale-1');
    expect(errorSpy.mock.calls[0][0]).toContain('foundOutLayers=2');
    expect(errorSpy.mock.calls[0][0]).toContain('expectedSaleItems=3');
  });

  // ── TEST 5: Tenant isolation ────────────────────────────────────────

  it('queries OUT layers with tenant-safe companyId + SALE reference filter', async () => {
    tx.costLayer.findMany.mockResolvedValue([outLayer('100')]);

    await service.onSaleCompleted(
      payload([item('prod-a', 1, '999')]),
      tx as never,
    );

    expect(tx.costLayer.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'comp-1',
        direction: 'OUT',
        referenceType: 'SALE',
        referenceId: 'sale-1',
      },
    });
  });
  // ── TEST 6: Decimal precision ───────────────────────────────────────

  it('keeps exact Decimal precision (100.3333 + 20.6667 = 121.0000) without float conversion', async () => {
    tx.costLayer.findMany.mockResolvedValue([
      outLayer('100.3333'),
      outLayer('20.6667'),
    ]);

    await service.onSaleCompleted(
      payload([item('prod-a', 1, '1'), item('prod-b', 1, '1')]),
      tx as never,
    );

    const debit = cogsLine()!.debit;
    expect(typeof debit).toBe('string'); // journal line carries a string, not a JS number
    expect(new Decimal(debit).eq('121.0000')).toBe(true);
  });

  // ── TEST 7: Transaction propagation ─────────────────────────────────

  it('passes the exact same transactionClient to glEngine.post', async () => {
    tx.costLayer.findMany.mockResolvedValue([outLayer('100')]);

    await service.onSaleCompleted(
      payload([item('prod-a', 1, '999')]),
      tx as never,
    );

    expect(gl.post).toHaveBeenCalledWith(
      expect.objectContaining({ referenceType: 'SALE', referenceId: 'sale-1' }),
      tx,
    );
  });

  // ── TEST 8: glEngine failure propagates ─────────────────────────────

  it('propagates glEngine.post failures (no swallow) so the sale transaction rolls back', async () => {
    tx.costLayer.findMany.mockResolvedValue([outLayer('100')]);
    gl.post.mockRejectedValue(new Error('Journal entry is not balanced'));

    await expect(
      service.onSaleCompleted(
        payload([item('prod-a', 1, '999')]),
        tx as never,
      ),
    ).rejects.toThrow('Journal entry is not balanced');
  });

  // ── TEST 9: Legacy compatibility journal ────────────────────────────

  it('produces a correct legacy journal for a sale without OUT layers (G9-F2.1 pre-deploy compatibility)', async () => {
    tx.costLayer.findMany.mockResolvedValue([]);

    await service.onSaleCompleted(
      payload([item('prod-a', 2, '100')]),
      tx as never,
    );

    const cogs = cogsLine();
    expect(new Decimal(cogs!.debit).toString()).toBe('200');
    expect(cogs!.credit).toBe('0');
    expect(inventoryLine()!.credit).toBe('200');
    expect(cogs).toMatchObject({ accountId: 'acc-cogs' });
  });

  // ── TEST 10: COGS journal amount == OUT totalCost ───────────────────

  it('makes the COGS journal amount exactly equal to the OUT totalCost sum (41.5 + 58.5 = 100)', async () => {
    tx.costLayer.findMany.mockResolvedValue([outLayer('41.5'), outLayer('58.5')]);

    await service.onSaleCompleted(
      payload([item('prod-a', 1, '999'), item('prod-b', 3, '999')]),
      tx as never,
    );

    const cogs = cogsLine();
    const inventory = inventoryLine();
    expect(new Decimal(cogs!.debit).toString()).toBe('100');
    // balanced COGS pair: Dr COGS / Cr Inventory for the same amount
    expect(new Decimal(inventory!.credit).toString()).toBe('100');
  });

  // ── TEST 11: Zero cost — existing behavior preserved ────────────────

  it('creates no COGS lines when total cost is zero (existing zero-amount guard)', async () => {
    tx.costLayer.findMany.mockResolvedValue([]);

    await service.onSaleCompleted(
      payload([item('prod-a', 2, '0')]),
      tx as never,
    );

    expect(cogsLine()).toBeUndefined();
    expect(inventoryLine()).toBeUndefined();
    // revenue side is still posted
    const lines = gl.post.mock.calls[0][0].lines;
    expect(lines.some((l: { accountId: string }) => l.accountId === 'acc-revenue')).toBe(true);
  });
});
