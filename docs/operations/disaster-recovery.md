# StockFlow Enterprise — Disaster Recovery Runbook

**Version:** 1.0  
**Last Updated:** 2026-07-26  
**Owner:** Platform Engineering Team  
**RTO:** 1 hour (Recovery Time Objective)  
**RPO:** 15 minutes (Recovery Point Objective)

---

## 1. Backup Strategy

### 1.1 Database (PostgreSQL)

| Backup Type | Frequency | Retention | Method |
|-------------|-----------|-----------|--------|
| Full | Daily (02:00 UTC) | 30 days | `pg_dump` |
| WAL archive | Continuous | 7 days | `pg_archive` |
| Logical | Weekly (Sunday 03:00 UTC) | 90 days | `pg_dump --format=custom` |
| Snapshot | Before every migration | Until next migration | Cloud provider snapshot |

**Automation:**

```bash
# Daily full backup
pg_dump -h $PGHOST -U stockflow -d stockflow \
  --format=custom \
  --file=/backups/stockflow-$(date +%Y-%m-%d).dump

# Weekly logical backup (table-level)
pg_dump -h $PGHOST -U stockflow -d stockflow \
  --format=custom \
  --compress=9 \
  --file=/backups/stockflow-weekly-$(date +%Y-%m-%d).dump
```

**Backup Verification:**

- Automated restore test runs every Monday at 04:00 UTC
- Backup size and checksum logged to monitoring
- Alerts on backup failure (PagerDuty)

### 1.2 Redis

| Data | Backup Type | Frequency | Retention |
|------|-------------|-----------|-----------|
| Cache (volatile) | None (rebuilt from DB) | — | — |
| Sessions | RDB snapshot | Every 5 min | 1 day |
| Queue state | AOF append | Continuous | 1 day |

```bash
# Redis RDB backup
redis-cli SAVE
cp /var/lib/redis/dump.rdb /backups/redis-$(date +%Y-%m-%d).rdb
```

### 1.3 Application Secrets

- Stored in GitHub Actions Secrets
- Vault (if deployed) — backed up via Vault Snapshot
- `.env` file — NOT committed (documented template only)

### 1.4 File Storage

- Receipt PDFs / Invoice files: Object storage (S3-compatible)
- Backups: Separate encrypted bucket with versioning

---

## 2. Restore Strategy

### 2.1 Database Restore

```bash
# Full restore
pg_restore -h $PGHOST -U stockflow -d stockflow \
  --clean --if-exists \
  /backups/stockflow-2026-07-26.dump

# Point-in-time recovery (PITR)
pg_restore -h $PGHOST -U stockflow -d stockflow \
  --clean --if-exists \
  --target-time "2026-07-26 14:30:00 UTC" \
  /backups/stockflow-weekly-2026-07-21.dump
```

### 2.2 Redis Restore

```bash
# Stop Redis, replace dump.rdb, restart
systemctl stop redis
cp /backups/redis-2026-07-26.rdb /var/lib/redis/dump.rdb
chown redis:redis /var/lib/redis/dump.rdb
systemctl start redis
```

### 2.3 Application Restore

```bash
# Recreate from Docker image
docker pull ghcr.io/stockflow/backend:$VERSION
docker run -d --name stockflow-backend \
  --env-file .env \
  -p 3000:3000 \
  ghcr.io/stockflow/backend:$VERSION
```

---

## 3. Migration Rollback

### 3.1 Rollback Procedure

```bash
# 1. Identify the last migration
npx prisma migrate status

# 2. Rollback one step
npx prisma migrate resolve --rolled-back "migration_name"

# 3. Reset to specific migration
npx prisma migrate reset --force --skip-generate

# 4. Re-apply migration
npx prisma migrate deploy

# 5. Verify
npx prisma validate
```

### 3.2 Automated Rollback in CI/CD

- Pipeline automatically runs `prisma migrate deploy --preview-feature` in dry-run mode
- If migration fails, pipeline aborts and notifies
- Manual rollback script in `/scripts/rollback.sh`

---

## 4. Database Snapshot

### 4.1 Pre-Migration Snapshot

Automatically taken before every migration deployment:

```bash
pg_dump -h $PGHOST -U stockflow -d stockflow \
  --format=custom \
  --file=/snapshots/pre-migration-$(date +%s).dump

# Label for rollback
echo "Snapshot: pre-migration-$(date +%s).dump" >> /snapshots/CHANGELOG
```

### 4.2 Point-in-Time Recovery (PITR)

