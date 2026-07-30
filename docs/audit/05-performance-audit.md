# Performance Audit — StockFlow

**Дата:** 30 июля 2026

---

## Общая оценка производительности: 7.0 / 10

---

## 1. Медленные запросы

### ❌ High

| # | Проблема | Место | Описание |
|---|---------|-------|----------|
| 1 | **N+1 на регистрации** | `AuthService.register` | При регистрации создаётся Admin роль и назначаются ВСЕ permissions. Если permissions > 100, это транзакция с bulk insert, но `findMany` всех permissions — лишний запрос |
| 2 | **Dual query pattern** | `CustomersRepository.findAll` | Использует `$transaction([findMany, count])` — 2 отдельных запроса вместо `withCount` |
| 3 | **Permissions на каждый запрос** | `RolesGuard` | Каждый защищённый HTTP запрос делает запрос к БД для загрузки permissions |

---

## 2. Индексы

### ❌ Medium

| # | Таблица | Отсутствующий индекс | Последствия |
|---|---------|---------------------|-------------|
| 1 | `FinancialTransaction` | `(companyId, referenceType, referenceId)` | Медленный поиск проводок по reference |
| 2 | `AuditLog` | `(companyId, createdAt)` | Очистка старых записей — полный scan |
| 3 | `StockMovement` | `(companyId, productId, createdAt)` | Отчёты по движениям товара |
| 4 | `Session` | `(expiresAt)` | Очистка сессий |

---

## 3. Redis / Кэширование

### ✅ Хорошо
- `CacheService` — полноценный сервис кэширования через ioredis
- Поддержка TTL (default 5 min)
- XFetch алгоритм для cache stampede protection
- `getOrCompute` с probabilistic early expiration
- `delPattern` для инвалидации по паттерну

### ❌ Проблемы

| # | Критичность | Проблема | Описание |
|---|------------|----------|----------|
| 1 | **High** | **Кэш почти не используется** | CacheService есть, но нет кэширования: permissions, customers list, products list — всё загружается из БД на каждый запрос |
| 2 | **Medium** | `CacheInterceptor` существует | Но не применяется ни к одному контроллеру |
| 3 | **Low** | Нет Redis Cluster поддержки | Redis singleton — single point of failure |

---

## 4. Batch операции

### ❌ Medium

| # | Проблема | Описание |
|---|---------|----------|
| 1 | Нет batch endpoints | Нет массового создания/обновления customers, products |
| 2 | Нет bulk import API | Для ERP системы нужен CSV/Excel import |

---

## 5. Pagination

### ✅ Хорошо
- Все findAll методы поддерживают `page`/`limit`
- `skip`/`take` в Prisma запросах
- Сортировка по разным полям

### ❌ Low

| # | Проблема | Описание |
|---|---------|----------|
| 1 | **Keyset pagination не реализована** | Используется offset-based pagination (`skip`/`take`), которая деградирует на больших страницах |
| 2 | Нет cursor-based pagination для больших таблиц (AuditLog, StockMovement) |

---

## 6. Streaming

### ❌ Low
- Нет streaming endpoints для больших отчётов (Excel/CSV export)
- Все данные загружаются в память перед отправкой

---

## 7. Connection Pool

### ❌ Medium
- Prisma использует пул соединений по умолчанию (PostgreSQL — 10 соединений)
- Нет кастомной конфигурации пула в зависимости от размера инстанса
- На Railway с 1 replica это может быть узким местом

---

## 8. Request Body Size

### ❌ Low
- Нет ограничения на размер тела запроса
- Для ERP с потенциально большими заказами (>1000 items) нужно ограничение

---

## Итоговая оценка: 7.0 / 10

### Ключевые проблемы:
1. **High** — Кэш (Redis) есть, но не используется для permissions, customers, products
2. **High** — N+1 запросы в нескольких местах (findMany + count)
3. **Medium** — Offset pagination на больших таблицах
4. **Medium** — Нет connection pool tuning
5. **Low** — Нет batch endpoints для массовых операций
