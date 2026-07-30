# Critical Issues Report — StockFlow

**Дата:** 30 июля 2026

---

## Critical (должно быть исправлено до релиза)

### CRIT-1: Production credentials в Git-репозитории

- **Файл:** `backend/.env`
- **Описание:** .env файл закоммичен в репозиторий с реальными production credentials:
  - DATABASE_URL с реальным паролем
  - REDIS_URL с реальным паролем
  - Слабый JWT_SECRET
- **Последствия:** Любой, у кого есть доступ к репозиторию, может подключиться к production БД и Redis
- **Решение:**
  1. Немедленно отозвать скомпрометированные credentials
  2. Добавить `.env` в `.gitignore`
  3. Сгенерировать новые secrets
  4. Использовать Railway secrets manager

---

### CRIT-2: Слабый JWT_SECRET

- **Файл:** `backend/.env`
- **Строка:** `JWT_SECRET=StockFlowSecret2026SuperStrongKey_123456`
- **Описание:** JWT secret — читаемая строка без спецсимволов, не-random
- **Последствия:** JWT токены могут быть подделаны (brute force или известная строка)
- **Решение:** `openssl rand -base64 64`

---

### CRIT-3: Нет Outbox Pattern для событий

- **Модуль:** EventBus (common/events)
- **Описание:** InMemoryEventBus теряет все события при падении сервера. Критичные события (SaleCompleted, PurchaseReceived) могут быть потеряны без возможности восстановления.
- **Последствия:** Потеря данных о продажах, движениях товара, финансовых транзакциях при сбое
- **Решение:** Внедрить Transactional Outbox pattern — записывать события в БД в той же транзакции, отправлять через background worker

---

### CRIT-4: DTO принимают companyId от клиента

- **Файл:** `backend/src/modules/customers/dto/create-customer.dto.ts:19`
- **Строка:** `companyId!: string;`
- **Файл:** `backend/src/modules/customers/dto/customer-query.dto.ts:17`
- **Строка:** `companyId?: string;`
- **Описание:** `companyId` передаётся через тело/query запроса, а не берётся из JWT Payload. Хотя сервис использует `currentUser.companyId`, DTO всё ещё позволяет передать чужой companyId
- **Последствия:** Потенциальная утечка данных между компаниями (data leakage)
- **Решение:** Удалить `companyId` из DTO, всегда брать из JWT payload

---

## High (должно быть исправлено до v1.0)

### HIGH-1: God Services

- **Файлы:** `SalesService` (400+ строк), `CustomersService` (300+ строк), `AuthService` (280+ строк)
- **Описание:** Сервисы нарушают SRP — смешивают бизнес-логику, валидацию, аудит, события
- **Последствия:** Трудно тестировать, поддерживать, расширять
- **Решение:** Разделить на специализированные сервисы

---

### HIGH-2: Permissions без кэширования

- **Файл:** `RolesGuard`
- **Описание:** Каждый защищённый HTTP запрос загружает permissions из БД
- **Последствия:** Лишние запросы к БД на каждый защищённый эндпоинт
- **Решение:** Кэшировать permissions в Redis с TTL 5 минут, инвалидировать при изменении ролей

---

### HIGH-3: Нет CSRF защиты

- **Описание:** API не защищён от CSRF атак
- **Последствия:** Если frontend хранит JWT в cookie, возможна CSRF атака
- **Решение:** Внедрить `csurf` или использовать double-submit cookie pattern

---

### HIGH-4: Нет rate limit на /auth/login

- **Файл:** `AuthController`
- **Описание:** Login endpoint не имеет отдельного rate limit
- **Последствия:** Brute force атака — до 600 попыток в минуту (при глобальном short rate limit)
- **Решение:** Добавить `@Throttle({ default: { limit: 5, ttl: 60000 } })` на login endpoint

---

### HIGH-5: Refresh и Access токены используют один secret

- **Файл:** `AuthService:260-275`
- **Описание:** `signAccessToken` и `signRefreshToken` используют один и тот же `jwt.secret`
- **Последствия:** Если access token secret скомпрометирован, refresh токены также скомпрометированы
- **Решение:** Использовать отдельные secrets для access и refresh токенов

---

### HIGH-6: Hardcoded bcrypt rounds

- **Файл:** `AuthService:149,303`
- **Описание:** `bcrypt.hash(password, 10)` — конфиг `BCRYPT_ROUNDS=12` из .env не используется
- **Последствия:** Несоответствие между конфигурацией и реальным поведением
- **Решение:** Использовать `this.configService.get('auth.bcryptRounds', 12)`

---

### HIGH-7: Sales и Finance модули без тестов

- **Файлы:** `modules/sales/`, `modules/finance/`, `modules/purchasing/`
- **Описание:** Критические бизнес-модули не имеют unit тестов
- **Последствия:** Любой рефакторинг в этих модулях — риск regression
- **Решение:** Написать тесты для Sales (создание, complete, refund) и Finance (journal entries, account balances)

---

### HIGH-8: InMemoryEventBus синхронный

- **Файл:** `common/events/in-memory-event-bus.ts`
- **Описание:** Handlers выполняются синхронно — медленный handler блокирует всю транзакцию
- **Последствия:** Пользователь ждёт завершения всех event handlers перед получением ответа
- **Решение:** Сделать асинхронным с background processing

---

### HIGH-9: Кэш не используется

- **Описание:** CacheService и CacheInterceptor есть, но не применяются
- **Последствия:** Все запросы идут напрямую в БД
- **Решение:** Внедрить кэширование для:
  - Permissions (RBAC)
  - Products list
  - Customers list
  - Chart of Accounts

---

### HIGH-10: Нет e2e тестов

- **Описание:** Нет end-to-end тестов для критических flow (Register → Login → Create Product → Create Sale → Complete Sale → Finance)
- **Последствия:** Релиз без проверки интеграции между модулями
- **Решение:** Написать e2e тесты для критических user journeys

---

## Medium (должно быть исправлено до v2.0)

### MED-1: Нет pre-commit hooks
### MED-2: PrismaBaseRepository — мёртвый код
### MED-3: Дублирование findById в CustomersService.update
### MED-4: Нет индекса на AuditLog.(companyId, createdAt)
### MED-5: Connection pool tuning для PostgreSQL

---

## Сводка

| Уровень | Количество | Действие |
|---------|-----------|----------|
| **Critical** | 4 | Немедленно до релиза |
| **High** | 10 | До v1.0 |
| **Medium** | 8 | До v2.0 |
| **Low** | 6 | Technical debt |

**Итого:** 28 критических и высоких проблем, блокирующих production релиз.
