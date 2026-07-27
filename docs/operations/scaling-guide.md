# StockFlow Enterprise — Scaling Guide

**Version:** 1.0  
**Last Updated:** 2026-07-26  
**Owner:** Platform Engineering Team  

---

## 1. Scaling Strategy

### 1.1 Application Layer

| Metric | Target | Action |
|--------|--------|--------|
| CPU > 70% for 5 min | Add replicas | Scale out |
| Memory > 85% for 5 min | Add replicas | Scale out |
| p95 latency > 2000ms | Add replicas | Scale out |
| Requests per second > 500/pod | Add replicas | Scale out |

**Horizontal scaling (recommended):**

```bash
# Manual scaling
kubectl scale deployment/stockflow-backend --replicas=5 -n stockflow-production

# HPA (Horizontal Pod Autoscaler)
kubectl autoscale deployment/stockflow-backend \
  --cpu-percent=70 \
  --memory-percent=85 \
  --min=2 \
  --max=10 \
  -n stockflow-production
```

**Target configuration:**

| Environment | Min Replicas | Max Replicas | CPU Request | Memory Request |
|-------------|-------------|-------------|-------------|----------------|
| Staging | 1 | 2 | 500m | 512Mi |
| Production | 2 | 10 | 1 | 1Gi |

---

## 2. Database Scaling

### 2.1 PostgreSQL

**Vertical scaling:**
- Increase instance size when CPU > 70% or memory > 80%
- Target: 2× RAM of database size for good cache hit ratio

**Horizontal scaling (read replicas):**

```sql
-- Read-only queries → read replica
SELECT ... FROM products WHERE ...

-- Write queries → primary
INSERT INTO sales (...) VALUES (...)
```

**Connection pooling:**

```yaml
# PgBouncer configuration
[databases]
stockflow = host=postgres-primary port=5432 dbname=stockflow

[pgbouncer]
pool_mode = transaction
max_client_conn = 200
default_pool_size = 25
```

### 2.2 Query Optimization

- All queries go through indexed columns
- N+1 queries detected via Prisma middleware (slow query log)
- Aggregation queries use materialized views where needed
- Cached report data expires after 5 minutes

### 2.3 Table Partitioning

For large tables (>10M rows):

- `journal_entries` — partitioned by `entry_date` (monthly)
- `stock_movements` — partitioned by `created_at` (monthly)
- `events` — partitioned by `timestamp` (monthly)

---

## 3. Redis Scaling

### 3.1 Cache Strategy

| Use Case | TTL | Eviction Policy |
|----------|-----|-----------------|
| Response cache | 60s | LRU |
| Session data | 1h | LRU |
| Rate limiter counters | 1m | N/A (on expiry) |
| DataLoader batch | 30s | LRU |

**Redis Cluster** (when >10GB):

```bash
# Cluster mode (production)
redis-cli --cluster create \
  redis-node-0:6379 \
  redis-node-1:6379 \
  redis-node-2:6379 \
  redis-node-3:6379 \
  redis-node-4:6379 \
  redis-node-5:6379 \
  --cluster-replicas 1
```

### 3.2 Cache Stampede Protection

The `CacheService.getOrCompute()` method implements probabilistic early expiration (XFetch algorithm):

```typescript
// Beta parameter controls early recompute aggressiveness
// beta=1.0 → normal (default)
// beta=0.5 → more aggressive (lower latency, higher compute)
const value = await cacheService.getOrCompute(
  'key',
  () => expensiveComputation(),
  300,  // TTL seconds
  1.0,  // beta
);
```

---

## 4. N+1 Query Detection

Prisma middleware logs slow queries (>500ms) automatically.

**Common N+1 patterns in StockFlow:**

| Pattern | Detection | Fix |
|---------|-----------|-----|
| `findMany` sales + per-sale items | Slow query log | Use `include` or Prisma `findMany({include: {items: true}})` |
| Report aggregation | Memory spike | Use Prisma `aggregate`/`groupBy` |
| Batch product lookup | Multiple queries | Use `DataLoader` pattern |
| Customer search + recent sales | N+1 join | Add proper index |

---

## 5. Caching Strategy

### 5.1 Response Caching

- GET endpoints with no auth → cached (60s TTL)
- GET endpoints with auth → NOT cached (user-specific)
- Aggregation/report endpoints → cached (5 min TTL)
- Cache invalidated on related mutations

### 5.2 Query Caching

```typescript
// Service layer caching
const products = await cacheService.getOrCompute(
  CacheService.buildKey('products:list', page, limit, search),
  () => this.productRepository.findMany(query),
  120, // 2 min TTL
);
```

### 5.3 Cache Invalidation

```typescript
// After product mutation
await cacheService.delPattern('products:*');
```

---

## 6. Performance Budgets

| Operation | Budget | Threshold |
|-----------|--------|-----------|
| API response (p50) | <100ms | <500ms |
| API response (p95) | <500ms | <2000ms |
| API response (p99) | <2000ms | <5000ms |
| DB query (p50) | <10ms | <50ms |
| DB query (p99) | <100ms | <500ms |
| Event handler | <100ms | <1000ms |
| Page load | <2s | <5s |

---

## 7. Capacity Planning

| Workload | Users | Replicas | DB | Redis |
|----------|-------|----------|----|-------|
| Small | <100 | 1–2 | db.t3.medium | 1GB |
| Medium | 100–1,000 | 2–4 | db.r6g.large | 4GB |
| Large | 1,000–10,000 | 4–8 | db.r6g.xlarge | 16GB |
| Enterprise | 10,000+ | 8–20 | db.r6g.2xlarge + replicas | 32GB cluster |

**Estimated resource per 1,000 requests:**
- CPU: 500ms (total)
- Memory: 50MB
- DB queries: 5–20
- Redis queries: 2–10

---

## 8. Load Testing

See `k6/scenarios.js` for load testing scenarios.

```bash
# Run load test
k6 run --vus 50 --duration 5m k6/scenarios.js

# Run with custom base URL
k6 run -e BASE_URL=https://staging.stockflow.example.com/api \
  --vus 100 --duration 10m k6/scenarios.js
```
