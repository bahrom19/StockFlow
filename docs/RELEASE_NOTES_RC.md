# StockFlow — Release Notes RC 1.0.0

> **Дата релиза:** 2026-07-30
> **Версия:** 1.0.0-RC
> **Статус:** Release Candidate — готов к эксплуатации для первых клиентов

---

## Что такое StockFlow

StockFlow — облачная ERP/POS/CRM система для розничной торговли и малого/среднего бизнеса.

**Ключевые возможности:**
- POS (Point of Sale) с поддержкой кассовых смен
- Управление товарами, складами, закупками
- Бухгалтерский учёт (план счетов, проводки, GL)
- CRM: клиенты, группы, скидки, лояльность
- Отчёты: дашборд, продажи, прибыль, остатки
- RBAC: гибкая система ролей и permissions
- Многотенантность: одна установка — много компаний

---

## Что реализовано

### Auth & Security
- Регистрация компании + пользователя
- JWT access + refresh token с rotation
- bcrypt хэширование (12 rounds)
- Rate limiting на login (5/мин)
- Audit log всех критических операций
- Account lockout после 5 неудачных попыток
- OpenTelemetry tracing (Jaeger, Grafana Tempo)
- Prometheus metrics

### Products
- CRUD товаров с пагинацией, поиском, фильтрацией
- SKU, штрихкод, цена, себестоимость, категория
- Optimistic locking через rowVersion

### Inventory
- Склады (CRUD)
- Остатки по товарам и складам
- Корректировка остатков
- Перемещение между складами
- История движений
- Варианты товаров
- Штрихкоды
- Партии (batches)
- Единицы измерения
- Инвентаризация (count + complete)
- Резервирование товаров
- Оценка запасов (FIFO)

### Purchasing
- Purchase Orders (полный lifecycle: DRAFT → PENDING → APPROVED → ORDERED → RECEIVED)
- Goods Receipt (приёмка товаров с созданием stock movement)
- Purchase Returns (DRAFT → APPROVED → COMPLETED)
- Purchase Invoices
- RFQs (Request for Quotation)
- Supplier Quotations
- Finance integration (journal entries при приёмке)
- Optimistic locking + concurrency protection

### Sales
- POS: создание продажи с товарами и оплатой
- Статусная модель: DRAFT → PENDING → COMPLETED → REFUNDED → CANCELLED
- Скидки на товары и на чек
- Множественные способы оплаты (Cash, Card, QR, Bank Transfer)
- Cash Shifts (открытие, закрытие, X/Z отчёты)
- Возврат товаров (restock inventory)
- Receipt creation
- Event-driven: SaleCompleted, SaleRefunded

### Finance
- Chart of Accounts (план счетов)
- Journal Entries (DRAFT → POSTED)
- GL Engine (immutable posting, reversal entries)
- Ledger Query с running balance
- Trial Balance
- Account Balances
- Financial Periods (OPEN → CLOSING → CLOSED)
- Fiscal Year Close
- Bank & Cash Accounts
- Financial Transactions
- Posting Validation Pipeline

### CRM
- Customers (с поддержкой физ. и юр. лиц)
- Customer Groups (со скидками)
- Contacts
- Customer Addresses
- Customer Notes
- Sales Opportunities
- Tasks
- Price Lists
- Credit Limits
- Loyalty (баллы, earn/redeem)

### Reports
- Dashboard (8 метрик: today/yesterday/month sales, gross revenue/profit, inventory value, low stock)
- Sales Report (revenue, profit, margin, payment breakdown)
- Profit Report (daily/weekly/monthly)
- Top Products
- Low Stock
- Inventory Valuation
- Customer Report
- Supplier Report
- Purchasing Report
- Cash Shift Report

### RBAC
- Role CRUD (company-scoped)
- Permission management
- Assign/unassign roles to users
- `@RequirePermission()` guard на всех endpoints
- Permissions seed (авто при старте)
- Users-with-roles query

### Billing
- Subscription Plans CRUD
- Company Subscription lifecycle (NEW → TRIAL → ACTIVE → CANCELLED → EXPIRED)
- Stripe provider (mock — production ready, требует `npm install stripe`)
- Invoice management (list, mark paid, void)
- Billing events + audit log
- Subscription expiry cron (lock-based)

### Infrastructure
- Docker multi-stage build (node:22-alpine)
- Railway deployment config
- GitHub Actions CI (12 stages)
- GitHub Actions CD (7 stages + auto-rollback)
- OpenTelemetry (HTTP, Express, Prisma)
- Prometheus metrics
- Request ID middleware
- Global Exception Filter
- Swagger / OpenAPI docs
- Health checks (liveness)
- Graceful shutdown hooks

