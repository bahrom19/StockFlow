# StockFlow Enterprise — Deployment Guide

**Version:** 1.0  
**Last Updated:** 2026-07-26  
**Owner:** DevOps Team  

---

## 1. CI/CD Pipeline

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Git Push   │───▶│   CI Pipeline  │───▶│  Docker Build │───▶│ Container     │
│   (main)     │    │  (12 stages)   │    │  & Push       │    │ Registry      │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                                                                    │
                                                                    ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Production │◀───│  Manual       │◀───│   Smoke      │◀───│   Staging     │
│   Deploy     │    │  Approval     │    │   Tests      │    │   Deploy      │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
       │
       ▼
┌─────────────┐
│   Post-Deploy│
│   Verify     │
└─────────────┘
```

---

## 2. Environments

| Environment | URL | DB | Purpose |
|-------------|-----|----|---------|
| `development` | `localhost:3000` | Local PostgreSQL | Local dev |
| `staging` | `staging.stockflow.example.com` | Staging RDS | Integration tests |
| `production` | `stockflow.example.com` | Production RDS | Live traffic |

---

## 3. Deployment Process

### 3.1 Standard Deployment

```bash
# 1. Push to main triggers CI
git push origin main

# 2. CI validates: build → test → lint → security → docker
# 3. Pipeline auto-deploys to staging
# 4. Smoke tests run against staging
# 5. Manual approval via GitHub Environments
# 6. Deploy to production
# 7. Post-deploy smoke tests
# 8. Auto-rollback on failure
```

### 3.2 Zero-Downtime Deployment

The application supports rolling updates:

```yaml
# Kubernetes deployment strategy
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

**Requirements:**
- Database migrations must be backward-compatible
- New code must handle both old and new DB schema
- Readiness probe ensures traffic only reaches ready pods

### 3.3 Database Migrations

Migrations run automatically on startup:

```bash
npx prisma migrate deploy
```

**Migration safety guidelines:**
- Never delete columns in the same deploy that removes code references
- Add columns first, deploy code that uses them, then remove old columns
- Always test migration rollback before production
- Take DB snapshot before every migration

**Zero-downtime migration process:**
1. Deploy migration (`prisma migrate deploy`)
2. Deploy new application code
3. Remove old code paths (next deployment)
4. Remove old columns (next deployment)

---

## 4. Rollback Process

### 4.1 Application Rollback

```bash
# Automated rollback (via CD pipeline)
kubectl rollout undo deployment/stockflow-backend -n stockflow-production

# Manual rollback to specific version
kubectl set image deployment/stockflow-backend \
  app=ghcr.io/stockflow/backend:$PREVIOUS_TAG \
  -n stockflow-production

# Verify rollback
kubectl rollout status deployment/stockflow-backend -n stockflow-production
```

### 4.2 Database Rollback

```bash
# 1. Restore from pre-migration snapshot
pg_restore -h $PGHOST -U stockflow -d stockflow \
  --clean --if-exists \
  /snapshots/pre-migration-$(date +%s).dump

# 2. Roll back Prisma migration
npx prisma migrate resolve --rolled-back "migration_name"

# 3. Deploy previous application version
```

---

## 5. Artifact Management

### 5.1 Docker Images

- Registry: `ghcr.io/stockflow/backend`
- Tags: `sha-<COMMIT_SHA>`, `latest`
- Cache: GitHub Actions cache (Buildkit)
- SBOM: Generated and attached to each release

### 5.2 Version Strategy

```
1.0.0 → 1.1.0 → 1.2.0 → 2.0.0
│         │         │         │
├─ Feature ├─ Bugfix ├─ Feature ├─ Breaking
│   add     │   fix    │   add    │   change
```

- **Major**: Breaking API changes
- **Minor**: New features, backwards-compatible
- **Patch**: Bug fixes, security patches

---

## 6. Pre-Deployment Checklist

- [ ] All CI stages pass
- [ ] Database migration reviewed
- [ ] Migration backward-compatible
- [ ] DB snapshot taken
- [ ] Staging smoke tests pass
- [ ] Manual approval received
- [ ] Rollback plan documented
- [ ] Runbook updated (if needed)
- [ ] Monitoring dashboards checked
- [ ] No active incidents

---

## 7. Post-Deployment Verification

```bash
# Health checks
curl -sSf https://stockflow.example.com/api/health/ready
curl -sSf https://stockflow.example.com/api/health/live

# API smoke test
# Requires: jq, and curl >= 7.55.0 for "-H @-" (reads a header from stdin).
# No credentials are stored in this repository. Export them before running:
#   export SF_API='https://<your-host>/api'      # base URL INCLUDING the /api prefix
#   export SF_EMAIL='<operator e-mail>'
#   export SF_PASSWORD='<operator password>'    # never passed on the command line
set -euo pipefail

: "${SF_API:?set SF_API to the API base including the /api prefix, e.g. https://<your-host>/api}"
: "${SF_EMAIL:?set SF_EMAIL to the operator e-mail}"
: "${SF_PASSWORD:?set SF_PASSWORD to the operator password}"

# Login. jq reads the credentials from the environment and curl receives the
# JSON body on stdin, so neither the password nor the token ever appears in a
# process argument list or in the command text.
TOKEN=$(
  jq -nc '{email: env.SF_EMAIL, password: env.SF_PASSWORD}' \
  | curl -sS -X POST "$SF_API/auth/login" \
        -H 'Content-Type: application/json' \
        --data @- \
  | jq -r '.accessToken // empty'
) || { rc=$?; echo "login failed: transport error (exit $rc)" >&2; exit 1; }

if [ -z "$TOKEN" ]; then
  echo "login failed: no accessToken in the response" >&2
  exit 1
fi

# Authorized request. curl -H @- reads the header from stdin, so the token is
# not in curl's argv. No trailing newline is emitted: curl adds the
# end-of-line marker itself and a stray newline would corrupt the header.
http_code=$(
  printf 'Authorization: Bearer %s' "$TOKEN" \
  | curl -sS -o /dev/null -w '%{http_code}' -H @- "$SF_API/products?limit=1"
) || { rc=$?; echo "products check failed: transport error (exit $rc)" >&2; exit 1; }

case "$http_code" in
  2*) echo "products check passed (HTTP $http_code)" ;;
  *)  echo "products check failed: HTTP $http_code" >&2; exit 1 ;;
esac

# Removes the shell variable binding only.
# It does NOT scrub the token from: shell history, terminal scrollback, the
# process environment inherited by children (/proc/<pid>/environ), process
# memory, swap or page cache. A local shell cannot prevent another process
# running as the same user from recovering the value while it is in flight.
unset TOKEN

curl -s https://stockflow.example.com/api/health/metrics | head -10

# Check error rate (should be 0)
curl -s http://localhost:9090/api/v1/query?query=rate(errors_total[5m])
```
