# Multi-Tenant Audit — StockFlow

**Дата:** 30 июля 2026

---

## Общая оценка изоляции: 7.5 / 10

Архитектура: **Discriminated Multi-Tenant** (companyId на каждой записи)

---

## 1. Модель данных

### ✅ Хорошо
- **Каждая бизнес-модель содержит `companyId`** — Customer, Product, Supplier, Sale, PurchaseOrder, etc.
- **Все связи идут через Company** — `@@index([companyId])` на каждой модели
- **Каскадное удаление** — `onDelete: Cascade` от Company ко всем дочерним таблицам

### ❌ Проблемы

| # | Критичность | Модель | Проблема |
|---|------------|--------|----------|
| 1 | **High** | `User` | User глобальный — нет companyId. Один пользователь может принадлежать разным компаниям через CompanyMember |
| 2 | **Medium** | `Permission` | Permission глобальный — нет companyId. Все компании видят одни и те же permissions |
| 3 | **Low** | `SubscriptionPlan` | Глобальный — нет companyId. Это корректно для SaaS |

---

## 2. Repository Level

### ✅ Хорошо
- `CustomersRepository.findById(id, companyId)` — companyId обязателен
- `CustomersRepository.findAll({ companyId })` — фильтр по companyId обязателен
- `CustomersRepository.update(id, data, companyId)` — companyId обязателен
- `RolesRepository.findById(id, companyId)` — аналогично

### ❌ Проверка каждого репозитория

| Модуль | Репозиторий | companyId scoped? | Статус |
|--------|-------------|-------------------|--------|
| Customers | CustomersRepository | ✅ Да | OK |
| Suppliers | SuppliersRepository | ✅ Да | OK |
| Products | ProductsRepository | ✅ Да | OK |
| Sales | SalesRepository | ✅ Да | OK |
| Purchasing | Все 6 репозиториев | ✅ Да | OK |
| RBAC | RolesRepository | ✅ Да | OK |
| Users | UsersRepository | ❓ Неизвестно | **Требует проверки** |
| CRM | Все 8 репозиториев | ✅ Да | OK |
| Inventory | InventoryRepository | ✅ Да | OK |
| Finance | FinanceRepository | ❓ Неизвестно | **Требует проверки** |

---

## 3. Service Level

### ✅ Хорошо
- `CustomersService.create(dto, currentUser)` — использует `currentUser.companyId`
- `CustomersService.findById(id, currentUser)` — передаёт `currentUser.companyId` в репозиторий
- `CustomersService.update(id, dto, currentUser)` — аналогично
- `SalesService.create(dto, userId, companyId)` — companyId как параметр
- `AuthService.register` — создаёт компанию, пользователя, связывает

### ❌ Проблемы

| # | Критичность | Сервис | Проблема |
|---|------------|--------|----------|
| 1 | **High** | `AuthService.login` | Использует `findUserByEmail(email)` — глобальный поиск пользователя. Если email есть в другой компании, пользователь залогинится. Это ожидаемо для мульти-tenant. |
| 2 | **Medium** | `SalesService.create` | Принимает `companyId` как параметр напрямую, а не через currentUser. Если контроллер передаст чужой companyId — утечка данных |

---

## 4. Controller Level

### ✅ Хорошо
- `CustomersController` использует `@CurrentUser()` для получения companyId
- `@UseGuards(JwtAuthGuard, RolesGuard)` — проверка аутентификации и прав

### ❌ Проблемы

| # | Критичность | Контроллер | Проблема |
|---|------------|-----------|----------|
| 1 | **High** | `CreateCustomerDto` | Содержит `companyId!: string;` — клиент может отправить чужой companyId (даже если сервис его игнорирует) |
| 2 | **High** | `CustomerQueryDto` | Содержит `companyId?: string;` — потенциальная фильтрация по чужой компании |

---

## 5. JWT Payload

### ✅ Хорошо
- `JwtPayload` содержит `companyId` — зашит в токен
- `JwtStrategy` загружает `companyId` в request.user
- `@CurrentUser()` декоратор извлекает `companyId` из токена

---

## 6. Data Leakage Vectors

### ❌ Critical

| # | Вектор утечки | Риск | Описание |
|---|---------------|------|----------|
| 1 | DTO `companyId` | **High** | Клиент может указать companyId в body/query — если сервис его использует (а он не должен) |
| 2 | `AuthService.findUserByEmail` | **Medium** | Глобальный поиск — возможна информация о существовании email |
| 3 | `AuditLog` | **Medium** | `companyId: '00000000-0000-0000-0000-000000000000'` — хардкод UUID при failed login |
| 4 | `Permission` | **Low** | Глобальные permissions — нет изоляции по company |

---

## 7. Global Data

### Следующие модели являются глобальными (no companyId):

| Модель | Комментарий |
|--------|-------------|
| `User` | OK — пользователь может быть в нескольких компаниях |
| `Permission` | **Medium** — все permissions видны всем компаниям |
| `SubscriptionPlan` | OK — глобальное для SaaS |
| `WebhookEvent` | OK — системное |
| `Session` | OK — привязана к User |

---

## Итог: 7.5 / 10

### Ключевые проблемы:
1. **High** — DTO содержат companyId (CreateCustomerDto, CustomerQueryDto)
2. **Medium** — Нет проверки, что companyId в запросе соответствует JWT компании
3. **Medium** — AuditLog использует хардкод UUID для failed login
4. **Low** — Global permissions видны всем компаниям
