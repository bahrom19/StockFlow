import {
  hasIntegrationDatabase,
  integrationDatabaseUrl,
} from './integration-env';
import { UnprocessableEntityException } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { IdempotencyService } from '../idempotency.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * Integration tests against a REAL PostgreSQL database.
 *
 * Run with:
 *   DATABASE_URL=postgresql://stockflow:stockflow@localhost:5444/stockflow \
 *     npx jest --config jest.integration.config.js src/infrastructure/idempotency
 *
 * When no `DATABASE_URL` is present the whole suite is skipped (CI provides
 * a postgres service for the integration step). The suite auto-applies the
 * `add_idempotency_record` migration if the table does not exist yet.
 *
 * `@prisma/client` is imported lazily inside `beforeAll`: merely importing
 * the package loads `.env` and overrides `process.env.DATABASE_URL`, which
 * would break the skip decision and point the tests at the dev database and
 * `integration-env` snapshots the URL before that side effect runs.
 */

const databaseUrl = integrationDatabaseUrl;
const hasDb = hasIntegrationDatabase;

async function ensureTable(prisma: PrismaClient): Promise<void> {
  const migrationsRoot = join(__dirname, '../../../../prisma/migrations');
  const dirs = existsSync(migrationsRoot)
    ? readdirSync(migrationsRoot, { withFileTypes: true }).filter((d) =>
        d.isDirectory(),
      )
    : [];
  for (const dir of dirs.sort()) {
    const file = join(migrationsRoot, dir.name, 'migration.sql');
    if (!existsSync(file)) continue;
    const sql = readFileSync(file, 'utf8');
    if (!sql.includes('CREATE TABLE "IdempotencyRecord"')) continue;

    const rows = await prisma.$queryRaw<
      { t: string | null }[]
    >`SELECT to_regclass('"IdempotencyRecord"')::text AS t`;
    if (rows[0]?.t) return;

    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('--') && !s.startsWith('/*'));
    for (const statement of statements) {
      await prisma.$executeRawUnsafe(statement);
    }
    return;
  }
  throw new Error('add_idempotency_record migration not found');
}

/** Runtime skip: `describe.skip` when no database is configured. */
const describeDb = hasDb ? describe : describe.skip;

