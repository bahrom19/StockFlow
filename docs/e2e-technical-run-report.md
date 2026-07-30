# StockFlow — E2E Technical Run Report

> **Дата:** 2026-07-30
> **Метод:** Полный технический прогон через HTTP API как реальный пользователь.
> **Правило:** Только воспроизводимые ошибки. Никаких стилистических замечаний или предположений.

---

## Инфраструктура

**Запущено:**
- PostgreSQL 16 (Docker, localhost:5432)
- Redis 7 (Docker, localhost:6379)
- Backend (NestJS, localhost:3000)
- Prisma migrations — применены

**Health endpoints — все работают:**
- `GET /api/health/live` → `{"status":"ok"}`
- `GET /api/health/ready` → `{"status":"ok"}` (+ database + redis checks)
- `GET /api/health/metrics` → Prometheus format

**Портовая проблема:**
- Обнаружено: `PORT=63882` в окружении shell (установлен Freebuff) переопределяет `.env` значение `PORT=3000`.
- Причина: `app.config.ts` использует `process.env.PORT ?? '3000'` (проверка на null/undefined), но при наличии `PORT` в окружении `??` не срабатывает.
- **Severity:** MEDIUM — локальная разработка, production использует Railway

---

## Найденные ошибки

### B1. POST /api/products требует companyId в теле запроса

| Поле | Значение |
|------|----------|
| **Сценарий** | Создание товара |
| **Шаги** | `POST /api/products` с `{"name":"Test","sku":"SKU-001","price":1500}` |
| **Ожидание** | companyId извлекается из JWT (multi-tenant design) |
| **Факт** | `400 Bad Request: companyId should not be empty, companyId must be a string` |
| **Причина** | DTO валидация требует `companyId` в теле запроса. `forbidNonWhitelisted: true` в ValidationPipe не даёт опустить поле. |
| **Обход** | Передать `companyId` в теле (извлекается из JWT и перезаписывается сервисом) |
| **Severity** | **HIGH** — нарушение multi-tenant архитектуры, несоответствие API Contract |

### B2. POST /api/products требует stockQuantity в теле

| Поле | Значение |
|------|----------|
| **Сценарий** | Создание товара |
| **Шаги** | `POST /api/products` без `stockQuantity` |
| **Ожидание** | `stockQuantity` не обязателен при создании (по умолчанию 0) |
| **Факт** | `400 Bad Request: stockQuantity must not be less than 0, stockQuantity must be an integer number` |
| **Причина** | `@IsInt()` и `@Min(0)` без `@IsOptional()` на DTO |
| **Обход** | Передать `"stockQuantity": 0` |
| **Severity** | **MEDIUM** — путает пользователя, KNOWN_LIMITATIONS 2.2 уже описывает это |

### B3. POST /api/suppliers DTO не соответствует API Contract

| Поле | Значение |
|------|----------|
| **Сценарий** | Создание поставщика |
| **Шаги** | `POST /api/suppliers` с `{"name":"...","contactPerson":"...","phone":"..."}` |
| **Ожидание** | Поле `name` для названия компании, `contactPerson` для контактного лица |
| **Факт** | `400 Bad Request: property contactPerson should not exist, property name should not exist`. Ожидаются поля: `companyName`, отсутствует `contactPerson` |
| **Причина** | DTO использует `companyName` вместо `name`, и не имеет поля `contactPerson` |
| **Severity** | **MEDIUM** — breaking change для frontend, ожидающего `name` как в API Contract |

### B4. POST /api/inventory/warehouses — 403 Forbidden даже для Admin

| Поле | Значение |
|------|----------|
| **Сценарий** | Создание склада |
| **Шаги** | `POST /api/inventory/warehouses` с JWT пользователя, имеющего роль Admin и все permissions |
| **Ожидание** | Admin может создавать склады (201 Created) |
| **Факт** | `403 Forbidden: Insufficient permissions` |
| **Причина** | `inventory:read`, `inventory:adjust`, `inventory:transfer` permissions существуют, но НЕТ `inventory:create` или `warehouse:create` permission. Permission `inventory:read` назначен Admin роли, но для создания склада требуется другой permission, которого не существует в системе. |
| **Проверка** | `GET /api/rbac/permissions` → нет ни одного permission с `warehouse` в названии |
| **Severity** | **HIGH** — невозможно создать склад вообще (ни через API, ни через UI) |

### B5. PATCH /api/purchasing/purchase-orders/{id}/status — status не читается

| Поле | Значение |
|------|----------|
| **Сценарий** | Изменение статуса Purchase Order |
| **Шаги** | `PATCH /api/purchasing/purchase-orders/{id}/status` с body `{"status":"PENDING"}` |
| **Ожидание** | Статус меняется на PENDING |
| **Факт** | `400 Bad Request: Cannot transition from DRAFT to undefined`. Поле `status` из body не прочитано. |
| **Причина** | DTO для status transition использует другое имя поля или `@Body()` без `@Body('status')` или `@Transform()`, при этом `validationPipe` с `forbidNonWhitelisted: true` не пропускает поле |
| **Severity** | **HIGH** — полный lifecycle Purchase Order (DRAFT → PENDING → APPROVED → ORDERED) **недоступен** через API. Функция закупок заблокирована. |

