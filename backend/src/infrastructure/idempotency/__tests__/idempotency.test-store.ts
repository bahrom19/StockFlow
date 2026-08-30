/**
 * Shared in-memory emulation of the `IdempotencyRecord` table and its
 * PostgreSQL unique-index semantics.
 *
 * Used by the F1 unit tests and by the F2 service-level idempotency
 * regression tests so every test asserts against ONE concurrency model:
 *   - writes are staged per transaction and visible only after commit;
 *   - an INSERT that targets a key already being inserted by another
 *     in-flight transaction BLOCKS until that transaction commits/rolls back;
 *   - after a commit it surfaces a unique-violation (skipDuplicates) outcome,
 *     after a rollback the insert proceeds normally.
 */

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

export { Row as IdempotencyRow };

interface Tx {
  id: number;
  staged: Map<string, Row>;
  /** Committed rows deleted inside this transaction (restored on rollback). */
  deleted: Map<string, Row>;
  done: Promise<'committed' | 'rolledback'>;
  resolveDone: (value: 'committed' | 'rolledback') => void;
}

export class MockIdempotencyStore {
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
    if (tx.staged.has(k)) {
      tx.staged.set(k, { ...row, ...args.data });
    } else {
      tx.staged.set(k, { ...row, ...args.data, id: row.id });
      this.committedRows.delete(k);
    }
    return { count: 1 };
  }

  async deleteMany(
    args: { where: { id: string } },
    tx: Tx,
  ): Promise<{ count: number }> {
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

/**
 * Prisma-shaped mock whose `$transaction` emulates Postgres transaction +
 * unique-index semantics for `IdempotencyRecord`.
 *
 * `extraModels(tx)` lets a spec attach additional model delegates to the
 * transaction client (business code that reads `tx.*` directly), e.g. the
 * goods-receipt flow reads `tx.warehouse` / `tx.purchaseOrderItem`.
 */
export function createMockPrisma(
  store: MockIdempotencyStore,
  extraModels?: (tx: Record<string, unknown>) => void,
): { prisma: Record<string, any> } {
  const prisma: Record<string, any> = {
    idempotencyRecord: {
      findUnique: jest.fn((args: { where: any }) =>
        store.committedFind(args?.where),
      ),
      deleteMany: jest.fn((args: { where: { expiresAt: { lt: Date } } }) =>
        store.committedDeleteExpired(args.where.expiresAt.lt),
      ),
    },
    $transaction: jest.fn(async (cb: (tx: any) => Promise<unknown>) => {
      const tx = store.beginTransaction();
      const txClient: Record<string, unknown> = {
        idempotencyRecord: {
          createMany: jest.fn((args: any) => store.createMany(args.data, tx)),
          findUnique: jest.fn((args: any) => store.findUnique(args.where, tx)),
          updateMany: jest.fn((args: any) => store.updateMany(args, tx)),
          deleteMany: jest.fn((args: any) => store.deleteMany(args, tx)),
        },
      };
      if (extraModels) extraModels(txClient);
      try {
        const result = await cb(txClient);
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
