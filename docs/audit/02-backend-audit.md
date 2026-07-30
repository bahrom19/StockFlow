# Backend Audit — StockFlow

---

## Общая оценка: 7.0 / 10

Стек: NestJS 11, TypeScript 5.6, Prisma 6, PostgreSQL, Redis, JWT, Swagger

---

## 1. Сервисы

### ✅ Сильные стороны
- Использование `$transaction` для атомарных операций (AuthService, CustomersService, SalesService)
- Dependency Injection через конструктор (правильный NestJS подход)
- EventBus для слабой связности модулей
- AuditLogService для отслеживания изменений
- Optimistic Locking через `rowVersion`

### ❌ Проблемы

| # | Критичность | Файл | Проблема |
|---|------------|------|----------|
| 1 | **High** | `CustomersService` | Дублирование `findById` — вызывается дважды в `update` и `softDelete` (сначала для проверки существования, потом для получения before-слепка) |
| 2 | **Medium** | `CustomersService` | `as Prisma.CustomerCreateInput` — type assertion на каждой операции. Маскирует ошибки типизации |
| 3 | **Medium** | `SalesService` | 400+ строк — God Service. Смешаны расчёты, валидация, работа со статусами, кассой, receipt, аудит, события |
| 4 | **Medium** | `AuthService` | Регистрация создаёт компанию, пользователя, роль, выдаёт права — нарушение SRP |
| 5 | **Low** | Все сервисы | Нет rate limiting на уровне отдельных эндпоинтов (только глобальный) |

---

## 2. Контроллеры

### ✅ Хорошо
- Тонкие — только декораторы и делегирование сервису
- JwtAuthGuard на всех защищённых эндпоинтах
- RolesGuard с `@RequirePermission` декларатором
- HttpCode возвращает правильные статусы
- Swagger декораторы (ApiTags, ApiOperation, ApiResponse)

### ❌ Проблемы

| # | Критичность | Файл | Проблема |
|---|------------|------|----------|
| 1 | **Medium** | `AuthController` | Нет rate limiting на `/auth/login` — vulnerable to brute force (хотя есть account lockout, но это не заменяет rate limit) |
| 2 | **Medium** | `AuthController` | Нет CSP headers для Swagger UI |
| 3 | **Low** | Все контроллеры | Нет единого формата paginated response DTO — каждый возвращает `{ items, total, page, limit }` вручную |

---

## 3. DTO

### ❌ Проблемы

| # | Критичность | Файл | Проблема |
|---|------------|------|----------|
| 1 | **High** | `CreateCustomerDto:19` | `companyId!: string` — companyId передаётся из DTO, а должен браться из JWT Payload |
| 2 | **High** | `CustomerQueryDto:17` | `companyId?: string` — фильтр по companyId из query params может позволить меж-tenant запросы |
| 3 | **Medium** | `LoginDto` | Нет rate limiting на уровне DTO |
| 4 | **Low** | Все DTO | Нет `@ApiProperty` на некоторых полях |

---

## 4. Guards

### ✅ Хорошо
- `JwtAuthGuard` — стандартный, через Passport
- `RolesGuard` — загружает permissions из БД, использует `@RequirePermission`
- `ThrottlerGuard` — глобальный rate limiter с 3 уровнями (short/medium/long)

### ❌ Проблемы

| # | Критичность | Файл | Проблема |
|---|------------|------|----------|
| 1 | **Medium** | `RolesGuard` | Загружает permissions из БД на КАЖДЫЙ запрос. Нет кэширования permissions |
| 2 | **Low** | `JwtAuthGuard` | Нет проверки на заблокированного пользователя на уровне guard |

---

## 5. Pipes

### ✅ Хорошо
- `ValidationPipe` с `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — глобально
- Использование `class-validator` и `class-transformer` для валидации

---

## 6. Interceptors

### ✅ Хорошо
- `MetricsInterceptor` — собирает метрики, длительность запросов, in-flight requests
- Обнаружение slow requests (>5s) с предупреждением
- Нормализация путей (`/api/users/uuid` вместо `/api/users/actual-uuid`)

### ❌ Проблемы

| # | Критичность | Файл | Проблема |
|---|------------|------|----------|
| 1 | **Low** | `MetricsInterceptor` | Нет response body size tracking |
| 2 | **Low** | `MetricsInterceptor` | Регулярка UUID может быть дорогой на каждый запрос |

---

## 7. Exception Filter

### ✅ Хорошо
- `GlobalExceptionFilter` — единый формат ошибок: `{ success: false, statusCode, message, error, timestamp, path, requestId }`
- Обрабатывает Prisma-specific исключения (P2002, P2025, validation, panic)

### ❌ Проблемы

| # | Критичность | Файл | Проблема |
|---|------------|------|----------|
| 1 | **Medium** | `GlobalExceptionFilter` | Дублирование кода — `Prisma.PrismaClientKnownRequestError` проверяется дважды в `getStatusCode` |
| 2 | **Low** | `GlobalExceptionFilter` | Нет sentry/error tracking integration |

---

## 8. Middleware

### ✅ Хорошо
- `RequestIdMiddleware` — добавляет `x-request-id` на каждый запрос
- Helmet — security headers
- Compression — gzip сжатие

---

## 9. Event Bus

### ✅ Хорошо
- Абстрактный `EventBus` interface — позволяет менять реализацию
- `InMemoryEventBus` — синхронное выполнение в рамках транзакции
- `context.transactionClient` — события выполняются внутри Prisma транзакции
- Подписка на события через `eventBus.subscribe()`

### ❌ Проблемы

| # | Критичность | Проблема | Описание |
|---|------------|----------|----------|
| 1 | **Medium** | Нет гарантии доставки | InMemoryEventBus теряет события при падении сервера |
| 2 | **Medium** | Синхронное выполнение | Один медленный handler блокирует весь publish и транзакцию |
| 3 | **High** | Нет Outbox Pattern | Критичные события (SaleCompleted) могут быть потеряны |

---

## 10. Scheduler

### ✅ Хорошо
- `BillingCronService` — использует `@nestjs/schedule` для периодических задач
- Billing модуль имеет свою cron-логику

---

## Итог: Ключевые проблемы

1. **High** — EventBus без Outbox Pattern (потеря событий)
2. **High** — DTO принимают `companyId` из тела/query запроса (меж-tenant атака)
3. **High** — God Services (SalesService 400+ строк)
4. **Medium** — Permissions загружаются на каждый запрос без кэша
5. **Medium** — Дублирование `findById` в CustomersService
6. **Medium** — Нет rate limit на login endpoint
