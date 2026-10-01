-- G16-L-2C-3: JobRun observability for executions that never ran.
--
-- ADDS a terminal SKIPPED outcome plus a closed-vocabulary skipReason, so a
-- cron run that was skipped (lock contention, or Redis unavailable/error under
-- the fail-closed policy) is no longer invisible.
--
-- Add-only. No column is dropped or retyped, no existing row is rewritten, and
-- no index changes: the existing (status, startedAt) index already serves the
-- "currently running / recently failed" lookup, and the new status reuses it.
--
-- PostgreSQL note (gate check before implementation): ALTER TYPE ... ADD VALUE
-- is transaction-safe from PostgreSQL 12 onward; production is 16.14. This repo
-- also already ships the identical pattern in
-- 20260805120000_add_payment_method_analytics (ADD VALUE + ALTER TABLE in one
-- Prisma migration), so the statement follows established project convention.
--
-- ADD VALUE appends, so RUNNING/SUCCEEDED/FAILED keep their existing ordinals.

-- AlterEnum
ALTER TYPE "JobRunStatus" ADD VALUE 'SKIPPED';

-- AlterTable
ALTER TABLE "JobRun" ADD COLUMN "skipReason" VARCHAR(32);
