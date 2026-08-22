import { ProductsRepository } from '../repositories/products.repository';
import { PrismaService } from '../../../common/prisma';

/**
 * Verifies the list/search WHERE clause: searching by free-text must match
 * name, SKU, barcode AND ntin; an explicit ntin filter must also work.
 */
describe('ProductsRepository — search by identifiers', () => {
  let repository: ProductsRepository;
  const findMany = jest.fn().mockResolvedValue([]);
  const count = jest.fn().mockResolvedValue(0);

  beforeEach(() => {
    jest.clearAllMocks();
    const prismaService = {
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
      get product() {
        return { findMany, count };
      },
    };
    repository = new ProductsRepository(prismaService as unknown as PrismaService);
  });

  it('free-text search matches name, sku, barcode AND ntin', async () => {
    await repository.findAll({
      companyId: 'comp-1',
      search: '123456789',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          companyId: 'comp-1',
          OR: [
            { name: { contains: '123456789', mode: 'insensitive' } },
            { sku: { contains: '123456789', mode: 'insensitive' } },
            { barcode: { contains: '123456789', mode: 'insensitive' } },
            { ntin: { contains: '123456789', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });

  it('explicit ntin filter is applied to the where clause', async () => {
    await repository.findAll({ companyId: 'comp-1', ntin: '123456789' });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ntin: { contains: '123456789', mode: 'insensitive' },
        }),
      }),
    );
  });
});
