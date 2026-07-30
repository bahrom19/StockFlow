# StockFlow API Contract v1.0

> Дата вступления в силу: 2026-07-30
> Статус: **Утверждён**
> Версия: 1.0.0

---

## Содержание

1. [Naming Convention](#1-naming-convention)
2. [Versioning Policy](#2-versioning-policy)
3. [Base URL](#3-base-url)
4. [Authentication & JWT Flow](#4-authentication--jwt-flow)
5. [RBAC / Permissions Flow](#5-rbac--permissions-flow)
6. [Standard Response Format](#6-standard-response-format)
7. [Error Format](#7-error-format)
8. [Pagination](#8-pagination)
9. [Common Query Parameters](#9-common-query-parameters)
10. [Auth](#10-auth)
11. [Users](#11-users)
12. [Products](#12-products)
13. [Customers](#13-customers)
14. [Suppliers](#14-suppliers)
15. [CRM](#15-crm)
16. [Inventory](#16-inventory)
17. [Sales](#17-sales)
18. [Purchasing](#18-purchasing)
19. [Finance](#19-finance)
20. [Reports](#20-reports)
21. [RBAC](#21-rbac)
22. [Billing](#22-billing)
23. [Compatibility Rules](#23-compatibility-rules)

---

## 1. Naming Convention

| Элемент | Правило | Пример |
|---------|---------|--------|
| **URL path** | `kebab-case`, plural nouns | `/purchase-orders`, `/cash-shifts` |
| **URL segments** | lowercase | `/inventory/stock/adjust` |
| **Query params** | `camelCase` | `?sortBy=name&sortOrder=asc` |
| **JSON fields** | `camelCase` | `firstName`, `companyId`, `rowVersion` |
| **Enum values** | `SCREAMING_SNAKE_CASE` | `DRAFT`, `PARTIALLY_RECEIVED` |
| **Timestamp format** | ISO 8601 UTC | `2026-07-30T12:00:00.000Z` |
| **Decimal amounts** | String with 4 decimal places | `"1234.5678"` |
| **ID format** | UUID v4 | `"550e8400-e29b-41d4-a716-446655440000"` |

### HTTP Methods

| Method | Семантика |
|--------|-----------|
| `GET` | Read resources (idempotent, safe) |
| `POST` | Create resource (non-idempotent) |
| `PATCH` | Partial update (idempotent) |
| `DELETE` | Soft delete (set `deletedAt`, idempotent) |

### HTTP Status Codes

| Code | Когда использовать |
|------|-------------------|
| `200 OK` | GET/PATCH успешно |
| `201 Created` | POST успешно |
| `204 No Content` | DELETE успешно (тело отсутствует) |
| `400 Bad Request` | Validation error, неверные параметры |
| `401 Unauthorized` | Отсутствует/невалидный JWT |
| `403 Forbidden` | Нет permission |
| `404 Not Found` | Ресурс не найден |
| `409 Conflict` | Duplicate, optimistic lock conflict |
| `422 Unprocessable` | Бизнес-правило нарушено (wrong status transition) |
| `429 Too Many Requests` | Rate limit превышен |
| `500 Internal Server Error` | Непредвиденная ошибка |
| `503 Service Unavailable` | Сервис временно недоступен |

---

## 2. Versioning Policy

- **URL-based versioning**: `/api/v1/...`
- **Header-based versioning**: `X-API-Version: 2026-07-30`
- Текущая версия: **v1**
- Политика совместимости:
  - Добавление **новых полей** в ответ — **совместимо**
  - Добавление **необязательных** query params — **совместимо**
  - Удаление/переименование полей — **breaking change** → новая мажорная версия
  - Изменение типа поля — **breaking change** → новая мажорная версия

---

## 3. Base URL

```typescript
// Development
baseUrl: string = 'http://localhost:3000/api/v1'

// Production
baseUrl: string = 'https://api.stockflow.app/api/v1'

// Headers для каждого запроса
Content-Type: application/json
Accept: application/json
Authorization: Bearer <jwt_access_token>  // кроме auth endpoints
X-Company-ID: <company_uuid>              // опционально, извлекается из JWT
```

---

## 4. Authentication & JWT Flow

### 4.1 Register

```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "My Company"
}
```

Response `201`:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl...",
  "expiresIn": "900",
  "refreshExpiresIn": "604800",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "companyId": "550e8400-e29b-41d4-a716-446655440001",
    "roles": ["Admin"],
    "permissions": ["products:create", "products:read", "..."]
  }
}
```

### 4.2 Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123!"
}
```

Response `200`: (same shape as register)

> ⚠️ Rate limited: **5 запросов в минуту**

### 4.3 Refresh Token

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl..."
}
```

Response `200`: (same shape as register)

### 4.4 Logout

```http
POST /auth/logout
Content-Type: application/json

{
  "refreshToken": "dGhpcyBpcyBhIHJlZnJl..."
}
```

Response `200`:
```json
{
  "message": "Logged out successfully"
}
```

### 4.5 Get Profile (GET /auth/me)

```http
GET /auth/me
Authorization: Bearer <access_token>
```

Response `200`:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "companyId": "550e8400-e29b-41d4-a716-446655440001",
  "roles": ["Admin"],
  "permissions": ["products:create", "products:read", "..."]
}
```

### 4.6 AuthResponse (shared shape)

```typescript
interface AuthResponse {
  accessToken: string;         // JWT access token
  refreshToken: string;        // Opaque refresh token
  expiresIn: string;           // Access token TTL in seconds ("900")
  refreshExpiresIn: string;    // Refresh token TTL in seconds ("604800")
  user: AuthUser;
}

interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  companyId: string;
  roles: string[];
  permissions: string[];
}
```

### 4.7 JWT Payload

```typescript
interface JwtPayload {
  userId: string;
  companyId: string;
  roles: string[];
  email: string;
}
```

### 4.8 Token Lifecycle

1. Access token: 15 минут (900 сек)
2. Refresh token: 7 дней (604800 сек), хранится в БД (hashed bcrypt)
3. Refresh token rotation: при каждом refresh старый токен инвалидируется
4. Login lockout: после 5 неудачных попыток — блокировка на 15 минут

---

## 5. RBAC / Permissions Flow

- Все endpoints (кроме `/auth/*`) защищены `@UseGuards(JwtAuthGuard, RolesGuard)`
- Permission проверяется через `@RequirePermission('<module>:<action>')`
- Формат permission: `{module}:{action}`
- Доступные модули: `products`, `crm`, `suppliers`, `inventory`, `sales`, `purchasing`, `finance`, `reports`, `users`, `roles`, `billing`
- Доступные действия: `create`, `read`, `update`, `delete`, `assign`, `post`, `close`, `shift`, `refund`, `reserve`, `period-close`

### Управление ролями

```http
POST /rbac/roles/assign    {"userId": "uuid", "roleId": "uuid"}
POST /rbac/roles/unassign  {"userId": "uuid", "roleId": "uuid"}
```

---

## 6. Standard Response Format

### Успешный ответ (один объект)

```json
{
  "id": "uuid",
  "name": "Some Entity",
  ...
}
```

### Успешный ответ (список с пагинацией)

```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### Успешный ответ (204 No Content)

Тело отсутствует. Используется для `DELETE`.

---

## 7. Error Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "errors": [
    {
      "field": "email",
      "message": "email must be a valid email address"
    }
  ],
  "timestamp": "2026-07-30T12:00:00.000Z",
  "path": "/api/v1/products"
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `statusCode` | number | HTTP статус |
| `message` | string | Человекочитаемое сообщение |
| `error` | string | HTTP статус text |
| `errors` | array | Детали валидации (optional) |
| `timestamp` | string | ISO 8601 |
| `path` | string | Путь запроса |

---

## 8. Pagination

### Request

| Параметр | Тип | Дефолт | Описание |
|----------|-----|--------|----------|
| `page` | number | 1 | Номер страницы (≥1) |
| `limit` | number | 20 | Элементов на странице (1-100) |
| `sortBy` | string | `createdAt` | Поле для сортировки |
| `sortOrder` | string | `desc` | `asc` или `desc` |

### Response

```json
{
  "items": [],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

### Nested paginated resources

- `/rbac/permissions?module=inventory&page=1&limit=20`
- `/reports/sales?dateFrom=2026-01-01&dateTo=2026-07-30&page=1&limit=20`

---

## 9. Common Query Parameters

| Параметр | Тип | Модули | Описание |
|----------|-----|--------|----------|
| `search` | string | Все | Полнотекстовый поиск |
| `isActive` | boolean | Почти все | Фильтр по активности |
| `dateFrom` | ISO date | Sales, Finance, Reports | Начало периода |
| `dateTo` | ISO date | Sales, Finance, Reports | Конец периода |
| `status` | enum | Sales, Purchasing, Finance | Фильтр по статусу |

---

## 10. Auth

Базовый путь: `/auth`

| Method | Path | Auth | Permission | Описание |
|--------|------|------|------------|----------|
| POST | `/auth/register` | ❌ | — | Регистрация нового пользователя + компании |
| POST | `/auth/login` | ❌ | — | Логин (rate limit: 5/мин) |
| POST | `/auth/refresh` | ❌ | — | Обновление токена |
| POST | `/auth/logout` | ❌ | — | Инвалидация refresh токена |
| GET | `/auth/me` | ✅ JWT | — | Профиль текущего пользователя |

**DTO:**

```typescript
// RegisterDto
{
  email: string;          // валидный email
  password: string;       // min 8, max 128
  firstName?: string;
  lastName?: string;
  companyName: string;
}

// LoginDto
{
  email: string;
  password: string;
}

// RefreshTokenDto
{
  refreshToken: string;
}

// LogoutDto
{
  refreshToken: string;
}
```

---

## 11. Users

Базовый путь: `/users`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/users` | `users:create` | Создать пользователя |
| GET | `/users` | `users:read` | Список пользователей |
| GET | `/users/:id` | `users:read` | Получить пользователя по ID |
| GET | `/users/email/:email` | `users:read` | Получить пользователя по email |
| PATCH | `/users/:id` | `users:update` | Обновить пользователя |
| DELETE | `/users/:id` | `users:delete` | Soft delete пользователя |

**Response (UserEntity):**

```typescript
{
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  companyId: string;
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
  deletedAt: string | null;
}
```

---

## 12. Products

Базовый путь: `/products`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/products` | — (JWT only) | Создать товар |
| GET | `/products` | — (JWT only) | Список товаров |
| GET | `/products/:id` | — (JWT only) | Получить товар |
| PATCH | `/products/:id` | — (JWT only) | Обновить товар |
| DELETE | `/products/:id` | — (JWT only) | Soft delete товара |

**Query params (GET /products):** `search`, `name`, `sku`, `barcode`, `category`, `isActive`, `page`, `limit`, `sortBy`, `sortOrder`

**Response (ProductEntity):**
```typescript
{
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  sku: string | null;
  barcode: string | null;
  price: number;             // Decimal stored as number
  costPrice: number | null;
  unit: string | null;
  category: string | null;
  brand: string | null;
  stockQuantity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
```

---

## 13. Customers

Базовый путь: `/customers`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/customers` | `crm:create` | Создать клиента |
| GET | `/customers` | `crm:read` | Список клиентов |
| GET | `/customers/:id` | `crm:read` | Получить клиента |
| PATCH | `/customers/:id` | `crm:update` | Обновить клиента |
| DELETE | `/customers/:id` | `crm:delete` | Soft delete клиента |

**Response (CustomerEntity):**
```typescript
{
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
```

---

## 14. Suppliers

Базовый путь: `/suppliers`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/suppliers` | `suppliers:create` | Создать поставщика |
| GET | `/suppliers` | `suppliers:read` | Список поставщиков |
| GET | `/suppliers/:id` | `suppliers:read` | Получить поставщика |
| PATCH | `/suppliers/:id` | `suppliers:update` | Обновить поставщика |
| DELETE | `/suppliers/:id` | `suppliers:delete` | Soft delete (204) |

**Response (SupplierEntity):**
```typescript
{
  id: string;
  companyId: string;
  companyName: string;
  bin: string | null;         // Business Identification Number
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
```

---

## 15. CRM

### Customers (альтернативный путь)
**Используйте основной `/customers`.** Mobile использует `/crm/customers` — **несовместимость**.

### Customer Groups
Базовый путь: `/crm/customer-groups`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/crm/customer-groups` | `crm:*` | Группы клиентов |

### Contacts
Базовый путь: `/crm/contacts`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/crm/contacts` | `crm:*` | Контакты |

### Addresses
Базовый путь: `/crm/addresses`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/crm/addresses` | `crm:*` | Адреса клиентов |

### Opportunities
Базовый путь: `/crm/opportunities`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/crm/opportunities` | `crm:*` | Продажные возможности |

### Tasks
Базовый путь: `/crm/tasks`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/crm/tasks` | `crm:*` | Задачи |

### Price Lists
Базовый путь: `/crm/price-lists`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/crm/price-lists` | `crm:*` | Ценовые листы |

### Credit Limits
Базовый путь: `/crm/credit-limits`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/crm/credit-limits` | `crm:*` | Кредитные лимиты |
| GET | `/crm/credit-limits/customer/:customerId` | `crm:read` | Лимит по клиенту |

### Customer Notes
Базовый путь: `/crm/customer-notes`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/crm/customer-notes/:customerId` | `crm:create` | Создать заметку |
| GET | `/crm/customer-notes` | `crm:read` | Список заметок |
| DELETE | `/crm/customer-notes/:id` | `crm:delete` | Удалить заметку |

### Loyalty
Базовый путь: `/crm/loyalty`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| GET | `/crm/loyalty/:customerId` | `crm:read` | Аккаунт лояльности |
| POST | `/crm/loyalty/earn` | `crm:update` | Начислить баллы |
| POST | `/crm/loyalty/redeem` | `crm:update` | Списать баллы |
| GET | `/crm/loyalty/:accountId/transactions` | `crm:read` | История транзакций |

---

## 16. Inventory

### Stock Levels
Базовый путь: `/inventory/stock`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| GET | `/inventory/stock` | `inventory:read` | Все остатки (пагинация) |
| GET | `/inventory/stock/movements` | `inventory:read` | История движений |
| GET | `/inventory/stock/:productId` | `inventory:read` | Остатки по товару |
| POST | `/inventory/stock/adjust` | `inventory:adjust` | Корректировка остатка |
| POST | `/inventory/stock/transfer` | `inventory:transfer` | Перемещение между складами |

### Warehouses
Базовый путь: `/inventory/warehouses`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/inventory/warehouses` | `inventory:*` | Склады (CRUD + soft delete) |

### Barcodes
Базовый путь: `/inventory/barcodes`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| GET | `/inventory/barcodes/search?q=` | `inventory:read` | Поиск по штрих-коду |
| GET | `/inventory/barcodes/:productId` | `inventory:read` | Штрих-коды товара |
| GET | `/inventory/barcodes/:productId/generate` | `inventory:read` | Сгенерировать штрих-код |
| POST | `/inventory/barcodes` | `inventory:create` | Создать штрих-код |
| PATCH | `/inventory/barcodes/:id` | `inventory:update` | Обновить |
| DELETE | `/inventory/barcodes/:id` | `inventory:delete` | Удалить |

### Variants
Базовый путь: `/inventory/variants`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| GET | `/inventory/variants/:productId` | `inventory:read` | Варианты товара |
| GET | `/inventory/variants/:productId/generate-sku` | `inventory:read` | Генерация SKU |
| POST | `/inventory/variants` | `inventory:create` | Создать вариант |
| PATCH | `/inventory/variants/:id` | `inventory:update` | Обновить |
| DELETE | `/inventory/variants/:id` | `inventory:delete` | Удалить |

### Batches
Базовый путь: `/inventory/batches`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| GET | `/inventory/batches/:productId` | `inventory:read` | Партии товара |
| POST | `/inventory/batches` | `inventory:create` | Создать партию |

### Units of Measure
Базовый путь: `/inventory/uom`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/inventory/uom` | `inventory:*` | Единицы измерения |

### Inventory Counts
Базовый путь: `/inventory/counts`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| GET | `/inventory/counts` | `inventory:read` | Инвентаризации |
| GET | `/inventory/counts/:id` | `inventory:read` | Детали |
| POST | `/inventory/counts` | `inventory:create` | Создать инвентаризацию |
| POST | `/inventory/counts/:id/complete` | `inventory:update` | Завершить |

### Valuation
Базовый путь: `/inventory/valuation`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| GET | `/inventory/valuation` | `inventory:read` | Оценка всех товаров |
| GET | `/inventory/valuation/:productId` | `inventory:read` | Оценка товара |

### Reservations
Базовый путь: `/inventory/reservations`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/inventory/reservations/reserve` | `inventory:reserve` | Зарезервировать |
| POST | `/inventory/reservations/release` | `inventory:reserve` | Освободить |

---

## 17. Sales

Базовый путь: `/sales`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/sales` | `sales:create` | Создать продажу (DRAFT) |
| GET | `/sales` | `sales:read` | Список продаж |
| GET | `/sales/next-number` | `sales:create` | Следующий номер |
| GET | `/sales/receipt/:id` | `sales:read` | Чек продажи |
| GET | `/sales/:id` | `sales:read` | Детали продажи |
| PATCH | `/sales/:id` | `sales:update` | Обновить draft |
| DELETE | `/sales/:id` | `sales:cancel` | Удалить draft (204) |
| PATCH | `/sales/:id/status?status=` | `sales:update` | Сменить статус |
| POST | `/sales/:id/complete` | `sales:update` | Завершить (уменьшить остатки) |
| POST | `/sales/:id/cancel` | `sales:cancel` | Отменить |
| POST | `/sales/:id/refund` | `sales:refund` | Возврат (восстановить остатки) |

### SaleStatus Enum
```typescript
enum SaleStatus {
  DRAFT,
  PENDING,
  COMPLETED,
  REFUNDED,
  CANCELLED,
  PARTIALLY_REFUNDED
}
```

### CreateSaleDto
```typescript
{
  warehouseId: string;
  customerId?: string;
  saleNumber?: string;
  currency: string;           // default "KZT"
  notes?: string;
  items: [
    {
      productId: string;
      quantity: number;
      unitPrice: number;
      costPrice?: number;
      discount?: number;      // default 0
    }
  ];
  payments: [
    {
      method: string;         // CASH | CARD | QR | BANK_TRANSFER | GIFT_CARD | STORE_CREDIT
      amount: number;
      reference?: string;
    }
  ];
}
```

### SaleEntity
```typescript
{
  id: string;
  companyId: string;
  warehouseId: string;
  cashierId: string;
  customerId: string | null;
  saleNumber: string;
  status: string;             // SaleStatus
  subtotal: string;           // decimal
  discount: string;
  tax: string;
  total: string;
  paidAmount: string;
  changeAmount: string;
  currency: string;
  notes: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  items: [...];
  payments: [...];
  receipts: [...];
}
```

### Cash Shifts
Базовый путь: `/sales/cash-shifts`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/sales/cash-shifts/open` | `sales:shift` | Открыть смену |
| POST | `/sales/cash-shifts/close?warehouseId=` | `sales:shift` | Закрыть смену |
| POST | `/sales/cash-shifts/cash-in?warehouseId=` | `sales:shift` | Внесение |
| POST | `/sales/cash-shifts/cash-out?warehouseId=` | `sales:shift` | Изъятие |
| GET | `/sales/cash-shifts/x-report?warehouseId=` | `sales:shift` | X-отчёт |
| GET | `/sales/cash-shifts/z-report/:id` | `sales:shift` | Z-отчёт |
| GET | `/sales/cash-shifts` | `sales:shift` | Все смены |

---

## 18. Purchasing

### Purchase Orders
Базовый путь: `/purchasing/purchase-orders`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/purchasing/purchase-orders` | `purchasing:create` | Создать PO |
| GET | `/purchasing/purchase-orders` | `purchasing:read` | Список PO |
| GET | `/purchasing/purchase-orders/next-number` | `purchasing:read` | Следующий номер |
| GET | `/purchasing/purchase-orders/:id` | `purchasing:read` | Детали PO |
| PATCH | `/purchasing/purchase-orders/:id` | `purchasing:update` | Обновить draft |
| DELETE | `/purchasing/purchase-orders/:id` | `purchasing:delete` | Удалить draft (204) |
| PATCH | `/purchasing/purchase-orders/:id/status?status=` | `purchasing:update` | Сменить статус |

### PurchaseOrderStatus Enum
```typescript
enum PurchaseOrderStatus {
  DRAFT,
  PENDING,
  APPROVED,
  ORDERED,
  PARTIALLY_RECEIVED,
  RECEIVED,
  CANCELLED
}
```

### Goods Receipts
Базовый путь: `/purchasing/goods-receipts`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/purchasing/goods-receipts` | `purchasing:create` | Приёмка товаров |
| GET | `/purchasing/goods-receipts` | `purchasing:read` | Список приёмок |
| GET | `/purchasing/goods-receipts/:id` | `purchasing:read` | Детали |
| DELETE | `/purchasing/goods-receipts/:id` | `purchasing:delete` | Удалить draft (204) |

### Purchase Returns
Базовый путь: `/purchasing/purchase-returns`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/purchasing/purchase-returns` | `purchasing:create` | Возврат поставщику |
| GET | `/purchasing/purchase-returns` | `purchasing:read` | Список возвратов |
| GET | `/purchasing/purchase-returns/:id` | `purchasing:read` | Детали |
| PATCH | `/purchasing/purchase-returns/:id` | `purchasing:update` | Обновить draft |
| DELETE | `/purchasing/purchase-returns/:id` | `purchasing:delete` | Удалить draft (204) |
| PATCH | `/purchasing/purchase-returns/:id/status?status=` | `purchasing:update` | Сменить статус |

### Purchase Invoice
Базовый путь: `/purchasing/invoices`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/purchasing/invoices` | `purchasing:create` | Создать invoice |
| GET | `/purchasing/invoices` | `purchasing:read` | Список |
| GET | `/purchasing/invoices/:id` | `purchasing:read` | Детали |
| DELETE | `/purchasing/invoices/:id` | `purchasing:delete` | Удалить draft (204) |
| PATCH | `/purchasing/invoices/:id/status?status=` | `purchasing:update` | Сменить статус |

### RFQs
Базовый путь: `/purchasing/rfqs`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD + status | `/purchasing/rfqs` | `purchasing:*` | Запросы предложений |

### Supplier Quotations
Базовый путь: `/purchasing/quotations`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD + status | `/purchasing/quotations` | `purchasing:*` | Коммерческие предложения |

---

## 19. Finance

### Chart of Accounts
Базовый путь: `/finance/chart-of-accounts`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/finance/chart-of-accounts` | `finance:*` | План счетов |

### Journal Entries
Базовый путь: `/finance/journal-entries`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/finance/journal-entries` | `finance:create` | Создать проводку (DRAFT) |
| GET | `/finance/journal-entries` | `finance:read` | Список |
| GET | `/finance/journal-entries/:id` | `finance:read` | Детали |
| PATCH | `/finance/journal-entries/:id` | `finance:update` | Обновить draft |
| POST | `/finance/journal-entries/:id/post` | `finance:post` | Опубликовать |

### GL Engine
Базовый путь: `/finance/gl`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/finance/gl/post` | `finance:post` | Создать и сразу опубликовать |
| POST | `/finance/gl/:id/reverse` | `finance:post` | Сторнировать |
| POST | `/finance/gl/fiscal-year/:year/close` | `finance:close` | Закрыть год |

### Ledger
Базовый путь: `/finance/ledger`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| GET | `/finance/ledger/:accountId` | `finance:read` | GL с running balance |
| GET | `/finance/ledger/balances/account` | `finance:read` | Балансы счетов |
| GET | `/finance/ledger/trial-balance` | `finance:read` | Оборотно-сальдовая |

### Financial Periods
Базовый путь: `/finance/financial-periods`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD + close | `/finance/financial-periods` | `finance:*` | Финансовые периоды |

### Financial Transactions
Базовый путь: `/finance/financial-transactions`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRD | `/finance/financial-transactions` | `finance:*` | Банковские транзакции |

### Bank Accounts
Базовый путь: `/finance/bank-accounts`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/finance/bank-accounts` | `finance:*` | Банковские счета |

### Cash Accounts
Базовый путь: `/finance/cash-accounts`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/finance/cash-accounts` | `finance:*` | Кассы |

---

## 20. Reports

Базовый путь: `/reports`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| GET | `/reports/dashboard` | `reports:read` | Dashboard summary |
| GET | `/reports/sales` | `reports:read` | Sales report |
| GET | `/reports/products/top` | `reports:read` | Top products |
| GET | `/reports/inventory/low-stock` | `reports:read` | Low stock |
| GET | `/reports/inventory/value` | `reports:read` | Inventory valuation |
| GET | `/reports/customers` | `reports:read` | Customer report |
| GET | `/reports/suppliers` | `reports:read` | Supplier report |
| GET | `/reports/purchasing` | `reports:read` | Purchasing report |
| GET | `/reports/cash-shifts` | `reports:read` | Cash shift report |
| GET | `/reports/profit` | `reports:read` | Profit report |

---

## 21. RBAC

### Permissions
Базовый путь: `/rbac/permissions`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/rbac/permissions` | `roles:*` | Управление permissions |
| GET | `/rbac/permissions/code/:code` | `roles:read` | Поиск по коду |

### Roles
Базовый путь: `/rbac/roles`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/rbac/roles` | `roles:*` | Управление ролями |
| POST | `/rbac/roles/assign` | `roles:assign` | Назначить роль |
| POST | `/rbac/roles/unassign` | `roles:assign` | Снять роль |
| GET | `/rbac/roles/users/list` | `roles:read` | Пользователи с ролями |

---

## 22. Billing

### Subscription Plans
Базовый путь: `/billing/plans`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| CRUD | `/billing/plans` | `admin:billing` / `billing:read` | Тарифные планы |
| GET | `/billing/plans/code/:code` | `billing:read` | Поиск по коду |

### Company Subscriptions
Базовый путь: `/billing/subscription`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| POST | `/billing/subscription` | `billing:create` | Создать подписку (trial) |
| GET | `/billing/subscription` | `billing:read` | Текущая подписка |
| GET | `/billing/subscription/all` | `admin:billing` | Все подписки (admin) |
| PATCH | `/billing/subscription/plan` | `billing:update` | Сменить план |
| POST | `/billing/subscription/cancel` | `billing:update` | Отменить |
| POST | `/billing/subscription/resume` | `billing:update` | Возобновить |
| POST | `/billing/subscription/status` | `admin:billing` | Сменить статус |
| GET | `/billing/subscription/:id` | `billing:read` | Детали подписки |

### Invoices
Базовый путь: `/billing/invoices`

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| GET | `/billing/invoices` | `billing:read` | Список инвойсов |
| GET | `/billing/invoices/:id` | `billing:read` | Детали |
| POST | `/billing/invoices/:id/pay` | `billing:create` | Оплатить (manual) |
| POST | `/billing/invoices/:id/void` | `admin:billing` | Аннулировать |

---

## 23. Compatibility Rules

### Добавление новых полей (backward compatible)
```diff
+ "permissions": ["products:create"]
```
Фронтенд должен игнорировать неизвестные поля.

### Изменение пути (breaking change)
```diff
- /crm/customers
+ /customers
```
Требуется новая версия API или редирект.

### Изменение типа поля (breaking change)
```diff
- "expiresIn": "900"
+ "expiresIn": 900
```
Требуется новая версия API.

### Удаление поля (breaking change)
```diff
- "expiresIn": "900"
```
Требуется новая версия API.

### Добавление обязательного поля (breaking change)
```diff
+ "phone": "string" // required
```
Требуется новая версия API.

---

## Appendix A: Route Mismatch Report (StockFlow Backend ↔ Mobile)

| # | Severity | Mobile Path | Backend Path | Статус |
|---|----------|-------------|--------------|--------|
| 1 | 🔴 CRITICAL | `GET /auth/me` | ✅ Исправлен в PR#1 Block1 | ✅ |
| 2 | 🟠 HIGH | `/crm/customers` | `/customers` | ❌ Not fixed |
| 3 | 🟠 HIGH | `/inventory/adjustments` | `/inventory/stock/adjust` | ❌ Not fixed |
| 4 | 🟠 HIGH | `/inventory/transfers` | `/inventory/stock/transfer` | ❌ Not fixed |
| 5 | 🟠 HIGH | `/inventory/movements` | `/inventory/stock/movements` | ❌ Not fixed |
| 6 | 🟡 MEDIUM | `/products/barcodes` | `/inventory/barcodes` | ❌ Not fixed |
| 7 | 🟡 MEDIUM | `/products/variants` | `/inventory/variants` | ❌ Not fixed |
| 8 | 🟡 MEDIUM | `/purchasing/orders` | `/purchasing/purchase-orders` | ❌ Not fixed |
| 9 | 🟡 MEDIUM | `/purchasing/goods-receipt` | `/purchasing/goods-receipts` | ❌ Not fixed |
| 10 | 🟡 MEDIUM | `/purchasing/returns` | `/purchasing/purchase-returns` | ❌ Not fixed |
| 11 | 🟢 LOW | `expiresIn`/`refreshExpiresIn`: string vs number | `string` (seconds as string) | ✅ OK |
| 12 | 🔵 INFO | `phone` в `CurrentUser` mobile — нет в `AuthUser` | Backend не возвращает `phone` | ❌ Not fixed |
| 13 | 🔵 INFO | `sales/receipt` path diff | Backend: `GET /sales/receipt/:id` — OK | ✅ OK |
| 14 | 🔵 INFO | `/billing/portal` в mobile — нет в backend | ❌ Not exists on backend | ❌ Not fixed |

---

*Документ является единым контрактом между Frontend (Mobile + Web) и Backend для StockFlow v1.0.*
*Любые изменения требуют утверждения архитектором и обновления этого документа.*
