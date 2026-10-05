import { InventoryFinanceHandler } from '../finance-integration.handler';
import { AuditLogService } from '../../../shared/services/audit-log.service';
import {
  GlEngineService,
  PostJournalEntryInput,
} from '../../../finance/services/gl-engine.service';
import { PrismaService } from '../../../../common/prisma';

/**
 * G16-F (NWD-02) — GL skip observability.
 *
 * The InventoryFinanceHandler legitimately skips journal creation for four
 * conditions (no tx context, missing COA 1300/5100, no OPEN period, zero
 * amount). Before G16-F those skips were invisible (warn-log only), which
 * meant stock could move without its GL leg and nobody would know. Now each
 * skip persists a durable, company-scoped AuditLog record carrying the full
 * posting reference (replay-ready), while the business operation itself
 * stays successful — observable-skip, never fail-closed.
 */
describe('InventoryFinanceHandler — GL skip observability (G16-F F7–F11)', () => {
  let handler: InventoryFinanceHandler;
  let glEngine: { post: jest.Mock };
  let auditLog: { log: jest.Mock };
  let tx: {
    journalEntry: { findFirst: jest.Mock };
    chartOfAccount: { findMany: jest.Mock };
    financialPeriod: { findFirst: jest.Mock };
  };

  const payload = {
    productId: 'prod-1',
    companyId: 'comp-1',
    warehouseId: 'wh-1',
    quantity: -2,
    beforeQuantity: 10,
    afterQuantity: 8,
    reason: 'manual',
    adjustedBy: 'user-1',
    referenceType: 'ADJUSTMENT',
    referenceId: 'ref-1',
    unitCost: '10',
  };

  // G16-N-4 P2: eventId is the journal clientOperationId / duplicate marker.
  const event = {
    eventName: 'inventory.adjusted',
    eventId: 'evt-1',
    payload,
  };

  const accounts = [
    { id: 'acct-inventory', code: '1300' },
    { id: 'acct-adjustment', code: '5100' },
  ];

  beforeEach(() => {
    glEngine = { post: jest.fn().mockResolvedValue(undefined) };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    tx = {
      journalEntry: { findFirst: jest.fn().mockResolvedValue(null) },
      chartOfAccount: { findMany: jest.fn().mockResolvedValue(accounts) },
      financialPeriod: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'period-1', status: 'OPEN' }),
      },
    };

    handler = new InventoryFinanceHandler(
      { queryRaw: jest.fn() } as unknown as PrismaService,
      glEngine as unknown as GlEngineService,
      auditLog as unknown as AuditLogService,
    );
  });

  const skipEntries = (action?: string) =>
    auditLog.log.mock.calls.filter(
      ([entry]) => !action || entry.action === action,
    );

  it('happy path posts the journal and records no skip entry', async () => {
    await handler.handle(event, { transactionClient: tx });

    expect(glEngine.post).toHaveBeenCalledTimes(1);
    expect(auditLog.log).not.toHaveBeenCalled();
  });

  it('F7: no transaction context → GL_SKIP_NO_TX_CONTEXT with best-effort out-of-tx record', async () => {
    await handler.handle(event, {}); // business semantics: resolve, not throw

    expect(glEngine.post).not.toHaveBeenCalled();
    expect(tx.chartOfAccount.findMany).not.toHaveBeenCalled();

    const calls = skipEntries('GL_SKIP_NO_TX_CONTEXT');
    expect(calls).toHaveLength(1);
    const [entry] = calls[0];
    expect(entry.companyId).toBe('comp-1');
    expect(entry.userId).toBe('user-1');
    expect(entry.entityType).toBe('FinanceJournal');
    expect(entry.entityId).toBe('ADJUSTMENT:ref-1');
    // best-effort: written WITHOUT the (absent) tx client
    expect(calls[0]).toHaveLength(1);
    expect(entry.after.reference).toEqual(
      expect.objectContaining({
        referenceType: 'ADJUSTMENT',
        referenceId: 'ref-1',
        productId: 'prod-1',
        quantity: -2,
        unitCost: '10',
      }),
    );
    expect(entry.after.reason).toContain('no transaction context');
  });

  it('F7b: best-effort record failure must never throw out of the handler', async () => {
    auditLog.log.mockRejectedValueOnce(new Error('audit db down'));

    await expect(handler.handle(event, {})).resolves.toBeUndefined();
    expect(glEngine.post).not.toHaveBeenCalled();
  });

  it('F8: missing COA 1300/5100 → GL_SKIP_NO_ACCOUNTS with missing codes and replay-ready reference, inside tx', async () => {
    tx.chartOfAccount.findMany.mockResolvedValue([]);

    await handler.handle(event, { transactionClient: tx });

    expect(glEngine.post).not.toHaveBeenCalled();
    const calls = skipEntries('GL_SKIP_NO_ACCOUNTS');
    expect(calls).toHaveLength(1);
    const [entry, txArg] = calls[0];
    expect(entry.companyId).toBe('comp-1');
    expect(entry.userId).toBe('user-1');
    expect(entry.entityId).toBe('ADJUSTMENT:ref-1');
    // durable within the SAME transaction as the business operation
    expect(txArg).toBe(tx);
    expect(entry.after.missingAccountCodes).toEqual(['1300', '5100']);
    expect(entry.after.reason).toContain('chart of accounts');
    expect(entry.after.reference).toEqual(
      expect.objectContaining({
        referenceType: 'ADJUSTMENT',
        referenceId: 'ref-1',
        unitCost: '10',
      }),
    );
  });

  it('F9: no OPEN financial period → GL_SKIP_NO_PERIOD with expected date and reference', async () => {
    tx.financialPeriod.findFirst.mockResolvedValue(null);

    await handler.handle(event, { transactionClient: tx });

    expect(glEngine.post).not.toHaveBeenCalled();
    const calls = skipEntries('GL_SKIP_NO_PERIOD');
    expect(calls).toHaveLength(1);
    const [entry, txArg] = calls[0];
    expect(entry.companyId).toBe('comp-1');
    expect(entry.userId).toBe('user-1');
    expect(txArg).toBe(tx);
    expect(entry.after.reason).toContain('no OPEN financial period');
    expect(typeof entry.after.expectedDate).toBe('string');
    expect(entry.after.reference).toEqual(
      expect.objectContaining({ referenceId: 'ref-1', quantity: -2 }),
    );
  });

  it('F10: zero amount → GL_SKIP_ZERO_AMOUNT (INFO semantics) with amount 0', async () => {
    await handler.handle(
      {
        eventName: 'inventory.adjusted',
        eventId: 'evt-zero',
        payload: { ...payload, unitCost: undefined },
      },
      { transactionClient: tx },
    );

    expect(glEngine.post).not.toHaveBeenCalled();
    const calls = skipEntries('GL_SKIP_ZERO_AMOUNT');
    expect(calls).toHaveLength(1);
    const [entry, txArg] = calls[0];
    expect(entry.companyId).toBe('comp-1');
    expect(entry.userId).toBe('user-1');
    expect(txArg).toBe(tx);
    expect(entry.after.amount).toBe('0');
    expect(entry.after.reason).toContain('zero valuation');
  });

  it('F11 control: posted journal is balanced with the inventory leg first', async () => {
    await handler.handle(event, { transactionClient: tx });

    const input = glEngine.post.mock.calls[0][0] as PostJournalEntryInput;
    expect(input.referenceType).toBe('INVENTORY_ADJUSTMENT');
    expect(input.lines).toHaveLength(2);
    const [inventoryLeg, adjustmentLeg] = input.lines;
    // decrease: Cr Inventory / Dr Adjustment — both legs carry amount 20
    expect(inventoryLeg?.credit).toBe('20');
    expect(inventoryLeg?.debit).toBe('0');
    expect(adjustmentLeg?.debit).toBe('20');
    expect(adjustmentLeg?.credit).toBe('0');
  });
});