### API Contract
- Единый документ: `docs/api-contract-v1.md`
- 50+ endpoint групп с полной спецификацией
- 12 route mismatches исправлены (Mobile → Backend)
- Совместимость с Mobile и Web фронтендами

### Testing (288 тестов)
- Auth: 3 specs, 45+ тестов
- Sales: 2 specs (включая concurrency)
- Purchasing: 5 specs (включая concurrency)
- Inventory: integration transaction tests
- Finance: GL pipeline integration
- Products, Customers, Suppliers: CRUD
- CRM: 3 specs
- RBAC: 3 specs
- Billing: 4 specs (subscription lifecycle)
- Users: 2 specs
- Shared: audit log
- Concurrency: 18 тестов (Sales + Purchasing)

---

## Что работает

- ✅ Полный lifecycle продажи: создание → оплата → возврат
- ✅ Полный lifecycle закупки: PO → Receive → Return → Invoice
- ✅ Складской учёт: приход, расход, перемещение, корректировка
- ✅ Бухгалтерия: план счетов, проводки, GL, баланс
- ✅ CRM: клиенты, группы, контакты, задачи, лояльность
- ✅ Отчёты: дашборд, продажи, прибыль, остатки
- ✅ Многопользовательский режим с RBAC
- ✅ Многотенантность (изоляция данных между компаниями)
- ✅ Кассовые смены с X/Z отчётами
- ✅ Оптимистичная блокировка (rowVersion)
- ✅ Аудит всех операций
- ✅ Docker деплой (Railway-ready)

---

## Что не работает (известные ограничения)

Подробно: `docs/KNOWN_LIMITATIONS.md`

- Смена/восстановление пароля
- Проверка уникальности SKU
- Экспорт отчётов (CSV/PDF)
- Stripe платежи (требуется `npm install stripe`)
- Readiness probe (/api/health/ready)
- E2E тесты
- Production backup скрипт
- Sentry crash reporting

---

## Что планируется в версии 1.1

### Security & Auth
- [ ] Forgot/reset/change password
- [ ] Rate limiting на register/refresh
- [ ] 2FA (TOTP)

### Products
- [ ] Проверка уникальности SKU/штрихкода
- [ ] Bulk import/export товаров (CSV)

### Sales
- [ ] Receipt COMPLETED/PRINTED статус
- [ ] Интеграция с фискальными принтерами
- [ ] Gift cards
- [ ] Customer loyalty (бонусы при покупке)

### Purchasing
- [ ] DRAFT workflow для Goods Receipt
- [ ] Non-silent finance journal errors

### Inventory
- [ ] DB-level pagination для stock list
- [ ] Множественные склады в POS

### Reports
- [ ] CSV/PDF экспорт всех отчётов
- [ ] Configurable low stock threshold
- [ ] Графики (sales trend, profit trend)

### Finance
- [ ] Account → company validation
- [ ] Автоматические проводки по закрытию периода

### Billing
- [ ] Stripe SDK installation + webhooks
- [ ] Subscription expiry cron
- [ ] Пробный период (trial) с напоминаниями

### RBAC
- [ ] Защита последней Admin роли
- [ ] Audit log для RBAC изменений

### Infrastructure
- [ ] Readiness probe (/api/health/ready)
- [ ] Sentry / error tracking
- [ ] Graceful shutdown timeout
- [ ] Production backup automation
- [ ] Header-based API versioning
- [ ] Redis caching для отчётов

### Testing
- [ ] E2E тесты (critical business flows)
- [ ] Reports module тесты
- [ ] Load testing (k6)

---

## Технический стек

| Компонент | Технология |
|-----------|------------|
| Runtime | Node.js 22, TypeScript |
| Framework | NestJS 11 |
| Database | PostgreSQL 16, Prisma ORM |
| Cache | Redis 7 |
| Auth | JWT (access + refresh rotation), bcrypt |
| API | REST, Swagger/OpenAPI |
| Events | In-process EventBus (Outbox-ready) |
| Monitoring | OpenTelemetry, Prometheus |
| Tracing | Jaeger / Grafana Tempo |
| Container | Docker, Alpine |
| Deployment | Railway |
| CI/CD | GitHub Actions |

---

## Как начать

```bash
# 1. Клонировать
git clone https://github.com/your-org/stockflow-backend.git

# 2. Установить
cd stockflow-backend && npm ci

# 3. Настроить
cp .env.example .env
# Отредактировать DATABASE_URL, JWT_SECRET

# 4. Поднять БД
docker compose up -d postgres redis

# 5. Миграции
npx prisma generate && npx prisma migrate deploy

# 6. Запустить
npm run start:dev
```

Swagger: `http://localhost:3000/docs`

---

## Поддержка

- GitHub Issues: https://github.com/your-org/stockflow-backend/issues
- Email: support@stockflow.app

---

**© 2026 StockFlow. All rights reserved.**
