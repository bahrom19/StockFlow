import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma';
import {
  CustomerCreditLedgerRepository,
  PrismaTx,
} from '../repositories/customer-credit-ledger.repository';

/**
 * G11-F2 R2-1 remediation — repository SQL contract tests.
 *
 * The never-negative balance guard MUST execute as TWO separate awaited
 * `$queryRaw` statements on the SAME transaction-bound client:
 *
 *   statement 1: SELECT pg_advisory_xact_lock(hashtext(key))
 *   statement 2: INSERT … SELECT … WHERE balance >= amount RETURNING *
 *
 * A single parameterized multi-statement `$queryRaw` cannot execute over
 * PostgreSQL's extended protocol (`cannot insert multiple commands into a
 * prepared statement` — R2-1 P1), and a single-statement CTE variant would
 * take its READ COMMITTED snapshot BEFORE the lock wait. These tests pin
 * the executable two-statement shape; they do NOT claim to prove
 * PostgreSQL concurrency — that requires a DB-backed integration harness
 * (known gap, see the remediation report).
 */

interface RecordedCall {
  tx: PrismaTx;
  sql: string;
  values: unknown[];
}

/** Call recorder. The implementation records EVERY invocation (sql +
 * bound values) and serves optional queued results — the repository
 * awaits each raw call before issuing the next, so the recorded order IS
 * the execution order (single-threaded awaited chain). */
function makeTx(): PrismaTx & {
  __calls: RecordedCall[];
  __queue: unknown[];
  __values: unknown[][];
} {
  const calls: RecordedCall[] = [];
  const queue: unknown[] = [];
  const values: unknown[][] = [];
  const tx = {
    __calls: calls,
    __queue: queue,
    __values: values,
    $queryRaw: jest.fn(
      (chunks: TemplateStringsArray, ...bound: unknown[]): Promise<unknown[]> => {
        calls.push({ tx: tx as unknown as PrismaTx, sql: chunks.join('?'), values: bound });
        values.push(bound);
        const next = queue.shift();
        return Promise.resolve(next === undefined ? [] : (next as unknown[]));
      },
    ),
  };
  return tx as unknown as PrismaTx & {
    __calls: RecordedCall[];
    __queue: unknown[];
    __values: unknown[][];
  };
}

const companyId = '11111111-1111-1111-1111-111111111111';
const customerId = '22222222-2222-2222-2222-222222222222';
const saleId = '33333333-3333-3333-3333-333333333333';

