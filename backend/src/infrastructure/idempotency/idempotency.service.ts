import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../common/prisma';
import {
  IDEMPOTENCY_PENDING_BODY,
  IDEMPOTENCY_PENDING_STATUS,
  IDEMPOTENCY_TTL_MS,
} from './idempotency.constants';
import {
  IdempotencyClient,
  IdempotencyExecuteParams,
  IdempotencyExecuteResult,
  IdempotencyHandlerResult,
  IdempotencyReplayResult,
  IdempotencyReserveParams,
  IdempotencyReserveResult,
} from './idempotency.types';

/**
 * Stable canonical JSON serialization.
 *
 * Key order is sorted and whitespace is normalized so that two requests that
 * carry the same logical payload produce the same SHA-256 `requestHash`
 * regardless of how the client ordered JSON keys. `undefined` is normalized
 * to `null` (it is not valid JSON object output anyway).
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined || typeof value !== 'object') {
    return JSON.stringify(value === undefined ? null : value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const parts = keys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`,
  );
  return `{${parts.join(',')}}`;
}

/**
 * Phase F1 — DB-backed idempotency infrastructure.
 *
 * Atomicity model
 * ---------------
 * The reservation INSERT is performed INSIDE the business transaction via the
 * `Prisma.TransactionClient` passed by the caller (`reserve`). The unique
 * index on `(companyId, idempotencyKey)` acts as a database-level mutex:
 *   - a second concurrent transaction that tries to insert the same key
 *     BLOCKS on the index until the first transaction commits or rolls back;
 *   - after the first commit it gets a unique-violation (P2002) and replays;
 *   - after a rollback/crash nothing was committed, so it inserts normally.
 *
 * Because the reservation row commits (or rolls back) together with the
 * business writes, the forbidden
 * `business commit → IdempotencyRecord` gap cannot occur — there is no
 * separate non-transactional write in this service.
 *
 * Concurrency outcome
 * -------------------
 * Identical key + identical payload after commit        → replay (200 + stored body)
 * Identical key + different payload after commit        → 422 UnprocessableEntityException
 * Identical key while another request is still in flight → `{ type: 'pending' }` (caller → 409)
 * Expired record (TTL 24h)                               → treated as absent, new reservation
 */
