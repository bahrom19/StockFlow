import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PurchasingFinanceService } from '../services/purchasing-finance.service';
import { GlEngineService } from '../../finance/services/gl-engine.service';

const companyId = 'comp-1';

const accountIds = {
  inventory: 'acc-1300',
  accountsPayable: 'acc-2100',
  grni: 'acc-2110',
  purchaseDiscount: 'acc-5200',
};

function mockTx() {
  return {
    chartOfAccount: {
      findMany: jest.fn().mockResolvedValue(
        Object.entries(accountIds).map(([key, id]) => ({
          id,
          code: { inventory: '1300', accountsPayable: '2100', grni: '2110', purchaseDiscount: '5200' }[key],
          isActive: true,
          deletedAt: null,
        })),
      ),
    },
    financialPeriod: {
      findFirst: jest.fn().mockResolvedValue({ id: 'period-1' }),
    },
  } as unknown as Prisma.TransactionClient;
}

/**
 * G9-F4: purchase-return journal shape.
 *
 * Two distinct economic values:
 *   A. AP debit  = declared supplier return value (unitCost × qty)
 *   B. Inventory credit = actual FIFO consumed cost (consumeFifoLayers result)   *   Difference → explicit variance leg on account 5200 (credit when the
   *   declared AP value exceeds the FIFO cost, debit in the reverse case).
 * When no FIFO basis is supplied (legacy/non-costed flows) the declared
 * basis is used and the journal keeps its historical two-leg shape.
 */
