# StockFlow Enterprise — Operations Runbook

**Version:** 1.0  
**Last Updated:** 2026-07-26  
**Owner:** Platform Engineering Team  

---

## 1. System Overview

| Component | Technology | Port | Dependencies |
|-----------|------------|------|--------------|
| API Server | NestJS (Node.js 22) | 3000 | PostgreSQL, Redis |
| Database | PostgreSQL 16 | 5432 | — |
| Cache | Redis 7 | 6379 | — |
| Tracing | OpenTelemetry/OTLP | 4318 | Jaeger/Grafana Tempo |
| Metrics | Prometheus | 9090 | — |
| Dashboard | Grafana | 3001 | Prometheus |

---

## 2. Startup Procedure

```bash
# Local development
npm run start:dev

# Production
docker compose up -d

# Verify startup
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"...","checks":[...]}
```

### Startup Sequence

1. OpenTelemetry SDK initializes
2. Prisma connects to PostgreSQL
3. Redis client connects
4. NestJS modules bootstrap
5. Health endpoint responds

### Startup Verification Checklist

- [ ] `/api/health` returns `status: ok`
- [ ] `/api/health/live` responds
- [ ] `/api/health/ready` shows PostgreSQL and Redis as `ok`
- [ ] `/api/health/metrics` returns Prometheus data
- [ ] Swagger docs at `/docs`
- [ ] JWT auth: `POST /api/auth/login` works

---

## 3. Shutdown Procedure

```bash
# Graceful shutdown
kill -TERM 1  # inside container
docker compose down

# Force shutdown (only if graceful fails)
kill -9 1
```

The application handles `SIGTERM`:
1. Stops accepting new requests
2. Drains existing connections (30s timeout)
3. Disconnects Prisma
4. Disconnects Redis
5. Flushes OpenTelemetry spans
6. Exits cleanly

---

## 4. Health Checks

| Endpoint | Purpose | Expected Status |
|----------|---------|-----------------|
| `GET /health/live` | Liveness probe | Always `ok` |
| `GET /health/ready` | Readiness probe | `ok` when DB+Redis reachable |
| `GET /health` | Full system health | `ok` / `degraded` / `down` |
| `GET /health/metrics` | Prometheus metrics | Prometheus exposition format |

### Kubernetes Probe Configuration

```yaml
livenessProbe:
  httpGet:
    path: /api/health/live
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 15
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
  failureThreshold: 3
```

---

## 5. Logging

### Structured JSON Format

Every log entry follows this schema:

```json
{
  "level": "log",
  "message": "...",
  "context": "HTTP",
  "timestamp": "2026-07-26T14:30:00.000Z",
  "pid": 1234
}
```

### HTTP Request Log (via MetricsInterceptor)

```json
{
  "requestId": "abc-123",
  "method": "POST",
  "path": "/api/sales",
  "status": "201",
  "duration": 245,
  "userId": "user-123",
  "companyId": "company-456",
  "timestamp": "2026-07-26T14:30:00.000Z"
}
```

### Log Levels

| Level | Usage |
|-------|-------|
| `error` | Exceptions, request failures, slow queries |
| `warn` | Slow queries (>500ms), slow requests (>5s), Redis errors |
| `log` | Standard request logs, startup messages |
| `debug` | Development-only details |
| `verbose` | Full query params, event payloads |

---

## 6. Monitoring

### Key Metrics

Generate 150–300 Prometheus metrics per Pod per scrape (15s interval).

**HTTP Metrics:**
- `http_requests_total` (method, path, status)
- `http_request_duration_ms` (p50/p95/p99)
- `http_requests_in_flight`

**Prisma Metrics:**
- `prisma_queries_total` (model, action)
- `prisma_query_duration_ms`
- `prisma_slow_queries_total`

**Business Metrics:**
- `events_total` (event_name, status)
- `errors_total` (type, module)
- `memory_usage_bytes`

### Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| High Error Rate | `errors_total > 10/min` | Critical |
| Slow Queries | `prisma_slow_queries_total > 5/min` | Warning |
| High Latency | `p95 http_request_duration_ms > 5000` | Critical |
| DB Down | `health/postgresql = down` | Critical |
| Redis Down | `health/redis = down` | Warning |

---

## 7. Common Procedures

### Restart Service

```bash
kubectl rollout restart deployment/stockflow-backend -n stockflow-production
```

### Scale Out

```bash
kubectl scale deployment/stockflow-backend --replicas=5 -n stockflow-production
```

### Run Migration

```bash
npx prisma migrate deploy
kubectl set image deployment/stockflow-backend app=ghcr.io/stockflow/backend:$NEW_TAG
```

### Check Logs

```bash
kubectl logs -n stockflow-production -l app=stockflow-backend --tail=100 -f
```

### View Metrics

```bash
# Prometheus query
curl http://localhost:9090/api/v1/query?query=http_requests_total
```

---

## 8. Environment Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Environment |
| `PORT` | No | `3000` | HTTP port |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection |
| `REDIS_URL` | **Yes** | — | Redis connection |
| `JWT_SECRET` | **Yes** | — | JWT signing key |
| `JWT_EXPIRES_IN` | No | `15m` | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token TTL |
| `OTEL_ENABLED` | No | `false` | Enable OpenTelemetry |
| `OTEL_SERVICE_NAME` | No | `stockflow-backend` | Service name for traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | `http://localhost:4318` | Trace export endpoint |

---

## 9. Troubleshooting

### Application won't start

```bash
# Check Prisma connection
npx prisma db push --skip-generate --accept-data-loss 2>&1

# Verify environment
node -e "require('./dist/main')" 2>&1

# Check port conflict
lsof -i :3000
```

### High memory usage

```bash
# Check heap usage
curl /api/health/ready | jq '.checks[] | select(.name=="memory")'

# Enable GC logging
NODE_OPTIONS="--trace-gc" npm run start:prod
```

### Slow queries

```bash
# Check PostgreSQL slow query log
kubectl exec -n stockflow-production -l app=stockflow-postgres -- cat /var/log/postgresql/postgresql-16-main.log | grep "duration"

# Check application logs for slow query warnings
kubectl logs -n stockflow-production -l app=stockflow-backend | grep "Slow query"
```

---

## 10. Maintenance Windows

| Activity | Frequency | Expected Downtime |
|----------|-----------|-------------------|
| Database migration | As needed | 30s–5min (zero-downtime) |
| OS security patch | Monthly | Rolling restart, no downtime |
| Redis restart | Quarterly | <1s (transient cache miss) |
| PostgreSQL upgrade | Yearly | 15–30min |
| Certificate renewal | Every 90 days | 0 (auto-renew) |
