import { Prisma } from '@prisma/client';

/**
 * G12-R1 — repository-level tenant-scoping contract tests.
 *
 * These tests exercise the REAL repository classes with a mocked PrismaService
 * and assert the actual `where` clause that reaches Prisma. This closes the
 * mock-fidelity gap where service specs asserted `companyId` in mocked
 * repository arguments while production repositories silently ignored it.
 */
describe('G12-R1 — CRM repository tenant scoping (Prisma where contract)', () => {
  const companyId = 'comp-1';

  function mockPrismaService(model: string): Record<string, any> {
    return {
      [model]: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      customer: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cust-1' }),
      },
    };
  }

  async function loadRepo(
    repoPath: string,
    repoClass: string,
    model: string,
  ): Promise<{ repo: any; prisma: Record<string, any> }> {
    jest.resetModules();
    const { [repoClass]: RepoClass } = await import(repoPath);
    const prisma = mockPrismaService(model);
    return { repo: new RepoClass(prisma as any), prisma };
  }

  type RepoCase = {
    name: string;
    repoPath: string;
    repoClass: string;
    model: string;
    /** The exact tenant where-clause the repository must produce. */
    expectedTenantWhere: Record<string, unknown>;
  };

  const cases: RepoCase[] = [
    {
      name: 'CustomerAddressRepository',
      repoPath: '../repositories/customer-address.repository',
      repoClass: 'CustomerAddressRepository',
      model: 'customerAddress',
      expectedTenantWhere: { customer: { companyId }, deletedAt: null },
    },
    {
      name: 'ContactRepository',
      repoPath: '../repositories/contact.repository',
      repoClass: 'ContactRepository',
      model: 'customerContact',
      expectedTenantWhere: { customer: { companyId }, deletedAt: null },
    },
    {
      name: 'CustomerNoteRepository',
      repoPath: '../repositories/customer-note.repository',
      repoClass: 'CustomerNoteRepository',
      model: 'customerNote',
      expectedTenantWhere: { customer: { companyId }, deletedAt: null },
    },
    {
      // CreditLimit has no own deletedAt (soft-delete via isActive);
      // the customer's deletedAt filter lives inside the customer predicate.
      name: 'CreditLimitRepository',
      repoPath: '../repositories/credit-limit.repository',
      repoClass: 'CreditLimitRepository',
      model: 'creditLimit',
      expectedTenantWhere: { customer: { companyId, deletedAt: null } },
    },
    {
      name: 'PriceListRepository',
      repoPath: '../repositories/price-list.repository',
      repoClass: 'PriceListRepository',
      model: 'priceList',
      expectedTenantWhere: { customer: { companyId }, deletedAt: null },
    },
  ];

  describe.each(cases)('$name', ({ repoPath, repoClass, model, expectedTenantWhere }) => {
    it('findMany scopes list by customer.companyId', async () => {
      const { repo, prisma } = await loadRepo(repoPath, repoClass, model);

      await repo.findMany({ companyId, skip: 0, take: 20 });

      expect(prisma[model].findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedTenantWhere }),
      );
      expect(prisma[model].count).toHaveBeenCalledWith(
        expect.objectContaining({ where: expectedTenantWhere }),
      );
    });

    it('findMany preserves caller filters and merges tenant predicate BEFORE pagination', async () => {
      const { repo, prisma } = await loadRepo(repoPath, repoClass, model);
      const callerWhere: Record<string, unknown> = {
        customerId: 'cust-9',
      };

      await repo.findMany({
        companyId,
        skip: 40,
        take: 20,
        where: callerWhere as Prisma.CustomerAddressWhereInput,
        orderBy: { createdAt: 'asc' },
      });

      const where = prisma[model].findMany.mock.calls[0][0].where;
      // Caller filters preserved, tenant predicate merged, nothing dropped.
      expect(where).toEqual({
        ...callerWhere,
        ...expectedTenantWhere,
      });
      // Pagination must not dilute the tenant predicate.
      expect(prisma[model].findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 40, take: 20 }),
      );
    });

    it('findCustomerCompany checks customer.id + companyId + deletedAt', async () => {
      const { repo, prisma } = await loadRepo(repoPath, repoClass, model);

      await repo.findCustomerCompany('cust-1', companyId);

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'cust-1', companyId, deletedAt: null },
        select: { id: true },
      });
    });
  });

  describe('CreditLimitRepository.findByCustomerId', () => {
    it('scopes by customerId + customer.companyId', async () => {
      const { repo, prisma } = await loadRepo(
        '../repositories/credit-limit.repository',
        'CreditLimitRepository',
        'creditLimit',
      );

      await repo.findByCustomerId('cust-1', companyId);

      expect(prisma.creditLimit.findFirst).toHaveBeenCalledWith({
        where: { customerId: 'cust-1', customer: { companyId } },
      });
    });
  });

  describe('LoyaltyRepository.findByCustomerId', () => {
    it('scopes by customerId + customer.companyId', async () => {
      const { repo, prisma } = await loadRepo(
        '../repositories/loyalty.repository',
        'LoyaltyRepository',
        'loyaltyAccount',
      );

      await repo.findByCustomerId('cust-1', companyId);

      expect(prisma.loyaltyAccount.findFirst).toHaveBeenCalledWith({
        where: { customerId: 'cust-1', customer: { companyId } },
      });
    });

    it('findCustomerCompany checks customer.id + companyId + deletedAt', async () => {
      const { repo, prisma } = await loadRepo(
        '../repositories/loyalty.repository',
        'LoyaltyRepository',
        'loyaltyAccount',
      );

      await repo.findCustomerCompany('cust-1', companyId);

      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { id: 'cust-1', companyId, deletedAt: null },
        select: { id: true },
      });
    });
  });
});
