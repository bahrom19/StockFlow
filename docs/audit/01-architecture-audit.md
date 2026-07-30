# Архитектурный аудит StockFlow

**Дата:** 30 июля 2026  
**Аудитор:** Senior Software Architect  
**Уровень:** Enterprise SaaS ERP  

---

## Общая оценка архитектуры: 7.5 / 10

---

## 1. Структура модулей

### ✅ Хорошо
- **Чёткое разделение на domain-модули:** customers, products, suppliers, sales, purchasing, finance, crm, billing, rbac, users, auth, inventory, reports, health, shared
- **Infrastructure layer:** cache, database, repositories — вынесены отдельно
- **Common layer:** config, events, filters, middleware, observability, prisma, utils — общие компоненты изолированы
- **Модули самодостаточны:** каждый содержит DTO, entities, repositories, services, controllers, mappers

### ❌ Проблемы

| # | Критичность | Проблема | Файл | Описание |
|---|------------|----------|------|----------|
| 1 | **High** | **SharedModule не найден** | `app.module.ts:41` | В `app.module.ts` импортируется `SharedModule`, но в структуре файлов он не обнаружен. Возможно, удалён или переименован, но импорт остался. |
| 2 | **Medium** | **Domain-слой не выделен** | `backend/src/modules/*/` | Все модули содержат `entities`, `repositories`, `services` в одном уровне. Нет чёткого разделения на Domain / Application / Infrastructure. |
| 3 | **High** | **PrismaBaseRepository — мёртвый код** | `infrastructure/repositories/base-prisma.repository.ts` | `PrismaBaseRepository` — это scaffold с throw-методами, который не используется ни одним модулем. Каждый модуль пишет свой repository с нуля. |
| 4 | **Low** | **index.ts не везде экспортирует** | Множество модулей | Отсутствуют barrel-файлы (`index.ts`) во многих модулях, что усложняет импорты. |

---

## 2. Зависимости между модулями

### ❌ High: Циклические зависимости (потенциальные)

- **SalesService** импортирует `EventBus` из `common/events`
- **InventoryModule** подписывается на события Sales через `SaleCompletedEventHandler`
- **FinanceModule** также подписывается на события Sales

Это архитектурно правильная событийно-ориентированная связь, но есть риск циклических зависимостей при прямых импортах между `SalesService` и `InventoryService`.

### ✅ Хорошо
- Модули используют EventBus для слабой связности
- BillingModule изолирован от основных бизнес-модулей

---

## 3. Нарушение SOLID

### ❌ Medium: Single Responsibility Principle (SRP)

| # | Файл | Описание |
|---|------|----------|
| 1 | `CustomersService` | И бизнес-логика, и аудит, и публикация событий, и маппинг. 300+ строк — service "разбухает". |
| 2 | `SalesService` | 400+ строк. Отвечает за создание продаж, валидацию товаров/складов/клиентов, расчёт сумм, управление статусами, complete/refund логику, генерацию receipt, обновление cash shift, публикацию событий и аудит. |
| 3 | `AuthService` | 280+ строк. Регистрация/логин/refresh/logout + блокировка аккаунтов + создание компании + создание ролей. |

### ❌ Medium: Dependency Inversion Principle (DIP)

- `CustomersRepository` напрямую зависит от `PrismaService`, а не от абстракции
- Нет интерфейсов для репозиториев — только конкретные классы
- Это затрудняет тестирование и замену реализации

### ✅ Хорошо: Open/Closed Principle
- EventBus реализован через интерфейс — можно подменить на Outbox/RabbitMQ/Kafka без изменения бизнес-кода

---

## 4. Нарушение Clean Architecture

### ❌ High
- **Entities** (`customer.entity.ts`) — это не domain-сущности, а DTO для API-ответов. Настоящие domain-сущности не выделены.
- **Services** напрямую используют `Prisma.CustomerCreateInput` — утечка инфраструктурной зависимости в бизнес-логику.
- **Repository Pattern** реализован не полностью — каждый репозиторий это прямая обёртка над Prisma, без доменных абстракций.
- **PrismaBaseRepository** не используется — ни один реальный репозиторий от него не наследуется.

---

## 5. Нарушение DDD

### ❌ Critical
- **Нет Aggregate Roots** — модули не определяют границы агрегатов
- **Нет Domain Events** как отдельного концепта — `CustomerCreatedEvent` это просто DTO
- **Value Objects** не используются — `Currency`, `Money`, `Address` — это строки и примитивы
- **Нет Ubiquitous Language** — терминология смешанная: `CustomerType.PERSON` и `CustomerType.COMPANY`
- **Нет Repository для каждого Aggregate** — репозитории соответствуют таблицам, не агрегатам

---

## 6. God Services

### ❌ Critical: SalesService (400+ строк)

`SalesService` нарушает SRP максимально:
- Валидация warehouse/customer/product
- Расчёт subtotal/discount/total/margin
- Управление жизненным циклом Sale (status machine)
- Complete/Refund логика с кассовыми сменами
- Генерация receipt
- Публикация событий
- Audit logging

**Рекомендация:** Разделить на:
- `SaleProcessor` — расчёты и валидация
- `SaleWorkflowService` — статусная машина
- `CashShiftManager` — работа с кассовыми сменами
- `SaleEventPublisher` — публикация событий

---

## 7. Fat Controllers

### ✅ Хорошо
- `CustomersController` — тонкий, только декораторы и вызов сервиса
- `SalesController` — аналогично
- `AuthController` — минимальный

Контроллеры не нарушают принципы — вся логика в сервисах.

---

## 8. Repository Pattern

### ❌ Medium
- Нет общего интерфейса/абстракции для репозиториев
- `CustomersRepository`, `SalesRepository` — независимые классы, не наследуют `PrismaBaseRepository`
- `PrismaBaseRepository` не используется (мёртвый код)

**Рекомендация:**
- Либо удалить `PrismaBaseRepository`
- Либо внедрить generic-интерфейс `IRepository<T>` и наследовать все репозитории

---

## 9. Неправильное использование Prisma

### ❌ Low
- В `CustomersService` используется `as Prisma.CustomerCreateInput` — type assertion, который может скрыть ошибки компиляции
- В некоторых местах прямой вызов `prismaService.customer.findMany` вместо использования репозитория

---

## Итоговые рекомендации

1. **High Priority:** Ввести интерфейсы для репозиториев (DIP)
2. **High Priority:** Разделить God Services (SalesService, CustomersService, AuthService)
3. **Medium Priority:** Создать доменные сущности, отделив их от API DTO
4. **Medium Priority:** Внедрить Value Objects для Currency, Money, Address
5. **Low Priority:** Добавить barrel-файлы (index.ts) во все модули
6. **Low Priority:** Удалить PrismaBaseRepository или внедрить наследование
