import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { IdempotencyService } from '../idempotency.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  IDEMPOTENCY_PENDING_BODY,
  IDEMPOTENCY_PENDING_STATUS,
  IDEMPOTENCY_TTL_MS,
} from '../idempotency.constants';

interface Row {
  id: string;
  companyId: string;
  idempotencyKey: string;
  endpoint: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
  expiresAt: Date;
  createdAt: Date;
}

interface Tx {
  id: number;
  staged: Map<string, Row>;
  /** Committed rows deleted inside this transaction (restored on rollback). */
  deleted: Map<string, Row>;
  done: Promise<'committed' | 'rolledback'>;
  resolveDone: (value: 'committed' | 'rolledback') => void;
}

/** Emulates Postgres semantics for the IdempotencyRecord unique index:
 *  - writes are staged per transaction and visible only after commit;
 *  - an INSERT that targets a key already being inserted by another
 *    in-flight transaction BLOCKS until that transaction commits/rolls back;
 *  - after a commit it surfaces a P2002 unique violation, after a rollback
 *    the insert proceeds normally.
 */
class MockIdempotencyStore {
  private committedRows = new Map<string, Row>();
  private inFlight = new Map<string, Tx>();
  private seq = 0;
  private txSeq = 0;

  private readonly key = (companyId: string, idempotencyKey: string): string =>
    `${companyId}::${idempotencyKey}`;

  beginTransaction(): Tx {
    const tx = {} as Tx;
    tx.id = ++this.txSeq;
    tx.staged = new Map();
    tx.deleted = new Map();
    tx.done = new Promise<'committed' | 'rolledback'>((resolve) => {
      tx.resolveDone = resolve;
    });
    return tx;
  }

  async createMany(
    dataList: Omit<Row, 'id' | 'createdAt'>[],
    tx: Tx,
  ): Promise<{ count: number }> {
    const data = dataList[0];
    if (!data) return { count: 0 };
    const k = this.key(data.companyId, data.idempotencyKey);
    const owner = this.inFlight.get(k);
    if (owner && owner !== tx) {
      await owner.done; // ON CONFLICT DO NOTHING still waits on the row lock
    }
    if (this.committedRows.has(k)) return { count: 0 };
    if (tx.staged.has(k)) return { count: 0 };
    const row: Row = {
      id: `rec-${++this.seq}`,
      createdAt: new Date(),
      ...data,
    };
    tx.staged.set(k, row);
    this.inFlight.set(k, tx);
    return { count: 1 };
  }

  async findUnique(
    where: {
      companyId_idempotencyKey: { companyId: string; idempotencyKey: string };
    },
    tx: Tx,
  ): Promise<Row | null> {
    const k = this.key(
      where.companyId_idempotencyKey.companyId,
      where.companyId_idempotencyKey.idempotencyKey,
    );
    return tx.staged.get(k) ?? this.committedRows.get(k) ?? null;
  }

  async updateMany(
    args: { where: Record<string, unknown>; data: Partial<Row> },
    tx: Tx,
  ) {
    const where = args.where as {
      companyId: string;
      idempotencyKey: string;
      responseStatus?: number;
    };
    const k = this.key(where.companyId, where.idempotencyKey);
    const row = tx.staged.get(k) ?? this.committedRows.get(k);
    if (!row) return { count: 0 };
    if (
      where.responseStatus !== undefined &&
      row.responseStatus !== where.responseStatus
    ) {
      return { count: 0 };
    }
    const next = { ...row, ...args.data };
    // Prisma.DbNull sentinel → SQL NULL (real Postgres returns `null`,
    // never the sentinel, when reading the column).
    if (
      (args.data as { responseBody?: unknown }).responseBody === Prisma.DbNull
    ) {
      next.responseBody = null;
    }
    tx.staged.set(k, next);
    return { count: 1 };
  }

  async deleteMany(args: { where: { id: string } }, tx: Tx) {
    let count = 0;
    for (const [k, row] of tx.staged) {
      if (row.id === args.where.id) {
        tx.staged.delete(k);
        count++;
      }
    }
    for (const [k, row] of this.committedRows) {
      if (row.id === args.where.id) {
        tx.deleted.set(k, row);
        this.committedRows.delete(k);
        count++;
      }
    }
    return { count };
  }

