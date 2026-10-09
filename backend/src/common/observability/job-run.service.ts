import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma';
import { JobRunStatus } from '@prisma/client';

/** Max stored error length; matches the column's VarChar(500). */
const MAX_ERROR_LENGTH = 500;

/**
 * Closed vocabulary for why an execution did NOT run (G16-L-2C-3), stored
 * verbatim in JobRun.skipReason. Structurally identical to RedisService's
 * LockSkipReason — declared here so observability does not depend on the
 * infrastructure/cache layer. Never extended with free-form/raw Redis errors.
 */
export type JobSkipReason =
  | 'LOCK_CONTENDED'
  | 'REDIS_UNAVAILABLE'
  | 'REDIS_ERROR';

/**
 * Durable, non-authoritative observability for scheduled/background jobs.
 *
 * Contract (G16-L-2 design audit, G16-L-2A):
 *  - JobRun is NEVER a source of truth for business state. Nothing in billing,
 *    maintenance or notifications reads it to decide what to do.
 *  - Every method swallows its own errors. Observability must not be able to
 *    abort, delay or partially undo the business operation it observes, so a
 *    database problem here degrades to a log line and nothing more.
 *  - No tenant scoping and no payment/financial data. `errorMessage` is a
 *    truncated, operator-safe summary — never a serialized exception object.
 */
@Injectable()
export class JobRunService {
  private readonly logger = new Logger(JobRunService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record the start of a run. Returns the new JobRun id, or null when the
   * row could not be written (observability failure must not stop the job).
   */
  async start(jobName: string): Promise<string | null> {
    try {
      const run = await this.prisma.jobRun.create({
        data: { jobName, status: JobRunStatus.RUNNING },
        select: { id: true },
      });
      return run.id;
    } catch (error) {
      this.logger.warn(
        `JobRun start failed for "${jobName}" (continuing): ${this.describe(error)}`,
      );
      return null;
    }
  }

  /**
   * Mark a run as finished. `runId` may be null (start failed or the caller
   * has no id) — that is a no-op, not an error.
   */
  async finish(
    runId: string | null,
    // `typeof X.Y` is required here: Prisma emits enums as const objects, so a
    // bare qualified name (JobRunStatus.SUCCEEDED) is not a valid type.
    status: typeof JobRunStatus.SUCCEEDED | typeof JobRunStatus.FAILED,
    options: {
      error?: unknown;
      processed?: number;
      succeeded?: number;
      failed?: number;
    } = {},
  ): Promise<void> {
    if (!runId) return;

    const finishedAt = new Date();
    try {
      const existing = await this.prisma.jobRun.findUnique({
        where: { id: runId },
        select: { startedAt: true },
      });

      await this.prisma.jobRun.update({
        where: { id: runId },
        data: {
          status,
          finishedAt,
          durationMs: existing
            ? finishedAt.getTime() - existing.startedAt.getTime()
            : null,
          errorMessage:
            status === JobRunStatus.FAILED
              ? this.truncate(this.describe(options.error))
              : null,
          processed: options.processed,
          succeeded: options.succeeded,
          failed: options.failed,
        },
      });
    } catch (error) {
      this.logger.warn(
        `JobRun finish failed for run ${runId} (continuing): ${this.describe(error)}`,
      );
    }
  }

  /**
   * Record an execution that never ran because its distributed lock could not
   * be acquired (G16-L-2C): a single terminal SKIPPED row with
   * startedAt = finishedAt = now and durationMs = 0. The caller then returns
   * without executing the business operation.
   *
   * Best-effort, like every other method here: a failed write degrades to a
   * log line and NEVER propagates — the cron/business operation must not
   * break because observability could not record that it was skipped.
   */
  async skip(jobName: string, reason: JobSkipReason): Promise<void> {
    const now = new Date();
    try {
      await this.prisma.jobRun.create({
        data: {
          jobName,
          status: JobRunStatus.SKIPPED,
          startedAt: now,
          finishedAt: now,
          durationMs: 0,
          errorMessage: null,
          skipReason: reason,
        },
        select: { id: true },
      });
    } catch (error) {
      this.logger.warn(
        `JobRun skip failed for "${jobName}" (continuing): ${this.describe(error)}`,
      );
    }
  }

  /**
   * Truncate an unknown error into a concise, operator-safe string.
   * Never returns a serialized exception object or a payment payload.
   */
  private describe(error: unknown): string {
    if (error === undefined || error === null) return 'Unknown error';
    if (typeof error === 'string') return error;
    if (error instanceof Error) {
      return error.name && error.message
        ? `${error.name}: ${error.message}`
        : error.message;
    }
    return 'Non-error value thrown';
  }

  private truncate(message: string): string {
    return message.length <= MAX_ERROR_LENGTH
      ? message
      : `${message.slice(0, MAX_ERROR_LENGTH - 3)}...`;
  }
}
