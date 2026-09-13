/**
 * G8: Multi-tenant document numbering hardening — integration tests.
 *
 * Verifies the tenant-scoped composite unique constraints on document numbers:
 *
 *   TEST 1 — two different companies may hold the SAME document number
 *            (the previous global @unique made the second insert a
 *            deterministic P2002 → HTTP 409 failure);
 *   TEST 2 — a duplicate number WITHIN one company is still rejected (P2002);
 *   TEST 4 — via pg_indexes: for all 8 G8 models a UNIQUE index on
 *            (companyId, documentNumber) exists and no single-column
 *            unique index on documentNumber remains.
 *
 * Runs against a real PostgreSQL database (same as the supplier-bin
 * integration tests). Excluded from unit runs via jest testPathIgnorePatterns
 * (.*\.integration\.spec\.ts$). Execution is BLOCKED when no local DB is
 * available — it must be run against staging/CI PostgreSQL.
 */

import { Prisma, PrismaClient } from '@prisma/client';

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://stockflow:stockflow@localhost:5432/stockflow';

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const TEST_PREFIX = 'E2E-G8-NUM-';
const PAYMENT_NUMBER = 'PAY-000001'; // same format as DocumentSequenceService

let companyA: string;
let companyB: string;

/**
 * Creates the minimal FK chain required by SupplierPayment:
 * Supplier → PurchaseOrder → PurchaseInvoice → SupplierPayment.
 *
 * Order numbers / invoice numbers are intentionally IDENTICAL across both
 * companies — this additionally exercises the G8 composite constraints for
 * PurchaseOrder and PurchaseInvoice in the same pass.
 */
async function createPaymentChain(companyId: string, index: number) {
  const supplier = await prisma.supplier.create({
    data: { companyId, companyName: `${TEST_PREFIX}Supplier-${index}` },
  });

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      companyId,
      supplierId: supplier.id,
      orderNumber: 'PO-G8-000001',
    },
  });

  const invoice = await prisma.purchaseInvoice.create({
    data: {
      companyId,
      purchaseOrderId: purchaseOrder.id,
      supplierId: supplier.id,
      invoiceNumber: 'INV-G8-000001',
      grandTotal: '10000',
      status: 'APPROVED',
    },
  });

  return { supplierId: supplier.id, purchaseInvoiceId: invoice.id };
}

async function createPayment(companyId: string, paymentNumber: string) {
  const supplier = await prisma.supplier.findFirstOrThrow({
    where: { companyId, companyName: { startsWith: TEST_PREFIX } },
  });
  const invoice = await prisma.purchaseInvoice.findFirstOrThrow({
    where: { companyId, invoiceNumber: 'INV-G8-000001' },
  });

  return prisma.supplierPayment.create({
    data: {
      companyId,
      supplierId: supplier.id,
      purchaseInvoiceId: invoice.id,
      paymentNumber,
      amount: '1000',
      method: 'CASH',
    },
  });
}

beforeAll(async () => {
  const compA = await prisma.company.create({
    data: {
      name: `${TEST_PREFIX}CompanyA`,
      bin: '900000000001',
      address: 'Test',
      phone: '+900000000001',
    },
  });
  companyA = compA.id;

  const compB = await prisma.company.create({
    data: {
      name: `${TEST_PREFIX}CompanyB`,
      bin: '900000000002',
      address: 'Test',
      phone: '+900000000002',
    },
  });
  companyB = compB.id;

  await createPaymentChain(companyA, 1);
  await createPaymentChain(companyB, 2);
});

afterAll(async () => {
  // Clean up test data in FK-safe order (company cascade covers the rest)
  await prisma.supplierPayment.deleteMany({
    where: { companyId: { in: [companyA, companyB] } },
  });
  await prisma.purchaseInvoice.deleteMany({
    where: { companyId: { in: [companyA, companyB] } },
  });
  await prisma.purchaseOrder.deleteMany({
    where: { companyId: { in: [companyA, companyB] } },
  });
  await prisma.supplier.deleteMany({
    where: { companyId: { in: [companyA, companyB] } },
  });
  await prisma.company.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  });
  await prisma.$disconnect();
});

describe('G8 tenant-scoped document numbering', () => {
  it('TEST 1: two companies can hold the SAME paymentNumber (PAY-000001)', async () => {
    const paymentA = await createPayment(companyA, PAYMENT_NUMBER);
    const paymentB = await createPayment(companyB, PAYMENT_NUMBER);

    expect(paymentA.paymentNumber).toBe(PAYMENT_NUMBER);
    expect(paymentB.paymentNumber).toBe(PAYMENT_NUMBER);
    expect(paymentA.companyId).not.toBe(paymentB.companyId);
  });

  it('TEST 2: same company cannot duplicate paymentNumber (P2002)', async () => {
    await expect(createPayment(companyA, PAYMENT_NUMBER)).rejects.toThrow(
      Prisma.PrismaClientKnownRequestError,
    );
  });

  it('TEST 4: composite unique (companyId, documentNumber) exists for all 8 G8 models; no global unique remains', async () => {
    const rows = await prisma.$queryRaw<
      { tablename: string; indexdef: string }[]
    >`
      SELECT tablename, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN (
          'SupplierPayment', 'PurchaseInvoice', 'PurchaseReturn', 'RFQ',
          'SupplierQuotation', 'PurchaseOrder', 'GoodsReceipt', 'PurchaseCreditNote'
        )
    `;

    const pairs: Array<[string, string]> = [
      ['SupplierPayment', 'paymentNumber'],
      ['PurchaseInvoice', 'invoiceNumber'],
      ['PurchaseReturn', 'returnNumber'],
      ['RFQ', 'rfqNumber'],
      ['SupplierQuotation', 'quotationNumber'],
      ['PurchaseOrder', 'orderNumber'],
      ['GoodsReceipt', 'receiptNumber'],
      ['PurchaseCreditNote', 'creditNoteNumber'],
    ];

    for (const [model, field] of pairs) {
      const tableRows = rows.filter((r) => r.tablename === model);

      // Composite unique must exist
      const hasComposite = tableRows.some(
        (r) =>
          r.indexdef.includes('UNIQUE INDEX') &&
          r.indexdef.includes(`("companyId", "${field}")`),
      );
      expect(hasComposite).toBe(true);

      // Global single-column unique must be gone
      const globalUniqueLeft = tableRows.some(
        (r) =>
          r.indexdef.includes('UNIQUE INDEX') &&
          r.indexdef.includes(`ON public."${model}" USING btree ("${field}")`),
      );
      expect(globalUniqueLeft).toBe(false);
    }
  });
});

