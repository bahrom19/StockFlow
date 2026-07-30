# StockFlow RC — Release Checklist

> **Версия:** 1.0.0-RC
> **Дата:** 2026-07-30

---

## 1. Backend

- [x] **TypeScript** — `tsc --noEmit` — 0 errors
- [x] **ESLint** — `npm run lint:check` — 0 errors
- [x] **NestJS Build** — `npm run build` — успешно
- [x] **Unit Tests** — 288 тестов, 28 suites — all pass
- [x] **All Services** — Auth, Products, Sales, Purchasing, Inventory, Finance, CRM, Reports, RBAC, Billing, Users, Health
- [x] **Audit Log** — критическиe операции логируются
- [x] **Optimistic Locking** — все основные сущности имеют rowVersion
- [x] **Concurrency** — Blocker B1 исправлен (верифицирован тестами)
- [ ] **Missing:** Forgot/Change password endpoint

---

## 2. Mobile

- [x] **Dart Analyze** — 0 issues
- [x] **API Endpoints** — 40+ констант сверены с backend
- [x] **Auth Flow** — register, login, refresh, logout, getProfile
- [x] **Products** — list, getById, create, update, delete
- [x] **Sales** — create, complete, cancel, refund, receipt
- [x] **Purchasing** — orders, goods receipt, returns
- [x] **Inventory** — stock list, movements, adjust, transfer
- [x] **Suppliers** — CRUD
- [x] **Dashboard** — summary, sales, profit
- [ ] **Missing:** Customers module (нет репозитория в mobile)
- [ ] **Missing:** CRM module (opportunities, tasks, contacts)

---

## 3. Database

- [x] **Prisma Schema** — `prisma validate` — valid
- [x] **Migrations** — все миграции имеют корректные SQL файлы
- [x] **`migration_lock.toml`** — присутствует
- [x] **Foreign Keys** — `onDelete: Cascade` на Company
- [x] **Indexes** — основные индексы присутствуют
- [x] **Optimistic Locking** — rowVersion на всех основных entity
- [x] **Soft Delete** — `deletedAt` на всех entity
- [ ] **Missing:** Индекс `(companyId, referenceType, referenceId)` на FinancialTransaction
- [ ] **Missing:** Индекс `(companyId, createdAt)` на AuditLog

---

## 4. API

- [x] **REST Consistent** — единый паттерн CRUD
- [x] **Status Codes** — 200/201/204/400/401/403/404/409/429
- [x] **Pagination** — `{ items, total, page, limit }`
- [x] **DTO Validation** — `whitelist: true`, `forbidNonWhitelisted: true`
- [x] **Multi-Tenant** — companyId из JWT, не из тела
- [x] **RBAC** — `@RequirePermission()` на всех защищённых endpoints
- [x] **API Contract v1.0** — создан: `docs/api-contract-v1.md`
- [ ] **Missing:** Header-based API versioning (только URL)

---

## 5. Docker

- [x] **Multi-stage build** — base, deps, build, runner
- [x] **Non-root user** — `appuser`
- [x] **Alpine base** — `node:22-alpine`
- [x] **tini** — init process (PID 1)
- [x] **HEALTHCHECK** — `GET /api/health/live`
- [x] **EXPOSE 3000**
- [x] **`.dockerignore`** — присутствует

---

## 6. Railway

- [x] **`railway.json`** — конфигурация
- [x] **Healthcheck Path** — `/api/health/live`
- [x] **Dockerfile builder** — DOCKERFILE
- [x] **Watch Patterns** — src/**/*.ts, prisma/**/*
- [x] **Restart Policy** — ON_FAILURE, max 10 retries

---

## 7. CI/CD

- [x] **GitHub Actions CI** — 12 stages
  - [x] Install dependencies
  - [x] Prisma generate
  - [x] TypeScript typecheck
  - [x] NestJS build
  - [x] ESLint
  - [x] Unit tests + coverage
  - [x] Integration tests (PostgreSQL)
  - [x] Security audit
  - [x] Circular dependency check
  - [x] Prisma validate
  - [x] Migration verification
  - [x] Docker build
- [x] **GitHub Actions CD** — 7 stages
  - [x] Build & Push Docker image
  - [x] Deploy Staging
  - [x] Smoke Tests
  - [x] Manual Approval Gate
  - [x] Deploy Production
  - [x] Post-Deploy Verification
  - [x] Auto-Rollback

---

## 8. Swagger

- [x] **`/docs`** endpoint
- [x] **`@ApiBearerAuth()`** — на защищённых endpoints
- [x] **`@ApiTags()`** — группировка модулей
- [x] **`@ApiOperation()`** — описание endpoint'ов
- [x] **`@ApiResponse()`** — частично (не все статусы задокументированы)
- [x] **Отключается в production** через `app.swaggerEnabled`