  /** Read-only (non-transactional) lookup used by `replay`. */
  committedFind(where: {
    companyId_idempotencyKey: { companyId: string; idempotencyKey: string };
  }): Row | null {
    const k = this.key(
      where.companyId_idempotencyKey.companyId,
      where.companyId_idempotencyKey.idempotencyKey,
    );
    return this.committedRows.get(k) ?? null;
  }

  /** Non-transactional delete used by `cleanupExpired`. */
  committedDeleteExpired(before: Date): { count: number } {
    let count = 0;
    for (const [k, row] of this.committedRows) {
      if (row.expiresAt < before) {
        this.committedRows.delete(k);
        count++;
      }
    }
    return { count };
  }

  commit(tx: Tx): void {
    // Apply deletions first (unless the same key was restaged in this tx).
    for (const key of tx.deleted.keys()) {
      if (!tx.staged.has(key)) {
        this.committedRows.delete(key);
      }
    }
    for (const [k, row] of tx.staged) {
      this.committedRows.set(k, row);
      if (this.inFlight.get(k) === tx) this.inFlight.delete(k);
    }
    tx.resolveDone('committed');
  }

  rollback(tx: Tx): void {
    for (const [k, row] of tx.deleted) {
      if (!this.committedRows.has(k)) {
        this.committedRows.set(k, row);
      }
    }
    for (const k of [...tx.staged.keys(), ...tx.deleted.keys()]) {
      if (this.inFlight.get(k) === tx) this.inFlight.delete(k);
    }
    tx.resolveDone('rolledback');
  }

  seedCommitted(row: Row): void {
    this.committedRows.set(this.key(row.companyId, row.idempotencyKey), row);
  }

  get(companyId: string, idempotencyKey: string): Row | null {
    return this.committedRows.get(this.key(companyId, idempotencyKey)) ?? null;
  }

  size(): number {
    return this.committedRows.size;
  }
}

function createMockPrisma(store: MockIdempotencyStore) {
  const prisma = {
    idempotencyRecord: {
      findUnique: jest.fn((args: { where: any }) =>
        store.committedFind(args.where),
      ),
      deleteMany: jest.fn((args: { where: { expiresAt: { lt: Date } } }) =>
        store.committedDeleteExpired(args.where.expiresAt.lt),
      ),
    },
    $transaction: jest.fn(async (cb: (tx: any) => Promise<unknown>) => {
      const tx = store.beginTransaction();
      const model = {
        createMany: jest.fn((args: any) => store.createMany(args.data, tx)),
        findUnique: jest.fn((args: any) => store.findUnique(args.where, tx)),
        updateMany: jest.fn((args: any) => store.updateMany(args, tx)),
        deleteMany: jest.fn((args: any) => store.deleteMany(args, tx)),
      };
      try {
        const result = await cb({ idempotencyRecord: model });
        store.commit(tx);
        return result;
      } catch (error) {
        store.rollback(tx);
        throw error;
      }
    }),
  };
  return { prisma };
}

