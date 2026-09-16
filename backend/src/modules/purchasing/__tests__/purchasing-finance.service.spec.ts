import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
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

/**
 * G11-A: per-operation account gate.
 *
 * Each journal requires ONLY the accounts it actually posts to. A missing
 * mandatory account fails fast with the stable, greppable BadRequestException;
 * accounts the operation never touches must not block it; and zero-value
 * operations skip the CoA lookup entirely (they post nothing).
 */
describe('PurchasingFinanceService — G11-A per-operation account gate', () => {
  let service: PurchasingFinanceService;
  let glPost: jest.Mock;

  const entryDate = new Date('2026-01-15T00:00:00.000Z');

  const grParams = {
    companyId,
    warehouseId: 'wh-1',
    receiptNumber: 'GR-1',
    receiptDate: entryDate,
    items: [{ productId: 'p1', quantity: 2, unitCost: '10' }],
    createdBy: 'user-1',
  };

  const invoiceParams = {
    companyId,
    invoiceNumber: 'INV-1',
    invoiceDate: entryDate,
    subtotal: '100',
    discountAmount: '0',
    taxAmount: '0',
    grandTotal: '100',
    createdBy: 'user-1',
  };

  const returnParams = {
    companyId,
    returnNumber: 'PR-1',
    returnDate: entryDate,
    items: [{ productId: 'p1', quantity: 1, unitCost: '10' }],
    fifoCostItems: [{ productId: 'p1', quantity: 1, totalCost: '10' }],
    createdBy: 'user-1',
  };

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

  /**
   * Transaction stub whose CoA lookup honours the `code in (...)` filter, so
   * each test declares exactly which accounts the company has.
   */
  function txWithAccounts(codes: string[]) {
    const rows = codes.map((code) => ({ id: `acct-${code}`, code }));
    return {
      chartOfAccount: {
        findMany: jest
          .fn()
          .mockImplementation(
            async ({ where }: { where: { code: { in: string[] } } }) =>
              rows.filter((row) => where.code.in.includes(row.code)),
          ),
      },
      financialPeriod: {
        findFirst: jest.fn().mockResolvedValue({ id: 'period-1' }),
      },
    } as unknown as Prisma.TransactionClient & {
      chartOfAccount: { findMany: jest.Mock };
    };
  }

  function postedAccountIds(): string[] {
    expect(glPost).toHaveBeenCalledTimes(1);
    return (glPost.mock.calls[0][0].lines as Array<{ accountId: string }>).map(
      (line) => line.accountId,
    );
  }

  describe('Goods Receipt — requires 1300 + 2110 only', () => {
    it('posts with 1300 + 2110 and is NOT blocked by missing 2100/5200', async () => {
      const tx = txWithAccounts(['1300', '2110']);
      await service.createGoodsReceiptJournal(grParams, tx);
      expect(postedAccountIds()).toEqual(['acct-1300', 'acct-2110']);
    });

    it('fails fast when 1300 is missing', async () => {
      const tx = txWithAccounts(['2110']);
      const promise = service.createGoodsReceiptJournal(grParams, tx);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('1300 (Inventory)');
      expect(glPost).not.toHaveBeenCalled();
    });

    it('fails fast when 2110 is missing', async () => {
      const tx = txWithAccounts(['1300']);
      const promise = service.createGoodsReceiptJournal(grParams, tx);
      await expect(promise).rejects.toThrow(
        '2110 (Goods Received Not Invoiced)',
      );
      expect(glPost).not.toHaveBeenCalled();
    });

    it('lists every missing mandatory account in one diagnostic', async () => {
      const tx = txWithAccounts([]);
      const promise = service.createGoodsReceiptJournal(grParams, tx);
      await expect(promise).rejects.toThrow(
        '1300 (Inventory), 2110 (Goods Received Not Invoiced)',
      );
    });

    it('resolves accounts tenant-scoped and only active, non-deleted rows', async () => {
      const tx = txWithAccounts(['1300', '2110']);
      await service.createGoodsReceiptJournal(grParams, tx);
      expect(tx.chartOfAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId,
            isActive: true,
            deletedAt: null,
          }),
        }),
      );
    });

    it('zero-value receipt skips the CoA lookup entirely', async () => {
      const tx = txWithAccounts([]);
      await service.createGoodsReceiptJournal(
        {
          ...grParams,
          items: [{ productId: 'p1', quantity: 0, unitCost: '10' }],
        },
        tx,
      );
      expect(tx.chartOfAccount.findMany).not.toHaveBeenCalled();
      expect(glPost).not.toHaveBeenCalled();
    });
  });

  describe('Purchase Invoice approval — requires 2100 + 2110, 5200 only for tax/discount', () => {
    it('posts with 2100 + 2110 when tax and discount are zero (5200 not required)', async () => {
      const tx = txWithAccounts(['2100', '2110']);
      await service.createInvoiceJournal(invoiceParams, tx);
      expect(postedAccountIds()).toEqual(['acct-2110', 'acct-2100']);
    });

    it('fails fast when 2100 is missing', async () => {
      const tx = txWithAccounts(['2110']);
      const promise = service.createInvoiceJournal(invoiceParams, tx);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('2100 (Accounts Payable)');
      expect(glPost).not.toHaveBeenCalled();
    });

    it('fails fast when 2110 is missing', async () => {
      const tx = txWithAccounts(['2100']);
      const promise = service.createInvoiceJournal(invoiceParams, tx);
      await expect(promise).rejects.toThrow(
        '2110 (Goods Received Not Invoiced)',
      );
      expect(glPost).not.toHaveBeenCalled();
    });

    it('requires 5200 when a tax line is actually posted', async () => {
      const taxed = { ...invoiceParams, taxAmount: '5', grandTotal: '105' };
      const tx = txWithAccounts(['2100', '2110']);
      const promise = service.createInvoiceJournal(taxed, tx);
      await expect(promise).rejects.toThrow(
        '5200 (Purchase Discounts and Write-Offs)',
      );
      expect(glPost).not.toHaveBeenCalled();
    });

    it('requires 5200 when a discount line is actually posted', async () => {
      const discounted = {
        ...invoiceParams,
        discountAmount: '5',
        grandTotal: '95',
      };
      const tx = txWithAccounts(['2100', '2110']);
      const promise = service.createInvoiceJournal(discounted, tx);
      await expect(promise).rejects.toThrow(
        '5200 (Purchase Discounts and Write-Offs)',
      );
      expect(glPost).not.toHaveBeenCalled();
    });

    it('posts the tax leg when 5200 is present', async () => {
      const taxed = { ...invoiceParams, taxAmount: '5', grandTotal: '105' };
      const tx = txWithAccounts(['2100', '2110', '5200']);
      await service.createInvoiceJournal(taxed, tx);
      expect(postedAccountIds()).toEqual([
        'acct-2110',
        'acct-5200',
        'acct-2100',
      ]);
    });

    it('zero-total invoice skips the CoA lookup entirely', async () => {
      const tx = txWithAccounts([]);
      await service.createInvoiceJournal(
        { ...invoiceParams, subtotal: '0', grandTotal: '0' },
        tx,
      );
      expect(tx.chartOfAccount.findMany).not.toHaveBeenCalled();
      expect(glPost).not.toHaveBeenCalled();
    });
  });

  describe('Purchase Return completion — requires 1300 + 2100, 5200 only for a variance leg', () => {
    it('posts with 1300 + 2100 when declared basis equals FIFO cost (5200 not required)', async () => {
      const tx = txWithAccounts(['1300', '2100']);
      await service.createPurchaseReturnJournal(returnParams, tx);
      expect(postedAccountIds()).toEqual(['acct-2100', 'acct-1300']);
    });

    it('does not require 2110 — a return never touches GRNI', async () => {
      const tx = txWithAccounts(['1300', '2100']);
      await service.createPurchaseReturnJournal(returnParams, tx);
      expect(glPost).toHaveBeenCalledTimes(1);
    });

    it('fails fast when 1300 is missing', async () => {
      const tx = txWithAccounts(['2100']);
      const promise = service.createPurchaseReturnJournal(returnParams, tx);
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow('1300 (Inventory)');
      expect(glPost).not.toHaveBeenCalled();
    });

    it('fails fast when 2100 is missing', async () => {
      const tx = txWithAccounts(['1300']);
      const promise = service.createPurchaseReturnJournal(returnParams, tx);
      await expect(promise).rejects.toThrow('2100 (Accounts Payable)');
      expect(glPost).not.toHaveBeenCalled();
    });

    it('requires 5200 only when a variance leg is produced', async () => {
      // declared 12 vs FIFO 10 → variance 2 → the 5200 leg is posted.
      const withVariance = {
        ...returnParams,
        items: [{ productId: 'p1', quantity: 1, unitCost: '12' }],
      };
      const tx = txWithAccounts(['1300', '2100']);
      const promise = service.createPurchaseReturnJournal(withVariance, tx);
      await expect(promise).rejects.toThrow(
        '5200 (Purchase Discounts and Write-Offs)',
      );
      expect(glPost).not.toHaveBeenCalled();
    });

    it('posts the variance leg when 5200 is present', async () => {
      const withVariance = {
        ...returnParams,
        items: [{ productId: 'p1', quantity: 1, unitCost: '12' }],
      };
      const tx = txWithAccounts(['1300', '2100', '5200']);
      await service.createPurchaseReturnJournal(withVariance, tx);
      expect(postedAccountIds()).toEqual([
        'acct-2100',
        'acct-1300',
        'acct-5200',
      ]);
    });

    it('zero-value return skips the CoA lookup entirely', async () => {
      const tx = txWithAccounts([]);
      await service.createPurchaseReturnJournal(
        {
          ...returnParams,
          items: [{ productId: 'p1', quantity: 1, unitCost: '0' }],
          fifoCostItems: [{ productId: 'p1', quantity: 1, totalCost: '0' }],
        },
        tx,
      );
      expect(tx.chartOfAccount.findMany).not.toHaveBeenCalled();
      expect(glPost).not.toHaveBeenCalled();
    });
  });
});