@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Expiry instant for a 24h reservation created at `from` (defaults to now). */
  getExpiresAt(from: Date = new Date()): Date {
    return new Date(from.getTime() + IDEMPOTENCY_TTL_MS);
  }

  /**
   * SHA-256 of the normalized request body.
   *
   * Stable across JSON key ordering and formatting; two logically identical
   * payloads always produce the same hash.
   */
  hashRequest(requestBody: unknown): string {
    const canonical = stableStringify(requestBody);
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Reserve a key inside the caller's OWN transaction (Phase 2 integration
   * point):
   *
   * ```ts
   * await prisma.$transaction(async (tx) => {
   *   const reservation = await idempotencyService.reserve(tx, params);
   *   if (reservation.type === 'replayed') return reservation; // fast path
   *   if (reservation.type === 'pending') throw new ConflictException(...);
   *   const result = await businessOperation(tx, ...);          // business mutation
   *   await idempotencyService.complete(tx, companyId, key, result.status, result.body);
   * });
   * ```
   *
   * The INSERT is the first write of the transaction. Returns:
   * - `created`  — this transaction owns the reservation and must do the work;
   * - `replayed` — a committed result for this exact key+payload exists;
   * - `pending`  — another request is still in-flight (caller replies 409).
   */
  async reserve(
    client: IdempotencyClient,
    params: IdempotencyReserveParams,
  ): Promise<IdempotencyReserveResult> {
    const now = params.now ?? new Date();
    const expiresAt = expiresAtFor(params.expiresAt, now);

    // INSERT ... ON CONFLICT DO NOTHING (unique index on companyId + key).
    // This is the reservation: it either wins the row, or — after the
    // competing transaction commits — it observes the existing record. No
    // exception is thrown for a conflict, so the caller transaction never
    // enters Postgres' aborted (25P02) state and can keep issuing queries.
    const created = await client.idempotencyRecord.createMany({
      data: [
        {
          companyId: params.companyId,
          idempotencyKey: params.idempotencyKey,
          endpoint: params.endpoint,
          requestHash: params.requestHash,
          responseStatus: IDEMPOTENCY_PENDING_STATUS,
          responseBody: IDEMPOTENCY_PENDING_BODY,
          expiresAt,
        },
      ],
      skipDuplicates: true,
    });

    if (created.count === 1) {
      return { type: 'created', requestHash: params.requestHash };
    }

    const existing = await client.idempotencyRecord.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId: params.companyId,
          idempotencyKey: params.idempotencyKey,
        },
      },
    });

    // The competing transaction already rolled back between our INSERT and
    // this read — retry the reservation in this same transaction.
    if (!existing) {
      return this.reserve(client, { ...params, expiresAt, now });
    }

    // Expired records are invalid: replace the reservation atomically.
    if (existing.expiresAt.getTime() <= now.getTime()) {
      await client.idempotencyRecord.deleteMany({
        where: { id: existing.id },
      });
      return this.reserve(client, { ...params, expiresAt, now });
    }

    // Same key, different payload — deterministic 422.
    if (existing.requestHash !== params.requestHash) {
      throw new UnprocessableEntityException(
        `Idempotency key '${params.idempotencyKey}' was already used with a different request payload`,
      );
    }

    if (existing.responseStatus === IDEMPOTENCY_PENDING_STATUS) {
      return { type: 'pending' };
    }

    return {
      type: 'replayed',
      status: existing.responseStatus,
      body: existing.responseBody,
    };
  }

  /**
   * Persist the response for a previously created reservation.
   *
   * Guarded by `responseStatus = PENDING` so a completed/committed response
   * is never overwritten by a stale request, and it participates in the
   * caller's transaction (rolls back together with the business writes).
   */
  async complete(
    client: IdempotencyClient,
    companyId: string,
    idempotencyKey: string,
    status: number,
    body: unknown,
  ): Promise<void> {
    await client.idempotencyRecord.updateMany({
      where: {
        companyId,
        idempotencyKey,
        responseStatus: IDEMPOTENCY_PENDING_STATUS,
      },
      data: {
        responseStatus: status,
        responseBody: IdempotencyService.toJson(body),
      },
    });
  }

  /**
   * Read-only replay fast-path (no reservation).
   *
   * Returns the stored `{ status, body }` for a committed, non-expired
   * key+payload, or `null` when the record is absent, expired or in-flight.
   * Use this to short-circuit before opening a transaction; it never
   * validates the request hash, so callers MUST pass it the same payload the
   * original request used (or rely on `execute` / `reserve` for safety).
   */
  async replay(
    companyId: string,
    idempotencyKey: string,
  ): Promise<IdempotencyReplayResult | null> {
    const record = await this.prisma.idempotencyRecord.findUnique({
      where: { companyId_idempotencyKey: { companyId, idempotencyKey } },
    });
    if (!record) return null;
    if (record.expiresAt.getTime() <= Date.now()) return null;
    if (record.responseStatus === IDEMPOTENCY_PENDING_STATUS) return null;
    return { status: record.responseStatus, body: record.responseBody };
  }

  /**
   * High-level convenience: reserve, run `work`, save the response — all in
   * one internal Prisma transaction. Equivalent to the Phase-2 pattern, kept
   * for callers that only need keyed execution without custom tx plumbing.
   */
  async execute(
    params: IdempotencyExecuteParams,
    work: (client: IdempotencyClient) => Promise<IdempotencyHandlerResult>,
  ): Promise<IdempotencyExecuteResult> {
    const requestHash = this.hashRequest(params.requestBody);

    return this.prisma.$transaction(async (tx) => {
      const reservation = await this.reserve(tx, {
        companyId: params.companyId,
        idempotencyKey: params.idempotencyKey,
        endpoint: params.endpoint,
        requestHash,
        expiresAt: params.expiresAt,
        now: params.now,
      });

      if (reservation.type === 'replayed') {
        return {
          type: 'replayed',
          status: reservation.status,
          body: reservation.body,
        };
      }
      if (reservation.type === 'pending') {
        return { type: 'pending' };
      }

      const result = await work(tx);
      const status = result.status;
      const body: unknown = result.body ?? null;
      await this.complete(
        tx,
        params.companyId,
        params.idempotencyKey,
        status,
        body,
      );
      return { type: 'completed', status, body };
    });
  }

  /**
   * Delete all expired records. Returns the number of deleted rows.
   *
   * Phase F1 keeps this as an invocable operation rather than a dedicated
   * scheduler: the only existing scheduler (`@nestjs/schedule`) lives inside
   * the billing module, and wiring infra cleanup into a business module would
   * be the wrong dependency direction. Operations can run this on a host
   * cron, or a future global scheduler can call it.
   */
  async cleanupExpired(now: Date = new Date()): Promise<number> {
    const result = await this.prisma.idempotencyRecord.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return result.count;
  }

  /**
   * Normalize an arbitrary response into a JSONB-safe value.
   *
   * `null`/`undefined` → `null` (per requirement 10). Anything else is
   * round-tripped through JSON so Dates serialize to ISO strings and
   * non-JSON members (e.g. Prisma.Decimal, which implements `toJSON`)
   * become plain JSON — matching exactly what will be replayed later, since
   * the database is the single source of truth.
   */
  private static toJson(
    body: unknown,
  ): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
    if (body === null || body === undefined) return Prisma.DbNull;
    return JSON.parse(JSON.stringify(body)) as Prisma.InputJsonValue;
  }
}

function expiresAtFor(override: Date | undefined, now: Date): Date {
  return override ?? new Date(now.getTime() + IDEMPOTENCY_TTL_MS);
}