describeDb('IdempotencyService (integration — real PostgreSQL)', () => {
  let prisma: PrismaClient;
  let service: IdempotencyService;

  const companyId = '11111111-1111-1111-1111-111111111111';
  const otherCompanyId = '22222222-2222-2222-2222-222222222222';
  const endpoint = '/api/v1/cash-in';

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    await prisma.$connect();
    await ensureTable(prisma);
    service = new IdempotencyService(prisma as unknown as PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.idempotencyRecord.deleteMany({});
      await prisma.$disconnect();
    }
  });

  beforeEach(async () => {
    await prisma.idempotencyRecord.deleteMany({});
  });

  const params = (
    idempotencyKey: string,
    requestBody: unknown,
    overrides: Record<string, unknown> = {},
  ) => ({
    companyId,
    idempotencyKey,
    endpoint,
    requestBody,
    ...overrides,
  });

  // ── 1. New key → reservation is created ────────────────────────────────
  it('creates a real row for a new key', async () => {
    const reservation = await prisma.$transaction((tx) =>
      service.reserve(tx, {
        companyId,
        idempotencyKey: 'key-new',
        endpoint,
        requestHash: service.hashRequest({ amount: 100 }),
      }),
    );
    expect(reservation.type).toBe('created');

    const row = await prisma.idempotencyRecord.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId,
          idempotencyKey: 'key-new',
        },
      },
    });
    expect(row).not.toBeNull();
    expect(row?.responseStatus).toBe(0); // pending sentinel during work
  });

  // ── 2. Same key + same requestHash → replay ────────────────────────────
  it('replays the stored response for the same key and payload', async () => {
    const work = jest.fn(async () => ({ status: 200, body: { id: 'x' } }));

    await service.execute(params('key-2', { amount: 100 }), work);
    const result = await service.execute(
      params('key-2', { amount: 100 }),
      work,
    );

    expect(result).toEqual({
      type: 'replayed',
      status: 200,
      body: { id: 'x' },
    });
    expect(work).toHaveBeenCalledTimes(1);
  });

  // ── 3. Same key + different requestHash → 422 ─────────────────────────
  it('rejects the same key with a different payload (422)', async () => {
    const work = jest.fn(async () => ({ status: 200, body: {} }));

    await service.execute(params('key-3', { amount: 100 }), work);

    await expect(
      service.execute(params('key-3', { amount: 999 }), work),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(work).toHaveBeenCalledTimes(1);
  });

  // ── 4. Two concurrent calls with the same key → business runs once ────
  it('runs the business function exactly once for concurrent duplicate keys', async () => {
    const work = jest.fn(async () => ({ status: 200, body: { ok: true } }));

    const [r1, r2] = await Promise.allSettled([
      service.execute(params('key-4', { amount: 100 }), work),
      service.execute(params('key-4', { amount: 100 }), work),
    ]);

    const values = [r1, r2].map((r) =>
      r.status === 'fulfilled' ? r.value : null,
    );
    expect(work).toHaveBeenCalledTimes(1);
    expect(values.filter((v) => v?.type === 'completed')).toHaveLength(1);
    expect(values.filter((v) => v?.type === 'replayed')).toHaveLength(1);
    // Both settled — the loser blocked on the unique index, not a deadlock.
    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('fulfilled');
  });

  // ── 5. Rollback → no IdempotencyRecord left ───────────────────────────
  it('leaves no row behind when the transaction rolls back', async () => {
    const failingWork = jest.fn(async () => {
      throw new Error('business failure');
    });

    await expect(
      service.execute(params('key-5', { amount: 100 }), failingWork),
    ).rejects.toThrow('business failure');

    const count = await prisma.idempotencyRecord.count({
      where: { companyId, idempotencyKey: 'key-5' },
    });
    expect(count).toBe(0);
  });

  // ── 6. Successful commit → record exists ──────────────────────────────
  it('persists a row after a successful commit', async () => {
    await service.execute(params('key-6', { amount: 100 }), async () => ({
      status: 200,
      body: { done: true },
    }));

    const row = await prisma.idempotencyRecord.findUnique({
      where: {
        companyId_idempotencyKey: { companyId, idempotencyKey: 'key-6' },
      },
    });
    expect(row).not.toBeNull();
    expect(row?.responseStatus).toBe(200);
  });

  // ── 7. Repeat returns the same status + body after commit ─────────────
  it('replays the exact status and body after commit', async () => {
    const body = { saleId: 'sale-1', total: 1250.5, nested: { a: [1, 2] } };
    await service.execute(params('key-7', { sku: 'A' }), async () => ({
      status: 202,
      body,
    }));

    const replay = await service.replay(companyId, 'key-7');
    expect(replay).toEqual({ status: 202, body });
  });

  // ── 8. companyId scoping ──────────────────────────────────────────────
  it('does not conflict across different companies', async () => {
    await service.execute(params('key-8', { amount: 100 }), async () => ({
      status: 201,
      body: { a: true },
    }));

    const resultB = await service.execute(
      { ...params('key-8', { amount: 999 }), companyId: otherCompanyId },
      async () => ({ status: 201, body: { b: true } }),
    );

    expect(resultB.type).toBe('completed');
    const rows = await prisma.idempotencyRecord.count();
    expect(rows).toBe(2);
  });

  // ── 9. Expired record is not used for replay ─────────────────────────
  it('treats an expired record as invalid', async () => {
    const past = new Date(Date.now() - 1000);
    let calls = 0;
    const work = jest.fn(async () => {
      calls++;
      return { status: 200, body: { v: calls } };
    });

    await service.execute(
      params('key-9', { amount: 100 }, { expiresAt: past }),
      work,
    );
    expect(await service.replay(companyId, 'key-9')).toBeNull();

    const result = await service.execute(
      params('key-9', { amount: 100 }),
      work,
    );
    expect(result.type).toBe('completed');
    expect(calls).toBe(2);
  });

  // ── 10. responseBody = null ───────────────────────────────────────────
  it('stores and replays a null body', async () => {
    await service.execute(params('key-10', { amount: 100 }), async () => ({
      status: 200,
      body: null,
    }));

    const replay = await service.replay(companyId, 'key-10');
    expect(replay).toEqual({ status: 200, body: null });
  });
});
