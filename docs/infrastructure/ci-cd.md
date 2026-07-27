# 🚀 StockFlow Enterprise — CI/CD Architecture

**Date**: July 25, 2026  
**Status**: Production-ready  
**Stack**: GitHub Actions + Docker + PostgreSQL + Node.js 22

---

## Table of Contents

1. [Pipeline Overview](#1-pipeline-overview)
2. [Trigger Configuration](#2-trigger-configuration)
3. [Stage Breakdown](#3-stage-breakdown)
4. [Infrastructure Dependencies](#4-infrastructure-dependencies)
5. [Integration Test Database](#5-integration-test-database)
6. [Coverage Reporting](#6-coverage-reporting)
7. [Docker Build Strategy](#7-docker-build-strategy)
8. [Branch Protection](#8-branch-protection)
9. [Local Development Workflow](#9-local-development-workflow)
10. [Troubleshooting](#10-troubleshooting)
11. [Future Improvements](#11-future-improvements)

---

## 1. Pipeline Overview

The CI/CD pipeline is defined in `.github/workflows/ci.yml` and consists of **12 sequential stages**. Every stage must pass before the pipeline succeeds.

```
Checkout → Setup Node → Install → Prisma Generate
    → Typecheck → Build → ESLint → Unit Tests
    → Integration Tests → Coverage Upload → npm Audit
    → Circular Dep Check → Prisma Validate
    → Migration Verify → Docker Build → Status ✅
```

Each stage has `continue-on-error: false` (implicit default), meaning the pipeline **halts immediately** on the first failure.

### Concurrency

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

- **group**: Scoped to workflow + branch/PR reference
- **cancel-in-progress**: Automatically cancels in-flight runs for the same PR when a new commit is pushed

---

## 2. Trigger Configuration

| Event | Branches | Purpose |
|-------|----------|---------|
| `push` | `main` | Continuous Integration on merge |
| `pull_request` | `main` | Pre-merge validation |

Both triggers run the **same full pipeline** — no shortcuts for PRs.

To configure branch protection in GitHub:
1. Settings → Branches → Add rule → Branch name pattern: `main`
2. Require status checks before merging
3. Select the `✅ CI Status` check (aggregate job)

---

## 3. Stage Breakdown

### Stage 0: Checkout & Setup

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: '22'
    cache: 'npm'
    cache-dependency-path: ./backend/package-lock.json
```

- `actions/checkout@v4` with default `fetch-depth: 1` (shallow clone)
- npm cache is restored from `package-lock.json` checksum

### Stage 1: Install Dependencies

```bash
npm ci
```

- Uses `npm ci` (not `npm install`) for **deterministic, reproducible installs**
- Reads exact versions from `package-lock.json`
- Halts if `package-lock.json` is out of sync with `package.json`

### Stage 2: Prisma Generate

```bash
npx prisma generate
```

- Generates the Prisma client from `schema.prisma`
- Required before TypeScript compilation
- If this fails, the schema has syntax errors

### Stage 3: TypeScript Build

Two sub-stages:

```bash
npx tsc -p tsconfig.json --noEmit   # Typecheck only (no output)
npm run build                        # nest build (actual compilation)
```

- `--noEmit` catches type errors quickly
- `nest build` catches NestJS-specific compilation issues (circular DI, missing module imports)

### Stage 4: ESLint

```bash
npx eslint "{src,apps,libs,test}/**/*.ts"
```

- Checks code against `@typescript-eslint/recommended` rules
- `@typescript-eslint/no-explicit-any` is configured as **error** — any usage fails the pipeline
- `@typescript-eslint/no-floating-promises` is configured as **error** — unhandled promises fail the pipeline

### Stage 5: Unit Tests

```bash
npx jest --coverage --passWithNoTests
```

- Uses Jest config from `jest.config.js`
- `--coverage` generates coverage reports (Istanbul/nyc format)
- `--passWithNoTests` ensures pipeline doesn't break if a test suite is temporarily empty

### Stage 6: Integration Tests

```bash
npx jest --config jest.integration.config.js --coverage --passWithNoTests
```

- **Requires PostgreSQL** (provided via GitHub Actions `services.postgres`)
- Uses a separate Jest config for integration tests
- `DATABASE_URL` points to the ephemeral PostgreSQL service container

> ⚠️ An integration test Jest config (`jest.integration.config.js`) must be created in the project root. See [Integration Test Database](#5-integration-test-database).

### Stage 7: Coverage Report

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: coverage-report
    path: ./backend/coverage/
```

- Uploads the `coverage/` directory as a downloadable artifact
- Retention: 14 days
- Available for PR comments via `thollander/actions-comment-pull-request`

### Stage 8: Security Audit

```bash
npm audit --audit-level=high
```

- Checks project dependencies for known vulnerabilities
- `--audit-level=high` — fails only on high and critical severity
- Low/moderate advisories are warnings but do not fail the pipeline

### Stage 9: Circular Dependency Detection

```bash
npx -p madge@8 madge --warning --circular --extensions ts src/
```

- Uses [`madge`](https://github.com/pahen/madge) to detect circular `import`/`require` chains
- `--circular` — exit with non-zero on circular dependencies
- `--warning` — show warnings for missing dependencies
- `--extensions ts` — only scan TypeScript files

### Stage 10: Prisma Schema Validation

```bash
npx prisma validate
```

- Validates the Prisma schema syntax
- Checks that all models, enums, and relations are well-formed
- Does NOT connect to a database

### Stage 11: Migration Verification

Verifies:
- `prisma/migrations/` directory exists
- `migration_lock.toml` exists (ensures migration engine consistency)
- Every migration directory contains a `migration.sql` file

This guards against:
- Missing migration files
- Corrupted migrations
- Manual directory deletion

### Stage 12: Docker Image Build

```bash
docker build -t stockflow-backend:${{ github.sha }} .
```

- Builds the Docker image using the project's `Dockerfile`
- Tags with the commit SHA for traceability
- Validates the Dockerfile doesn't have syntax errors
- Does NOT push to a registry (separate CD job)

---

## 4. Infrastructure Dependencies

| Service | Purpose | Provided By |
|---------|---------|-------------|
| Node.js 22 | Runtime | `actions/setup-node` |
| PostgreSQL 16 | Integration test DB | GitHub Actions `services.postgres` |
| Docker | Image build | GitHub Actions runner (default) |

### Environment Variables

```yaml
env:
  NODE_VERSION: '22'
  WORKING_DIR: ./backend
```

All `run` steps execute inside `./backend` by default.

---

## 5. Integration Test Database

The pipeline spins up PostgreSQL as a **service container**:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_DB: stockflow_test
      POSTGRES_USER: stockflow
      POSTGRES_PASSWORD: stockflow
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 5s
      --health-timeout 5s
      --health-retries 10
```

The integration test step receives `DATABASE_URL`:

```yaml
env:
  DATABASE_URL: postgresql://stockflow:stockflow@localhost:5432/stockflow_test
```

### Jest Integration Config

Create `backend/jest.integration.config.js`:

```javascript
/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.integration\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage-integration',
  testEnvironment: 'node',
  testTimeout: 30000,
  // globalSetup: '<rootDir>/../test/setup.ts',   // Optional — add when integration test helpers are needed
  // globalTeardown: '<rootDir>/../test/teardown.ts', // Optional — add when needed
};
```

---

## 6. Coverage Reporting

The pipeline uses Jest's built-in coverage reporter (`--coverage` flag).

Coverage thresholds should be configured in `jest.config.js`:

```javascript
module.exports = {
  // ... existing config ...
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

### Viewing Coverage

1. Download the `coverage-report` artifact from the Actions run
2. Open `coverage/lcov-report/index.html` in your browser

---

## 7. Docker Build Strategy

The Docker build uses GitHub Actions' built-in Docker layer caching:

```yaml
- name: 🐳 Build Docker image
  run: docker build -t stockflow-backend:${{ github.sha }} .
```

For production deployments, extend with:

```yaml
- name: Login to Docker Hub
  uses: docker/login-action@v3
  with:
    username: ${{ secrets.DOCKER_USERNAME }}
    password: ${{ secrets.DOCKER_PASSWORD }}

- name: Push to Docker Hub
  run: |
    docker tag stockflow-backend:${{ github.sha }} stockflow/backend:latest
    docker push stockflow/backend:latest
```

The existing `Dockerfile` uses multi-stage builds:

```
node:22-alpine (base)
    │
    ├── deps  — npm ci (all deps)
    │   │
    │   └── build — prisma generate + nest build
    │
    └── runner — npm ci --omit=dev (prod deps only)
                 │
                 └── copy dist, prisma, .prisma
```

---

## 8. Branch Protection

### Required status checks

Configure the following checks as required in GitHub branch protection rules:

| Check Name | Source |
|------------|--------|
| `CI — main` | The main CI job |
| `✅ CI Status` | Aggregate status job |

### Protected branches

| Branch | Protection |
|--------|------------|
| `main` | Requires PR, requires status checks, no direct pushes |

---

## 9. Local Development Workflow

### Running the full pipeline locally

```bash
cd backend

# Stage 1
npm ci

# Stage 2
npx prisma generate

# Stage 3
npx tsc -p tsconfig.json --noEmit
npm run build

# Stage 4
npx eslint "{src,apps,libs,test}/**/*.ts"

# Stage 5
npx jest --coverage --passWithNoTests

# Stage 8
npm audit --audit-level=high

# Stage 9 (requires madge)
npx -p madge@8 madge --warning --circular --extensions ts src/

# Stage 10
npx prisma validate
```

### Pre-commit hook (optional)

Install `husky` to run the pipeline stages locally before pushing:

```bash
npx husky init
echo "npm run lint:check && npx tsc --noEmit" > .husky/pre-commit
```

---

## 10. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `npm ci` fails | `package-lock.json` out of sync | Run `npm install` locally and commit the updated lockfile |
| `npx prisma generate` fails | Schema syntax error | Run `npx prisma validate` locally |
| ESLint fails on `no-explicit-any` | Codebase uses `any` type | Replace with proper types or add `eslint-disable` comment with justification |
| `npm audit` fails | Vulnerable dependency | Run `npm audit fix` or update the vulnerable package |
| `madge` finds circular deps | Import cycle | Restructure imports to break the cycle |
| Docker build fails | Missing environment or bad Dockerfile | Run `docker build .` locally |
| Integration tests timeout | DB connection slow | Increase `testTimeout` in `jest.integration.config.js` |

---

## 11. Future Improvements

| Priority | Improvement | Effort |
|:--------:|-------------|:------:|
| 🔴 | **Deploy to staging** after CI passes | 2 days |
| 🔴 | **Container registry push** (Docker Hub / ECR) | 1 day |
| 🟠 | **Slack notifications** on pipeline failure | 4 hours |
| 🟠 | **Code coverage PR comment** (`thollander/actions-comment-pull-request`) | 2 hours |
| 🟠 | **Dependency caching** for npm + Prisma layers | 2 hours |
| 🟡 | **SonarQube** or **CodeClimate** static analysis | 1 day |
| 🟡 | **Terraform** infrastructure deployment | 3 days |
| 🟢 | **E2E tests** with Playwright/Cypress | 3 days |
| 🟢 | **Performance regression tests** (k6/artillery) | 2 days |
| 🟢 | **Dependabot** automated dependency updates | 1 hour |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions Runner                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌─────────────────┐    ┌────────────┐  │
│  │  Checkout     │───▶│  Setup Node 22   │───▶│  npm ci    │  │
│  └──────────────┘    └─────────────────┘    └──────┬─────┘  │
│                                                     │        │
│  ┌──────────────────────────────────────────────────┘        │
│  ▼                                                           │
│  ┌──────────────┐    ┌─────────────────┐    ┌────────────┐  │
│  │  prisma gen   │───▶│  tsc --noEmit   │───▶│  nest build │  │
│  └──────────────┘    └─────────────────┘    └──────┬─────┘  │
│                                                     │        │
│  ┌──────────────────────────────────────────────────┘        │
│  ▼                                                           │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  ESLint   │───▶│  Jest Unit   │───▶│  Jest Integration│   │
│  └──────────┘    └──────┬───────┘    └────────┬─────────┘   │
│                         │                      │              │
│  ┌──────────────────────┴──────────────────────┘              │
│  ▼                                                           │
│  ┌────────────┐    ┌───────────┐    ┌──────────────────┐    │
│  │ Upload cov  │───▶│ npm audit │───▶│  madge circular   │    │
│  └────────────┘    └───────────┘    └────────┬─────────┘    │
│                                               │              │
│  ┌────────────────────────────────────────────┘              │
│  ▼                                                           │
│  ┌──────────────┐    ┌──────────────────┐    ┌────────────┐  │
│  │ prisma val.   │───▶│  Migration check │───▶│  Docker     │  │
│  └──────────────┘    └──────────────────┘    │  build      │  │
│                                               └────────────┘  │
│                                                     │        │
│  ┌──────────────────────────────────────────────────┘        │
│  ▼                                                           │
│  ┌────────────────┐                                          │
│  │ ✅ Status = OK │                                          │
│  └────────────────┘                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

*Last updated: July 25, 2026*  
*Maintained by: StockFlow Architecture Team*
