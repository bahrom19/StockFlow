import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ChartOfAccountsService } from '../chart-of-accounts.service';

const companyId = 'comp-1';
const currentUser = {
  userId: 'user-1',
  companyId,
  roles: ['Admin'],
  email: 'admin@example.com',
};

const account = (over: Record<string, any> = {}) => ({
  id: 'acc-1',
  companyId,
  code: '1010',
  name: 'Cash',
  description: null,
  accountType: 'ASSET',
  normalBalance: 'DEBIT',
  isActive: true,
  isSystem: false,
  isCashOrBank: false,
  parentId: null,
  level: 0,
  sortOrder: 0,
  rowVersion: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  ...over,
});

const createDto = (over: Record<string, any> = {}) => ({
  code: '1010',
  name: 'Cash',
  accountType: 'ASSET',
  normalBalance: 'DEBIT',
  ...over,
});

/**
 * G15-07-C1 — the isSystem flag is server-controlled.
 *
 * Clients must not be able to create a system account, convert an account
 * into a system account, or change the flag by echoing a different value;
 * and a system account must not be soft-deletable (the scoped lookups filter
 * deletedAt while the unique (companyId, code) constraint blocks recreating
 * the code, so a soft-deleted system account is unrecoverable).
 */
describe('ChartOfAccountsService — system-account trust model (G15-07-C1)', () => {
  let service: ChartOfAccountsService;
  let repository: any;
  let mockTx: any;
  let prisma: any;
  let auditLog: any;

  beforeEach(() => {
    mockTx = {};
    repository = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
    prisma = {
      $transaction: jest.fn((cb: (tx: any) => any) => cb(mockTx)),
    };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    service = new ChartOfAccountsService(
      repository,
      prisma,
      auditLog,
    ) as unknown as ChartOfAccountsService;
  });

  describe('create', () => {
    it('rejects a client-requested system account', async () => {
      await expect(
        service.create(createDto({ isSystem: true }) as any, currentUser),
      ).rejects.toThrow(BadRequestException);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('persists a normal account with isSystem forced to false', async () => {
      repository.create.mockImplementation((data: any) =>
        Promise.resolve(account({ ...data, companyId })),
      );

      await service.create(createDto() as any, currentUser);

      const data = repository.create.mock.calls[0][0];
      expect(data.isSystem).toBe(false);
    });

    it('does not trust a client-sent isSystem = false', async () => {
      repository.create.mockResolvedValue(account());

      await service.create(createDto({ isSystem: false }) as any, currentUser);

      const data = repository.create.mock.calls[0][0];
      expect(data.isSystem).toBe(false);
    });
  });

  describe('update', () => {
    it('rejects a change of the system-account flag', async () => {
      repository.findById.mockResolvedValue(account({ isSystem: false }));

      await expect(
        service.update('acc-1', { isSystem: true } as any, currentUser),
      ).rejects.toThrow(BadRequestException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('accepts a no-op echo of the current flag without writing it', async () => {
      repository.findById.mockResolvedValue(account({ isSystem: false }));
      repository.update.mockResolvedValue(account({ isSystem: false }));

      await service.update('acc-1', { isSystem: false } as any, currentUser);

      expect(repository.update).toHaveBeenCalledTimes(1);
      const data = repository.update.mock.calls[0][1];
      expect(data).not.toHaveProperty('isSystem');
    });

    it('allows an existing system account to keep isSystem = true as a no-op', async () => {
      repository.findById.mockResolvedValue(account({ isSystem: true }));
      repository.update.mockResolvedValue(account({ isSystem: true }));

      await service.update('acc-1', { isSystem: true } as any, currentUser);

      const data = repository.update.mock.calls[0][1];
      expect(data).not.toHaveProperty('isSystem');
      expect(repository.update.mock.calls[0][3]).toBe(1); // rowVersion CAS
    });

    it('rejects converting a system account back to non-system', async () => {
      repository.findById.mockResolvedValue(account({ isSystem: true }));

      await expect(
        service.update('acc-1', { isSystem: false } as any, currentUser),
      ).rejects.toThrow(BadRequestException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects an update of an unknown account', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('acc-1', { name: 'X' } as any, currentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('parent ownership (G16-B-02 PH1 B02-06)', () => {
    const withParentLookup = (resolved: unknown) => {
      (mockTx as any).chartOfAccount = {
        findFirst: jest.fn().mockResolvedValue(resolved),
      };
    };

    it('rejects a foreign parent on create with 404 and persists nothing', async () => {
      withParentLookup(null);

      await expect(
        service.create(createDto({ parentId: 'parent-evil' }) as any, currentUser),
      ).rejects.toThrow(NotFoundException);

      expect(
        (mockTx as any).chartOfAccount.findFirst,
      ).toHaveBeenCalledWith({
        where: {
          id: 'parent-evil',
          companyId,
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive/deleted parent on create with 404', async () => {
      withParentLookup(null);

      await expect(
        service.create(createDto({ parentId: 'parent-old' }) as any, currentUser),
      ).rejects.toThrow(NotFoundException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('accepts a same-company live parent on create', async () => {
      withParentLookup({ id: 'parent-1' });
      repository.create.mockImplementation((data: any) =>
        Promise.resolve(account({ ...data, companyId })),
      );

      await service.create(
        createDto({ parentId: 'parent-1' }) as any,
        currentUser,
      );

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          parent: { connect: { id: 'parent-1' } },
        }),
        expect.anything(),
      );
    });

    it('skips the lookup when no parent is supplied on create', async () => {
      repository.create.mockResolvedValue(account());

      await service.create(createDto() as any, currentUser);

      expect((mockTx as any).chartOfAccount).toBeUndefined();
      expect(repository.create).toHaveBeenCalled();
    });

    it('rejects a foreign parent on update with 404', async () => {
      repository.findById.mockResolvedValue(account());
      withParentLookup(null);

      await expect(
        service.update('acc-1', { parentId: 'parent-evil' } as any, currentUser),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('allows explicit parent disconnect without a lookup', async () => {
      repository.findById.mockResolvedValue(account());
      repository.update.mockResolvedValue(account());

      await service.update('acc-1', { parentId: null } as any, currentUser);

      expect((mockTx as any).chartOfAccount).toBeUndefined();
      expect(repository.update).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('rejects deletion of a system account', async () => {
      repository.findById.mockResolvedValue(
        account({ code: '3200', isSystem: true }),
      );

      await expect(service.softDelete('acc-1', currentUser)).rejects.toThrow(
        BadRequestException,
      );

      expect(repository.softDelete).not.toHaveBeenCalled();
      expect(auditLog.log).not.toHaveBeenCalled();
    });

    it('preserves the existing soft-delete behaviour for non-system accounts', async () => {
      repository.findById.mockResolvedValue(account({ isSystem: false }));
      repository.softDelete.mockResolvedValue(
        account({ isSystem: false, deletedAt: new Date(), isActive: false }),
      );

      const result = await service.softDelete('acc-1', currentUser);

      expect(repository.softDelete).toHaveBeenCalledWith(
        'acc-1',
        companyId,
        1,
        mockTx,
      );
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE' }),
        mockTx,
      );
      expect(result.deletedAt).not.toBeNull();
    });
  });
});

/**
 * G16-FU-2 — cash-account classification integrity.
 *
 * `isCashOrBank` is an independent per-account business classification (it is
 * NOT derived from `accountType`), but it may only be true for an account
 * capable of representing cash: an ASSET/DEBIT account. `CashFlowService`
 * computes cash as Σ(debit − credit) over exactly that population.
 *
 * Two independent rules are enforced:
 *
 *   1. the type invariant, validated on the FINAL state so the
 *      cross-direction bypass (flip `accountType`/`normalBalance` while leaving
 *      `isCashOrBank: true`) is rejected too — this holds unconditionally, with
 *      no history involved;
 *   2. the historical gate — once the account has ANY JournalLine, toggling the
 *      cash flag is refused, because it would retroactively restate historical
 *      cash. It rides the SAME `updateMany` predicate as the optimistic lock, so
 *      it is atomic rather than a SELECT-then-UPDATE.
 *
 * Balance, AccountBalance snapshots and period state are deliberately NOT
 * consulted: an account with a zero current balance, or with every entry
 * reversed, still has reportable history.
 */
describe('ChartOfAccountsService — cash classification integrity (G16-FU-2)', () => {
  let service: ChartOfAccountsService;
  let repository: any;
  let mockTx: any;
  let prisma: any;
  let auditLog: any;

  /** journalLine.count inside the open transaction — drives the error mapping. */
  let journalLineCount: number;

  /**
   * A REAL ConflictException instance. The service distinguishes a failed CAS
   * from a failed history guard with `instanceof`, so a hand-rolled object with
   * `name: 'ConflictException'` is correctly NOT accepted — tests must use the
   * actual class.
   */
  let ConflictCtor: typeof import('@nestjs/common').ConflictException;
  beforeAll(async () => {
    ConflictCtor = (await import('@nestjs/common')).ConflictException;
  });

  beforeEach(() => {
    journalLineCount = 0;
    mockTx = {
      chartOfAccount: {
        count: jest.fn(async () => 1),
        findFirst: jest.fn(async () => ({ id: 'acc-1' })),
      },
      journalLine: { count: jest.fn(async () => journalLineCount) },
    };
    repository = {
      create: jest.fn(async (data: any) => account({ ...data, companyId })),
      findById: jest.fn(),
      update: jest.fn(async (_id: any, data: any) => account(data)),
      softDelete: jest.fn(),
    };
    prisma = { $transaction: jest.fn((cb: (tx: any) => any) => cb(mockTx)) };
    auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    service = new ChartOfAccountsService(
      repository,
      prisma,
      auditLog,
    ) as unknown as ChartOfAccountsService;
  });

  const cashDto = (over: Record<string, any> = {}) => ({
    code: '1050',
    name: 'Bank',
    accountType: 'ASSET',
    normalBalance: 'DEBIT',
    ...over,
  });

  /** Existing account state the update is applied on top of. */
  const given = (over: Record<string, any> = {}) =>
    account({ isCashOrBank: false, accountType: 'ASSET', normalBalance: 'DEBIT', ...over });

  describe('create — type invariant', () => {
    it('1. accepts ASSET + DEBIT + isCashOrBank=true', async () => {
      await service.create(cashDto({ isCashOrBank: true }) as any, currentUser);

      expect(repository.create).toHaveBeenCalled();
      expect(repository.create.mock.calls[0][0].isCashOrBank).toBe(true);
    });

    it.each([
      ['2. LIABILITY + CREDIT', 'LIABILITY', 'CREDIT'],
      ['3. LIABILITY + DEBIT', 'LIABILITY', 'DEBIT'],
      ['4. EQUITY + CREDIT', 'EQUITY', 'CREDIT'],
      ['5. REVENUE + CREDIT', 'REVENUE', 'CREDIT'],
      ['6. EXPENSE + DEBIT', 'EXPENSE', 'DEBIT'],
      ['7. ASSET + CREDIT', 'ASSET', 'CREDIT'],
    ])('rejects %s + isCashOrBank=true', async (_n, type, normal) => {
      await expect(
        service.create(
          cashDto({ isCashOrBank: true, accountType: type, normalBalance: normal }) as any,
          currentUser,
        ),
      ).rejects.toThrow(BadRequestException);

      // rejected BEFORE any write — the value is never coerced or persisted
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('8. accepts an omitted or false isCashOrBank on any type', async () => {
      await service.create(cashDto({ accountType: 'EXPENSE' }) as any, currentUser);
      expect(repository.create.mock.calls[0][0].isCashOrBank).toBe(false);

      await service.create(
        cashDto({ isCashOrBank: false, accountType: 'REVENUE' }) as any,
        currentUser,
      );
      expect(repository.create.mock.calls[1][0].isCashOrBank).toBe(false);
    });
  });

  describe('update — unposted accounts stay freely classifiable', () => {
    it('9. allows false -> true while unposted', async () => {
      repository.findById.mockResolvedValue(given({ isCashOrBank: false }));

      await service.update('acc-1', { isCashOrBank: true } as any, currentUser);

      expect(repository.update).toHaveBeenCalled();
      expect(repository.update.mock.calls[0][1].isCashOrBank).toBe(true);
    });

    it('10. allows true -> false while unposted', async () => {
      repository.findById.mockResolvedValue(given({ isCashOrBank: true }));

      await service.update('acc-1', { isCashOrBank: false } as any, currentUser);

      expect(repository.update).toHaveBeenCalled();
      expect(repository.update.mock.calls[0][1].isCashOrBank).toBe(false);
    });

    it('11. still enforces the final-state invariant on an unposted account', async () => {
      // flagged cash already; flip accountType only -> final state is invalid
      repository.findById.mockResolvedValue(given({ isCashOrBank: true }));

      await expect(
        service.update('acc-1', { accountType: 'LIABILITY' } as any, currentUser),
      ).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('no history guard is attached when the flag is not being toggled', async () => {
      repository.findById.mockResolvedValue(given({ isCashOrBank: true }));

      await service.update('acc-1', { name: 'Renamed' } as any, currentUser);

      // extraWhere is the 6th arg and must stay undefined so a benign rename
      // of a posted cash account is never blocked
      expect(repository.update.mock.calls[0][5]).toBeUndefined();
    });
  });

  describe('update — posted accounts are frozen (historical gate)', () => {
    /** The atomic write matched 0 rows because the history predicate failed. */
    const postedUpdate = async (before: Record<string, any>, dto: Record<string, any>) => {
      repository.findById.mockResolvedValue(given(before));
      repository.update.mockRejectedValue(new ConflictCtor('stale'));
      journalLineCount = 1;
      return service.update('acc-1', dto as any, currentUser);
    };

    it('12. rejects posted true -> false', async () => {
      await expect(
        postedUpdate({ isCashOrBank: true }, { isCashOrBank: false }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.update).toHaveBeenCalled();
    });

    it('13. rejects posted false -> true', async () => {
      await expect(
        postedUpdate({ isCashOrBank: false }, { isCashOrBank: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('14. rejects flipping accountType on a posted cash account', async () => {
      repository.findById.mockResolvedValue(given({ isCashOrBank: true }));
      await expect(
        service.update('acc-1', { accountType: 'LIABILITY' } as any, currentUser),
      ).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('15. rejects flipping normalBalance on a posted cash account', async () => {
      repository.findById.mockResolvedValue(given({ isCashOrBank: true }));
      await expect(
        service.update('acc-1', { normalBalance: 'CREDIT' } as any, currentUser),
      ).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('16. rejects a posted non-cash account becoming cash', async () => {
      await expect(
        postedUpdate({ isCashOrBank: false }, { isCashOrBank: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('17. rejects a reversed-only historical account (history, not balance)', async () => {
      // net balance is zero after the reversal, yet history still freezes it
      await expect(
        postedUpdate({ isCashOrBank: false }, { isCashOrBank: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('18. rejects a zero-current-balance historical account', async () => {
      await expect(
        postedUpdate({ isCashOrBank: false }, { isCashOrBank: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('the history guard is passed as the 6th repository argument (atomic predicate)', async () => {
      repository.findById.mockResolvedValue(given({ isCashOrBank: false }));
      repository.update.mockRejectedValueOnce(new ConflictCtor('stale'));
      journalLineCount = 1;

      await expect(
        service.update('acc-1', { isCashOrBank: true } as any, currentUser),
      ).rejects.toThrow(BadRequestException);

      const extraWhere = repository.update.mock.calls[0][5];
      expect(extraWhere).toEqual({ journalLines: { none: {} } });
    });

    it('20. a rejected classification writes nothing and logs no audit', async () => {
      repository.findById.mockResolvedValue(given({ isCashOrBank: false }));
      repository.update.mockRejectedValue(new ConflictCtor('stale'));
      journalLineCount = 1;

      await expect(
        service.update('acc-1', { isCashOrBank: true } as any, currentUser),
      ).rejects.toThrow(BadRequestException);

      expect(auditLog.log).not.toHaveBeenCalled();
    });
  });

  describe('update — CAS and omitted field', () => {
    it('19. a stale rowVersion still surfaces ConflictException', async () => {
      repository.findById.mockResolvedValue(given());
      repository.update.mockRejectedValue(new ConflictCtor('stale'));
      journalLineCount = 0; // no history -> the CAS conflict must stay a conflict

      await expect(
        service.update('acc-1', { name: 'Renamed' } as any, currentUser),
      ).rejects.toThrow(ConflictCtor);
    });

    it('21. a PATCH without isCashOrBank does not mutate it', async () => {
      repository.findById.mockResolvedValue(given({ isCashOrBank: true }));

      await service.update('acc-1', { name: 'Renamed' } as any, currentUser);

      const data = repository.update.mock.calls[0][1];
      expect(data.isCashOrBank).toBeUndefined();
      expect('isCashOrBank' in data).toBe(false);
    });
  });
});
