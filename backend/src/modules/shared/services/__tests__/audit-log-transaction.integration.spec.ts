/**
 * G16-N-5 — AuditLogService transaction integrity (integration, REAL PostgreSQL).
 *
 * Root cause under test: `AuditLogService.log(entry, tx?)` selects its client
 * with `const client = tx ?? this.prismaService`. At 29 production call sites the
 * call sat INSIDE a Prisma interactive `$transaction` but omitted `tx`, so the
 * `AuditLog` INSERT ran in its own AUTOCOMMIT transaction on a separate
 * connection. If the business transaction then rolled back, the audit row
 * survived — a permanent false record of an operation that never happened
 * (the sharpest case: `FiscalYearCloseService.closeFiscalYear` recording a
 * fiscal-year CLOSE that was rolled back).
 *
 * The fix threads the existing transaction client at those sites. This spec
 * proves the resulting guarantee against a real database, using the REAL
 * `AuditLogService` and REAL Prisma client — nothing about the behaviour is
 * mocked, because the whole defect is about WHICH CONNECTION issues the write.
 *
 *   A. ROLLBACK  — business write + `log(entry, tx)` + throw  → neither survives
 *   B. COMMIT    — business write + `log(entry, tx)`           → both survive, once
 *   C. CONTROL   — business write + `log(entry)` (no tx) + throw → audit row
 *                  SURVIVES while the business row does not. This pins the
 *                  original defect: it proves the test genuinely distinguishes
 *                  the transaction client from the root client, so case A is a
 *                  real assertion about threading and not a tautology.
 *
 * Conventions follow `idempotency.integration.spec.ts`:
 *  - `integration-env` is imported FIRST so `DATABASE_URL` is snapshotted before
 *    importing `@prisma/client` (which loads `.env` and would overwrite it);
 *  - `@prisma/client` is imported LAZILY inside `beforeAll` for the same reason;
 *  - the whole suite skips when no database is configured.
 */
import {
  hasIntegrationDatabase,
  integrationDatabaseUrl,
} from '../../../../infrastructure/idempotency/__tests__/integration-env';

