import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
});