describe('IdempotencyService (unit)', () => {
  let service: IdempotencyService;
  let store: MockIdempotencyStore;
  let prisma: ReturnType<typeof createMockPrisma>['prisma'];

  const endpoint = '/api/v1/cash-in';
  const companyId = 'company-a';

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

  beforeEach(() => {
    store = new MockIdempotencyStore();
    prisma = createMockPrisma(store).prisma;
    service = new IdempotencyService(prisma as unknown as PrismaService);
  });

  // ── 1. New key → reservation created & completed ────────────────────────
  it('creates a reservation for a new key and completes it', async () => {
    const work = jest.fn(async () => ({ status: 201, body: { ok: true } }));

    const result = await service.execute(
      params('key-new', { amount: 100 }),
      work,
    );

    expect(result).toEqual({
      type: 'completed',
      status: 201,
      body: { ok: true },
    });
    expect(work).toHaveBeenCalledTimes(1);
    const row = store.get(companyId, 'key-new');
    expect(row).not.toBeNull();
    expect(row?.responseStatus).toBe(201);
    expect(row?.responseBody).toEqual({ ok: true });
  });

  // ── 2. Same key + same requestHash → replay ─────────────────────────────
  it('replays the stored response for the same key and payload', async () => {
    const work = jest.fn(async () => ({
      status: 200,
      body: { saleId: 'sale-1' },
    }));

    await service.execute(params('key-1', { amount: 100 }), work);
    const result = await service.execute(
      params('key-1', { amount: 100 }),
      work,
    );

    expect(result).toEqual({
      type: 'replayed',
      status: 200,
      body: { saleId: 'sale-1' },
    });
    expect(work).toHaveBeenCalledTimes(1); // business logic did NOT run twice
  });

  // ── 3. Same key + different requestHash → 422 ───────────────────────────
  it('throws 422 when the same key is reused with a different payload', async () => {
    const work = jest.fn(async () => ({ status: 200, body: { ok: true } }));

    await service.execute(params('key-3', { amount: 100 }), work);

    await expect(
      service.execute(params('key-3', { amount: 999 }), work),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(work).toHaveBeenCalledTimes(1);
  });

  // ── 4. Two concurrent calls with the same key → business fn runs once ──
  it('runs the business function exactly once for concurrent duplicate keys', async () => {
    const work = jest.fn(async () => ({ status: 200, body: { ok: 1 } }));

    const results = await Promise.allSettled([
      service.execute(params('key-4', { amount: 100 }), work),
      service.execute(params('key-4', { amount: 100 }), work),
    ]);

    const values = results.map((r) =>
      r.status === 'fulfilled' ? r.value : null,
    );
    expect(work).toHaveBeenCalledTimes(1);
    expect(values.filter((v) => v?.type === 'completed')).toHaveLength(1);
    expect(values.filter((v) => v?.type === 'replayed')).toHaveLength(1);
  });

  it('blocks a duplicate INSERT on an in-flight transaction (real race shape)', async () => {
    // First request stays mid-transaction while the second one hits the key.
    const slowWork = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return { status: 200, body: { ok: true } };
    });
    const fastWork = jest.fn(async () => {
      throw new Error('must not run');
    });

    const [r1, r2] = await Promise.allSettled([
      service.execute(params('key-4b', { amount: 100 }), slowWork),
      service.execute(params('key-4b', { amount: 100 }), fastWork),
    ]);

    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('fulfilled');
    if (r1.status === 'fulfilled') expect(r1.value.type).toBe('completed');
    if (r2.status === 'fulfilled') expect(r2.value.type).toBe('replayed');
    expect(slowWork).toHaveBeenCalledTimes(1);
    expect(fastWork).not.toHaveBeenCalled();
  });

  // ── 5. Rollback → no IdempotencyRecord left behind ──────────────────────
  it('leaves no IdempotencyRecord when the transaction rolls back', async () => {
    const failingWork = jest.fn(async () => {
      throw new Error('business failure');
    });

    await expect(
      service.execute(params('key-5', { amount: 100 }), failingWork),
    ).rejects.toThrow('business failure');

    expect(store.size()).toBe(0);
    expect(await service.replay(companyId, 'key-5')).toBeNull();
  });

  // ── 6. Successful commit → record exists ────────────────────────────────
  it('persists the IdempotencyRecord after a successful commit', async () => {
    const work = jest.fn(async () => ({ status: 200, body: { done: true } }));

    await service.execute(params('key-6', { amount: 100 }), work);

    const replay = await service.replay(companyId, 'key-6');
    expect(replay).not.toBeNull();
    expect(replay?.status).toBe(200);
    expect(replay?.body).toEqual({ done: true });
  });

  // ── 7. Replay returns the exact stored status + body after commit ───────
  it('replays the exact status and body after a commit', async () => {
    const body = { saleId: 'sale-1', total: 1250.5, items: [1, 2, 3] };
    const work = jest.fn(async () => ({ status: 202, body }));

    await service.execute(params('key-7', { sku: 'A' }), work);
    const replay = await service.replay(companyId, 'key-7');

    expect(replay).toEqual({ status: 202, body });
  });

  // ── 8. companyId A + key X does not conflict with companyId B + key X ───
  it('scopes idempotency by (companyId, idempotencyKey)', async () => {
    const workB = jest.fn(async () => ({ status: 201, body: { b: true } }));

    await service.execute(
      { ...params('key-8', { amount: 100 }) },
      async () => ({
        status: 201,
        body: { a: true },
      }),
    );
    const resultB = await service.execute(
      { ...params('key-8', { amount: 999 }), companyId: 'company-b' },
      workB,
    );

    expect(resultB.type).toBe('completed');
    expect(workB).toHaveBeenCalledTimes(1);
    expect(store.get('company-a', 'key-8')).not.toBeNull();
    expect(store.get('company-b', 'key-8')).not.toBeNull();
  });

  // ── 9. Expired record is not used for replay ────────────────────────────
  it('treats an expired record as absent for replay and re-executes', async () => {
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

    // Committed but already expired → read-only replay refuses it.
    expect(await service.replay(companyId, 'key-9')).toBeNull();

    // Same key+payload → treated as absent, business re-runs.
    const result = await service.execute(
      params('key-9', { amount: 100 }),
      work,
    );
    expect(result.type).toBe('completed');
    expect(calls).toBe(2);
  });

  it('never replays an expired-but-committed record on the fast path', async () => {
    const expiredHash = service.hashRequest({ amount: 1 });
    store.seedCommitted({
      id: 'rec-expired',
      companyId,
      idempotencyKey: 'key-expired',
      endpoint,
      requestHash: expiredHash,
      responseStatus: 200,
      responseBody: { stale: true },
      expiresAt: new Date(Date.now() - 5000),
      createdAt: new Date(),
    });

    expect(await service.replay(companyId, 'key-expired')).toBeNull();
  });

  // ── 10. responseBody = null is handled correctly ────────────────────────
  it('stores and replays a null response body', async () => {
    const work = jest.fn(async () => ({ status: 200, body: null }));

    await service.execute(params('key-10', { amount: 100 }), work);
    const replay = await service.replay(companyId, 'key-10');

    expect(replay).toEqual({ status: 200, body: null });
  });

  // ── Extra: in-flight pending reservation → pending, no business work ────
  it('reports pending (conflict) for a committed-but-incomplete reservation', async () => {
    const hash = service.hashRequest({ amount: 100 });
    store.seedCommitted({
      id: 'rec-pending',
      companyId,
      idempotencyKey: 'key-pending',
      endpoint,
      requestHash: hash,
      responseStatus: IDEMPOTENCY_PENDING_STATUS,
      responseBody: IDEMPOTENCY_PENDING_BODY,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      createdAt: new Date(),
    });

    const work = jest.fn(async () => ({ status: 200, body: { ok: true } }));
    const result = await service.execute(
      params('key-pending', { amount: 100 }),
      work,
    );

    expect(result.type).toBe('pending');
    expect(work).not.toHaveBeenCalled();
  });

  // ── Extra: requestHash stability across JSON key order ──────────────────
  it('hashes equal payloads identically regardless of key order', () => {
    expect(service.hashRequest({ a: 1, b: { c: 2 }, d: [3, 4] })).toBe(
      service.hashRequest({ d: [3, 4], b: { c: 2 }, a: 1 }),
    );
    expect(service.hashRequest({ a: 1 })).not.toBe(
      service.hashRequest({ a: 2 }),
    );
    expect(service.hashRequest('string')).toBe(service.hashRequest('string'));
  });

  // ── Extra: TTL is 24 hours ──────────────────────────────────────────────
  it('defaults the reservation TTL to 24 hours', () => {
    const now = new Date('2026-08-30T00:00:00.000Z');
    expect(service.getExpiresAt(now).getTime()).toBe(
      now.getTime() + IDEMPOTENCY_TTL_MS,
    );
    expect(IDEMPOTENCY_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  // ── Extra: cleanupExpired removes only expired rows ─────────────────────
  it('cleanupExpired deletes only expired records', async () => {
    const now = new Date();
    store.seedCommitted({
      id: 'rec-old-1',
      companyId,
      idempotencyKey: 'key-old-1',
      endpoint,
      requestHash: 'h1',
      responseStatus: 200,
      responseBody: null,
      expiresAt: new Date(now.getTime() - 60_000),
      createdAt: new Date(now.getTime() - 2 * 60_000),
    });
    store.seedCommitted({
      id: 'rec-old-2',
      companyId: 'company-b',
      idempotencyKey: 'key-old-2',
      endpoint,
      requestHash: 'h2',
      responseStatus: 200,
      responseBody: null,
      expiresAt: new Date(now.getTime() - 10_000),
      createdAt: new Date(now.getTime() - 2 * 60_000),
    });
    store.seedCommitted({
      id: 'rec-fresh',
      companyId,
      idempotencyKey: 'key-fresh',
      endpoint,
      requestHash: 'h3',
      responseStatus: 200,
      responseBody: null,
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: new Date(now.getTime() - 60_000),
    });

    const deleted = await service.cleanupExpired(now);

    expect(deleted).toBe(2);
    expect(store.get(companyId, 'key-old-1')).toBeNull();
    expect(store.get('company-b', 'key-old-2')).toBeNull();
    expect(store.get(companyId, 'key-fresh')).not.toBeNull();
  });
});
