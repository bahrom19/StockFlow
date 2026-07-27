# StockFlow Enterprise — Backup Guide

**Version:** 1.0  
**Last Updated:** 2026-07-26  
**Owner:** Platform Engineering Team  

---

## 1. Backup Overview

| Backup Target | Type | Frequency | Retention | Storage |
|---------------|------|-----------|-----------|---------|
| PostgreSQL | Full dump | Daily | 30 days | S3 |
| PostgreSQL | WAL archive | Continuous | 7 days | S3 |
| PostgreSQL | Logical dump | Weekly | 90 days | S3 |
| PostgreSQL | Pre-migration snapshot | Per migration | 30 days | EBS snapshot |
| Redis (sessions) | RDB | Every 5 min | 1 day | S3 |
| Application config | .env template | — | — | Git (encrypted) |
| Secrets | Vault | — | — | GitHub Secrets |
| Docker images | Registry | Per push | 90 days | GHCR |
| Receipts/Invoices | Object storage | — | 7 years | S3 Glacier |

---

## 2. PostgreSQL Backup

### 2.1 Automated Daily Backup

```bash
#!/bin/bash
# /scripts/backup-postgres.sh

BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/stockflow-${TIMESTAMP}.dump"

mkdir -p "${BACKUP_DIR}"

# Create custom format dump (compressed)
pg_dump "postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
  --format=custom \
  --compress=9 \
  --file="${BACKUP_FILE}"

# Encrypt backup
gpg --encrypt --recipient backup@stockflow.com \
  --output "${BACKUP_FILE}.gpg" \
  "${BACKUP_FILE}"

# Upload to S3
aws s3 cp "${BACKUP_FILE}.gpg" "s3://stockflow-backups/postgres/${TIMESTAMP}.dump.gpg"

# Cleanup old backups
find "${BACKUP_DIR}" -name "*.dump" -mtime +30 -delete

# Verify backup integrity
pg_restore --list "${BACKUP_FILE}" > /dev/null 2>&1 && \
  echo "Backup verified: ${BACKUP_FILE}"
```

### 2.2 WAL Archiving

```ini
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://stockflow-wal-archive/%f'
archive_timeout = 300
```

### 2.3 Backup Verification

Restore test runs automatically every Monday:

```bash
# Create test database
createdb stockflow_restore_test

# Restore backup
pg_restore -d stockflow_restore_test \
  --format=custom \
  /backups/latest-stockflow.dump

# Run basic verification queries
psql -d stockflow_restore_test -c "SELECT COUNT(*) FROM sales;"
psql -d stockflow_restore_test -c "SELECT COUNT(*) FROM users;"
psql -d stockflow_restore_test -c "SELECT COUNT(*) FROM journal_entries;"

# Cleanup
dropdb stockflow_restore_test
```

---

## 3. Redis Backup

### 3.1 RDB Snapshot

```bash
# Save snapshot
redis-cli SAVE

# Copy to backup location
cp /var/lib/redis/dump.rdb /backups/redis/redis-$(date +%Y-%m-%d).rdb

# Upload to S3
aws s3 cp /backups/redis/ "s3://stockflow-backups/redis/" --recursive
```

### 3.2 AOF Persistence

```ini
# redis.conf
appendonly yes
appendfsync everysec
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

---

## 4. Secrets Backup

Secrets are stored in:
- **GitHub Secrets** (production secrets)
- **Vault** (if deployed)

```bash
# Backup Vault secrets
vault operator raft snapshot save /backups/vault/snapshot-$(date +%Y-%m-%d).snap
```

---

## 5. Backup Monitoring

- Prometheus alerts on backup failure
- Grafana dashboard: `Backup Status`
- Weekly backup report via email
- PagerDuty integration for missed backups

**Alert rules:**

```yaml
- alert: BackupFailed
  expr: time() - backup_last_success_timestamp > 86400
  for: 1h
  labels:
    severity: critical
  annotations:
    summary: "No successful backup in the last 24 hours"

- alert: BackupSlow
  expr: backup_duration_seconds > 3600
  for: 5m
  labels:
    severity: warning
```

---

## 6. Backup Restoration Testing

| Test | Frequency | Success Criteria |
|------|-----------|-----------------|
| DB restore to test env | Weekly | All tables have data, row counts match |
| Application start on restored DB | Weekly | Health check passes |
| Redis restore | Monthly | Session data recoverable |
| Point-in-time recovery | Monthly | Data consistent at target time |
| Full DR drill | Quarterly | RTO < 1 hour, RPO < 15 min |

---

## 7. Backup Costs

| Storage | Estimated Monthly Cost |
|---------|----------------------|
| PostgreSQL dumps (30 days) | $5–15 |
| WAL archive (7 days) | $10–30 |
| Long-term archives (90 days) | $2–5 |
| Pre-migration snapshots | $5–10 |
| **Total** | **$22–60/month** |
