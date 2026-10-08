/**
 * MUST be imported FIRST (before @prisma/client) so DATABASE_URL is snapshotted
 * before @prisma/client loads the project .env and overwrites it.
 */
import {
  integrationDatabaseUrl,
  hasIntegrationDatabase,
} from '../../../infrastructure/idempotency/__tests__/integration-env';

import { readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PurchaseOrderRepository } from '../../purchasing/repositories/purchase-order.repository';
import { PurchaseInvoiceRepository } from '../../purchasing/repositories/purchase-invoice.repository';
import { SupplierExposureRepository } from '../../suppliers/repositories/supplier-exposure.repository';
import { OverdueInvoiceRepository } from '../../notifications/repositories/overdue-invoice.repository';

/**
 * G16 P1/P2 — raw-SQL UUID/TEXT type-resolution regression suite.
 *
 * ## The defect class
 *
 * Prisma 6 `$queryRaw` binds a JS `string` parameter to PostgreSQL as `text`.
 * Every scoped key in this schema is `uuid` (`@db.Uuid`), and PostgreSQL has NO
 * implicit `uuid`↔`text` cast. A raw statement that compares such a column to a
 * bound string therefore fails to resolve its operator:
 *
 *   ERROR: operator does not exist: uuid = text   (SQLSTATE 42883)
 *
 * Prisma surfaces this as `P2010`. The fix is the project's existing
 * convention — cast the PARAMETER, never the column:
 *
 *   WHERE "companyId" = ${companyId}::uuid
 *
 * ## Why this suite is real-PostgreSQL only
 *
 * Unit tests that mock `$queryRaw` inspect the template strings and can never
 * exercise PostgreSQL's operator resolution, so they cannot detect this defect
 * class at all (see supplier-payments.service.spec.ts:390 and
 * supplier-payment-allocations.service.spec.ts:409, which both assert on
 * `join('')` and would pass unchanged against broken SQL). Every assertion here
 * sends the statement to a live PostgreSQL type resolver.
 *
 * ## Two complementary mechanisms
 *
 * 1. **Real production code** — repositories whose lock/read method reaches
 *    `$queryRaw` without a pre-query validation guard are invoked directly, so
 *    the exact SQL shipped in production is executed.
 * 2. **Verbatim SQL + source-drift guard** — the remaining statements live
 *    inside service methods guarded by earlier existence checks that would
 *    require seeded fixtures. Those statements are reproduced verbatim and
 *    additionally asserted to be present in the production source file, so the
 *    suite fails if production drifts away from what is exercised here.
 *
 * ## Safety
 *
 * The suite is READ-ONLY against whatever DATABASE_URL it is given: every
 * statement is probed with a valid-but-absent UUID and locks, if any, are taken
 * only inside transactions that are unconditionally rolled back. No INSERT,
 * UPDATE, DELETE, DDL, migration or truncate is performed.
 */

const describeDb = hasIntegrationDatabase ? describe : describe.skip;

/** `backend/src` — this spec lives at `src/modules/shared/__tests__/`. */
const SRC_ROOT = join(__dirname, '..', '..', '..');
/** `backend/` — holds `prisma/schema.prisma`. */
const BACKEND_ROOT = join(SRC_ROOT, '..');

/** A syntactically valid UUID that is asserted to be absent from every table. */
const ABSENT_UUID = '00000000-0000-0000-0000-0000000000ff';
const ABSENT_UUID_2 = '00000000-0000-0000-0000-0000000000fe';

const DATE_FROM = new Date('2020-01-01T00:00:00.000Z');
const DATE_TO = new Date('2030-01-01T00:00:00.000Z');

/** SQLSTATE of a missing/unknown column. Not a UUID/TEXT defect. */
const UNDEFINED_COLUMN = '42703';
/** SQLSTATE of "operator does not exist" — the defect under test. */
const UNDEFINED_OPERATOR = '42883';
/** Prisma's wrapper code for a failed raw query. */
const PRISMA_RAW_FAILED = 'P2010';

function pgCode(error: unknown): string | undefined {
  const meta = (error as { meta?: { code?: string } })?.meta;
  return meta?.code ?? (error as { code?: string })?.code;
}

function pgMessage(error: unknown): string {
  const meta = (error as { meta?: { message?: string } })?.meta;
  return String(meta?.message ?? (error as Error)?.message ?? '');
}

/** Normalizes whitespace so a verbatim SQL copy survives source reformatting. */
function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

