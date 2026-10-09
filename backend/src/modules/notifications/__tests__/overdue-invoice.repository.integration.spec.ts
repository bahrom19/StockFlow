/**
 * MUST be imported FIRST (before @prisma/client) so DATABASE_URL is snapshotted
 * before any Prisma side effect can run.
 */
import { hasIntegrationDatabase } from '../../../infrastructure/idempotency/__tests__/integration-env';

import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { OverdueInvoiceRepository } from '../repositories/overdue-invoice.repository';

/**
 * G16 P2-a — overdue purchase-invoice supplier projection (real PostgreSQL).
 *
 * ## The defect
 *
 * `OverdueInvoiceRepository.findOverdueInvoices` projected `s."name"` for the
 * supplier display name, but `model Supplier` exposes `companyName` and has
 * never had a `name` column (it was created that way in
 * `20260729014253_add_billing_tables` and no migration ever renamed it).
 * PostgreSQL therefore rejected the statement at parse time:
 *
 *   ERROR: column s.name does not exist   (SQLSTATE 42703)
 *
 * The query is the ONLY source of the `SUPPLIER_PAYMENT_OVERDUE` notification,
 * so this made the daily overdue scan silently non-functional.
 *
 * ## Why this suite is real-PostgreSQL only
 *
 * `$queryRaw` is mocked in `overdue-invoice.repository.spec.ts`, which asserts
 * on the SQL text and therefore cannot detect an undefined column. Only a live
 * PostgreSQL type/column resolver can. Every assertion here sends the statement
 * to a real database; nothing about the SQL is mocked.
 *
 * ## Fixture safety
 *
 * Fixtures are created inside a transaction that is ALWAYS rolled back via a
 * sentinel throw, so the integration database is left with zero residue. No
 * Supplier `deletedAt` / `isActive` predicates are exercised here — those belong
 * to the deferred F-1 workstream and are deliberately out of scope.
 */

const describeDb = hasIntegrationDatabase ? describe : describe.skip;

/** `backend/src` — this spec lives at `src/modules/notifications/__tests__/`. */
const SRC_ROOT = join(__dirname, '..', '..', '..');
/** `backend/` — holds `prisma/schema.prisma`. */
const BACKEND_ROOT = join(SRC_ROOT, '..');

const REPOSITORY_REL =
  'modules/notifications/repositories/overdue-invoice.repository.ts';

/** Prefix for every seeded fixture so residue can be asserted to be zero. */
const FIXTURE_PREFIX = 'G16-P2A-OVERDUE-';
const ROLLBACK_SENTINEL = 'ROLLBACK_G16_P2A';

const UNDEFINED_COLUMN = '42703';
const PRISMA_RAW_FAILED = 'P2010';

function pgCode(error: unknown): string | undefined {
  const meta = (error as { meta?: { code?: string } })?.meta;
  return meta?.code ?? (error as { code?: string })?.code;
}

function pgMessage(error: unknown): string {
  const meta = (error as { meta?: { message?: string } })?.meta;
  return String(meta?.message ?? (error as Error)?.message ?? '');
}

/** Server-local midnight, mirroring OverdueNotificationCronService.getScanStart(). */
function scanStart(): Date {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return startOfToday;
}

/** Whole days before `startOfToday` — a dueDate this far back is overdue. */
function daysBefore(start: Date, days: number): Date {
  return new Date(start.getTime() - days * 24 * 60 * 60 * 1000);
}

interface OverdueFixture {
  companyId: string;
  otherCompanyId: string;
  supplierCompanyName: string;
  matchingInvoiceNumbers: string[];
}