### B6. POST /api/sales требует warehouseId, который невозможно получить

| Поле | Значение |
|------|----------|
| **Сценарий** | Создание продажи |
| **Шаги** | `POST /api/sales` с `{"items":[...],"payments":[...]}` |
| **Ожидание** | Продажа создаётся (B5 заблокирован, но sales должен работать) |
| **Факт** | `400 Bad Request: warehouseId should not be empty, warehouseId must be a string` |
| **Причина** | Sales требует warehouseId, но создать warehouse невозможно (B4 — 403 Forbidden). Циркулярная зависимость. |
| **Severity** | **HIGH** — продажи заблокированы, так как warehouseId обязателен, а warehouse создать нельзя |

### B7. /api/finance/ledger и /api/finance/accounts — 404

| Поле | Значение |
|------|----------|
| **Сценарий** | Просмотр GL и счетов |
| **Шаги** | `GET /api/finance/ledger`, `GET /api/finance/accounts` |
| **Ожидание** | 200 + данные |
| **Факт** | `404 Cannot GET /api/finance/ledger`. Endpoints не зарегистрированы. |
| **Причина** | Finance модуль использует другие пути (например, `/api/finance/ledger-query`) |
| **Severity** | **LOW** — frontend может найти правильный endpoint через Swagger |

### B8. Register response возвращает пустой массив permissions

| Поле | Значение |
|------|----------|
| **Сценарий** | Регистрация нового пользователя |
| **Шаги** | `POST /api/auth/register` |
| **Ожидание** | `permissions: [...]` со всеми permissions роли Admin |
| **Факт** | Register response: `"permissions": []` (пусто). GET /auth/me показывает все 49 permissions. |
| **Причина** | PermissionsSeedService работает асинхронно (OnModuleInit), permissions создаются после старта модуля. При регистрации пользователя permissions ещё могут не существовать в БД. |
| **Severity** | **MEDIUM** — frontend при регистрации не видит permissions, требуется дополнительный запрос GET /auth/me |

---

## Проверенные сценарии без ошибок

| Сценарий | Результат |
|----------|-----------|
| POST /auth/register | ✅ 201 — пользователь + компания созданы |
| POST /auth/login | ✅ 200 — access + refresh tokens |
| POST /auth/refresh | ✅ 200 — новые токены |
| POST /auth/logout | ✅ 200 — token invalidated |
| GET /auth/me | ✅ 200 — профиль + permissions |
| POST /auth/login rate limit | ✅ 429 — после 5 запросов в минуту |
| Reuse old refresh after logout | ✅ 401 — "Invalid refresh token" |
| POST /products (с companyId) | ✅ 201 — товар создан |
| GET /products (с пагинацией) | ✅ 200 — list |
| PATCH /products/{id} | ✅ 200 — обновление |
| POST /suppliers (с companyName) | ✅ 201 — поставщик создан |
| POST /purchasing/purchase-orders | ✅ 201 — PO создан (DRAFT) |
| GET /inventory/stock | ✅ 200 — пустой список |
| GET /reports/dashboard | ✅ 200 — 8 метрик |
| GET /reports/sales | ✅ 200 — пустой отчёт |
| GET /reports/profit | ✅ 200 — нулевой отчёт |
| GET /api/rbac/roles | ✅ 200 — Admin роль |
| GET /api/rbac/permissions | ✅ 200 — 49 permissions |
| POST /api/customers (с companyId) | ✅ 201 — клиент создан |

---

## Сводка

| # | Описание | Severity | Блокирует |
|---|----------|----------|-----------|
| B1 | Products: companyId обязателен в теле | HIGH | Создание товара через frontend |
| B2 | Products: stockQuantity обязателен | MEDIUM | — |
| B3 | Suppliers: DTO mismatch (companyName vs name) | MEDIUM | Frontend с полем `name` |
| **B4** | **Warehouses: 403 Forbidden для Admin** | **HIGH** | **Склад нельзя создать** |
| **B5** | **PO status PATCH не читает status из body** | **HIGH** | **PO lifecycle заблокирован** |
| **B6** | **Sales требует warehouseId, который нельзя получить** | **HIGH** | **Продажи заблокированы** |
| B7 | Finance endpoints 404 | LOW | — |
| B8 | Register: пустой permissions | MEDIUM | — |

### 3 Blocker-ошибки для бизнес-процессов:

1. **B4 (Warehouses 403)** → нельзя создать склад → B6 (Sales требует warehouse) → **продажи недоступны**
2. **B5 (PO status не читается)** → нельзя перевести PO из DRAFT → **закупки недоступны**  
3. **B4 + B5 → полная блокировка Purchasing + Sales workflows**

### Причина большинства проблем

`ValidationPipe({ forbidNonWhitelisted: true })` в `main.ts` — глобальный pipe запрещает любые поля, не описанные в DTO. При этом `companyId` **обязателен** в DTO многих модулей (products, customers, suppliers), хотя должен извлекаться из JWT. А поле `status` в PATCH purchase-orders не читается, так как его имя в DTO отличается.

### Вердикт

**Систему нельзя использовать для бизнес-процессов до исправления B4, B5 и B6.** Без склада и статусных переходов PO невозможно выполнить ни закупку, ни продажу.
