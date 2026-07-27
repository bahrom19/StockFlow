# StockFlow Enterprise — Monitoring Guide

**Version:** 1.0  
**Last Updated:** 2026-07-26  
**Owner:** Platform Engineering Team  

---

## 1. Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  Application │────▶│  Prometheus  │────▶│    Grafana    │
│  (Metrics)   │     │  (Scrape)    │     │  (Dashboard)  │
└─────────────┘     └─────────────┘     └──────────────┘
       │                    │
       │                    ▼
       │             ┌──────────────┐     ┌──────────────┐
       │             │ Alertmanager │────▶│   PagerDuty   │
       │             └──────────────┘     └──────────────┘
       │
       ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│Application   │────▶│  OpenTelemetry│────▶│   Jaeger /   │
│ (Traces)     │     │  Collector    │     │ Grafana Tempo│
└─────────────┘     └──────────────┘     └──────────────┘
```

---

## 2. Metrics Collection

### 2.1 Application Metrics

Scraped by Prometheus at `/api/health/metrics` every 15 seconds.

**Core metrics exposed:**
- `http_requests_total` — Request count (method, path, status)
- `http_request_duration_ms` — Duration histogram
- `http_requests_in_flight` — Concurrent requests
- `prisma_queries_total` — Database query count
- `prisma_query_duration_ms` — Query duration
- `prisma_slow_queries_total` — Slow queries
- `events_total` — Business events
- `errors_total` — Application errors
- `memory_usage_bytes` — Memory by type (rss, heap, external)

### 2.2 Infrastructure Metrics

Collected via Prometheus exporters:
- **PostgreSQL**: `postgres_exporter` — connections, active queries, cache hit ratio
- **Redis**: `redis_exporter` — hit rate, memory, connected clients
- **Node**: Default metrics via `prom-client` — event loop lag, GC

### 2.3 Prometheus Configuration

```yaml
scrape_configs:
  - job_name: 'stockflow-backend'
    scrape_interval: 15s
    metrics_path: '/api/health/metrics'
    static_configs:
      - targets: ['app:3000']
        labels:
          app: stockflow-backend
          environment: production
```

---

## 3. Grafana Dashboards

### 3.1 Dashboard: Application Overview

**Panels:**
1. **Request Rate** (QPS by endpoint, last 1h)
2. **Error Rate** (% of 5xx responses)
3. **p50/p95/p99 Latency** (by endpoint)
4. **Active Requests** (in-flight gauge)
5. **Database Query Rate** (queries/s by model)
6. **Slow Queries** (count >500ms)
7. **Memory Usage** (RSS, Heap, External)
8. **Business Events** (event count by type)

### 3.2 Dashboard: Database

**Panels:**
1. **Active Connections**
2. **Query Throughput**
3. **Cache Hit Ratio**
4. **Replication Lag**
5. **Connection Pool Usage**

### 3.3 Dashboard: Business

**Panels:**
1. **Sales Volume** (per hour/day)
2. **New Customers** (per day)
3. **Purchase Orders** (per status)
4. **Inventory Turns**
5. **Journal Entries** (per day)

---

## 4. Alerting Rules

### 4.1 Critical Alerts

```yaml
groups:
  - name: stockflow-critical
    rules:
      - alert: ServiceDown
        expr: up{job="stockflow-backend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "StockFlow backend is down"

      - alert: HighErrorRate
        expr: rate(errors_total[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Error rate exceeds 10%"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m])) > 5000
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "p95 latency exceeds 5000ms"
```

### 4.2 Warning Alerts

```yaml
      - alert: SlowQueries
        expr: rate(prisma_slow_queries_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow queries detected"

      - alert: HighMemoryUsage
        expr: memory_usage_bytes{type="heapUsed"} / memory_usage_bytes{type="heapTotal"} > 0.85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Heap usage above 85%"

      - alert: DatabaseDown
        expr: health_check_status{check="postgresql"} == 0
        for: 1m
        labels:
          severity: critical
```

---

## 5. Distributed Tracing

### 5.1 OpenTelemetry Configuration

Enable traces via environment:

```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_SERVICE_NAME=stockflow-backend
```

### 5.2 Trace Fields

Every trace span includes:
- `http.method` — HTTP method
- `http.url` — Request URL
- `http.status_code` — Response status
- `http.request_id` — Correlation ID
- `user.id` — Authenticated user
- `company.id` — Multi-tenant ID
- `db.query` — Prisma query (sanitized)

### 5.3 Instrumentation

Auto-instrumented:
- HTTP requests (incoming/outgoing)
- Express routes
- Prisma queries (per query span)

---

## 6. Structured Logging

### 6.1 Log Format

```json
{
  "level": "log",
  "message": "...",
  "context": "HTTP",
  "timestamp": "2026-07-26T14:30:00.000Z",
  "pid": 1234,
  "requestId": "abc-123",
  "userId": "user-456",
  "companyId": "company-789"
}
```

### 6.2 Log Shipping (Production)

```
Application (stdout)
  → CloudWatch Agent / Fluentd
    → Log aggregation (S3 / Elasticsearch)
      → Grafana Loki / Kibana
```

---

## 7. Health Check Integration

| Probe | Kubernetes | Load Balancer | Description |
|-------|------------|---------------|-------------|
| Liveness | `livenessProbe` | — | Is the process alive? |
| Readiness | `readinessProbe` | Health check | Can serve traffic? |
| Full Health | — | — | Dependency status |

---

## 8. SLA/SLO Tracking

| Indicator | Target | Measurement Period |
|-----------|--------|-------------------|
| API Availability | 99.9% | Monthly |
| API Latency (p95) | <2000ms | Rolling 7 days |
| API Latency (p99) | <5000ms | Rolling 7 days |
| Error Rate | <1% | Rolling 1 hour |
| Uptime | 99.95% | Monthly |
| Recovery Time | <1 hour | Per incident |

---

## 9. Monitoring Runbook

### Add New Metric

1. Add metric to `MetricsService` constructor
2. Register with `this.registry`
3. Use in interceptor/service
4. Verify at `/api/health/metrics`
5. Add panel to Grafana dashboard

### Add New Alert

1. Add Prometheus recording rule
2. Configure Alertmanager routing
3. Add PagerDuty integration
4. Test alert in staging
5. Document in runbook

### Debug Missing Metrics

```bash
# Check if endpoint is accessible
curl -s http://localhost:3000/api/health/metrics | head -20

# Verify Prometheus target
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="stockflow-backend")'

# Check for scrape errors
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="stockflow-backend") | .lastError'
```
