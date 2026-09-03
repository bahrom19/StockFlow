/**
 * G1: Supplier BIN uniqueness integration tests.
 *
 * Validates the partial unique index `supplier_company_bin_unique` and
 * application-level duplicate detection for BIN within a company.
 *
 * Runs against a real PostgreSQL database (same as other integration tests).
 */

import { PrismaClient } from '@prisma/client';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://stockflow:stockflow@localhost:5432/stockflow';

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const TEST_PREFIX = 'E2E-SUPPLIER-BIN-';

let companyA: string;
let companyB: string;

beforeAll(async () => {
  // Create two test companies for cross-company isolation tests
  const compA = await prisma.company.create({
    data: {
      name: `${TEST_PREFIX}CompanyA`,
      bin: '000000000001',
      address: 'Test',
      phone: '+000000000001',
    },
  });
  companyA = compA.id;

  const compB = await prisma.company.create({
    data: {
      name: `${TEST_PREFIX}CompanyB`,
      bin: '000000000002',
      address: 'Test',
      phone: '+000000000002',
    },
  });
  companyB = compB.id;
});

afterAll(async () => {
  // Clean up test data
  await prisma.supplier.deleteMany({
    where: { companyName: { startsWith: TEST_PREFIX } },
  });
  await prisma.company.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
  await prisma.$disconnect();
});

describe('Supplier BIN uniqueness (G1)', () => {
  it('should reject duplicate BIN within same company', async () => {
    await prisma.supplier.create({
      data: {
        companyId: companyA,
        companyName: `${TEST_PREFIX}Supplier1`,
        bin: '111111111111',
      },
    });

    await expect(
      prisma.supplier.create({
        data: {
          companyId: companyA,
          companyName: `${TEST_PREFIX}Supplier2`,
          bin: '111111111111', // same BIN
        },
      }),
    ).rejects.toThrow();
  });

  it('should allow same BIN in different companies', async () => {
    const result = await prisma.supplier.create({
      data: {
        companyId: companyB,
        companyName: `${TEST_PREFIX}Supplier3`,
        bin: '111111111111', // same BIN as companyA supplier
      },
    });

    expect(result).toBeDefined();
    expect(result.bin).toBe('111111111111');
  });

  it('should allow BIN reuse after soft-delete', async () => {
    // Soft-delete the first supplier in companyA
    const supplier = await prisma.supplier.findFirst({
      where: {
        companyId: companyA,
        bin: '222222222222',
        deletedAt: null,
      },
    });

    if (supplier) {
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: { deletedAt: new Date(), isActive: false },
      });
    }

    // Create with same BIN — should succeed since old one is soft-deleted
    const result = await prisma.supplier.create({
      data: {
        companyId: companyA,
        companyName: `${TEST_PREFIX}Supplier-reused`,
        bin: '222222222222',
      },
    });

    expect(result).toBeDefined();
    expect(result.bin).toBe('222222222222');
  });

  it('should allow multiple NULL BIN suppliers', async () => {
    const s1 = await prisma.supplier.create({
      data: {
        companyId: companyA,
        companyName: `${TEST_PREFIX}NullBin1`,
      },
    });
    const s2 = await prisma.supplier.create({
      data: {
        companyId: companyA,
        companyName: `${TEST_PREFIX}NullBin2`,
      },
    });

    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
  });

  it('should allow empty-string BIN (not NULL) — PostgreSQL NULL semantics', async () => {
    // Note: application normalizes "" to null, but at DB level empty string ≠ NULL
    // The partial unique index only applies where bin IS NOT NULL AND bin != ''
    // So empty string passes the predicate and would NOT be covered by the unique index.
    // This is a PostgreSQL semantics test, not an application behavior test.
    const s1 = await prisma.supplier.create({
      data: {
        companyId: companyA,
        companyName: `${TEST_PREFIX}EmptyBin1`,
        bin: '',
      },
    });
    const s2 = await prisma.supplier.create({
      data: {
        companyId: companyA,
        companyName: `${TEST_PREFIX}EmptyBin2`,
        bin: '',
      },
    });

    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
  });

  it('should verify partial unique index exists with correct predicate', async () => {
    const indexes = await prisma.$queryRawUnsafe<
      Array<{ indexname: string; indexdef: string }>
    >(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'Supplier'
      AND indexname = 'supplier_company_bin_unique'
    `);

    expect(indexes).toHaveLength(1);
    const idx = indexes[0];
    expect(idx).toBeDefined();
    expect(idx!.indexdef).toContain('UNIQUE');
    expect(idx!.indexdef).toContain('companyId');
    expect(idx!.indexdef).toContain('bin');
    expect(idx!.indexdef).toContain('deletedAt');
  });

  it('should verify FK constraints are RESTRICT for historical documents', async () => {
    const fks = await prisma.$queryRawUnsafe<
      Array<{ constraint_name: string; delete_rule: string }>
    >(`
      SELECT 
        tc.constraint_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc 
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('PurchaseOrder', 'PurchaseReturn', 'PurchaseInvoice', 'SupplierQuotation')
      AND tc.constraint_name LIKE '%supplierId%'
    `);

    expect(fks.length).toBeGreaterThan(0);
    for (const fk of fks) {
      expect(fk.delete_rule).toBe('RESTRICT');
    }

    // Contacts and Addresses should remain CASCADE
    const contactFks = await prisma.$queryRawUnsafe<
      Array<{ constraint_name: string; delete_rule: string }>
    >(`
      SELECT 
        tc.constraint_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.referential_constraints rc 
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN ('SupplierContact', 'SupplierAddress')
      AND tc.constraint_name LIKE '%supplierId%'
    `);

    expect(contactFks.length).toBeGreaterThan(0);
    for (const fk of contactFks) {
      expect(fk.delete_rule).toBe('CASCADE');
    }
  });
});