import type { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../../common/prisma/prisma.service';
import { AuditLogService } from '../audit-log.service';

const databaseUrl = integrationDatabaseUrl;
const describeDb = hasIntegrationDatabase ? describe : describe.skip;

/** Unique per run so a crashed run can never collide with this one's rows. */
const RUN = `g16n5-${process.pid}-${Date.now()}`;

/** `AuditLog.userId` is a nullable `@db.Uuid` with an FK to `User`, so the audit
 *  entries below reference a REAL committed user — a fabricated UUID would
 *  violate `AuditLog_userId_fkey` before the transaction behaviour is reached. */
const ACTOR_EMAIL_SUFFIX = '@g16-n-5.invalid';

describeDb(
  'AuditLogService transaction integrity (integration — real PostgreSQL)',
  () => {
    let prisma: PrismaClient;
    let auditLog: AuditLogService;

    /** Committed tenant, created OUTSIDE every test transaction. */
    let companyId: string;
    /** Committed actor whose `User` row satisfies the AuditLog user FK. */
    let actorId: string;

    const warehousesByCode = () =>
      prisma.warehouse.findMany({
        where: { code: { startsWith: RUN } },
        select: { id: true },
      });

    const auditRows = () =>
      prisma.auditLog.findMany({
        where: { companyId },
        select: {
          entity: true,
          entityId: true,
          action: true,
          oldValues: true,
          newValues: true,
        },
      });

    const entryFor = (entityId: string) => ({
      companyId,
      userId: actorId,
      entityType: 'Warehouse',
      entityId,
      action: 'CREATE',
      before: null,
      after: { name: 'audit-probe' },
    });

    beforeAll(async () => {
      const { PrismaClient: Ctor } = await import('@prisma/client');
      prisma = new Ctor({ datasources: { db: { url: databaseUrl } } });
      await prisma.$connect();

      // Real service under test, wired to the real client.
      auditLog = new AuditLogService(prisma as unknown as PrismaService);

      const company = await prisma.company.create({
        data: { name: `${RUN}-tenant` },
        select: { id: true },
      });
      companyId = company.id;

      const user = await prisma.user.create({
        data: {
          email: `${RUN}${ACTOR_EMAIL_SUFFIX}`,
          passwordHash: 'g16-n-5-not-a-real-hash',
        },
        select: { id: true },
      });
      actorId = user.id;
      await prisma.companyMember.create({
        data: { companyId, userId: actorId },
      });
    });

    afterAll(async () => {
      if (!prisma) return;
      // Cascade removes the tenant's warehouses, members and company; audit rows
      // and the actor user are cleaned explicitly.
      await prisma.auditLog.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { name: { startsWith: RUN } } });
      await prisma.user.deleteMany({
        where: { email: { endsWith: ACTOR_EMAIL_SUFFIX } },
      });
      await prisma.$disconnect();
    });

    beforeEach(async () => {
      await prisma.auditLog.deleteMany({ where: { companyId } });
      await prisma.warehouse.deleteMany({
        where: { code: { startsWith: RUN } },
      });
    });

    // ── A. ROLLBACK ────────────────────────────────────────────────────────
    it('A. ROLLBACK: a business write and its audit row roll back TOGETHER', async () => {
      let warehouseId = '';

      await expect(
        prisma.$transaction(async (tx) => {
          const wh = await tx.warehouse.create({
            data: { companyId, name: `${RUN}-rolled-back`, code: `${RUN}-rb` },
            select: { id: true },
          });
          warehouseId = wh.id;

          await auditLog.log(entryFor(wh.id), tx);

          // Force the rollback AFTER both writes have been issued.
          throw new Error('forced rollback for G16-N-5 rollback proof');
        }),
      ).rejects.toThrow('forced rollback for G16-N-5 rollback proof');

      // Read back through the ROOT client — a separate connection, so anything it
      // can see was genuinely committed.
      expect(await warehousesByCode()).toHaveLength(0);
      expect(await auditRows()).toHaveLength(0);
      expect(
        await prisma.auditLog.findUnique({
          where: { id: '00000000-0000-0000-0000-000000000000' },
        }),
      ).toBeNull();
      expect(warehouseId).not.toBe('');
    });

    // ── B. COMMIT ──────────────────────────────────────────────────────────
    it('B. COMMIT: the audit row commits atomically with the business row, exactly once', async () => {
      let warehouseId = '';

      await prisma.$transaction(async (tx) => {
        const wh = await tx.warehouse.create({
          data: { companyId, name: `${RUN}-committed`, code: `${RUN}-ok` },
          select: { id: true },
        });
        warehouseId = wh.id;
        await auditLog.log(entryFor(wh.id), tx);
      });

      const warehouses = await warehousesByCode();
      expect(warehouses).toHaveLength(1);
      expect(warehouses[0]?.id).toBe(warehouseId);

      const rows = await auditRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        entity: 'Warehouse',
        entityId: warehouseId,
        action: 'CREATE',
        oldValues: null,
        newValues: { name: 'audit-probe' },
      });
      expect(rows[0]?.entityId).toBe(warehouseId);
    });

    // ── C. CONTROL — the original defect ───────────────────────────────────
    it('C. CONTROL: WITHOUT tx the audit row survives the rollback (pins the original defect)', async () => {
      let warehouseId = '';

      await expect(
        prisma.$transaction(async (tx) => {
          const wh = await tx.warehouse.create({
            data: { companyId, name: `${RUN}-control`, code: `${RUN}-ctl` },
            select: { id: true },
          });
          warehouseId = wh.id;

          // NO `tx` — this is the pre-fix call shape. The AuditLog INSERT falls
          // back to the root client and autocommits on its own connection.
          await auditLog.log(entryFor(wh.id));

          throw new Error('forced rollback for G16-N-5 control proof');
        }),
      ).rejects.toThrow('forced rollback for G16-N-5 control proof');

      // Business row is gone…
      expect(await warehousesByCode()).toHaveLength(0);
      // …but the audit row SURVIVED. This is exactly the divergence G16-N-5
      // removes, and it proves cases A and B are discriminating the two clients.
      const rows = await auditRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.entityId).toBe(warehouseId);
    });
  },
);