describe('PurchasingFinanceService — G9-F4 purchase return journal', () => {
  let service: PurchasingFinanceService;
  let glPost: jest.Mock;

  beforeEach(async () => {
    glPost = jest.fn().mockResolvedValue(undefined);
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasingFinanceService,
        { provide: GlEngineService, useValue: { post: glPost } },
      ],
    }).compile();
    service = mod.get(PurchasingFinanceService);
  });

  afterEach(() => jest.clearAllMocks());

  const baseParams = {
    companyId,
    returnNumber: 'PR-TEST-0001',
    returnDate: new Date('2026-09-15'),
    createdBy: 'user-1',
  };

  function postedLines() {
    expect(glPost).toHaveBeenCalledTimes(1);
    return glPost.mock.calls[0][0].lines as Array<{
      accountId: string;
      debit: string;
      credit: string;
    }>;
  }

  function totalBy(lines: Array<{ debit: string; credit: string }>) {
    const debit = lines.reduce((s, l) => s.plus(l.debit), new Prisma.Decimal(0));
    const credit = lines.reduce((s, l) => s.plus(l.credit), new Prisma.Decimal(0));
    return { debit, credit };
  }

  it('CASE A — AP value == FIFO cost: two-leg journal, no variance line', async () => {
    await service.createPurchaseReturnJournal(
      {
        ...baseParams,
        items: [{ productId: 'p1', quantity: 5, unitCost: '140' }],
        fifoCostItems: [{ productId: 'p1', quantity: 5, totalCost: '700' }],
      },
      mockTx(),
    );

    const lines = postedLines();
    expect(lines).toHaveLength(2);
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: accountIds.accountsPayable, debit: '700' }),
        expect.objectContaining({ accountId: accountIds.inventory, credit: '700' }),
      ]),
    );
    const { debit, credit } = totalBy(lines);
    expect(debit.eq(credit)).toBe(true);
  });

  it('CASE B — AP value > FIFO cost: explicit credit variance leg on 5200 (excess supplier credit reduces purchase cost)', async () => {
    await service.createPurchaseReturnJournal(
      {
        ...baseParams,
        items: [{ productId: 'p1', quantity: 5, unitCost: '160' }],
        fifoCostItems: [{ productId: 'p1', quantity: 5, totalCost: '700' }],
      },
      mockTx(),
    );

    const lines = postedLines();
    expect(lines).toHaveLength(3);
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: accountIds.accountsPayable, debit: '800' }),
        expect.objectContaining({ accountId: accountIds.inventory, credit: '700' }),
        expect.objectContaining({
          accountId: accountIds.purchaseDiscount,
          debit: '0',
          credit: '100',
        }),
      ]),
    );
    const { debit, credit } = totalBy(lines);
    expect(debit.eq(credit)).toBe(true);
  });

  it('CASE C — AP value < FIFO cost: explicit debit variance leg on 5200 (FIFO cost above supplier credit = write-off)', async () => {
    await service.createPurchaseReturnJournal(
      {
        ...baseParams,
        items: [{ productId: 'p1', quantity: 5, unitCost: '140' }],
        fifoCostItems: [{ productId: 'p1', quantity: 5, totalCost: '800' }],
      },
      mockTx(),
    );

    const lines = postedLines();
    expect(lines).toHaveLength(3);
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: accountIds.accountsPayable, debit: '700' }),
        expect.objectContaining({ accountId: accountIds.inventory, credit: '800' }),
        expect.objectContaining({
          accountId: accountIds.purchaseDiscount,
          debit: '100',
          credit: '0',
        }),
      ]),
    );
    const { debit, credit } = totalBy(lines);
    expect(debit.eq(credit)).toBe(true);
  });

  it('multi-item returns sum FIFO totalCost per item for the Inventory credit', async () => {
    await service.createPurchaseReturnJournal(
      {
        ...baseParams,
        items: [
          { productId: 'p1', quantity: 5, unitCost: '140' },
          { productId: 'p2', quantity: 3, unitCost: '50' },
        ],
        fifoCostItems: [
          { productId: 'p1', quantity: 5, totalCost: '700' },
          { productId: 'p2', quantity: 3, totalCost: '100' },
        ],
      },
      mockTx(),
    );

    const lines = postedLines();
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: accountIds.accountsPayable, debit: '850' }),
        expect.objectContaining({ accountId: accountIds.inventory, credit: '800' }),
        expect.objectContaining({
          accountId: accountIds.purchaseDiscount,
          debit: '0',
          credit: '50',
        }),
      ]),
    );
    const { debit, credit } = totalBy(lines);
    expect(debit.eq(credit)).toBe(true);
  });

  it('legacy flow (no fifoCostItems) keeps the historical declared-basis shape with no variance line', async () => {
    await service.createPurchaseReturnJournal(
      {
        ...baseParams,
        items: [{ productId: 'p1', quantity: 5, unitCost: '140' }],
      },
      mockTx(),
    );

    const lines = postedLines();
    expect(lines).toHaveLength(2);
    expect(lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ accountId: accountIds.accountsPayable, debit: '700' }),
        expect.objectContaining({ accountId: accountIds.inventory, credit: '700' }),
      ]),
    );
  });

  it('keeps the PURCHASE_RETURN reference and posts inside the caller transaction', async () => {
    const tx = mockTx();
    await service.createPurchaseReturnJournal(
      {
        ...baseParams,
        items: [{ productId: 'p1', quantity: 1, unitCost: '10' }],
        fifoCostItems: [{ productId: 'p1', quantity: 1, totalCost: '10' }],
      },
      tx,
    );

    const call = glPost.mock.calls[0];
    expect(call[0].referenceType).toBe('PURCHASE_RETURN');
    expect(call[0].referenceId).toBe('PR-TEST-0001');
    expect(call[0].companyId).toBe(companyId);
    expect(call[1]).toBe(tx);
  });

  it('skips the journal entirely when both bases are zero', async () => {
    await service.createPurchaseReturnJournal(
      {
        ...baseParams,
        items: [{ productId: 'p1', quantity: 5, unitCost: '0' }],
        fifoCostItems: [{ productId: 'p1', quantity: 5, totalCost: '0' }],
      },
      mockTx(),
    );

    expect(glPost).not.toHaveBeenCalled();
  });
});