PostgreSQL WAL archiving enables PITR:

```sql
-- Find the target transaction
SELECT * FROM pg_stat_activity WHERE state = 'active';

-- Recover to specific LSN
SELECT pg_create_restore_point('before_migration_xyz');
```

---

## 5. Redis Recovery

### 5.1 Cache Loss Recovery

Redis cache loss is **non-critical** — all data is rebuilt from database.

- Cache warming job runs automatically after Redis restart
- First requests after restart will be slower (cache miss)
- Application handles Redis failures gracefully (fallback to DB)

### 5.2 Session Recovery

- Sessions stored in Redis with TTL
- If Redis is lost, users must re-authenticate
- JWT tokens remain valid until expiry (independent of Redis)

---

## 6. Secrets Recovery

### 6.1 GitHub Secrets

All secrets stored in GitHub repository secrets:

1. `DATABASE_URL` — Read-write DB connection
2. `REDIS_URL` — Redis connection
3. `JWT_SECRET` — JWT signing key
4. `JWT_REFRESH_SECRET` — Refresh token signing key
5. `ENCRYPTION_KEY` — Application-level encryption

### 6.2 Secret Rotation

| Secret | Rotation Frequency | Requires Downtime |
|--------|-------------------|-------------------|
| `JWT_SECRET` | 90 days | Yes (new tokens) |
| `JWT_REFRESH_SECRET` | 90 days | Yes (new tokens) |
| `DATABASE_URL` | 180 days | Brief (connection pool drain) |
| `ENCRYPTION_KEY` | 365 days | Requires data re-encryption |

### 6.3 Recovery from Secret Loss

```bash
# 1. Generate new secrets
openssl rand -base64 32 > jwt_secret.txt
openssl rand -base64 32 > encryption_key.txt

# 2. Update GitHub Secrets
gh secret set JWT_SECRET < jwt_secret.txt

# 3. Restart application
kubectl rollout restart deployment/stockflow-backend -n stockflow-production
```

---

## 7. Disaster Scenarios

### Scenario A: Complete Database Loss

| Step | Action | Time |
|------|--------|------|
| 1 | Stop application | 1 min |
| 2 | Restore from latest full backup | 15 min |
| 3 | Apply WAL replay for PITR | 5 min |
| 4 | Verify data integrity | 5 min |
| 5 | Start application | 1 min |
| 6 | Run smoke tests | 5 min |
| **Total** | | **32 min** |

### Scenario B: Application Crash Loop

| Step | Action | Time |
|------|--------|------|
| 1 | Check logs: `kubectl logs -n stockflow-production -l app=stockflow-backend` | 2 min |
| 2 | Rollback deployment: `kubectl rollout undo deployment/stockflow-backend` | 2 min |
| 3 | Verify health: `curl /api/health` | 1 min |
| 4 | Escalate to engineering if rollback fails | 5 min |
| **Total** | | **10 min** |

### Scenario C: Redis Failure

| Step | Action | Time |
|------|--------|------|
| 1 | Restart Redis pod | 1 min |
| 2 | Verify connectivity: `redis-cli ping` | 1 min |
| 3 | Application auto-reconnects (no restart needed) | 0 min |
| **Total** | | **2 min** |

### Scenario D: Data Corruption

| Step | Action | Time |
|------|--------|------|
| 1 | Identify corrupt data via monitoring alerts | 5 min |
| 2 | Restore from snapshot before corruption | 15 min |
| 3 | Replay transactions from audit log (if needed) | 30 min |
| 4 | Verify financial reconciliation | 10 min |
| **Total** | | **60 min** |

---

## 8. Recovery Testing Schedule

| Test | Frequency | Responsible |
|------|-----------|-------------|
| Database restore from backup | Weekly | Platform Engineering |
| Redis restart + warmup | Weekly | Platform Engineering |
| Full DR drill | Monthly | SRE Team |
| Migration rollback | Per deployment | DevOps |
| Secret rotation | Quarterly | Security Team |

---

## 9. Contact Escalation

| Level | Contact | Response Time |
|-------|---------|---------------|
| L1 | On-call engineer | 5 min |
| L2 | Platform Engineering | 15 min |
| L3 | Database Administrator | 30 min |
| L4 | Engineering Manager | 1 hour |

---

## 10. DR Automation

- AWS Lambda triggers automated backup verification
- PagerDuty integration for backup failures
- Grafana dashboard: `Disaster Recovery — Backup Status`
- Weekly DR report generated automatically