describe('CustomerCreditLedgerRepository — R2-1 two-statement guard contract', () => {
  // The guarded paths execute through the caller's tx client only — the
  // injected PrismaService is never touched by them, an empty stub suffices.
  const repo = new CustomerCreditLedgerRepository({} as unknown as PrismaService);

  it('atomicSpend: lock statement runs FIRST, guarded INSERT second, same tx', async () => {
    const tx = makeTx();
    const row = { id: 'r1' };
    tx.__queue.push([[{ acquired: 1 }]], [row]);

    const result = await repo.atomicSpend(tx, companyId, {
      saleId,
      customerId,
      currency: 'KZT' as never,
      amount: new Prisma.Decimal('70.0000'),
      createdBy: 'user-1',
    });

    expect(result).toEqual(row as never);
    expect(tx.__calls).toHaveLength(2);

    const lock = tx.__calls[0]!;
    const insert = tx.__calls[1]!;
    expect(lock.sql).toContain('pg_advisory_xact_lock');
    expect(lock.sql).not.toContain('INSERT INTO');
    expect(lock.tx).toBe(tx);

    expect(insert.sql).toContain('INSERT INTO "CustomerCreditTransaction"');
    expect(insert.sql).toContain('RETURNING *');
    expect(insert.sql).toContain("t.\"direction\" = 'ISSUED'");
    expect(insert.sql).not.toContain('pg_advisory_xact_lock');
    expect(insert.tx).toBe(tx);
  });

  it('atomicSpend: guard key is the deterministic (companyId, customerId, currency)', async () => {
    const tx = makeTx();

    await repo.atomicSpend(tx, companyId, {
      saleId,
      customerId,
      currency: 'USD' as never,
      amount: new Prisma.Decimal('10'),
      createdBy: 'user-1',
    });

    const lockSql = tx.__calls[0]!.sql;
    // hashtext over the composite key — currency and both ids participate
    expect(lockSql).toContain('hashtext(');
    // the three key components are the first three bound parameters
    expect(tx.__values[0]).toEqual([companyId, customerId, 'USD']);
  });

  it('atomicSpend: zero inserted rows → null (insufficient balance contract)', async () => {
    const tx = makeTx();
    // empty queue → every raw call yields zero rows

    const result = await repo.atomicSpend(tx, companyId, {
      saleId,
      customerId,
      currency: 'KZT' as never,
      amount: new Prisma.Decimal('70.0000'),
      createdBy: 'user-1',
    });

    expect(result).toBeNull();
    // both statements were still issued, lock first
    expect(tx.__calls).toHaveLength(2);
    expect(tx.__calls[0]!.sql).toContain('pg_advisory_xact_lock');
    expect(tx.__calls[1]!.sql).toContain('INSERT INTO');
  });

  it('createManualAdjustment (ADJUSTED): same two-statement guard, self-referencing id', async () => {
    const tx = makeTx();
    const createdRow = { id: 'adj-row-1' };
    tx.__queue.push([[{ acquired: 1 }]], [createdRow]);

    const result = await repo.createManualAdjustment(tx, companyId, {
      customerId,
      currency: 'KZT' as never,
      amount: new Prisma.Decimal('70.0000'),
      direction: 'ADJUSTED',
      reason: 'write-off',
      createdBy: 'user-1',
    });

    expect(result).toEqual(createdRow as never);
    expect(tx.__calls).toHaveLength(2);
    expect(tx.__calls[0]!.sql).toContain('pg_advisory_xact_lock');
    // direction/referenceType travel as bound parameters — assert the values
    const insertValues = tx.__values[1]!;
    expect(insertValues[3]).toBe('ADJUSTED'); // direction param
    expect(insertValues[6]).toBe('MANUAL_ADJUSTMENT'); // referenceType param
    // self-reference: the SAME application-generated id is bound as both
    // the row id (explicitId) and its referenceId inside the guarded INSERT
    expect(insertValues[0]).toBe(insertValues[7]); // explicitId === referenceId
  });

  it('createManualAdjustment (ADJUSTED): zero rows → null (no overdraw)', async () => {
    const tx = makeTx();

    const result = await repo.createManualAdjustment(tx, companyId, {
      customerId,
      currency: 'KZT' as never,
      amount: new Prisma.Decimal('100.0000'),
      direction: 'ADJUSTED',
      reason: 'overdraw attempt',
      createdBy: 'user-1',
    });

    expect(result).toBeNull();
    expect(tx.__calls).toHaveLength(2);
  });

  it('createManualAdjustment (ISSUED): plain insert, NO advisory lock', async () => {
    const tx = {
      $queryRaw: jest.fn(),
      customerCreditTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'issued-1' }),
      },
    } as unknown as PrismaTx & {
      customerCreditTransaction: { create: jest.Mock };
    };

    const result = await repo.createManualAdjustment(tx, companyId, {
      customerId,
      currency: 'KZT' as never,
      amount: new Prisma.Decimal('25.0000'),
      direction: 'ISSUED',
      reason: 'goodwill top-up',
      createdBy: 'user-1',
    });

    expect(result).toEqual({ id: 'issued-1' } as never);
    expect(tx.customerCreditTransaction.create).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('issueRefundCredit: plain create, NO advisory lock (ISSUED never serialized)', async () => {
    const tx = {
      customerCreditTransaction: {
        create: jest.fn().mockResolvedValue({ id: 'issued-2' }),
      },
    } as unknown as PrismaTx & {
      customerCreditTransaction: { create: jest.Mock };
    };

    await repo.issueRefundCredit(tx, companyId, {
      allocationId: 'alloc-1',
      refundId: 'refund-1',
      customerId,
      currency: 'KZT' as never,
      amount: new Prisma.Decimal('80.0000'),
      createdBy: 'user-1',
    });

    expect(tx.customerCreditTransaction.create).toHaveBeenCalledTimes(1);
    const data = tx.customerCreditTransaction.create.mock.calls[0][0].data;
    expect(data.direction).toBe('ISSUED');
    expect(data.referenceType).toBe('REFUND_ALLOCATION');
  });
});
