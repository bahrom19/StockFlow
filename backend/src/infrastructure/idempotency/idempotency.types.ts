import { Prisma } from '@prisma/client';

/**
 * Phase F1 — idempotency layer types.
 *
 * The low-level API (`reserve` / `complete`) accepts the SAME
 * `Prisma.TransactionClient` the caller received from `$transaction`, so the
 * idempotency reservation, the business mutation and the saved response are
 * committed (or rolled back) atomically in a single database transaction.
 */
export type IdempotencyClient = Prisma.TransactionClient;

export interface IdempotencyReserveParams {
  companyId: string;
  idempotencyKey: string;
  endpoint: string;
  requestHash: string;
  /** Override for the 24h default (used by tests / expiry forcing). */
  expiresAt?: Date;
  /** Clock override (defaults to `new Date()`). */
  now?: Date;
}

export type IdempotencyReserveResult =
  | { type: 'created'; requestHash: string }
  | { type: 'pending' }
  | { type: 'replayed'; status: number; body: unknown };

export interface IdempotencyReplayResult {
  status: number;
  body: unknown;
}

export interface IdempotencyExecuteParams {
  companyId: string;
  idempotencyKey: string;
  endpoint: string;
  requestBody: unknown;
  /** Override for the 24h default (used by tests / expiry forcing). */
  expiresAt?: Date;
  /** Clock override (defaults to `new Date()`). */
  now?: Date;
}

export interface IdempotencyHandlerResult {
  status: number;
  body?: unknown;
}

export type IdempotencyExecuteResult =
  | { type: 'completed'; status: number; body: unknown }
  | { type: 'pending' }
  | { type: 'replayed'; status: number; body: unknown };