describeDb(
  'G16 P2-a — OverdueInvoiceRepository supplier projection (real PostgreSQL)',
  () => {
    let prisma: PrismaService;

    beforeAll(async () => {
      prisma = new PrismaService();
      await prisma.$connect();
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    /**
     * Runs `body` inside a transaction whose fixtures are always rolled back.
     * The sentinel throw is the rollback mechanism; the residue assertion
     * afterwards proves nothing was persisted.
     */
    const withRolledBackFixtures = async <T>(
      body: (tx: PrismaService, ctx: { start: Date }) => Promise<T>,
    ): Promise<T> => {
      const start = scanStart();
      let captured: T | undefined;
      await prisma
        .$transaction(async (tx) => {
          captured = await body(tx as unknown as PrismaService, { start });
          throw new Error(ROLLBACK_SENTINEL);
        })
        .catch((error: unknown) => {
          if (!pgMessage(error).includes(ROLLBACK_SENTINEL)) throw error;
        });
      return captured as T;
    };

    /** Minimal FK chain required by PurchaseInvoice: Supplier → PurchaseOrder → PurchaseInvoice. */
    const seedChain = async (
      tx: PrismaService,
      companyId: string,
      supplierId: string,
      orderNumber: string,
    ) => {
      const order = await tx.purchaseOrder.create({
        data: { companyId, supplierId, orderNumber },
      });
      return order;
    };

    it('T1/T2/T3/T4 — resolves against real PostgreSQL and returns the seeded supplierName', async () => {
      const result = await withRolledBackFixtures(async (tx, { start }) => {
        const supplierCompanyName = `${FIXTURE_PREFIX}Supplier-Alpha`;

        const company = await tx.company.create({
          data: { name: `${FIXTURE_PREFIX}Company`, status: 'ACTIVE' },
        });
        const supplier = await tx.supplier.create({
          data: { companyId: company.id, companyName: supplierCompanyName },
        });
        const order = await seedChain(
          tx,
          company.id,
          supplier.id,
          `${FIXTURE_PREFIX}PO-1`,
        );

        // Matching overdue invoice: APPROVED, grandTotal > 0, no allocations,
        // dueDate 3 days in the past, not soft-deleted.
        const invoice = await tx.purchaseInvoice.create({
          data: {
            companyId: company.id,
            supplierId: supplier.id,
            purchaseOrderId: order.id,
            invoiceNumber: `${FIXTURE_PREFIX}INV-OVERDUE`,
            status: 'APPROVED',
            grandTotal: '5000.0000',
            dueDate: daysBefore(start, 3),
          },
        });

        const repo = new OverdueInvoiceRepository(tx);
        const rows = await repo.findOverdueInvoices(company.id, start);

        return {
          companyId: company.id,
          otherCompanyId: company.id,
          supplierCompanyName,
          matchingInvoiceNumbers: [invoice.invoiceNumber],
          rows,
          start,
        };
      });

      // T1 — executed without 42703 / P2010 (a throw here fails the test).
      expect(result.rows.length).toBeGreaterThanOrEqual(1);

      // T2 — the seeded overdue invoice is actually returned.
      const row = result.rows.find(
        (r) => r.invoiceNumber === `${FIXTURE_PREFIX}INV-OVERDUE`,
      );
      expect(row).toBeDefined();

      // T3 — supplierName is exactly Supplier.companyName (NOT a similar column).
      expect(row!.supplierName).toBe(result.supplierCompanyName);

      // T4 — the alias is "supplierName", i.e. the OverdueInvoiceRow key exists.
      expect(Object.keys(row!)).toContain('supplierName');
      expect(typeof row!.supplierName).toBe('string');
      expect(row!.supplierName.length).toBeGreaterThan(0);

      // Ordering contract also holds on the returned row.
      expect(row!.daysOverdue).toBeGreaterThanOrEqual(1);
    }, 60000);

    it('T5 — a foreign companyId returns zero rows (tenant predicate intact)', async () => {
      await withRolledBackFixtures(async (tx, { start }) => {
        const companyA = await tx.company.create({
          data: { name: `${FIXTURE_PREFIX}Tenant-A`, status: 'ACTIVE' },
        });
        const companyB = await tx.company.create({
          data: { name: `${FIXTURE_PREFIX}Tenant-B`, status: 'ACTIVE' },
        });
        const supplierA = await tx.supplier.create({
          data: {
            companyId: companyA.id,
            companyName: `${FIXTURE_PREFIX}Supplier-A`,
          },
        });
        const orderA = await seedChain(
          tx,
          companyA.id,
          supplierA.id,
          `${FIXTURE_PREFIX}PO-A`,
        );
        await tx.purchaseInvoice.create({
          data: {
            companyId: companyA.id,
            supplierId: supplierA.id,
            purchaseOrderId: orderA.id,
            invoiceNumber: `${FIXTURE_PREFIX}INV-A`,
            status: 'APPROVED',
            grandTotal: '5000.0000',
            dueDate: daysBefore(start, 3),
          },
        });

        const repo = new OverdueInvoiceRepository(tx);

        // Owner sees its own overdue invoice.
        const ownRows = await repo.findOverdueInvoices(companyA.id, start);
        expect(ownRows.length).toBeGreaterThanOrEqual(1);
        expect(ownRows[0]!.supplierName).toBe(`${FIXTURE_PREFIX}Supplier-A`);

        // A different tenant must see nothing — no cross-tenant leakage.
        const foreignRows = await repo.findOverdueInvoices(companyB.id, start);
        expect(foreignRows).toEqual([]);
      });
    }, 60000);

    it('T6 — invoice filters remain intact', async () => {
      await withRolledBackFixtures(async (tx, { start }) => {
        const company = await tx.company.create({
          data: { name: `${FIXTURE_PREFIX}Filters`, status: 'ACTIVE' },
        });
        const supplier = await tx.supplier.create({
          data: {
            companyId: company.id,
            companyName: `${FIXTURE_PREFIX}Supplier-F`,
          },
        });

        const makeInvoice = async (
          suffix: string,
          extra: Record<string, unknown> = {},
        ) => {
          const order = await seedChain(
            tx,
            company.id,
            supplier.id,
            `${FIXTURE_PREFIX}PO-${suffix}`,
          );
          return tx.purchaseInvoice.create({
            data: {
              companyId: company.id,
              supplierId: supplier.id,
              purchaseOrderId: order.id,
              invoiceNumber: `${FIXTURE_PREFIX}INV-${suffix}`,
              status: 'APPROVED',
              grandTotal: '1000.0000',
              dueDate: daysBefore(start, 5),
              ...extra,
            } as never,
          });
        };

        const kept = await makeInvoice('KEPT');
        await makeInvoice('SOFT-DELETED', { deletedAt: new Date() });
        await makeInvoice('NOT-OVERDUE', { dueDate: daysBefore(start, 0) });
        await makeInvoice('FUTURE', {
          dueDate: new Date(start.getTime() + 5 * 86400000),
        });
        await makeInvoice('ZERO-TOTAL', { grandTotal: '0.0000' });
        await makeInvoice('DRAFT-STATUS', { status: 'DRAFT' });
        // G9-B1: coverage is SUM(SupplierPaymentAllocation.amount), NOT the legacy
        // PurchaseInvoice.paidAmount cache. With no allocation rows this invoice is
        // still outstanding even though paidAmount equals grandTotal.
        await makeInvoice('PAID-AMOUNT-ONLY', {
          grandTotal: '1000.0000',
          paidAmount: '1000.0000',
        });

        const repo = new OverdueInvoiceRepository(tx);
        const rows = await repo.findOverdueInvoices(company.id, start);
        const numbers = rows.map((r) => r.invoiceNumber);

        expect(numbers).toContain(kept.invoiceNumber);
        expect(numbers).toContain(`${FIXTURE_PREFIX}INV-PAID-AMOUNT-ONLY`);
        expect(numbers).not.toContain(`${FIXTURE_PREFIX}INV-SOFT-DELETED`);
        expect(numbers).not.toContain(`${FIXTURE_PREFIX}INV-NOT-OVERDUE`);
        expect(numbers).not.toContain(`${FIXTURE_PREFIX}INV-FUTURE`);
        expect(numbers).not.toContain(`${FIXTURE_PREFIX}INV-ZERO-TOTAL`);
        expect(numbers).not.toContain(`${FIXTURE_PREFIX}INV-DRAFT-STATUS`);
      });
    }, 60000);

    it('T7 — results are ordered ascending by dueDate', async () => {
      await withRolledBackFixtures(async (tx, { start }) => {
        const company = await tx.company.create({
          data: { name: `${FIXTURE_PREFIX}Ordering`, status: 'ACTIVE' },
        });
        const supplier = await tx.supplier.create({
          data: {
            companyId: company.id,
            companyName: `${FIXTURE_PREFIX}Supplier-O`,
          },
        });

        // Seed deliberately out of order: 9, 2, 5, 1 days overdue.
        for (const days of [9, 2, 5, 1]) {
          const order = await seedChain(
            tx,
            company.id,
            supplier.id,
            `${FIXTURE_PREFIX}PO-ORD-${days}`,
          );
          await tx.purchaseInvoice.create({
            data: {
              companyId: company.id,
              supplierId: supplier.id,
              purchaseOrderId: order.id,
              invoiceNumber: `${FIXTURE_PREFIX}INV-ORD-${days}`,
              status: 'APPROVED',
              grandTotal: '1000.0000',
              dueDate: daysBefore(start, days),
            },
          });
        }

        const repo = new OverdueInvoiceRepository(tx);
        const rows = await repo.findOverdueInvoices(company.id, start);
        expect(rows.length).toBeGreaterThanOrEqual(4);

        // Most overdue first ⇒ oldest dueDate first ⇒ dueDate is non-decreasing.
        const dueDates = rows.map((r) => new Date(r.dueDate).getTime());
        for (let i = 1; i < dueDates.length; i++) {
          expect(dueDates[i]!).toBeGreaterThanOrEqual(dueDates[i - 1]!);
        }
        // Most overdue invoice comes first.
        expect(rows[0]!.invoiceNumber).toBe(`${FIXTURE_PREFIX}INV-ORD-9`);
        expect(rows[0]!.daysOverdue).toBe(9);
      });
    }, 60000);

    describe('non-vacuity and supplementary guards', () => {
      it('a s."name" projection still fails with 42703 — the old code cannot pass T1-T7', async () => {
        // Proves the suite can discriminate: the exact statement shipped before
        // G16 P2-a must still be rejected by PostgreSQL.
        await expect(
          prisma.$queryRaw`
          SELECT pi."id" AS "invoiceId", s."name" AS "supplierName"
          FROM "PurchaseInvoice" pi
          JOIN "Supplier" s ON s."id" = pi."supplierId"
          WHERE pi."companyId" = ${'00000000-0000-0000-0000-0000000000ff'}::uuid
        `,
        ).rejects.toMatchObject({ meta: { code: UNDEFINED_COLUMN } });
      });

      it('regression guards: no 42703 / P2010 is raised by the repository', async () => {
        const repo = new OverdueInvoiceRepository(prisma);
        let code: string | undefined;
        let message = '';
        try {
          await repo.findOverdueInvoices(
            '00000000-0000-0000-0000-0000000000ff',
            scanStart(),
          );
        } catch (error) {
          code = pgCode(error);
          message = pgMessage(error);
        }
        expect({ code, message: message.slice(0, 160) }).toEqual({
          code: expect.not.stringMatching(
            new RegExp(`^(${UNDEFINED_COLUMN}|${PRISMA_RAW_FAILED})$`),
          ),
          message: expect.any(String),
        });
      });

      it('supplementary source guard: SQL projects s."companyName" AS "supplierName"', () => {
        // Supplementary only — T1-T4 execute the real statement against PostgreSQL.
        const source = readFileSync(join(SRC_ROOT, REPOSITORY_REL), 'utf-8');
        expect(source).toContain('s."companyName" AS "supplierName"');
        // The tenant predicate and ordering must remain untouched.
        expect(source).toContain('WHERE pi."companyId" = ${companyId}::uuid');
        expect(source).toContain('ORDER BY pi."dueDate" ASC');
        // F-1 is explicitly deferred: no Supplier soft-delete/isActive predicate.
        expect(source).not.toContain('s."deletedAt"');
        expect(source).not.toContain('s."isActive"');
      });

      it('schema is untouched — Supplier still declares companyName and no "name"', () => {
        const schema = readFileSync(
          join(BACKEND_ROOT, 'prisma', 'schema.prisma'),
          'utf-8',
        );
        const model = schema.slice(schema.indexOf('model Supplier {'));
        const body = model.slice(0, model.indexOf('\n}'));
        expect(body).toMatch(/companyName\s+String\s+@db\.VarChar\(255\)/);
        expect(body).not.toMatch(/^\s+name\s+String/m);
      });
    });

    describe('fixture residue', () => {
      it('the integration database has zero residue from this spec', async () => {
        const companies = await prisma.company.count({
          where: { name: { startsWith: FIXTURE_PREFIX } },
        });
        const suppliers = await prisma.supplier.count({
          where: { companyName: { startsWith: FIXTURE_PREFIX } },
        });
        const orders = await prisma.purchaseOrder.count({
          where: { orderNumber: { startsWith: FIXTURE_PREFIX } },
        });
        const invoices = await prisma.purchaseInvoice.count({
          where: { invoiceNumber: { startsWith: FIXTURE_PREFIX } },
        });

        expect({ companies, suppliers, orders, invoices }).toEqual({
          companies: 0,
          suppliers: 0,
          orders: 0,
          invoices: 0,
        });
      });
    });
  },
);

if (!hasIntegrationDatabase) {
  console.warn(
    '[g16-p2a-overdue-invoice.integration] DATABASE_URL not set — real-PostgreSQL suite skipped.',
  );
}
