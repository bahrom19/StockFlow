import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IdempotencyService } from '../idempotency.service';
import { runWithIdempotency } from '../idempotency.helper';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  IDEMPOTENCY_PENDING_BODY,
  IDEMPOTENCY_PENDING_STATUS,
  IDEMPOTENCY_TTL_MS,
} from '../idempotency.constants';
import {
  MockIdempotencyStore,
  createMockPrisma,
} from './idempotency.test-store';

const companyId = 'comp-1';
const endpoint = 'cash-in';

/**
 * Phase F2 — the shared `runWithIdempotency` orchestration.
 *
 * These tests exercise the REAL `IdempotencyService` against an in-memory
 * emulation of Postgres' unique-index concurrency semantics, proving that the
 * helper satisfies the reserve → replay/pending → work → complete → commit
 * contract for EVERY wired endpoint (the endpoints share this helper).
 */
describe('runWithIdempotency (Phase F2 shared orchestration)', () => {
  let store: MockIdempotencyStore;
  let prisma: ReturnType<typeof createMockPrisma>['prisma'];
  let service: IdempotencyService;

  const runner = (
    overrides: Partial<Parameters<typeof runWithIdempotency>[0]> = {},
  ) =>
    runWithIdempotency({
      prisma: prisma as unknown as PrismaService,
      idempotency: service,
      companyId,
      endpoint,
      requestHashPayload: { amount: 100, warehouseId: 'wh-1', userId: 'u-1' },
      status: 200,
      work: async () => ({ done: true }),
      ...overrides,
    });

  beforeEach(() => {
    store = new MockIdempotencyStore();
    prisma = createMockPrisma(store).prisma;
    service = new IdempotencyService(prisma as unknown as PrismaService);
  });

  it('runs the legacy path untouched when no Idempotency-Key is provided', async () => {
    const work = jest.fn(async () => ({ ok: 'legacy' }));
    const result = await runner({ idempotencyKey: undefined, work });

    expect(result).toEqual({ status: 200, body: { ok: 'legacy' } });
    expect(work).toHaveBeenCalledTimes(1);
    expect(store.size()).toBe(0); // no IdempotencyRecord written
  });

  it('creates a reservation, runs the mutation once and replays the same response', async () => {
    const work = jest.fn(async () => ({ id: 'shift-1', cashIn: '5' }));
    const first = await runner({ idempotencyKey: 'k1', work });
    const second = await runner({ idempotencyKey: 'k1', work });

    expect(first).toEqual({
      status: 200,
      body: { id: 'shift-1', cashIn: '5' },
    });
    expect(second).toEqual(first); // identical response on replay
    expect(work).toHaveBeenCalledTimes(1); // business effect exactly once
  });

  it('throws 422 when the same key is reused with a different payload', async () => {
    await runner({ idempotencyKey: 'k2', work: async () => ({ a: 1 }) });
    await expect(
      runner({
        idempotencyKey: 'k2',
        requestHashPayload: { amount: 999, warehouseId: 'wh-1', userId: 'u-1' },
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rolls the reservation back with the business write on failure, so a retry can run again', async () => {
    const work = jest
      .fn()
      .mockRejectedValueOnce(new Error('business failure'))
      .mockResolvedValueOnce({ id: 'shift-2', cashIn: '5' });

    await expect(runner({ idempotencyKey: 'k3', work })).rejects.toThrow(
      'business failure',
    );
    expect(store.size()).toBe(0); // no orphaned IdempotencyRecord

    const retry = await runner({ idempotencyKey: 'k3', work });
    expect(retry).toEqual({
      status: 200,
      body: { id: 'shift-2', cashIn: '5' },
    });
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('runs the business mutation exactly once for two concurrent duplicate requests', async () => {
    const slowWork = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { id: 'shift-3', cashIn: '5' };
    });
    const fastWork = jest.fn(async () => {
      throw new Error('must not run a second time');
    });

    const results = await Promise.allSettled([
      runner({ idempotencyKey: 'k4', work: slowWork }),
      runner({ idempotencyKey: 'k4', work: fastWork }),
    ]);

    const fulfilled = results.map((r) =>
      r.status === 'fulfilled' ? r.value : null,
    );
    expect(fulfilled.filter((v) => v !== null)).toHaveLength(2);
    expect(fulfilled[0]).toEqual(fulfilled[1]); // loser replays the winner's body
    expect(slowWork).toHaveBeenCalledTimes(1);
    expect(fastWork).not.toHaveBeenCalled();
  });

  it('answers 409 Conflict for a committed-but-incomplete (pending) reservation', async () => {
    const hash = service.hashRequest({
      amount: 100,
      warehouseId: 'wh-1',
      userId: 'u-1',
    });
    store.seedCommitted({
      id: 'rec-pending',
      companyId,
      idempotencyKey: 'k5',
      endpoint,
      requestHash: hash,
      responseStatus: IDEMPOTENCY_PENDING_STATUS,
      responseBody: IDEMPOTENCY_PENDING_BODY,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
      createdAt: new Date(),
    });

    const work = jest.fn(async () => ({ ok: true }));
    await expect(runner({ idempotencyKey: 'k5', work })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(work).not.toHaveBeenCalled();
  });

  it('preserves the configured status on both the first run and the replay', async () => {
    const result = await runner({
      idempotencyKey: 'k6',
      status: 201,
      work: async () => ({ created: true }),
    });
    expect(result.status).toBe(201);
    const replay = await runner({
      idempotencyKey: 'k6',
      status: 201,
      work: async () => ({ shouldNotRun: true }),
    });
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual({ created: true });
  });
});