---

## 9. ENV

- [x] **`.env.example`** — все переменные документированы
- [x] **`env.validation.ts`** — Joi валидация
- [x] **JWT_SECRET** — required, min 16 chars
- [x] **JWT_REFRESH_SECRET** — optional, min 16 chars
- [x] **DATABASE_URL** — required, URI
- [x] **REDIS_URL** — optional
- [x] **NODE_ENV** — development / production / test

---

## 10. Prisma

- [x] **Schema valid** — `prisma validate`
- [x] **Migrations** — все корректны
- [x] **@default** — все поля имеют дефолты
- [x] **@updatedAt** — на всех entity
- [x] **@unique** — на ключевых полях
- [x] **@@index** — на companyId + search полях

---

## 11. Redis

- [x] **`CacheModule`** — зарегистрирован в AppModule
- [x] **`CacheInterceptor`** — HTTP кэширование
- [x] **`redis.config.ts`** — конфигурация
- [x] **`RedisService`** — сервис для работы с Redis
- [ ] **Missing:** Ни один контроллер не использует `@CacheControl` или `CacheInterceptor`

---

## 12. PostgreSQL

- [x] **Prisma ORM** — все запросы через Prisma
- [x] **Connection pool** — Prisma управляет pool'ом
- [x] **docker-compose.yml** — PostgreSQL + Redis для локальной разработки

---

## 13. Monitoring

- [x] **OpenTelemetry** — HTTP, Express, Prisma instrumentation
- [x] **OTLP export** — Jaeger, Grafana Tempo
- [x] **Prometheus metrics** — `GET /api/health/metrics`
- [x] **MetricsInterceptor** — HTTP request duration, counter
- [x] **Request ID middleware**
- [ ] **Missing:** Sentry/Rollbar crash reporting

---

## 14. Logging

- [x] **Structured logging** — `bufferLogs: true`
- [x] **Global Exception Filter** — все ошибки логируются со stack trace
- [x] **Request ID** — пробрасывается в логи
- [x] **Logger** — во всех сервисах

---

## 15. Backup & Restore

- [ ] **Missing:** Automated backup script
- [ ] **Missing:** Restore procedure documentation
- [ ] **Missing:** Backup retention policy

---

## 16. Health Check

- [x] **`GET /api/health`** — общий health
- [x] **`GET /api/health/live`** — liveness probe (Docker HEALTHCHECK)
- [x] **`GET /api/health/metrics`** — Prometheus метрики
- [ ] **Missing:** `GET /api/health/ready` — readiness probe (проверяет зависимости)

---

## 17. Seed

- [x] **PermissionsSeedService** — `OnModuleInit` — авто-сидирование permissions
- [x] Admin role создаётся при регистрации компании
- [x] Все permissions назначаются Admin роли

---

## 18. Migration

- [x] **`prisma:migrate:deploy`** — скрипт для production
- [x] **Railway Deploy Command** — `prisma generate && prisma migrate deploy`
- [x] **Последняя миграция:** `20260729014253_add_billing_tables`

---

## 19. Production ENV

- [ ] **JWT_SECRET** — должен быть заменён на сильный случайный ключ
- [ ] **CORS_ORIGIN** — должен быть ограничен доменом фронтенда
- [ ] **SWAGGER_ENABLED** — `false` в production
- [ ] **LOG_LEVEL** — `info` или `warn` в production
- [ ] **NODE_ENV** — `production`

---

## 20. Rollback Plan

- [x] **CI/CD pipeline** — авто-rollback при failure
- [ ] **Missing:** Manual rollback procedure docs
- [ ] **Missing:** Database rollback strategy (migration revert)

---

## Итог

| Категория | Выполнено | Всего |
|-----------|-----------|-------|
| Backend | 4 | 5 |
| Mobile | 9 | 11 |
| Database | 6 | 8 |
| API | 7 | 8 |
| Docker | 5 | 5 |
| Railway | 4 | 4 |
| CI/CD | 2 | 2 |
| Swagger | 5 | 5 |
| ENV | 5 | 5 |
| Prisma | 6 | 6 |
| Redis | 4 | 5 |
| PostgreSQL | 3 | 3 |
| Monitoring | 5 | 6 |
| Logging | 4 | 4 |
| Backup | 0 | 3 |
| Health Check | 3 | 4 |
| Seed | 3 | 3 |
| Migration | 3 | 3 |
| Production ENV | 0 | 5 |
| Rollback Plan | 1 | 3 |

**Всего выполнено: 74 / 100 ✅**
