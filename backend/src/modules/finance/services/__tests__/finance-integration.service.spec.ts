import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { FinanceIntegrationService } from '../finance-integration.service';
import { FinancialPeriodsRepository } from '../../repositories/financial-periods.repository';
import { GlEngineService, PostJournalEntryInput } from '../gl-engine.service';
import { SaleCompletedEventPayload } from '../../../sales/interfaces/sale-event.interface';

describe('FinanceIntegrationService', () => {
  let service: FinanceIntegrationService;
  let mockTx: Record<string, any>;
  let mockPeriodsRepo: jest.Mocked<FinancialPeriodsRepository>;
  let mockGlEngine: jest.Mocked<GlEngineService>;

  const companyId = 'comp-1';
  const warehouseId = 'wh-1';
  const cashierId = 'user-1';
  const customerId = 'cust-1';
  const saleId = 'sale-1';
  const saleNumber = 'SALE-0001';
  const periodId = 'period-1';
  const cashAccountId = 'acct-cash';
  const bankAccountId = 'acct-bank';
  const arAccountId = 'acct-ar';
  const revenueAccountId = 'acct-rev';
  const cogsAccountId = 'acct-cogs';
  const inventoryAccountId = 'acct-inv';

  const mockAccounts = [
    {
      id: cashAccountId,
      code: '1010',
      name: 'Cash',
      accountType: 'ASSET',
      normalBalance: 'DEBIT',
    },
    {
      id: bankAccountId,
      code: '1020',
      name: 'Bank',
      accountType: 'ASSET',
      normalBalance: 'DEBIT',
    },
    {
      id: arAccountId,
      code: '1200',
      name: 'AR',
      accountType: 'ASSET',
      normalBalance: 'DEBIT',
    },
    {
      id: revenueAccountId,
      code: '4000',
      name: 'Sales Revenue',
      accountType: 'REVENUE',
      normalBalance: 'CREDIT',
    },
    {
      id: cogsAccountId,
      code: '5000',
      name: 'COGS',
      accountType: 'EXPENSE',
      normalBalance: 'DEBIT',
    },
    {
      id: inventoryAccountId,
      code: '1300',
      name: 'Inventory',
      accountType: 'ASSET',
      normalBalance: 'DEBIT',
    },
  ];

  function baseSaleEvent(
    overrides?: Partial<SaleCompletedEventPayload>,
  ): SaleCompletedEventPayload {
    return {
      saleId,
      companyId,
      warehouseId,
      cashierId,
      customerId,
      saleNumber,
      subtotal: '100.00',
      discount: '0',
      total: '100.00',
      paidAmount: '100.00',
      changeAmount: '0.00',
      currency: 'KZT',
      items: [
        {
          productId: 'prod-1',
          quantity: 1,
          unitPrice: '100.00',
          costPrice: '60.00',
          discount: '0',
          subtotal: '100.00',
          total: '100.00',
          margin: '40.00',
        },
      ],
      payments: [{ method: 'CASH', amount: '100.00' }],
      ...overrides,
    };
  }

  /** Get the input passed to glEngine.post() from the first call */
  function getPostedJournal(): PostJournalEntryInput {
    const calls = mockGlEngine.post.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const input = calls[0];
    expect(input).toBeDefined();
    return input![0] as PostJournalEntryInput;
  }

  /** Compute total debit and credit from journal lines */
  function getBalanceTotals(journalData: PostJournalEntryInput): {
    totalDebit: number;
    totalCredit: number;
  } {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of journalData.lines ?? []) {
      totalDebit += Number.parseFloat(line.debit ?? '0');
      totalCredit += Number.parseFloat(line.credit ?? '0');
    }
    return { totalDebit, totalCredit };
  }

  beforeEach(async () => {
    mockPeriodsRepo = {
      findCurrent: jest.fn(),
    } as unknown as jest.Mocked<FinancialPeriodsRepository>;

    mockGlEngine = {
      post: jest.fn(),
      reverse: jest.fn(),
    } as unknown as jest.Mocked<GlEngineService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceIntegrationService,
        { provide: FinancialPeriodsRepository, useValue: mockPeriodsRepo },
        { provide: GlEngineService, useValue: mockGlEngine },
      ],
    }).compile();

    service = module.get<FinanceIntegrationService>(FinanceIntegrationService);

    mockTx = {
      chartOfAccount: {
        findMany: jest.fn().mockResolvedValue(mockAccounts),
      },
      // G9-F2.2.1: canonical COGS is read from OUT CostLayers
      // (referenceType='SALE', referenceId=saleId). These tests exercise the
      // legacy compatibility path (no OUT layers → Σ item.costPrice × quantity),
      // so the mock returns an empty layer set; dedicated FIFO COGS coverage
      // lives in finance-integration.sale-cogs.spec.ts.
      costLayer: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      // G11-E5: allocation facts of the refund. Default is EMPTY → historical
      // E4-era refunds take the legacy Cash fallback (that is exactly what the
      // E4 tests below assert); E5 tests override per scenario.
      refundPaymentAllocation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    mockPeriodsRepo.findCurrent.mockResolvedValue({ id: periodId } as any);
    mockGlEngine.post.mockResolvedValue({} as any);
  });

  // ─────────────────────────────────────────────
  // 1. Cash Sale
  // ─────────────────────────────────────────────
  it('should post journal entries for a cash sale via GlEngineService', async () => {
    await service.onSaleCompleted(
      baseSaleEvent({
        items: [
          {
            productId: 'prod-1',
            quantity: 2,
            unitPrice: '50.00',
            costPrice: '30.00',
            discount: '0',
            subtotal: '100.00',
            total: '100.00',
            margin: '40.00',
          },
        ],
      }),
      mockTx as unknown as Prisma.TransactionClient,
    );

    expect(mockGlEngine.post).toHaveBeenCalledTimes(1);

    const journal = getPostedJournal();
    expect(journal.companyId).toBe(companyId);
    expect(journal.financialPeriodId).toBe(periodId);
    expect(journal.referenceType).toBe('SALE');
    expect(journal.referenceId).toBe(saleId);
    expect(journal.createdBy).toBe(cashierId);

    const { totalDebit, totalCredit } = getBalanceTotals(journal);
    expect(totalDebit).toBe(totalCredit);

    const lineDebits = journal.lines.filter(
      (l) => Number.parseFloat(l.debit) > 0,
    );
    const lineCredits = journal.lines.filter(
      (l) => Number.parseFloat(l.credit) > 0,
    );

    expect(lineDebits.length).toBeGreaterThanOrEqual(2); // Cash + COGS
    expect(lineCredits.length).toBeGreaterThanOrEqual(2); // Revenue + Inventory
  });

  // ─────────────────────────────────────────────
  // 2. Card Sale
  // ─────────────────────────────────────────────
  it('should post journal entries for a card sale via GlEngineService', async () => {
    await service.onSaleCompleted(
      baseSaleEvent({
        subtotal: '200.00',
        total: '200.00',
        paidAmount: '200.00',
        items: [
          {
            productId: 'prod-1',
            quantity: 1,
            unitPrice: '200.00',
            costPrice: '120.00',
            discount: '0',
            subtotal: '200.00',
            total: '200.00',
            margin: '80.00',
          },
        ],
        payments: [{ method: 'CARD', amount: '200.00' }],
      }),
      mockTx as unknown as Prisma.TransactionClient,
    );

    const journal = getPostedJournal();
    const { totalDebit, totalCredit } = getBalanceTotals(journal);
    expect(totalDebit).toBe(totalCredit);

    const lines = journal.lines;
    const bankDebitLine = lines.find(
      (l) => l.accountId === bankAccountId && Number.parseFloat(l.debit) > 0,
    );
    expect(bankDebitLine).toBeDefined();
    expect(bankDebitLine!.debit).toBe('200');
  });

  // ─────────────────────────────────────────────
  // 3. Mixed Payment (Cash + Card)
  // ─────────────────────────────────────────────
  it('should post journal entries for a mixed payment (cash + card)', async () => {
    await service.onSaleCompleted(
      baseSaleEvent({
        subtotal: '150.00',
        total: '150.00',
        paidAmount: '150.00',
        items: [
          {
            productId: 'prod-1',
            quantity: 1,
            unitPrice: '150.00',
            costPrice: '90.00',
            discount: '0',
            subtotal: '150.00',
            total: '150.00',
            margin: '60.00',
          },
        ],
        payments: [
          { method: 'CASH', amount: '100.00' },
          { method: 'CARD', amount: '50.00' },
        ],
      }),
      mockTx as unknown as Prisma.TransactionClient,
    );

    const journal = getPostedJournal();
    const lines = journal.lines;

    const cashDebit = lines.find(
      (l) => l.accountId === cashAccountId && Number.parseFloat(l.debit) > 0,
    );
    const bankDebit = lines.find(
      (l) => l.accountId === bankAccountId && Number.parseFloat(l.debit) > 0,
    );
    expect(cashDebit).toBeDefined();
    expect(cashDebit!.debit).toBe('100');
    expect(bankDebit).toBeDefined();
    expect(bankDebit!.debit).toBe('50');

    const { totalDebit, totalCredit } = getBalanceTotals(journal);
    expect(totalDebit).toBe(totalCredit);
  });

  // ─────────────────────────────────────────────
  // 4. Credit Sale (Store Credit)
  // ─────────────────────────────────────────────
  it('should post journal entries for a credit sale (store credit)', async () => {
    await service.onSaleCompleted(
      baseSaleEvent({
        subtotal: '300.00',
        total: '300.00',
        paidAmount: '300.00',
        items: [
          {
            productId: 'prod-1',
            quantity: 3,
            unitPrice: '100.00',
            costPrice: '60.00',
            discount: '0',
            subtotal: '300.00',
            total: '300.00',
            margin: '120.00',
          },
        ],
        payments: [{ method: 'STORE_CREDIT', amount: '300.00' }],
      }),
      mockTx as unknown as Prisma.TransactionClient,
    );

    const journal = getPostedJournal();
    const lines = journal.lines;

    const arDebitLine = lines.find(
      (l) => l.accountId === arAccountId && Number.parseFloat(l.debit) > 0,
    );
    expect(arDebitLine).toBeDefined();
    expect(arDebitLine!.debit).toBe('300');

    const { totalDebit, totalCredit } = getBalanceTotals(journal);
    expect(totalDebit).toBe(totalCredit);
  });

  // ─────────────────────────────────────────────
  // 5. No open period — throws BadRequestException
  // ─────────────────────────────────────────────
  it('should throw BadRequestException when no open financial period exists', async () => {
    mockPeriodsRepo.findCurrent.mockResolvedValue(null);

    await expect(
      service.onSaleCompleted(
        baseSaleEvent(),
        mockTx as unknown as Prisma.TransactionClient,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockGlEngine.post).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────
  // 6. Refund reverses journal entries
  // ─────────────────────────────────────────────
  it('should reverse journal entries on refund', async () => {
    await service.onSaleRefunded(
      {
        saleId,
        companyId,
        warehouseId,
        cashierId,
        saleNumber,
        total: '100.00',
        currency: 'KZT',
        items: [
          {
            productId: 'prod-1',
            quantity: 2,
            unitPrice: '50.00',
            costPrice: '30.00',
            discount: '0',
            subtotal: '100.00',
            total: '100.00',
            margin: '40.00',
          },
        ],
        payments: [{ method: 'CASH', amount: '100.00' }],
      },
      mockTx as unknown as Prisma.TransactionClient,
    );

    const journal = getPostedJournal();
    expect(journal.referenceType).toBe('REFUND');
    expect(journal.referenceId).toBe(saleId);

    const lines = journal.lines;
    const revDebit = lines.find(
      (l) => l.accountId === revenueAccountId && Number.parseFloat(l.debit) > 0,
    );
    const cashCredit = lines.find(
      (l) => l.accountId === cashAccountId && Number.parseFloat(l.credit) > 0,
    );
    expect(revDebit).toBeDefined();
    expect(revDebit!.debit).toBe('100');
    expect(cashCredit).toBeDefined();
    expect(cashCredit!.credit).toBe('100');

    const { totalDebit, totalCredit } = getBalanceTotals(journal);
    expect(totalDebit).toBe(totalCredit);
  });

  // ─────────────────────────────────────────────
  // 7. No open period on refund — throws BadRequestException
  // ─────────────────────────────────────────────
  it('should throw BadRequestException on refund when no open period exists', async () => {
    mockPeriodsRepo.findCurrent.mockResolvedValue(null);

    await expect(
      service.onSaleRefunded(
        {
          saleId,
          companyId,
          warehouseId,
          cashierId,
          saleNumber,
          total: '100.00',
          currency: 'KZT',
          items: [],
          payments: [],
        },
        mockTx as unknown as Prisma.TransactionClient,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(mockGlEngine.post).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────
  // 8. Transaction propagation — tx passed to glEngine
  // ─────────────────────────────────────────────
  it('should propagate the Prisma transaction to GlEngineService.post()', async () => {
    await service.onSaleCompleted(
      baseSaleEvent(),
      mockTx as unknown as Prisma.TransactionClient,
    );

    expect(mockGlEngine.post).toHaveBeenCalledWith(expect.any(Object), mockTx);
  });

  // ═════════════════════════════════════════════
  // 9–10: Concurrent optimistic locking tests
  // ═════════════════════════════════════════════
  it('should propagate GlEngineService.post() errors for rollback', async () => {
    const conflictError = new ConflictException(
      'Journal entry version conflict',
    );
    mockGlEngine.post.mockRejectedValue(conflictError);

    await expect(
      service.onSaleCompleted(
        baseSaleEvent(),
        mockTx as unknown as Prisma.TransactionClient,
      ),
    ).rejects.toThrow(ConflictException);
  });

  // ─────────────────────────────────────────────
  // 11. Overpayment (change) — cash posted net of change
  // ─────────────────────────────────────────────
  it('should post cash net of change for an overpaid cash sale', async () => {
    await service.onSaleCompleted(
      baseSaleEvent({
        subtotal: '1500.00',
        total: '1500.00',
        paidAmount: '1800.00',
        changeAmount: '300.00',
        items: [
          {
            productId: 'prod-1',
            quantity: 1,
            unitPrice: '1500.00',
            costPrice: '900.00',
            discount: '0',
            subtotal: '1500.00',
            total: '1500.00',
            margin: '600.00',
          },
        ],
        payments: [{ method: 'CASH', amount: '1800.00' }],
      }),
      mockTx as unknown as Prisma.TransactionClient,
    );

    const journal = getPostedJournal();
    const lines = journal.lines;

    const cashDebit = lines.find(
      (l) => l.accountId === cashAccountId && Number.parseFloat(l.debit) > 0,
    );
    // Cash must be tendered − change (1800 − 300 = 1500), NOT gross tendered.
    expect(cashDebit).toBeDefined();
    expect(Number.parseFloat(cashDebit!.debit)).toBe(1500);

    const { totalDebit, totalCredit } = getBalanceTotals(journal);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(2400); // 1500 cash + 900 COGS
  });

  // ─────────────────────────────────────────────
  // 12. Overpayment — change greater than cash tendered (from float)
  // ─────────────────────────────────────────────
  it('should post cash credit when change exceeds cash tendered', async () => {
    await service.onSaleCompleted(
      baseSaleEvent({
        subtotal: '1500.00',
        total: '1500.00',
        paidAmount: '1800.00',
        changeAmount: '300.00',
        items: [
          {
            productId: 'prod-1',
            quantity: 1,
            unitPrice: '1500.00',
            costPrice: '900.00',
            discount: '0',
            subtotal: '1500.00',
            total: '1500.00',
            margin: '600.00',
          },
        ],
        // Cash 200 + CARD 1600 = 1800 paid, change 300 > cash 200
        payments: [
          { method: 'CASH', amount: '200.00' },
          { method: 'CARD', amount: '1600.00' },
        ],
      }),
      mockTx as unknown as Prisma.TransactionClient,
    );

    const journal = getPostedJournal();
    const lines = journal.lines;

    // No cash debit line (net cash would be negative)
    const cashDebit = lines.find(
      (l) => l.accountId === cashAccountId && Number.parseFloat(l.debit) > 0,
    );
    expect(cashDebit).toBeUndefined();
    // Cash credited 100 (change 300 − cash 200) drawn from float
    const cashCredit = lines.find(
      (l) => l.accountId === cashAccountId && Number.parseFloat(l.credit) > 0,
    );
    expect(cashCredit).toBeDefined();
    expect(Number.parseFloat(cashCredit!.credit)).toBe(100);

    const { totalDebit, totalCredit } = getBalanceTotals(journal);
    expect(totalDebit).toBe(totalCredit);
    expect(totalDebit).toBe(2500); // 1600 bank + 900 COGS
  });

  it('should pass balanced journal entries (debit == credit)', async () => {
    await service.onSaleCompleted(
      baseSaleEvent({
        subtotal: '250.00',
        total: '250.00',
        paidAmount: '250.00',
        items: [
          {
            productId: 'prod-1',
            quantity: 5,
            unitPrice: '50.00',
            costPrice: '30.00',
            discount: '0',
            subtotal: '250.00',
            total: '250.00',
            margin: '100.00',
          },
        ],
        payments: [{ method: 'CASH', amount: '250.00' }],
      }),
      mockTx as unknown as Prisma.TransactionClient,
    );

    const journal = getPostedJournal();
    const { totalDebit, totalCredit } = getBalanceTotals(journal);
    expect(totalDebit).toBe(totalCredit);
  });

  // ─────────────────────────────────────────────
  // G11-D: Refund payment-method reversal integrity
  // ─────────────────────────────────────────────

  it('G11-D: CARD refund credits Bank (1020), not Cash', async () => {
    await service.onSaleRefunded(
      {
        saleId,
        companyId,
        warehouseId,
        cashierId,
        saleNumber,
        total: '1000.00',
        currency: 'KZT',
        items: [{
          productId: 'prod-1', quantity: 1, unitPrice: '1000.00',
          costPrice: '600.00', discount: '0', subtotal: '1000.00',
          total: '1000.00', margin: '400.00',
        }],
        payments: [{ method: 'CARD', amount: '1000.00' }],
      },
      mockTx as unknown as Prisma.TransactionClient,
    );

    const journal = getPostedJournal();
    const lines = journal.lines;

    const bankCredit = lines.find(
      (l) => l.accountId === bankAccountId && Number.parseFloat(l.credit) > 0,
    );
    expect(bankCredit).toBeDefined();
    expect(bankCredit!.credit).toBe('1000');

    const cashCredits = lines.filter(
      (l) => l.accountId === cashAccountId && Number.parseFloat(l.credit) > 0,
    );
    expect(cashCredits).toHaveLength(0);

    const { totalDebit, totalCredit } = getBalanceTotals(journal);
    expect(totalDebit).toBe(totalCredit);
  });

  it('G11-D: mixed CASH + CARD refund credits Cash (net) + Bank', async () => {
    await service.onSaleRefunded(
      {
        saleId,
        companyId,
        warehouseId,
        cashierId,
        saleNumber,
        total: '1000.00',
        currency: 'KZT',
        items: [{
          productId: 'prod-1', quantity: 1, unitPrice: '1000.00',
          costPrice: '600.00', discount: '0', subtotal: '1000.00',
          total: '1000.00', margin: '400.00',
        }],
        payments: [
          { method: 'CASH', amount: '400.00' },
          { method: 'CARD', amount: '600.00' },
        ],
      },
      mockTx as unknown as Prisma.TransactionClient,
    );

    const journal = getPostedJournal();
    const lines = journal.lines;

    const cashCredit = lines.find(
      (l) => l.accountId === cashAccountId && Number.parseFloat(l.credit) > 0,
    );
    expect(cashCredit).toBeDefined();
    expect(cashCredit!.credit).toBe('400');

    const bankCredit = lines.find(
      (l) => l.accountId === bankAccountId && Number.parseFloat(l.credit) > 0,
    );
    expect(bankCredit).toBeDefined();
    expect(bankCredit!.credit).toBe('600');

    const { totalDebit, totalCredit } = getBalanceTotals(journal);
    expect(totalDebit).toBe(totalCredit);
  });

  it('G11-D: STORE_CREDIT refund credits AR (1200), not Cash', async () => {
    await service.onSaleRefunded(
      {
        saleId,
        companyId,
        warehouseId,
        cashierId,
        saleNumber,
        total: '1000.00',
        currency: 'KZT',
        items: [{
          productId: 'prod-1', quantity: 1, unitPrice: '1000.00',
          costPrice: '600.00', discount: '0', subtotal: '1000.00',
          total: '1000.00', margin: '400.00',
        }],
        payments: [{ method: 'STORE_CREDIT', amount: '1000.00' }],
      },
      mockTx as unknown as Prisma.TransactionClient,
    );

    const journal = getPostedJournal();
    const lines = journal.lines;

    const arCredit = lines.find(
      (l) => l.accountId === arAccountId && Number.parseFloat(l.credit) > 0,
    );
    expect(arCredit).toBeDefined();
    expect(arCredit!.credit).toBe('1000');

    const cashCredits = lines.filter(
      (l) => l.accountId === cashAccountId && Number.parseFloat(l.credit) > 0,
    );
    expect(cashCredits).toHaveLength(0);

    const { totalDebit, totalCredit } = getBalanceTotals(journal);
    expect(totalDebit).toBe(totalCredit);
  });

  it('G11-D: CASH + CARD + STORE_CREDIT refund credits all three accounts', async () => {
    await service.onSaleRefunded(
      {
        saleId,
        companyId,
        warehouseId,
        cashierId,
        saleNumber,
        total: '1000.00',
        currency: 'KZT',
        items: [{
          productId: 'prod-1', quantity: 1, unitPrice: '1000.00',
          costPrice: '600.00', discount: '0', subtotal: '1000.00',
          total: '1000.00', margin: '400.00',
        }],
        payments: [
          { method: 'CASH', amount: '200.00' },
          { method: 'CARD', amount: '300.00' },
          { method: 'STORE_CREDIT', amount: '500.00' },
        ],
      },
      mockTx as unknown as Prisma.TransactionClient,
    );

    const journal = getPostedJournal();
    const lines = journal.lines;

    const cashCredit = lines.find(
      (l) => l.accountId === cashAccountId && Number.parseFloat(l.credit) > 0,
    );
    expect(cashCredit).toBeDefined();
    expect(cashCredit!.credit).toBe('200');

    const bankCredit = lines.find(
      (l) => l.accountId === bankAccountId && Number.parseFloat(l.credit) > 0,
    );
    expect(bankCredit).toBeDefined();
    expect(bankCredit!.credit).toBe('300');

    const arCredit = lines.find(
      (l) => l.accountId === arAccountId && Number.parseFloat(l.credit) > 0,
    );
    expect(arCredit).toBeDefined();
    expect(arCredit!.credit).toBe('500');

    const { totalDebit, totalCredit } = getBalanceTotals(journal);
    expect(totalDebit).toBe(totalCredit);
  });

  it('G11-D: QR / BANK_TRANSFER / MOBILE_WALLET refund all credit Bank', async () => {
    const methods = ['QR', 'BANK_TRANSFER', 'MOBILE_WALLET'];
    for (const method of methods) {
      mockGlEngine.post.mockClear();

      await service.onSaleRefunded(
        {
          saleId,
          companyId,
          warehouseId,
          cashierId,
          saleNumber,
          total: '500.00',
          currency: 'KZT',
          items: [{
            productId: 'prod-1', quantity: 1, unitPrice: '500.00',
            costPrice: '300.00', discount: '0', subtotal: '500.00',
            total: '500.00', margin: '200.00',
          }],
          payments: [{ method, amount: '500.00' }],
        },
        mockTx as unknown as Prisma.TransactionClient,
      );

      const journal = getPostedJournal();
      const lines = journal.lines;
      const bankCredit = lines.find(
        (l) => l.accountId === bankAccountId && Number.parseFloat(l.credit) > 0,
      );
      expect(bankCredit).toBeDefined();
      expect(bankCredit!.credit).toBe('500');
    }
  });

  it('G11-D: GIFT_CARD refund credits AR (1200)', async () => {
    await service.onSaleRefunded(
      {
        saleId,
        companyId,
        warehouseId,
        cashierId,
        saleNumber,
        total: '1000.00',
        currency: 'KZT',
        items: [{
          productId: 'prod-1', quantity: 1, unitPrice: '1000.00',
          costPrice: '600.00', discount: '0', subtotal: '1000.00',
          total: '1000.00', margin: '400.00',
        }],
        payments: [{ method: 'GIFT_CARD', amount: '1000.00' }],
      },
      mockTx as unknown as Prisma.TransactionClient,
    );

    const journal = getPostedJournal();
    const lines = journal.lines;
    const arCredit = lines.find(
      (l) => l.accountId === arAccountId && Number.parseFloat(l.credit) > 0,
    );
    expect(arCredit).toBeDefined();
    expect(arCredit!.credit).toBe('1000');
    expect(arCredit!.description).toContain('Gift card');
  });

  // ═════════════════════════════════════════════
  // G11-E4 — Partial refund Finance/GL (sale.partially_refunded)
  // ═════════════════════════════════════════════
  describe('G11-E4: onSalePartiallyRefunded', () => {
    const refundId = 'refund-1';
    const refundNumber = 'REF-COMP-0001';
    const actorId = 'user-9';

    const partialEvent = (overrides: Record<string, unknown> = {}) => ({
      saleId,
      companyId,
      warehouseId,
      refundId,
      refundNumber,
      saleNumber,
      total: '300.0000',
      currency: 'KZT' as const,
      createdBy: actorId,
      items: [
        {
          productId: 'prod-1',
          saleItemId: 'sale-item-1',
          quantity: 3,
          unitPrice: '100.0000',
          total: '300.0000',
          fifoCost: '180.0000',
        },
      ],
      ...overrides,
    });

    beforeEach(() => {
      // Every E4 test posts exactly one journal per call.
      mockGlEngine.post.mockClear();
    });

    it('1: posts Dr Revenue = total, Cr Cash = total, Dr Inventory / Cr COGS = Σ fifoCost', async () => {
      await service.onSalePartiallyRefunded(
        partialEvent() as any,
        mockTx as unknown as Prisma.TransactionClient,
      );

      expect(mockGlEngine.post).toHaveBeenCalledTimes(1);
      const journal = getPostedJournal();
      const lines = journal.lines;

      const revDebit = lines.find(
        (l) => l.accountId === revenueAccountId && Number.parseFloat(l.debit) > 0,
      );
      const cashCredit = lines.find(
        (l) => l.accountId === cashAccountId && Number.parseFloat(l.credit) > 0,
      );
      const invDebit = lines.find(
        (l) => l.accountId === inventoryAccountId && Number.parseFloat(l.debit) > 0,
      );
      const cogsCredit = lines.find(
        (l) => l.accountId === cogsAccountId && Number.parseFloat(l.credit) > 0,
      );

      expect(revDebit!.debit).toBe('300');
      expect(cashCredit!.credit).toBe('300');
      expect(invDebit!.debit).toBe('180');
      expect(cogsCredit!.credit).toBe('180');
    });

    it('2: journal is balanced (Σdebit == Σcredit) on real lines', async () => {
      await service.onSalePartiallyRefunded(
        partialEvent({
          total: '300.0000',
          items: [
            { ...partialEvent().items[0], fifoCost: '180.0000' },
            { ...partialEvent().items[0], saleItemId: 'sale-item-2', quantity: 1, unitPrice: '100.0000', total: '100.0000', fifoCost: '60.0000' },
          ],
        }) as any,
        mockTx as unknown as Prisma.TransactionClient,
      );

      const journal = getPostedJournal();
      const { totalDebit, totalCredit } = getBalanceTotals(journal);
      expect(totalDebit).toBe(totalCredit);
      expect(totalDebit).toBeCloseTo(300 + 240, 6);
    });
    it('3: multiple partial refunds produce separate journals (each its own amount)', async () => {
      await service.onSalePartiallyRefunded(
        partialEvent({ refundId: 'refund-1', total: '300.0000', items: [{ ...partialEvent().items[0], fifoCost: '180.0000' }] }) as any,
        mockTx as unknown as Prisma.TransactionClient,
      );
      await service.onSalePartiallyRefunded(
        partialEvent({ refundId: 'refund-2', total: '200.0000', items: [{ ...partialEvent().items[0], saleItemId: 'sale-item-2', quantity: 2, unitPrice: '100.0000', total: '200.0000', fifoCost: '120.0000' }] }) as any,
        mockTx as unknown as Prisma.TransactionClient,
      );

      expect(mockGlEngine.post).toHaveBeenCalledTimes(2);
      const [first, second] = mockGlEngine.post.mock.calls;
      const j1 = first![0] as PostJournalEntryInput;
      const j2 = second![0] as PostJournalEntryInput;

      expect(j1.referenceId).toBe('refund-1');
      expect(j2.referenceId).toBe('refund-2');
      expect(j1.lines.find((l) => l.accountId === revenueAccountId)!.debit).toBe(
        '300',
      );
      expect(j2.lines.find((l) => l.accountId === revenueAccountId)!.debit).toBe(
        '200',
      );
    });

    it('4: current refund only — no cumulative amounts', async () => {
      await service.onSalePartiallyRefunded(
        partialEvent({ refundId: 'refund-1', total: '300.0000' }) as any,
        mockTx as unknown as Prisma.TransactionClient,
      );
      await service.onSalePartiallyRefunded(
        partialEvent({ refundId: 'refund-2', total: '200.0000' }) as any,
        mockTx as unknown as Prisma.TransactionClient,
      );

      // neither journal carries the cumulative 500
      for (const call of mockGlEngine.post.mock.calls) {
        const j = call[0] as PostJournalEntryInput;
        const revDebit = j.lines.find(
          (l) => l.accountId === revenueAccountId,
        )!.debit;
        expect(revDebit).not.toBe('500');
        expect(Number.parseFloat(revDebit)).toBeLessThan(500);
      }
      expect(
        (mockGlEngine.post.mock.calls[0]![0] as PostJournalEntryInput).lines.find(
          (l) => l.accountId === revenueAccountId,
        )!.debit,
      ).toBe('300');
      expect(
        (mockGlEngine.post.mock.calls[1]![0] as PostJournalEntryInput).lines.find(
          (l) => l.accountId === revenueAccountId,
        )!.debit,
      ).toBe('200');
    });

    it('5: final-after-partial posts ONLY the final remainder', async () => {
      await service.onSalePartiallyRefunded(
        partialEvent({ refundId: 'refund-final', total: '200.0000', items: [{ ...partialEvent().items[0], quantity: 2, total: '200.0000', fifoCost: '119.9999' }] }) as any,
        mockTx as unknown as Prisma.TransactionClient,
      );

      const journal = getPostedJournal();
      expect(journal.referenceId).toBe('refund-final');
      expect(journal.lines.find((l) => l.accountId === revenueAccountId)!.debit).toBe('200');
      expect(
        journal.lines.find((l) => l.accountId === inventoryAccountId)!.debit,
      ).toBe('119.9999');
    });

    it('6/7: FIFO conservation 100/3 → 33.3333 + 33.3333 + 33.3334 = 100.0000 across three refund journals', async () => {
      const lines = ['33.3333', '33.3333', '33.3334'];
      for (let i = 0; i < lines.length; i += 1) {
        await service.onSalePartiallyRefunded(
          partialEvent({
            refundId: `refund-${i + 1}`,
            total: '100.0000',
            items: [{ ...partialEvent().items[0], quantity: 1, total: '100.0000', fifoCost: lines[i] }],
          }) as any,
          mockTx as unknown as Prisma.TransactionClient,
        );
      }

      expect(mockGlEngine.post).toHaveBeenCalledTimes(3);
      let sum = new Decimal(0);
      for (const call of mockGlEngine.post.mock.calls) {
        const j = call[0] as PostJournalEntryInput;
        sum = sum.add(new Decimal(j.lines.find((l) => l.accountId === inventoryAccountId)!.debit));
      }
      expect(sum.toFixed(4)).toBe('100.0000');
    });

    it('8: does NOT read CostLayer OUT (negative assertion)', async () => {
      await service.onSalePartiallyRefunded(
        partialEvent() as any,
        mockTx as unknown as Prisma.TransactionClient,
      );
      expect(mockTx.costLayer.findMany).not.toHaveBeenCalled();
    });

    it('9: does NOT use product.costPrice — no product queries at all (negative assertion)', async () => {
      const productFindUnique = jest.fn();
      const productFindFirst = jest.fn();
      const txWithProduct = {
        ...mockTx,
        product: { findUnique: productFindUnique, findFirst: productFindFirst },
      };
      await service.onSalePartiallyRefunded(
        partialEvent({ items: [{ ...partialEvent().items[0], fifoCost: '77.7777' }] }) as any,
        txWithProduct as unknown as Prisma.TransactionClient,
      );
      expect(productFindUnique).not.toHaveBeenCalled();
      expect(productFindFirst).not.toHaveBeenCalled();
      expect(
        (getPostedJournal().lines.find((l) => l.accountId === inventoryAccountId)! as any).debit,
      ).toBe('77.7777');
    });

    it('10/11: reference identity REFUND/refundId and createdBy from payload', async () => {
      await service.onSalePartiallyRefunded(
        partialEvent() as any,
        mockTx as unknown as Prisma.TransactionClient,
      );
      const journal = getPostedJournal();
      expect(journal.referenceType).toBe('REFUND');
      expect(journal.referenceId).toBe(refundId);
      expect(journal.referenceId).not.toBe(saleId);
      expect(journal.createdBy).toBe(actorId);
    });

    it('12: company isolation — accounts and period scoped to event.companyId', async () => {
      await service.onSalePartiallyRefunded(
        partialEvent({ companyId: 'comp-99' }) as any,
        mockTx as unknown as Prisma.TransactionClient,
      );
      expect(mockTx.chartOfAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'comp-99' }),
        }),
      );
      expect(mockPeriodsRepo.findCurrent).toHaveBeenCalledWith('comp-99');
      expect(getPostedJournal().companyId).toBe('comp-99');
    });

    it('13: currency passthrough without FX', async () => {
      await service.onSalePartiallyRefunded(
        partialEvent({ currency: 'USD' }) as any,
        mockTx as unknown as Prisma.TransactionClient,
      );
      const journal = getPostedJournal();
      // GL metadata carries the payload currency untouched
      expect(journal.description).toContain('Partial refund');
      // amounts posted verbatim from payload strings (no conversion)
      expect(journal.lines.find((l) => l.accountId === revenueAccountId)!.debit).toBe('300');
    });

    it('14: missing OPEN financial period → throws (fail fast)', async () => {
      mockPeriodsRepo.findCurrent.mockResolvedValueOnce(null as any);
      await expect(
        service.onSalePartiallyRefunded(
          partialEvent() as any,
          mockTx as unknown as Prisma.TransactionClient,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockGlEngine.post).not.toHaveBeenCalled();
    });

    it('15: missing required account → throws (fail fast, no silent skip)', async () => {
      mockTx.chartOfAccount.findMany.mockResolvedValueOnce(
        mockAccounts.filter((a) => a.code !== '1300'),
      );
      await expect(
        service.onSalePartiallyRefunded(
          partialEvent() as any,
          mockTx as unknown as Prisma.TransactionClient,
        ),
      ).rejects.toThrow(/1300/);
      expect(mockGlEngine.post).not.toHaveBeenCalled();
    });

    it('16: glEngine.post failure propagates for rollback through the caller transaction', async () => {
      mockGlEngine.post.mockRejectedValueOnce(new Error('period closed'));
      await expect(
        service.onSalePartiallyRefunded(
          partialEvent() as any,
          mockTx as unknown as Prisma.TransactionClient,
        ),
      ).rejects.toThrow('period closed');
    });

    it('17: handler without transactionClient fails fast and never calls the integration service', async () => {
      const { SalePartiallyRefundedEventHandler } = await import(
        '../../events/sale-partially-refunded.handler'
      );
      const integration = { onSalePartiallyRefunded: jest.fn() };
      const handler = new SalePartiallyRefundedEventHandler(
        integration as any,
      );

      await expect(
        handler.handle({ payload: partialEvent() } as any, {} as any),
      ).rejects.toThrow(/No transaction context/);
      expect(integration.onSalePartiallyRefunded).not.toHaveBeenCalled();

      // and with a tx it delegates
      const tx = {} as any;
      await handler.handle({ payload: partialEvent() } as any, {
        transactionClient: tx,
      });
      expect(integration.onSalePartiallyRefunded).toHaveBeenCalledWith(
        expect.objectContaining({ refundId }),
        tx,
      );
    });
  });

  // ═══════════════════════════════════════════
  // G11-E5 — allocation-driven payment side (sale.partially_refunded)
  // ═══════════════════════════════════════════
  describe('G11-E5: onSalePartiallyRefunded payment allocation', () => {
    const refundId = 'refund-1';
    const refundNumber = 'REF-COMP-0001';

    const partialEvent = (overrides: Record<string, unknown> = {}) => ({
      saleId,
      companyId,
      warehouseId,
      refundId,
      refundNumber,
      saleNumber,
      total: '300.0000',
      currency: 'KZT' as const,
      createdBy: 'user-9',
      items: [
        {
          productId: 'prod-1',
          saleItemId: 'sale-item-1',
          quantity: 3,
          unitPrice: '100.0000',
          total: '300.0000',
          fifoCost: '180.0000',
        },
      ],
      ...overrides,
    });

    const setAllocations = (
      rows: Array<{ method: string; amount: string }>,
    ) => {
      mockTx.refundPaymentAllocation.findMany.mockResolvedValue(
        rows.map((r) => ({ ...r, amount: new Decimal(r.amount) })),
      );
    };

    beforeEach(() => {
      mockGlEngine.post.mockClear();
      mockTx.refundPaymentAllocation.findMany.mockClear();
      mockTx.refundPaymentAllocation.findMany.mockResolvedValue([]);
    });

    it('18: no allocation rows → legacy fallback Cr Cash 1010 = total (historical E4 refund)', async () => {
      await service.onSalePartiallyRefunded(
        partialEvent() as any,
        mockTx as unknown as Prisma.TransactionClient,
      );
      expect(mockTx.refundPaymentAllocation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId,
            salesRefundId: refundId,
          }),
        }),
      );
      const lines = getPostedJournal().lines;
      const cashCredit = lines.find(
        (l) => l.accountId === cashAccountId && Number.parseFloat(l.credit) > 0,
      );
      expect(cashCredit!.credit).toBe('300');
      // no bank/AR lines exist
      expect(
        lines.some(
          (l) =>
            (l.accountId === bankAccountId || l.accountId === arAccountId) &&
            Number.parseFloat(l.credit) > 0,
        ),
      ).toBe(false);
    });

    it('19: allocation rows drive the payment side (CASH→1010, CARD→1020, STORE_CREDIT→1200)', async () => {
      setAllocations([
        { method: 'CASH', amount: '100.0000' },
        { method: 'CARD', amount: '120.0000' },
        { method: 'STORE_CREDIT', amount: '80.0000' },
      ]);
      await service.onSalePartiallyRefunded(
        partialEvent() as any,
        mockTx as unknown as Prisma.TransactionClient,
      );
      const lines = getPostedJournal().lines;
      const creditFor = (accountId: string) =>
        Number.parseFloat(
          lines.find(
            (l) =>
              l.accountId === accountId && Number.parseFloat(l.credit) > 0,
          )!.credit,
        );
      expect(creditFor(cashAccountId)).toBe(100);
      expect(creditFor(bankAccountId)).toBe(120);
      expect(creditFor(arAccountId)).toBe(80);
      // FIFO/COGS side untouched
      expect(
        Number.parseFloat(
          lines.find(
            (l) =>
              l.accountId === inventoryAccountId &&
              Number.parseFloat(l.debit) > 0,
          )!.debit,
        ),
      ).toBe(180);
      expect(
        Number.parseFloat(
          lines.find(
            (l) =>
              l.accountId === cogsAccountId && Number.parseFloat(l.credit) > 0,
          )!.credit,
        ),
      ).toBe(180);
      const { totalDebit, totalCredit } = getBalanceTotals(getPostedJournal());
      expect(totalDebit).toBe(totalCredit);
    });

    it('20: BANK_TRANSFER and GIFT_CARD aggregate into 1020/1200; no zero lines', async () => {
      setAllocations([
        { method: 'BANK_TRANSFER', amount: '150.0000' },
        { method: 'GIFT_CARD', amount: '150.0000' },
      ]);
      await service.onSalePartiallyRefunded(
        partialEvent() as any,
        mockTx as unknown as Prisma.TransactionClient,
      );
      const lines = getPostedJournal().lines;
      expect(
        Number.parseFloat(
          lines.find(
            (l) =>
              l.accountId === bankAccountId && Number.parseFloat(l.credit) > 0,
          )!.credit,
        ),
      ).toBe(150);
      expect(
        Number.parseFloat(
          lines.find(
            (l) =>
              l.accountId === arAccountId && Number.parseFloat(l.credit) > 0,
          )!.credit,
        ),
      ).toBe(150);
      // no zero-value credit lines anywhere
      expect(
        lines.filter((l) => Number.parseFloat(l.credit) === 0 && Number.parseFloat(l.debit) === 0),
      ).toHaveLength(0);
    });

    it('21: allocation sum != refund total → FAIL FAST, no journal', async () => {
      setAllocations([
        { method: 'CASH', amount: '100.0000' },
        { method: 'CARD', amount: '100.0000' },
      ]); // sums to 200, refund total is 300
      await expect(
        service.onSalePartiallyRefunded(
          partialEvent() as any,
          mockTx as unknown as Prisma.TransactionClient,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockGlEngine.post).not.toHaveBeenCalled();
    });

    it('22: non-positive allocation row → FAIL FAST, no silent Cash fallback', async () => {
      setAllocations([
        { method: 'CASH', amount: '300.0000' },
        { method: 'CARD', amount: '0.0000' },
      ]);
      await expect(
        service.onSalePartiallyRefunded(
          partialEvent() as any,
          mockTx as unknown as Prisma.TransactionClient,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockGlEngine.post).not.toHaveBeenCalled();
    });

    it('23: allocation read is tenant-scoped by companyId + salesRefundId (never refundId alone)', async () => {
      setAllocations([{ method: 'CASH', amount: '300.0000' }]);
      await service.onSalePartiallyRefunded(
        partialEvent({ companyId: 'comp-42' }) as any,
        mockTx as unknown as Prisma.TransactionClient,
      );
      expect(mockTx.refundPaymentAllocation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'comp-42',
            salesRefundId: refundId,
          }),
        }),
      );
    });
  });
});
