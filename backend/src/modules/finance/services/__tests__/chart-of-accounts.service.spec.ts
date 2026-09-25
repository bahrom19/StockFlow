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
