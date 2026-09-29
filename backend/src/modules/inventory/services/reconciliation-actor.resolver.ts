import { UserStatus } from '@prisma/client';

/**
 * G16-J-R1 — reconciliation audit-actor resolution (P0 remediation).
 *
 * G16-I-3 passed the non-UUID literal 'reconciliation-runner' as the AuditLog
 * actor. `AuditLog.userId` is a PostgreSQL `uuid` column with an FK to
 * `User.id`, so every apply transaction failed (22P02 / FK) and rolled back —
 * `--apply` could never succeed.
 *
 * The actor is now an EXPLICIT, pre-validated reference to a real User row,
 * supplied by the operator via STOCKFLOW_RECONCILIATION_ACTOR_USER_ID.
 *
 * Fail-closed guarantees (enforced BEFORE any write transaction is opened):
 *  - the environment variable must be present and non-blank;
 *  - it must be a UUID (arbitrary strings such as 'reconciliation-runner' are
 *    rejected — no silent UUID coercion);
 *  - the referenced User must exist and not be soft-deleted;
 *  - the User must be ACTIVE (status ACTIVE and isActive = true);
 *  - this module NEVER creates or mutates a User — it only reads.
 *
 * Tenant note: `User` is not company-scoped (company access is modelled
 * through `CompanyMember`) and `AuditLog` carries no composite
 * (userId, companyId) constraint — `AuditLog_userId_fkey` and
 * `AuditLog_companyId_fkey` are independent. `AuditLogService` performs no
 * tenancy validation on `userId`. A single validated actor may therefore be
 * legally recorded for reconciliation rows of many companies, consistent with
 * the existing audit architecture.
 */
export const RECONCILIATION_ACTOR_ENV_VAR =
  'STOCKFLOW_RECONCILIATION_ACTOR_USER_ID';

export type ReconciliationActorErrorCode =
  | 'MISSING'
  | 'INVALID'
  | 'NOT_FOUND'
  | 'INACTIVE';

/** Typed, fail-fast actor-resolution failure (never a silent fallback). */
export class ReconciliationActorResolutionError extends Error {
  constructor(
    readonly code: ReconciliationActorErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ReconciliationActorResolutionError';
  }
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Minimal structural view of the Prisma surface required here. Kept narrow so
 * the resolver stays read-only by construction and is trivially mockable.
 */
export interface ReconciliationActorReader {
  user: {
    findFirst(args: {
      where: { id: string; deletedAt: null };
      select: { id: true; isActive: true; status: true };
    }): Promise<{
      id: string;
      isActive: boolean;
      status: UserStatus;
    } | null>;
  };
}

/**
 * Resolve the reconciliation audit actor to a real, ACTIVE `User.id`.
 * Throws {@link ReconciliationActorResolutionError} on any invalid input —
 * callers must abort before opening a write transaction.
 */
export async function resolveReconciliationActor(
  prisma: ReconciliationActorReader,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const raw = env[RECONCILIATION_ACTOR_ENV_VAR];
  if (raw === undefined || raw.trim() === '') {
    throw new ReconciliationActorResolutionError(
      'MISSING',
      `${RECONCILIATION_ACTOR_ENV_VAR} is not set. Set it to the UUID of an existing, ACTIVE StockFlow user to be recorded as the reconciliation actor.`,
    );
  }

  const candidate = raw.trim();
  if (!UUID_PATTERN.test(candidate)) {
    throw new ReconciliationActorResolutionError(
      'INVALID',
      `${RECONCILIATION_ACTOR_ENV_VAR} must be a UUID (got ${JSON.stringify(
        candidate,
      )}). Arbitrary strings are rejected: AuditLog.userId is a uuid column with a foreign key to User.id.`,
    );
  }

  const user = await prisma.user.findFirst({
    where: { id: candidate, deletedAt: null },
    select: { id: true, isActive: true, status: true },
  });

  if (user === null) {
    throw new ReconciliationActorResolutionError(
      'NOT_FOUND',
      `${RECONCILIATION_ACTOR_ENV_VAR}=${candidate} does not reference an existing, non-deleted User. No user is created automatically.`,
    );
  }

  if (!user.isActive || user.status !== UserStatus.ACTIVE) {
    throw new ReconciliationActorResolutionError(
      'INACTIVE',
      `${RECONCILIATION_ACTOR_ENV_VAR}=${candidate} references a User that is not ACTIVE (status=${user.status}, isActive=${user.isActive}).`,
    );
  }

  // Return the DB-canonical id (never the raw env string).
  return user.id;
}
