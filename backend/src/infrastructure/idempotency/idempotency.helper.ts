import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyClient } from './idempotency.types';

/**
 * Result of a mutation routed through `runWithIdempotency`.
 *
 * `body` is the response body to be serialized by the controller. On a replay
 * it is the JSON stored in `IdempotencyRecord.responseBody`; on a fresh
 * execution it is whatever `work` returned (the business entity). Because
 * `complete` round-trips the body through JSON before storing it, both paths
 * produce the exact same wire representation.
 */
export interface IdempotencyRunResult {
  status: number;
  body: unknown;
}

export interface RunWithIdempotencyOptions {
  /** The application's plain (non-transactional) Prisma client. */
  prisma: PrismaService;
  /** The Phase-F1 `IdempotencyService` (reserve/complete/hash). */
  idempotency: IdempotencyService;
  /** Tenant scope of the reservation (from the authenticated JWT). */
  companyId: string;
  /**
   * HTTP `Idempotency-Key` header value. When absent the endpoint keeps its
   * legacy behaviour: the mutation runs in a plain transaction and NO
   * IdempotencyRecord is written.
   */
  idempotencyKey?: string;
  /** Stable endpoint identifier stored in `IdempotencyRecord.endpoint`. */
  endpoint: string;
  /**
   * Every input that changes the business effect — the request body plus
   * relevant query/path params (e.g. `warehouseId`) and the acting user.
   * Same key + different hash  => HTTP 422 (enforced by the F1 layer).
   */
  requestHashPayload: unknown;
  /** HTTP status of the successful first execution (also used for replies). */
  status: number;
  /**
   * The business mutation. MUST perform every write through the `tx` client
   * it receives and return the response body that should be replayed later.
   */
  work: (tx: IdempotencyClient) => Promise<unknown>;
}

/**
 * Phase F2 — shared idempotency orchestration for POST mutations.
 *
 * A SINGLE Prisma interactive transaction is opened by this helper for the
 * keyed path:
 *
 *   reserve(tx) ──► replay exists ? return stored { status, body }
 *                ──► pending ? throw 409 Conflict
 *                ──► work(tx) ──► complete(tx, status, body) ──► commit
 *
 * The reservation INSERT, the business writes and the saved response commit
 * (or roll back) atomically — the forbidden
 * `business commit → IdempotencyRecord` gap cannot occur, and a business
 * failure rolls the reservation back together with the effect, so a retry
 * after an error starts clean.
 *
 * The no-key path is byte-for-byte the legacy behaviour: the same `work`
 * runs inside its own transaction and no IdempotencyRecord is touched.
 */
export async function runWithIdempotency(
  options: RunWithIdempotencyOptions,
): Promise<IdempotencyRunResult> {
  const {
    prisma,
    idempotency,
    companyId,
    idempotencyKey,
    endpoint,
    requestHashPayload,
    status,
    work,
  } = options;

  // Legacy path: no idempotency key → existing behaviour must not change.
  // The mutation still runs inside one transaction (same atomicity contract).
  if (!idempotencyKey) {
    const body = await prisma.$transaction((tx) => work(tx));
    return { status, body };
  }

  return prisma.$transaction(async (tx) => {
    const reservation = await idempotency.reserve(tx, {
      companyId,
      idempotencyKey,
      endpoint,
      requestHash: idempotency.hashRequest(requestHashPayload),
    });

    // Fast path: a completed result for this exact key+payload exists.
    if (reservation.type === 'replayed') {
      return { status: reservation.status, body: reservation.body };
    }

    // A competing request still holds the reservation. The current
    // transaction rolls back with nothing committed and the caller answers
    // 409 (matches the F1 pending semantics).
    if (reservation.type === 'pending') {
      throw new ConflictException(
        `Request with idempotency key '${idempotencyKey}' is already being processed`,
      );
    }

    // `created`: this transaction owns the reservation — run the business
    // mutation on the SAME transaction client, then persist the response.
    const body = await work(tx);
    await idempotency.complete(tx, companyId, idempotencyKey, status, body);
    return { status, body };
  });
}
