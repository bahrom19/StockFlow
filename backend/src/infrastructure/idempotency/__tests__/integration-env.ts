/**
 * Snapshot of `DATABASE_URL` captured in a module with ZERO imports.
 *
 * Importing `@prisma/client` (directly or via the service chain) loads the
 * project's `.env` and overwrites `process.env.DATABASE_URL`. Importing this
 * file FIRST in an integration spec guarantees the snapshot reflects the
 * actual shell/CI environment before any Prisma side effect can run.
 */
export const integrationDatabaseUrl = process.env.DATABASE_URL;
export const hasIntegrationDatabase = Boolean(process.env.DATABASE_URL);
