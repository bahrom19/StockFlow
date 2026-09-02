import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

/**
 * Regression — product EDIT must actually persist changed fields.
 *
 * The mobile client PATCHes a diff payload; these tests pin the repository
 * contract so a change can never be silently dropped between
 * ProductsService.update() and Prisma:
 *  - every changed field (name/sku/barcode/ntin) reaches the Prisma update;
 *  - clearing NTIN sends an explicit null (stores NULL, not '' / no-op);
 *  - price strings are converted to Prisma Decimal;
 *  - an optimistic-lock miss (rowVersion conflict) raises 409 instead of a
 *    fake success, and a missing row raises 404.
 */
describe('ProductsRepository — update persists changed fields', () => {
  const findFirst = jest.fn();
  const findUnique = jest.fn();
  const update = jest.fn();
  const updateMany = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const buildRepo = () =>
    new ProductsRepository({
      get product() {
        return { findFirst, findUnique, update, updateMany };
      },
    } as unknown as PrismaService);

  it('Scenario A: renamed name reaches prisma.product.update (legacy path)', async () => {
    findFirst.mockResolvedValue({ id: 'prod-1' });
    update.mockResolvedValue({ id: 'prod-1' });

    await buildRepo().update(
      'prod-1',
      { name: 'Молоко 1 л' } as Prisma.ProductUpdateInput,
      'comp-1',
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-1' },
        data: expect.objectContaining({ name: 'Молоко 1 л' }),
      }),
    );
  });

  it('Scenarios B+D: name/sku/barcode/ntin all land in updateMany.data', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue({ id: 'prod-1', rowVersion: 4 });

    const result = await buildRepo().update(
      'prod-1',
      {
        name: 'Молоко 1 л',
        sku: 'SKU-200',
        barcode: '4870000000000',
        ntin: '789012',
      } as Prisma.ProductUpdateInput,
      'comp-1',
      3,
    );

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'prod-1', companyId: 'comp-1', rowVersion: 3 },
        data: expect.objectContaining({
          name: 'Молоко 1 л',
          sku: 'SKU-200',
          barcode: '4870000000000',
          ntin: '789012',
          rowVersion: { increment: 1 },
        }),
      }),
    );
    // The freshly read updated row is returned to the client.
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'prod-1' } }),
    );
    expect(result).toEqual({ id: 'prod-1', rowVersion: 4 });
  });

  it('Scenario C: clearing NTIN stores an explicit NULL via updateMany', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue({ id: 'prod-1', ntin: null });

    await buildRepo().update(
      'prod-1',
      { ntin: null } as unknown as Prisma.ProductUpdateInput,
      'comp-1',
      5,
    );

    const { data } = updateMany.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(data).toHaveProperty('ntin', null);
    expect(data.ntin).toBeNull(); // not '' and not omitted
  });

  it('price string is converted to Prisma Decimal before persisting', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findUnique.mockResolvedValue({ id: 'prod-1' });

    await buildRepo().update(
      'prod-1',
      { price: '149.90' } as Prisma.ProductUpdateInput,
      'comp-1',
      2,
    );

    const { data } = updateMany.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(String(data.price)).toBe('149.9');
  });

  it('rowVersion conflict → ConflictException (no silent success)', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    // Repository re-checks existence before deciding 409 vs 404.
    findFirst.mockResolvedValue({ id: 'prod-1', rowVersion: 999 });

    await expect(
      buildRepo().update(
        'prod-1',
        { name: 'X' } as Prisma.ProductUpdateInput,
        'comp-1',
        3,
      ),
    ).rejects.toThrow(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it('rowVersion conflict on deleted row → NotFoundException', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findFirst.mockResolvedValue(null);

    await expect(
      buildRepo().update(
        'prod-1',
        { name: 'X' } as Prisma.ProductUpdateInput,
        'comp-1',
        3,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

// ── Duplicate check methods ──────────────────────────────────────────────────

describe('ProductsRepository — findActiveBySkuAndCompany', () => {
  let repository: ProductsRepository;
  const findFirst = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ProductsRepository({
      product: { findFirst },
    } as unknown as PrismaService);
  });

  it('queries with correct WHERE clause excluding deleted products', async () => {
    findFirst.mockResolvedValue(null);

    await repository.findActiveBySkuAndCompany('SKU-001', 'comp-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        sku: 'SKU-001',
        companyId: 'comp-1',
        deletedAt: null,
      },
      select: { id: true, name: true },
    });
  });

  it('excludes a specific product ID when provided (self-update)', async () => {
    findFirst.mockResolvedValue(null);

    await repository.findActiveBySkuAndCompany('SKU-001', 'comp-1', 'prod-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        sku: 'SKU-001',
        companyId: 'comp-1',
        deletedAt: null,
        id: { not: 'prod-1' },
      },
      select: { id: true, name: true },
    });
  });

  it('returns conflicting product when found', async () => {
    findFirst.mockResolvedValue({ id: 'other', name: 'Other' });

    const result = await repository.findActiveBySkuAndCompany('SKU-001', 'comp-1');

    expect(result).toEqual({ id: 'other', name: 'Other' });
  });
});

describe('ProductsRepository — findActiveByBarcodeAndCompany', () => {
  let repository: ProductsRepository;
  const findFirst = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ProductsRepository({
      product: { findFirst },
    } as unknown as PrismaService);
  });

  it('queries with correct WHERE clause excluding deleted products', async () => {
    findFirst.mockResolvedValue(null);

    await repository.findActiveByBarcodeAndCompany('12345', 'comp-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        barcode: '12345',
        companyId: 'comp-1',
        deletedAt: null,
      },
      select: { id: true, name: true },
    });
  });

  it('excludes a specific product ID when provided', async () => {
    findFirst.mockResolvedValue(null);

    await repository.findActiveByBarcodeAndCompany('12345', 'comp-1', 'prod-1');

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        barcode: '12345',
        companyId: 'comp-1',
        deletedAt: null,
        id: { not: 'prod-1' },
      },
      select: { id: true, name: true },
    });
  });
});