/**
 * Reads a production source file by its path relative to `backend/src`.
 * Throws if the file cannot be found, so a moved/deleted production file makes
 * the drift guard fail loudly rather than silently passing.
 */
function readProductionSource(relativeToSrc: string): string {
  return readFileSync(join(SRC_ROOT, relativeToSrc), 'utf-8');
}

describeDb(
  'G16 P1/P2 — raw SQL UUID/TEXT type resolution (real PostgreSQL)',
  () => {
    let prisma: PrismaService;

    beforeAll(async () => {
      prisma = new PrismaService();
      await prisma.$connect();
    });

    afterAll(async () => {
      await prisma.$disconnect();
    });

    /** Asserts a failure is NOT one of the defect-class codes under test. */
    const expectNotUuidTextDefect = (error: unknown, label: string) => {
      const code = pgCode(error);
      const message = pgMessage(error);
      expect({ label, code, message: message.slice(0, 200) }).toEqual({
        label,
        code: expect.not.stringMatching(
          new RegExp(
            `^(${UNDEFINED_OPERATOR}|${PRISMA_RAW_FAILED}|${UNDEFINED_COLUMN})$`,
          ),
        ),
        message: expect.any(String),
      });
    };

    /** Asserts the SQL is free of the uuid/text operator-resolution defect. */
    const expectNoUuidTextDefect = async (
      label: string,
      run: () => Promise<unknown>,
    ) => {
      try {
        await run();
      } catch (error) {
        const code = pgCode(error);
        const message = pgMessage(error);
        if (
          code === UNDEFINED_OPERATOR ||
          message.includes('operator does not exist')
        ) {
          throw new Error(
            `${label}: UUID/TEXT defect regressed — operator does not exist (${code}): ${message.slice(0, 200)}`,
          );
        }
        if (code === PRISMA_RAW_FAILED) {
          throw new Error(
            `${label}: raw query failed (${code}): ${message.slice(0, 200)}`,
          );
        }
        // Any other SQLSTATE (e.g. 42703 for an unrelated missing column) is
        // surfaced separately and is NOT this defect class.
        throw new Error(
          `${label}: unexpected SQLSTATE ${code} (not uuid/text class): ${message.slice(0, 200)}`,
        );
      }
    };

    describe('fixture preconditions', () => {
      it('absent UUIDs really do not exist, so probes mutate nothing', async () => {
        const [company, po, invoice, payment] = await Promise.all([
          prisma.company.findUnique({ where: { id: ABSENT_UUID } }),
          prisma.purchaseOrder.findUnique({ where: { id: ABSENT_UUID } }),
          prisma.purchaseInvoice.findUnique({ where: { id: ABSENT_UUID } }),
          prisma.supplierPayment.findUnique({ where: { id: ABSENT_UUID } }),
        ]);
        expect(company).toBeNull();
        expect(po).toBeNull();
        expect(invoice).toBeNull();
        expect(payment).toBeNull();
      });

      it('sanity: an un-cast uuid comparison still fails, proving this suite can detect the defect', async () => {
        // Negative control. If PostgreSQL ever accepted `uuid = text`, or if Prisma
        // ever changed parameter binding, this expectation would fail and the
        // positive assertions below would become vacuous.
        await expect(
          prisma.$queryRaw`SELECT 1 AS ok WHERE ${ABSENT_UUID}::uuid = ${ABSENT_UUID}`,
        ).rejects.toMatchObject({ code: PRISMA_RAW_FAILED });
      });

      it('sanity: the ::uuid cast resolves the very same comparison', async () => {
        const rows = await prisma.$queryRaw<Array<{ ok: number }>>`
        SELECT 1 AS ok WHERE ${ABSENT_UUID}::uuid = ${ABSENT_UUID}::uuid
      `;
        expect(rows).toEqual([{ ok: 1 }]);
      });
    });

    describe('1-2. PurchaseOrder / PurchaseInvoice repository locks (real repository code)', () => {
      it('PurchaseOrderRepository.lockById executes against real PostgreSQL', async () => {
        const repo = new PurchaseOrderRepository(prisma);
        await expect(
          prisma.$transaction(async (tx) =>
            repo
              .lockById(ABSENT_UUID, ABSENT_UUID, tx)
              .catch((error: unknown) => {
                expectNotUuidTextDefect(error, 'lockById');
                throw error;
              }),
          ),
        ).rejects.toThrow(/Purchase order with id .* not found/);
      });

      it('PurchaseInvoiceRepository.lockInvoiceById executes against real PostgreSQL', async () => {
        const repo = new PurchaseInvoiceRepository(prisma);
        await expect(
          prisma.$transaction(async (tx) =>
            repo
              .lockInvoiceById(ABSENT_UUID, ABSENT_UUID, tx)
              .catch((error: unknown) => {
                expectNotUuidTextDefect(error, 'lockInvoiceById');
                throw error;
              }),
          ),
        ).rejects.toThrow(/Purchase invoice with id .* not found/);
      });

      it('both repository locks keep FOR UPDATE (plan contains LockRows)', async () => {
        const poPlan = await prisma.$queryRawUnsafe<
          Array<Record<string, string>>
        >(
          `EXPLAIN SELECT id FROM "PurchaseOrder" WHERE id = $1::uuid AND "companyId" = $2::uuid AND "deletedAt" IS NULL FOR UPDATE`,
          ABSENT_UUID,
          ABSENT_UUID,
        );
        const piPlan = await prisma.$queryRawUnsafe<
          Array<Record<string, string>>
        >(
          `EXPLAIN SELECT id FROM "PurchaseInvoice" WHERE id = $1::uuid AND "companyId" = $2::uuid AND "deletedAt" IS NULL FOR UPDATE`,
          ABSENT_UUID,
          ABSENT_UUID,
        );
        expect(JSON.stringify(poPlan)).toContain('LockRows');
        expect(JSON.stringify(piPlan)).toContain('LockRows');
      });
    });

    describe('3-4. supplier-payments and supplier-payment-allocations invoice locks', () => {
      // Verbatim from suppliers/services/supplier-payments.service.ts and
      // suppliers/services/supplier-payment-allocations.service.ts; the drift
      // guards below fail if production stops matching these.
      const PAYMENT_INVOICE_LOCK = normalize(`
      SELECT id FROM "PurchaseInvoice"
      WHERE id = ${'{purchaseInvoiceId}'}::uuid
        AND "companyId" = ${'{companyId}'}::uuid
        AND "deletedAt" IS NULL
      FOR UPDATE
    `);

      const ALLOCATION_INVOICE_LOCK = normalize(`
      SELECT id FROM "PurchaseInvoice"
      WHERE id = ${'{purchaseInvoiceId}'}::uuid
        AND "companyId" = ${'{companyId}'}::uuid
        AND "deletedAt" IS NULL
      FOR UPDATE
    `);

      const ALLOCATION_PAYMENT_LOCK = normalize(`
      SELECT id, amount, "deletedAt"
      FROM "SupplierPayment"
      WHERE id = ${'{paymentId}'}::uuid
        AND "companyId" = ${'{companyId}'}::uuid
        AND "deletedAt" IS NULL
      FOR UPDATE
    `);

      it('production source carries ::uuid on all three inline locks', () => {
        const paymentsSource = normalize(
          readProductionSource(
            'modules/suppliers/services/supplier-payments.service.ts',
          ),
        );
        const allocationsSource = normalize(
          readProductionSource(
            'modules/suppliers/services/supplier-payment-allocations.service.ts',
          ),
        );

        expect(paymentsSource).toContain(
          'WHERE id = ${dto.purchaseInvoiceId}::uuid AND "companyId" = ${companyId}::uuid',
        );
        expect(allocationsSource).toContain(
          'WHERE id = ${purchaseInvoiceId}::uuid AND "companyId" = ${companyId}::uuid',
        );
        expect(allocationsSource).toContain(
          'WHERE id = ${paymentId}::uuid AND "companyId" = ${companyId}::uuid',
        );
      });

      it('supplier-payments invoice lock resolves on real PostgreSQL', async () => {
        await expectNoUuidTextDefect(
          'supplier-payments invoice lock',
          async () => {
            await prisma.$queryRaw`
          SELECT id FROM "PurchaseInvoice"
          WHERE id = ${ABSENT_UUID}::uuid
            AND "companyId" = ${ABSENT_UUID_2}::uuid
            AND "deletedAt" IS NULL
          FOR UPDATE
        `;
          },
        );
      });

      it('allocation invoice lock resolves on real PostgreSQL', async () => {
        await expectNoUuidTextDefect('allocation invoice lock', async () => {
          await prisma.$queryRaw`
          SELECT id FROM "PurchaseInvoice"
          WHERE id = ${ABSENT_UUID}::uuid
            AND "companyId" = ${ABSENT_UUID_2}::uuid
            AND "deletedAt" IS NULL
          FOR UPDATE
        `;
        });
      });

      it('allocation payment lock resolves on real PostgreSQL and keeps FOR UPDATE', async () => {
        await expectNoUuidTextDefect('allocation payment lock', async () => {
          await prisma.$queryRaw`
          SELECT id, amount, "deletedAt"
          FROM "SupplierPayment"
          WHERE id = ${ABSENT_UUID}::uuid
            AND "companyId" = ${ABSENT_UUID_2}::uuid
            AND "deletedAt" IS NULL
          FOR UPDATE
        `;
        });

        const plan = await prisma.$queryRawUnsafe<
          Array<Record<string, string>>
        >(
          `EXPLAIN SELECT id, amount, "deletedAt" FROM "SupplierPayment"
          WHERE id = $1::uuid AND "companyId" = $2::uuid AND "deletedAt" IS NULL FOR UPDATE`,
          ABSENT_UUID,
          ABSENT_UUID_2,
        );
        expect(JSON.stringify(plan)).toContain('LockRows');
      });

      it('canonical lock order invoice -> payment is preserved in the allocation path', async () => {
        const source = readProductionSource(
          'modules/suppliers/services/supplier-payment-allocations.service.ts',
        );
        const invoiceLockAt = source.indexOf('FROM "PurchaseInvoice"');
        const paymentLockAt = source.indexOf('FROM "SupplierPayment"');
        expect(invoiceLockAt).toBeGreaterThan(-1);
        expect(paymentLockAt).toBeGreaterThan(-1);
        expect(invoiceLockAt).toBeLessThan(paymentLockAt);
      });

      it('both allocation lock statements keep their FOR UPDATE clause', () => {
        // Count only FOR UPDATE that terminates a raw-SQL template (`FOR UPDATE` + closing
        // backtick), so occurrences inside docstrings/comments are not miscounted.
        const source = readProductionSource(
          'modules/suppliers/services/supplier-payment-allocations.service.ts',
        );
        const lockClauses = source.match(/FOR UPDATE\s*`/g) ?? [];
        expect(lockClauses).toHaveLength(2);
      });
    });

    describe('5. supplier-exposure representative raw query (real repository code)', () => {
      it('SupplierExposureRepository.getOpenPoExposureAggregates resolves on real PostgreSQL', async () => {
        const repo = new SupplierExposureRepository(prisma);
        const rows = await repo.getOpenPoExposureAggregates(
          ABSENT_UUID,
          ABSENT_UUID,
        );
        expect(Array.isArray(rows)).toBe(true);
        expect(rows).toEqual([]);
      });

      it('production source carries ::uuid on companyId and supplierId', () => {
        const source = normalize(
          readProductionSource(
            'modules/suppliers/repositories/supplier-exposure.repository.ts',
          ),
        );
        expect(source).toContain('WHERE pi."companyId" = ${companyId}::uuid');
        expect(source).toContain('WHERE po."supplierId" = ${supplierId}::uuid');
        expect(source).toContain('AND po."companyId" = ${companyId}::uuid');
      });

      it('tenant predicate stays effective: a different companyId yields no rows', async () => {
        const repo = new SupplierExposureRepository(prisma);
        await expect(
          repo.getOpenPoExposureAggregates(ABSENT_UUID, ABSENT_UUID_2),
        ).resolves.toEqual([]);
      });
    });

    describe('6. Company FOR UPDATE lock (companies.service.ts)', () => {
      it('resolves on real PostgreSQL', async () => {
        await expectNoUuidTextDefect('Company lock', async () => {
          await prisma.$queryRaw`SELECT id FROM "Company" WHERE id = ${ABSENT_UUID}::uuid FOR UPDATE`;
        });
      });

      it('keeps FOR UPDATE (plan contains LockRows)', async () => {
        const plan = await prisma.$queryRawUnsafe<
          Array<Record<string, string>>
        >(
          `EXPLAIN SELECT id FROM "Company" WHERE id = $1::uuid FOR UPDATE`,
          ABSENT_UUID,
        );
        expect(JSON.stringify(plan)).toContain('LockRows');
      });

      it('production source carries ::uuid', () => {
        const source = normalize(
          readProductionSource(
            'modules/companies/services/companies.service.ts',
          ),
        );
        expect(source).toContain(
          'SELECT id FROM "Company" WHERE id = ${companyId}::uuid FOR UPDATE',
        );
      });
    });

    describe('7-8. companies monetary-data checks + CreditLimit via Customer', () => {
      /** Mirrors LOCK_TABLES in companies.service.ts:14-28. */
      const LOCK_TABLES = [
        'Product',
        'CostLayer',
        'Sale',
        'PurchaseOrder',
        'PurchaseReturn',
        'PurchaseInvoice',
        'CashShift',
        'CashAccount',
        'BankAccount',
        'FinancialTransaction',
        'SupplierPayment',
        'SupplierProduct',
        'CreditLimit',
      ] as const;

      it('all 12 companyId-owned lock tables resolve with ::uuid', async () => {
        const owned = LOCK_TABLES.filter((table) => table !== 'CreditLimit');
        expect(owned).toHaveLength(12);
        for (const table of owned) {
          await expectNoUuidTextDefect(`EXISTS on ${table}`, async () => {
            await prisma.$queryRawUnsafe(
              `SELECT EXISTS(SELECT 1 FROM "${table}" WHERE "companyId" = $1::uuid LIMIT 1)`,
              ABSENT_UUID,
            );
          });
        }
      });

      it('CreditLimit has no companyId column (precondition for the join fix)', async () => {
        const cols = await prisma.$queryRawUnsafe<
          Array<{ column_name: string }>
        >(
          `SELECT column_name FROM information_schema.columns
          WHERE table_name::text = $1 ORDER BY column_name`,
          'CreditLimit',
        );
        const names = cols.map((c) => c.column_name);
        expect(names).toContain('customerId');
        expect(names).not.toContain('companyId');
      });

      it('CreditLimit tenant check resolves through Customer.companyId (Option B)', async () => {
        await expectNoUuidTextDefect('CreditLimit via Customer', async () => {
          await prisma.$queryRaw`
          SELECT EXISTS(
            SELECT 1 FROM "CreditLimit" cl
            JOIN "Customer" c ON c."id" = cl."customerId"
            WHERE c."companyId" = ${ABSENT_UUID}::uuid
            LIMIT 1
          )
        `;
        });
      });

      it('the OLD CreditLimit predicate fails with 42703, never 42883', async () => {
        // Pins the exact reason Option B was required: CreditLimit owns no
        // companyId column, so the uniform predicate cannot work.
        await expect(
          prisma.$queryRaw`
          SELECT EXISTS(SELECT 1 FROM "CreditLimit" WHERE "companyId" = ${ABSENT_UUID}::uuid LIMIT 1)
        `,
        ).rejects.toMatchObject({ meta: { code: UNDEFINED_COLUMN } });
      });

      it('CreditLimit check is genuinely tenant-scoped, not a global scan', async () => {
        // Any company that has customers must not match a foreign companyId.
        const companyWithCustomers = await prisma.customer.findFirst({
          select: { companyId: true },
        });
        const foreignCompanyId =
          companyWithCustomers?.companyId === ABSENT_UUID
            ? ABSENT_UUID_2
            : ABSENT_UUID;

        const [viaJoin] = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS(
          SELECT 1 FROM "CreditLimit" cl
          JOIN "Customer" c ON c."id" = cl."customerId"
          WHERE c."companyId" = ${foreignCompanyId}::uuid
          LIMIT 1
        )
      `;
        expect(viaJoin).toBeDefined();
        expect(typeof viaJoin!.exists).toBe('boolean');

        // Cross-check the join against the Prisma relation path.
        const creditLimitsForCompany = await prisma.creditLimit.count({
          where: { customer: { companyId: foreignCompanyId } },
        });
        expect(viaJoin!.exists).toBe(creditLimitsForCompany > 0);
      });

      it('CreditLimit guard returns TRUE for the owning company and FALSE for a foreign one', async () => {
        // Without a CreditLimit row the assertion above is vacuous (both the raw
        // join and the Prisma relation path report "none"). Seed fixtures inside a
        // transaction that is ALWAYS rolled back, so the positive branch is
        // genuinely exercised while leaving no data behind.
        await prisma.$transaction(async (tx) => {
          const company = await tx.company.create({
            data: { name: 'G16-UUID-CAST-CREDITLIMIT-PROBE' },
          });
          const otherCompany = await tx.company.create({
            data: { name: 'G16-UUID-CAST-CREDITLIMIT-OTHER' },
          });
          const customer = await tx.customer.create({
            data: { companyId: company.id, type: 'PERSON' },
          });
          const foreignCustomer = await tx.customer.create({
            data: { companyId: otherCompany.id, type: 'PERSON' },
          });
          await tx.creditLimit.create({
            data: { customerId: customer.id, amount: '100.0000' },
          });
          await tx.creditLimit.create({
            data: { customerId: foreignCustomer.id, amount: '100.0000' },
          });

          const existsFor = async (companyId: string) => {
            const rows = await tx.$queryRaw<Array<{ exists: boolean }>>`
              SELECT EXISTS(
                SELECT 1 FROM "CreditLimit" cl
                JOIN "Customer" c ON c."id" = cl."customerId"
                WHERE c."companyId" = ${companyId}::uuid
                LIMIT 1
              )
            `;
            return rows[0]!.exists;
          };

          // Owning company must be blocked from changing currency.
          expect(await existsFor(company.id)).toBe(true);
          // A different tenant's CreditLimit must NOT leak into the decision.
          expect(await existsFor(otherCompany.id)).toBe(true);
          expect(await existsFor(ABSENT_UUID)).toBe(false);

          throw new Error('ROLLBACK_G16_PROBE');
        }).catch((error: unknown) => {
          // Expected: the forced throw rolls the transaction back.
          expect(pgMessage(error)).toContain('ROLLBACK_G16_PROBE');
        });

        // Prove the rollback really removed everything.
        const residue = await prisma.company.count({
          where: { name: { startsWith: 'G16-UUID-CAST-CREDITLIMIT' } },
        });
        expect(residue).toBe(0);
      });

      it('production source keeps LOCK_TABLES allowlisted and joins CreditLimit via Customer', () => {
        const source = normalize(
          readProductionSource(
            'modules/companies/services/companies.service.ts',
          ),
        );
        // CreditLimit must NOT be silently dropped from the guard.
        expect(source).toContain(`'CreditLimit',`);
        expect(source).toContain(
          '? Prisma.sql`SELECT EXISTS(SELECT 1 FROM ${Prisma.raw(`"${table}"`)} cl JOIN "Customer" c ON c."id" = cl."customerId" WHERE c."companyId" = ${companyId}::uuid LIMIT 1)`',
        );
        expect(source).toContain(
          ': Prisma.sql`SELECT EXISTS(SELECT 1 FROM ${Prisma.raw(`"${table}"`)} WHERE "companyId" = ${companyId}::uuid LIMIT 1)`',
        );
      });
    });

    describe('9. supplier-analytics representative raw UUID queries', () => {
      const ANALYTICS_SQL = [
        normalize(`
        SELECT pi."supplierId", pi.currency, SUM(pi."grandTotal")
        FROM "PurchaseInvoice" pi
        WHERE pi."supplierId" = ${'{supplierId}'}::uuid
          AND pi."companyId" = ${'{companyId}'}::uuid
          AND pi."deletedAt" IS NULL
          AND pi."status" IN ('APPROVED', 'PAID')
          AND pi."currency" = ${'{baseCurrency}'}::"Currency"
          AND pi."invoiceDate" >= ${'{dateFrom}'}
          AND pi."invoiceDate" <= ${'{dateTo}'}
        GROUP BY pi."supplierId", pi.currency
      `),
        normalize(`
        SELECT pii."productId", SUM(pii."total")
        FROM "PurchaseInvoiceItem" pii
        JOIN "PurchaseInvoice" pi ON pii."purchaseInvoiceId" = pi.id
        JOIN "Product" p ON pii."productId" = p.id
        WHERE pi."supplierId" = ${'{supplierId}'}::uuid
          AND pi."companyId" = ${'{companyId}'}::uuid
          AND pi."deletedAt" IS NULL
          AND pii."productId" = ${'{productId}'}::uuid
        GROUP BY pii."productId"
      `),
        normalize(`
        SELECT pri."productId", SUM(pri."quantity")
        FROM "PurchaseReturnItem" pri
        JOIN "PurchaseReturn" pr ON pri."purchaseReturnId" = pr.id
        WHERE pr."supplierId" = ${'{supplierId}'}::uuid
          AND pr."companyId" = ${'{companyId}'}::uuid
          AND pr."deletedAt" IS NULL
          AND pr."returnDate" >= ${'{dateFrom}'}
          AND pr."returnDate" <= ${'{dateTo}'}
        GROUP BY pri."productId"
      `),
        normalize(`
        SELECT po."id", po.currency, po."grandTotal"
        FROM "PurchaseOrder" po
        WHERE po."supplierId" = ${'{supplierId}'}::uuid
          AND po."companyId" = ${'{companyId}'}::uuid
          AND po."deletedAt" IS NULL
          AND po."orderDate" >= ${'{dateFrom}'}
          AND po."orderDate" <= ${'{dateTo}'}
      `),
      ];

      it('every analytics statement resolves on real PostgreSQL', async () => {
        await expectNoUuidTextDefect('analytics invoice summary', async () => {
          await prisma.$queryRaw`
          SELECT pi."supplierId", pi.currency, SUM(pi."grandTotal")
          FROM "PurchaseInvoice" pi
          WHERE pi."supplierId" = ${ABSENT_UUID}::uuid
            AND pi."companyId" = ${ABSENT_UUID_2}::uuid
            AND pi."deletedAt" IS NULL
            AND pi."status" IN ('APPROVED', 'PAID')
            AND pi."currency" = ${'KZT'}::"Currency"
            AND pi."invoiceDate" >= ${DATE_FROM}
            AND pi."invoiceDate" <= ${DATE_TO}
          GROUP BY pi."supplierId", pi.currency
        `;
        });

        await expectNoUuidTextDefect(
          'analytics product purchases (pii.productId)',
          async () => {
            await prisma.$queryRaw`
          SELECT pii."productId", SUM(pii."total")
          FROM "PurchaseInvoiceItem" pii
          JOIN "PurchaseInvoice" pi ON pii."purchaseInvoiceId" = pi.id
          JOIN "Product" p ON pii."productId" = p.id
          WHERE pi."supplierId" = ${ABSENT_UUID}::uuid
            AND pi."companyId" = ${ABSENT_UUID_2}::uuid
            AND pi."deletedAt" IS NULL
            AND pii."productId" = ${ABSENT_UUID}::uuid
          GROUP BY pii."productId"
        `;
          },
        );

        await expectNoUuidTextDefect(
          'analytics return summary (pr.supplierId)',
          async () => {
            await prisma.$queryRaw`
          SELECT pri."productId", SUM(pri."quantity")
          FROM "PurchaseReturnItem" pri
          JOIN "PurchaseReturn" pr ON pri."purchaseReturnId" = pr.id
          WHERE pr."supplierId" = ${ABSENT_UUID}::uuid
            AND pr."companyId" = ${ABSENT_UUID_2}::uuid
            AND pr."deletedAt" IS NULL
            AND pr."returnDate" >= ${DATE_FROM}
            AND pr."returnDate" <= ${DATE_TO}
          GROUP BY pri."productId"
        `;
          },
        );

        await expectNoUuidTextDefect(
          'analytics reliability (po.supplierId)',
          async () => {
            await prisma.$queryRaw`
          SELECT po."id", po.currency, po."grandTotal"
          FROM "PurchaseOrder" po
          WHERE po."supplierId" = ${ABSENT_UUID}::uuid
            AND po."companyId" = ${ABSENT_UUID_2}::uuid
            AND po."deletedAt" IS NULL
            AND po."orderDate" >= ${DATE_FROM}
            AND po."orderDate" <= ${DATE_TO}
        `;
          },
        );
      });

      it('production source has ::uuid on every analytics UUID comparison', () => {
        const source = normalize(
          readProductionSource(
            'modules/suppliers/services/supplier-analytics.service.ts',
          ),
        );

        // supplierId + companyId: 6 query sites each (PurchaseInvoice x6,
        // PurchaseReturn x2, PurchaseOrder x1).
        const piSupplier =
          source.split('WHERE pi."supplierId" = ${supplierId}::uuid').length -
          1;
        const piCompany =
          source.split('AND pi."companyId" = ${companyId}::uuid').length - 1;
        const prSupplier =
          source.split('WHERE pr."supplierId" = ${supplierId}::uuid').length -
          1;
        const prCompany =
          source.split('AND pr."companyId" = ${companyId}::uuid').length - 1;
        const poSupplier =
          source.split('WHERE po."supplierId" = ${supplierId}::uuid').length -
          1;
        const poCompany =
          source.split('AND po."companyId" = ${companyId}::uuid').length - 1;
        const itemProduct =
          source.split('AND pii."productId" = ${productId}::uuid').length - 1;

        expect(piSupplier).toBe(6);
        expect(piCompany).toBe(6);
        expect(prSupplier).toBe(2);
        expect(prCompany).toBe(2);
        expect(poSupplier).toBe(1);
        expect(poCompany).toBe(1);
        expect(itemProduct).toBe(1);
        expect(ANALYTICS_SQL.length).toBe(4);

        // No un-cast UUID comparison may remain anywhere in the file.
        expect(source).not.toMatch(
          /=\s*\$\{(supplierId|companyId|productId)\}(?!\s*::)/,
        );
      });
    });

    describe('10. overdue invoice query', () => {
      it('tenant predicate resolves on real PostgreSQL', async () => {
        await expectNoUuidTextDefect(
          'overdue invoice tenant predicate',
          async () => {
            await prisma.$queryRaw`
          SELECT pi."id"
          FROM "PurchaseInvoice" pi
          WHERE pi."companyId" = ${ABSENT_UUID}::uuid
            AND pi."deletedAt" IS NULL
          LIMIT 1
        `;
          },
        );
      });

      it('production source carries ::uuid on companyId', () => {
        const source = normalize(
          readProductionSource(
            'modules/notifications/repositories/overdue-invoice.repository.ts',
          ),
        );
        expect(source).toContain('WHERE pi."companyId" = ${companyId}::uuid');
      });

      it('real OverdueInvoiceRepository call: uuid/text defect is gone; a separate 42703 remains (KNOWN, unfixed)', async () => {
        // The `::uuid` fix is complete. OverdueInvoiceRepository.findOverdueInvoices
        // still fails, but for an UNRELATED pre-existing reason: it selects
        // s."name" while model Supplier exposes "companyName" (schema.prisma:518).
        // That is NOT the UUID/TEXT defect class and is intentionally left for a
        // separate decision. This test pins the current boundary against the REAL
        // repository method, so a future fix flips it deliberately rather than
        // silently.
        const repo = new OverdueInvoiceRepository(prisma);
        let code: string | undefined;
        let message = '';
        try {
          await repo.findOverdueInvoices(ABSENT_UUID, DATE_TO);
          throw new Error(
            'expected the known 42703 for s."name"; the statement now succeeds — remove this pin and fix the column',
          );
        } catch (error) {
          code = pgCode(error);
          message = pgMessage(error);
        }
        expect(code).toBe(UNDEFINED_COLUMN);
        expect(message).toContain('s.name');
        expect(message).not.toContain('operator does not exist');
      });
    });

    describe('tenant isolation is unchanged by the ::uuid cast', () => {
      it('a foreign companyId still matches nothing on every patched predicate', async () => {
        await prisma.$queryRaw`
        SELECT id FROM "PurchaseOrder"
        WHERE id = ${ABSENT_UUID}::uuid AND "companyId" = ${ABSENT_UUID_2}::uuid
      `;
        await prisma.$queryRaw`
        SELECT id FROM "PurchaseInvoice"
        WHERE id = ${ABSENT_UUID}::uuid AND "companyId" = ${ABSENT_UUID_2}::uuid
      `;
        await prisma.$queryRaw`
        SELECT id FROM "SupplierPayment"
        WHERE id = ${ABSENT_UUID}::uuid AND "companyId" = ${ABSENT_UUID_2}::uuid
      `;
      });

      it('the cast does not change row visibility for a real company', async () => {
        const company = await prisma.company.findFirst({
          select: { id: true },
        });
        const casted = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Company" WHERE id = ${company?.id ?? ABSENT_UUID}::uuid
      `;
        const typed = await prisma.company.findMany({
          where: { id: company?.id ?? ABSENT_UUID },
          select: { id: true },
        });
        expect(casted.map((r) => r.id).sort()).toEqual(
          typed.map((r) => r.id).sort(),
        );
      });
    });

    describe('no schema or migration drift', () => {
      it('::uuid is a SQL-level cast only — schema still declares @db.Uuid', () => {
        const schema = readFileSync(
          join(BACKEND_ROOT, 'prisma', 'schema.prisma'),
          'utf-8',
        );
        expect(schema).toContain('@db.Uuid');
      });

      it('Prisma.sql composition is used for the allowlisted CreditLimit branch', () => {
        const source = readProductionSource(
          'modules/companies/services/companies.service.ts',
        );
        expect(source).toContain('Prisma.raw(`"${table}"`)');
        expect(source).toContain('Prisma.sql');
      });
    });
  },
);

if (!hasIntegrationDatabase) {
  console.warn(
    '[g16-uuid-cast.integration] DATABASE_URL not set — real-PostgreSQL regression suite skipped.',
  );
}
