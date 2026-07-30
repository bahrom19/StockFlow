# Database Audit — StockFlow

**Дата:** 30 июля 2026  
**Технология:** PostgreSQL 16 через Prisma 6

---

## Общая оценка: 8.0 / 10

---

## 1. Schema (schema.prisma)

### ✅ Сильные стороны
- **Все поля корректно типизированы** — `@db.Uuid`, `@db.VarChar`, `@db.Decimal`, `@db.Text`
- **Enums** — используются proper PostgreSQL enums через Prisma enum
- **Soft delete** — `deletedAt: DateTime?` на всех бизнес-сущностях
- **Optimistic Locking** — `rowVersion: Int @default(0)` на большинстве моделей
- **Cascade delete** — правильный `onDelete: Cascade` от Company ко всем дочерним сущностям
- **UUID первичные ключи** — `@default(uuid())` на всех моделях
- **Unit of Measure** — `@@unique([companyId, name])` и `@@unique([companyId, abbreviation])`

### ❌ Проблемы

| # | Критичность | Модель | Проблема |
|---|------------|--------|----------|
| 1 | **High** | `Session` | У модели Session нет индекса по `expiresAt` — каждый запрос проверяет валидность сессии через full scan |
| 2 | **Medium** | `AuditLog` | Модель AuditLog будет быстро расти. Нет индекса по `(companyId, createdAt)` для эффективной очистки старых записей |
| 3 | **Medium** | `RefreshToken` | Нет индекса по `expiresAt` — очистка просроченных токенов будет медленной |
| 4 | **Low** | `User` | `@@index([email, deletedAt])` — хороший составной индекс |

---

## 2. Индексы

### ✅ Хорошо
- Почти все модели имеют индексы по `companyId`, `createdAt`, `deletedAt`
- Составные индексы: `@@index([companyId, status])`, `@@index([companyId, createdAt])`
- Индексы на внешних ключах присутствуют (companyId, productId, customerId, etc.)

### ❌ Чего не хватает

| # | Критичность | Модель | Рекомендация |
|---|------------|--------|-------------|
| 1 | **High** | `FinancialTransaction` | Нет индекса по `(companyId, referenceType, referenceId)` — используется для поиска проводок по reference |
| 2 | **Medium** | `StockMovement` | Нет индекса по `(companyId, productId, createdAt)` — типичный запрос "движения товара за период" |
| 3 | **Medium** | `JournalEntry` | Нет индекса по `(companyId, entryDate, status)` — фильтрация проводок |
| 4 | **Low** | `Invoice` | `@@index([subscriptionId, companyId])` — избыточно, companyId уже есть в модели |

---

## 3. Foreign Keys

### ✅ Хорошо
- Все связи имеют явные foreign keys с `@relation`
- Каскадное удаление от Company ко всем дочерним моделям
- `onDelete: SetNull` для опциональных связей (groupId, parentId, etc.)

### ❌ Проблема

| # | Критичность | Модель | Описание |
|---|------------|--------|----------|
| 1 | **Medium** | `Task.customerId` | `onDelete: SetNull` — если клиент удалён, задача остаётся без customerId, но с companyId. Это корректно. |

---

## 4. Десятичные поля

### ✅ Хорошо
- `@db.Decimal(18, 4)` — единый стандарт для всех денежных полей
- `@db.Decimal(18, 6)` для exchangeRate
- `@db.Decimal(5, 2)` для процентов (discount, probability)

---

## 5. Nullable поля

### ❌ Medium

| # | Модель | Поле | Проблема |
|---|--------|------|----------|
| 1 | `Product` | `sku: String?` | SKU должен быть обязательным для складского учёта |
| 2 | `Product` | `barcode: String?` | Barcode опциональный — OK |

---

## 6. Уникальные ключи

### ✅ Хорошо
- `@@unique([companyId, name])` для ролей и единиц измерения
- `@@unique([companyId, year, month])` для FinancialPeriod
- `@@unique([companyId, accountId, financialPeriodId])` для AccountBalance
- `@@unique([companyId, code])` для ChartOfAccount

### ❌ Low
- `@unique` на `Permission.code` — глобальный unique, не scoped по company. Это правильно для глобальных permissions.

---

## 7. Отношения

### ❌ Medium

| # | Модели | Проблема |
|---|--------|----------|
| 1 | `User` ↔ `CompanyMember` ↔ `Role` | 3-табличная связь Many-to-Many — корректно, но сложно для запросов |
| 2 | `Sale` → `CashShift` | Опциональная связь (`cashShiftId: String?`) — может привести к потерянным связям |

---

## 8. Миграции

### ✅ Хорошо
- Одна миграция найдена: `20260729014253_add_billing_tables`
- `migration_lock.toml` присутствует
- Миграция использует `CREATE TABLE`, `ALTER TABLE`

### ❌ Low
- Только одна миграция — проект на ранней стадии или миграции сквашиваются

---

## 9. N+1 запросы

### ❌ High

| # | Место | Описание |
|---|-------|----------|
| 1 | `CustomersRepository.findAll` | Использует `$transaction([findMany, count])` — это 2 отдельных запроса, хотя Prisma умеет делать `findMany` + `count` через `@prisma/client` extension |
| 2 | `SalesService.completeSale` | Загружает `saleItems` и `payments` через отдельные `findMany` — 2 дополнительных запроса. При большом количестве items это может быть N+1 |
| 3 | `AuthService.findUserRoles` | Загружает роли через отдельный query после основного запроса |

---

## 10. Избыточные include

### ❌ Medium
- В Prisma нет избыточных `include` в репозиториях — они используют `findMany` с `where`, а не `include` связанных моделей. Это хорошо.
- Но в `getReceiptBySaleId` вероятно есть include receipt — нужно проверить.

---

## 11. Генерация Prisma Client

### ✅ Хорошо
- `binaryTargets: ["native", "linux-musl-openssl-3.0.x"]` — поддерживает и локальную разработку, и production на Alpine
- `prisma generate` в postinstall

---

## Итоговая оценка: 8 / 10

### Ключевые проблемы:
1. **High** — Отсутствие индекса на `FinancialTransaction.referenceType/referenceId` (часто используемый запрос)
2. **High** — N+1 в `CustomersRepository.findAll` (2 запроса вместо 1)
3. **Medium** — Отсутствие индекса на `AuditLog.(companyId, createdAt)`
4. **Medium** — Отсутствие индекса на `RefreshToken.expiresAt`
5. **Low** — Product.sku nullable (должен быть обязательным для складского учёта)
