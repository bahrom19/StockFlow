-- G16-L-2A: durable cron/background-job run observability.
--
-- Adds a single operational table, `JobRun`, plus the `JobRunStatus` enum.
-- It records one row per successful lock acquisition of a scheduled job so
-- that a missed, doubled, or failed run is observable AFTER THE FACT.
--
-- Design constraints (G16-L-2 design audit):
--   * JobRun is NOT the source of truth for billing or maintenance state.
--     It is purely observational. Nothing in the billing/maintenance
--     modules reads it to decide what to do.
--   * JobRun is system-level operational data, NOT tenant data. It is
--     therefore intentionally NOT scoped by companyId and is never exposed
--     through a public API in this workstream.
--   * No Payment/financial/customer data is stored here. errorMessage is
--     a truncated, operator-safe summary written by the service; a
--     serialized exception object is never persisted.
--
-- A run abandoned by a process crash keeps status = RUNNING with a NULL
-- finishedAt. This workstream deliberately introduces NO automatic stale-run
-- repair: a RUNNING row older than a threshold is an alertable signal for
-- operators, and auto-expiring it would erase the very evidence the table
-- exists to preserve.
--
-- Indexes are limited to the two operational access paths that are actually
-- used: "latest runs of job X" and "currently running / recently failed".
-- No speculative indexes are added.

-- CreateEnum
CREATE TYPE "JobRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "JobRun" (
    "id" UUID NOT NULL,
    "jobName" VARCHAR(100) NOT NULL,
    "status" "JobRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "errorMessage" VARCHAR(500),
    "processed" INTEGER,
    "succeeded" INTEGER,
    "failed" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobRun_jobName_startedAt_idx" ON "JobRun"("jobName", "startedAt");

-- CreateIndex
CREATE INDEX "JobRun_status_startedAt_idx" ON "JobRun"("status", "startedAt");
