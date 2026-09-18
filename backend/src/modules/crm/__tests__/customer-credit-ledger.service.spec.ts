import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  Currency,
  CustomerCreditTransactionDirection,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { AuditLogService } from '../../shared/services/audit-log.service';
import { PrismaService } from '../../../common/prisma';
import {
  CustomerCreditLedgerRepository,
  PrismaTx,
} from '../repositories/customer-credit-ledger.repository';
import { CustomerCreditLedgerService } from '../services/customer-credit-ledger.service';

/**
 * G11-F2 — customer credit ledger unit tests.
 *
 * The atomic never-negative spend lives in a single SQL statement
 * (INSERT…SELECT…WHERE balance >= amount). Unit tests here assert the
 * SERVICE contract around it: aggregation of credit payments, customer
 * requirement, currency semantics, direction encoding, the insufficient-
 * balance failure mapping, issuance-per-allocation, and audit on manual
 * adjustments. The SQL guard itself is exercised by the repository tests'
 * where-shape assertions and (in a DB-backed environment) the integration
 * concurrency gate — see the final report note.
 */

const companyId = 'comp-1';
const userId = 'user-1';
const customerId = 'cust-1';

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'lrow-1',
    companyId,
    customerId,
    direction: 'SPENT',
    amount: new Decimal('100.0000'),
    currency: 'KZT',
    referenceType: 'SALE_PAYMENT',
    referenceId: 'sale-1',
    createdBy: userId,
    reason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('CustomerCreditLedgerService', () => {
  let service: CustomerCreditLedgerService;
  let repo: {
    atomicSpend: jest.Mock;
    issueRefundCredit: jest.Mock;
    createManualAdjustment: jest.Mock;
    getBalances: jest.Mock;
    getTransactions: jest.Mock;
    findCustomerCompany: jest.Mock;
  };
  let auditLog: { log: jest.Mock };
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    repo = {
      atomicSpend: jest
        .fn()
        .mockImplementation((_tx: PrismaTx, _c: string, facts: unknown) =>
          Promise.resolve(
            row({
              direction: 'SPENT',
              amount: (facts as { amount: Decimal }).amount,
              currency: (facts as { currency: string }).currency,
              referenceId: (facts as { saleId: string }).saleId,
            }) as never,
          ),
        ),
      issueRefundCredit: jest
        .fn()
        .mockImplementation((_tx: PrismaTx, _c: string, f: unknown) =>
          Promise.resolve({ id: 'lrow-issued', ...(f as object) } as never),
        ),
      createManualAdjustment: jest
        .fn()
        .mockImplementation((_tx: PrismaTx, _c: string, f: unknown) =>
          Promise.resolve({
            id: 'lrow-adjust',
            referenceId: 'lrow-adjust',
            ...(f as object),
          } as never),
        ),
      getBalances: jest.fn().mockResolvedValue(new Map()),
      getTransactions: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
      }),
      findCustomerCompany: jest.fn().mockResolvedValue({ id: customerId }),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    prisma = { $transaction: jest.fn((fn: any) => fn({})) };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerCreditLedgerService,
        { provide: CustomerCreditLedgerRepository, useValue: repo },
        { provide: AuditLogService, useValue: auditLog },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = mod.get(CustomerCreditLedgerService);
  });

  const tx = {} as Prisma.TransactionClient;

  describe('spend — sale completion integration', () => {
    it('creates one aggregated SPENT row for STORE_CREDIT + GIFT_CARD (§9: 100 + 50 → 150, one row)', async () => {
      const result = await service.spend(tx, {
        companyId,
        saleId: 'sale-1',
        customerId,
        currency: Currency.KZT,
        payments: [
          { method: PaymentMethod.STORE_CREDIT, amount: '100.0000' },
          { method: PaymentMethod.GIFT_CARD, amount: '50.0000' },
          { method: PaymentMethod.CASH, amount: '999.0000' },
          { method: PaymentMethod.CARD, amount: '999.0000' },
        ],
        createdBy: userId,
      });

      expect(result).not.toBeNull();
      expect(result!.direction).toBe('SPENT');
      expect(new Decimal(result!.amount).toFixed(4)).toBe('150.0000');
      expect(repo.atomicSpend).toHaveBeenCalledTimes(1);
      const [, , facts] = repo.atomicSpend.mock.calls[0];
      expect(facts.amount.toFixed(4)).toBe('150.0000');
      expect(facts.currency).toBe(Currency.KZT);
    });

    it('returns null and never touches the ledger for non-credit payments (§23.23)', async () => {
      const result = await service.spend(tx, {
        companyId,
        saleId: 'sale-1',
        customerId,
        currency: Currency.KZT,
        payments: [
          { method: PaymentMethod.CASH, amount: '100' },
          { method: PaymentMethod.CARD, amount: '400' },
        ],
        createdBy: userId,
      });

      expect(result).toBeNull();
      expect(repo.atomicSpend).not.toHaveBeenCalled();
    });

    it('fails fast when a credit payment exists but the sale has no customer (§23.22)', async () => {
      await expect(
        service.spend(tx, {
          companyId,
          saleId: 'sale-1',
          customerId: null,
          currency: Currency.KZT,
          payments: [{ method: PaymentMethod.STORE_CREDIT, amount: '100' }],
          createdBy: userId,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.atomicSpend).not.toHaveBeenCalled();
    });

    it('maps zero inserted rows (insufficient balance) to BadRequestException (§23.6)', async () => {
      repo.atomicSpend.mockResolvedValue(null);
      await expect(
        service.spend(tx, {
          companyId,
          saleId: 'sale-1',
          customerId,
          currency: Currency.KZT,
          payments: [{ method: PaymentMethod.STORE_CREDIT, amount: '500' }],
          createdBy: userId,
        }),
      ).rejects.toThrow(/Insufficient customer credit balance/);
    });

    it('passes the caller transaction client to the repository (no nested tx)', async () => {
      await service.spend(tx, {
        companyId,
        saleId: 'sale-1',
        customerId,
        currency: Currency.KZT,
        payments: [{ method: PaymentMethod.STORE_CREDIT, amount: '10' }],
        createdBy: userId,
      });
      expect(repo.atomicSpend.mock.calls[0][0]).toBe(tx);
    });
  });

  describe('issueRefundCredit — refund integration', () => {
    it('creates one ISSUED row per eligible allocation with exact amounts (§23.9)', async () => {
      const results = await service.issueRefundCredit(tx, {
        companyId,
        customerId,
        currency: Currency.KZT,
        allocations: [
          { id: 'alloc-1', method: PaymentMethod.STORE_CREDIT, amount: new Decimal('80.0000') },
          { id: 'alloc-2', method: PaymentMethod.GIFT_CARD, amount: new Decimal('20.0000') },
          { id: 'alloc-3', method: PaymentMethod.CASH, amount: new Decimal('900.0000') },
        ],
        createdBy: userId,
      });

      expect(results).toHaveLength(2);
      expect(repo.issueRefundCredit).toHaveBeenCalledTimes(2);
      const first = repo.issueRefundCredit.mock.calls[0][2];
      const second = repo.issueRefundCredit.mock.calls[1][2];
      expect(first.allocationId).toBe('alloc-1');
      expect(first.amount.toFixed(4)).toBe('80.0000');
      expect(second.allocationId).toBe('alloc-2');
      expect(second.amount.toFixed(4)).toBe('20.0000');
      // CASH allocation never reaches the ledger
      expect(
        repo.issueRefundCredit.mock.calls.every(
          (c) => c[2].allocationId !== 'alloc-3',
        ),
      ).toBe(true);
    });

    it('returns [] when no credit-method allocations exist', async () => {
      const results = await service.issueRefundCredit(tx, {
        companyId,
        customerId,
        currency: Currency.KZT,
        allocations: [
          { id: 'alloc-c', method: PaymentMethod.CASH, amount: new Decimal('10') },
        ],
        createdBy: userId,
      });
      expect(results).toEqual([]);
      expect(repo.issueRefundCredit).not.toHaveBeenCalled();
    });

    it('fails fast when the sale has no customer but a credit allocation exists (§11)', async () => {
      await expect(
        service.issueRefundCredit(tx, {
          companyId,
          customerId: null,
          currency: Currency.KZT,
          allocations: [
            { id: 'alloc-1', method: PaymentMethod.STORE_CREDIT, amount: new Decimal('10') },
          ],
          createdBy: userId,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repo.issueRefundCredit).not.toHaveBeenCalled();
    });
  });

  describe('adjust — manual corrections', () => {
    it('positive amount → ISSUED top-up with MANUAL_ADJUSTMENT reference (§23.14)', async () => {
      const result = await service.adjust(
        { amount: '250.0000', currency: 'KZT', reason: 'goodwill credit' },
        customerId,
        companyId,
        userId,
      );

      expect(result).toBeDefined();
      const facts = repo.createManualAdjustment.mock.calls[0][2];
      expect(facts.direction).toBe(CustomerCreditTransactionDirection.ISSUED);
      expect(facts.amount.toFixed(4)).toBe('250.0000');
      expect(facts.reason).toBe('goodwill credit');
      expect(auditLog.log).toHaveBeenCalledTimes(1);
      const entry = auditLog.log.mock.calls[0][0];
      expect(entry.action).toBe('ISSUED');
      expect(entry.entityType).toBe('CustomerCreditTransaction');
    });

    it('negative amount → ADJUSTED write-off (positive stored amount) (§23.15)', async () => {
      await service.adjust(
        { amount: '-150.0000', currency: 'KZT', reason: 'fraud reversal' },
        customerId,
        companyId,
        userId,
      );

      const facts = repo.createManualAdjustment.mock.calls[0][2];
      expect(facts.direction).toBe(CustomerCreditTransactionDirection.ADJUSTED);
      expect(facts.amount.toFixed(4)).toBe('150.0000'); // stored positive
      expect(facts.reason).toBe('fraud reversal');
      const entry = auditLog.log.mock.calls[0][0];
      expect(entry.action).toBe('ADJUSTED');
    });

    it('negative adjustment beyond balance fails fast (§23.16 — repository guard returns 0 rows)', async () => {
      // F2-2 remediation: the never-negative invariant is enforced by the
      // repository's DB-level guard (advisory lock + INSERT…SELECT…WHERE
      // balance >= amount). Insufficient balance ⇒ 0 inserted rows ⇒ the
      // service maps null → BadRequest. (The real PostgreSQL serialization
      // is not unit-testable — see the final report's concurrency note.)
      repo.createManualAdjustment.mockResolvedValue(null);

      await expect(
        service.adjust(
          { amount: '-100.0000', currency: 'KZT', reason: 'overdraw' },
          customerId,
          companyId,
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repo.createManualAdjustment).toHaveBeenCalledTimes(1);
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('zero amount is rejected', async () => {
      await expect(
        service.adjust(
          { amount: '0.0000', currency: 'KZT', reason: 'noop' },
          customerId,
          companyId,
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('audit failure rolls back the adjustment (§14)', async () => {
      auditLog.log.mockRejectedValue(new Error('audit down'));
      await expect(
        service.adjust(
          { amount: '10.0000', currency: 'KZT', reason: 'x' },
          customerId,
          companyId,
          userId,
        ),
      ).rejects.toThrow('audit down');
      // the service transaction wrapper was entered; the thrown error rolls
      // the whole tx back (mock invokes fn synchronously)
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('balances / tenant isolation', () => {
    it('returns per-currency balances from the aggregation (§23.8)', async () => {
      repo.getBalances.mockImplementation(
        (_c: string, _cust: string, cur?: Currency) => {
          if (cur === Currency.USD) {
            return Promise.resolve(
              new Map([
                ['USD', { balance: new Decimal('5.0000'), issuedTotal: new Decimal('5'), spentTotal: new Decimal('0'), adjustedTotal: new Decimal('0') }],
              ]),
            );
          }
          return Promise.resolve(
            new Map([
              ['KZT', { balance: new Decimal('1000.0000'), issuedTotal: new Decimal('2000'), spentTotal: new Decimal('1000'), adjustedTotal: new Decimal('0') }],
              ['USD', { balance: new Decimal('5.0000'), issuedTotal: new Decimal('5'), spentTotal: new Decimal('0'), adjustedTotal: new Decimal('0') }],
            ]),
          );
        },
      );

      const all = await service.getBalances(customerId, companyId);
      expect(all.map((b) => b.currency).sort()).toEqual(['KZT', 'USD']);
      const kzt = all.find((b) => b.currency === 'KZT')!;
      expect(kzt.balance).toBe('1000.0000'); // 2000 ISSUED − 1000 SPENT
      expect(kzt.issuedTotal).toBe('2000.0000');

      const usdOnly = await service.getBalances(customerId, companyId, 'USD');
      expect(usdOnly).toHaveLength(1);
      expect(usdOnly[0]!.currency).toBe('USD');
    });

    it('foreign customer → NotFoundException (tenant-safe 404, §23.18)', async () => {
      repo.findCustomerCompany.mockResolvedValue(null);
      await expect(
        service.getBalances('other-tenant-cust', companyId),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getTransactions('other-tenant-cust', companyId, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('zero-activity customer → single zero balance (§23.1 baseline)', async () => {
      repo.getBalances.mockResolvedValue(new Map());
      const balances = await service.getBalances(customerId, companyId);
      expect(balances).toHaveLength(1);
      expect(balances[0]!.balance).toBe('0.0000');
    });

    it('Decimal 4-place precision is preserved end-to-end (§23.21)', async () => {
      repo.getBalances.mockResolvedValue(
        new Map([
          ['KZT', { balance: new Decimal('33.3333').add(new Decimal('33.3333')).add(new Decimal('33.3334')), issuedTotal: new Decimal('100.0000'), spentTotal: new Decimal('0'), adjustedTotal: new Decimal('0') }],
        ]),
      );
      const balances = await service.getBalances(customerId, companyId, 'KZT');
      expect(balances[0]!.balance).toBe('100.0000');
    });
  });
});
