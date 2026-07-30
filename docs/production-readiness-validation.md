# StockFlow Production Readiness Validation

> Дата: 2026-07-30
> Тип: **Business Process Validation** (не code review, не architecture audit)
> Метод: Полный lifecycle каждого модуля как конечный пользователь

---

## Сводка

| Метрика | Значение |
|---------|----------|
| **Blocker** | 1 |
| **High** | 4 |
| **Medium** | 7 |
| **Low** | 5 |
| **Total issues** | 17 |
| **Готов к запуску?** | ❌ **НЕТ** (Blocker > 0) |

---

## 1. Auth — Регистрация / Логин / JWT

### Lifecycle
```
Register → Login → Access API → Refresh → Logout
```

### Пройдено ✅
- Регистрация создаёт: User + Company + Admin Role + все permissions + company member ✅
- Логин проверяет lockout (5 попыток, 15 мин блокировки) ✅
- Lockout auto-unlock после истечения срока ✅
- Refresh token rotation (старый токен инвалидируется) ✅
- bcrypt хэширование (12 rounds из конфига) ✅

### ❌ MEDIUM: Нестандартный формат `expiresIn`
**Проблема:** `AuthResponse.expiresIn` возвращает raw config значение — может быть `"15m"`, `"900"`, `"3600s"` в зависимости от формата в .env. Мобильный клиент ожидает строку с секундами (`"900"`), но если config задан как `"15m"`, то токен будет работать, а клиентские таймеры — нет.

**Влияние:** Таймеры обратного отсчёта на фронтенде могут работать некорректно. Безопасность не затронута — JWT валидируется по времени на бэкенде.

---

## 2. Products — CRUD

### Lifecycle
```
Create Product → List Products → Get Product → Update Product → Delete Product (soft)
```

### Пройдено ✅
- CRUD операции ✅
- Pagination, search, filters ✅
- Soft delete с optimistic locking ✅
- JWT auth на всех endpoints ✅

### ❌ HIGH: Отсутствует защита от дубликатов SKU
**Проблема:** В `ProductsService.create()` нет проверки на уникальность `sku` или `barcode`. Можно создать 100 товаров с одинаковым SKU. На уровне Prisma schema нет `@unique` на этих полях.

**Влияние:** Дубликаты SKU в системе. Поиск по SKU может вернуть несколько товаров. Интеграция с поставщиками/маркетплейсами сломается.

**Воспроизведение:** POST /products с теми же `sku: "ABC-123"` и `name: "Test 1"`, затем ещё раз — оба создадутся успешно.

---

## 3. Sales — Полный lifecycle продажи

### Lifecycle
```
Create Sale (DRAFT) → Update → Complete (decrease stock) → Receipt → Refund → Cancel
```

### Пройдено ✅
- Создание DRAFT с items и payments ✅
- Complete: уменьшение stock через EventBus handlers ✅
- Refund: восстановление stock через EventBus handlers ✅
- Cash shift integration (привязка sale к открытой смене) ✅
- Status machine с валидными переходами ✅
- Audit log для всех операций ✅

### ❌ HIGH: Receipt создаётся в статусе DRAFT и никогда не переводится
**Проблема:** В `completeSale()`, receipt создаётся с `status: 'DRAFT'`, но после этого никогда не меняется на `COMPLETED` или `PRINTED`. Нет механизма, который бы перевёл receipt в финальный статус после успешной печати/отправки.

**Влияние:** Все чеки навсегда остаются в статусе DRAFT. Фронтенд не может отличить "новый, непечатный чек" от "незавершённого". Отчётность по чекам будет некорректной.

**Воспроизведение:** 
1. POST /sales (create)
2. POST /sales/:id/complete
3. GET /sales/receipt/:id → status: "DRAFT"

### ❌ MEDIUM: `softDelete` использует permission `sales:cancel` вместо `sales:delete`
**Проблема:** SalesController:
```typescript
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
@RequirePermission('sales:cancel')
```
Permission называется `sales:cancel`, но операция — soft delete. В API Contract зафиксировано `sales:cancel`. Это semantic mismatch — удаление и отмена семантически разные операции. На практике, если у пользователя есть `sales:cancel`, он может удалять — что может быть неожиданно.

**Влияние:** Невозможно дать пользователю права на отмену продажи, но не на удаление. И наоборот.

### ✅ MEDIUM: Status machine — DRAFT → CANCELLED (valid)
Валидность: DRAFT может быть сразу отменён без прохождения через PENDING. Это бизнес-логически корректно.

---

## 4. Purchasing — Закупки

### Lifecycle
```
Create PO (DRAFT) → Submit (PENDING) → Approve (APPROVED) → Order (ORDERED) → 
Goods Receipt → Update PO status → Invoice → Return
```

### Пройдено ✅
- Полный lifecycle PO с 7 статусами ✅
- Event-driven: PurchaseOrderCreatedEvent, PurchaseOrderApprovedEvent ✅
- Goods Receipt: создание stock movement, обновление остатков ✅
- Finance journal entries при receipt ✅
- Audit log на каждом шаге ✅

### ❌ BLOCKER: `updateStatusAfterReceipt()` bypasses optimistic locking
**Проблема:** В `PurchaseOrderService.updateStatusAfterReceipt()`:
```typescript
await this.purchaseOrderRepository.update(
  id,
  { status: PurchaseOrderStatus.RECEIVED },
  companyId,
  undefined,  // rowVersion = undefined — bypasses optimistic locking!
  tx,
);
```
Метод передаёт `undefined` как `rowVersion`. В репозитории:
```typescript
if (rowVersion !== undefined) {
  // WHERE id AND companyId AND rowVersion — optimistic locking check
} else {
  // UPDATE without rowVersion check — no optimistic locking!
}
```
Это означает, что если два goods receipt создаются одновременно для одного PO, оба могут обновить статус без проверки версии, и `updateStatusAfterReceipt` перезапишет изменения друг друга.

**Влияние:** Race condition при параллельной приёмке товаров. Статус PO может быть установлен в RECEIVED, когда часть товаров ещё не принята. Data integrity issue.

**Воспроизведение:**
1. Создать PO с 4 items
2. Отправить 2 параллельных запроса на goods receipt (каждый по 2 items)
3. `updateStatusAfterReceipt` может перезаписать статус без проверки версии

### ❌ HIGH: Finance journal creation failure — silent data loss
**Проблема:** В `GoodsReceiptService.create()`:
```typescript
try {
  await this.financeService.createGoodsReceiptJournal(...);
} catch (err) {
  this.logger.warn(`Failed to create finance journal: ...`);
  // Ошибка проглатывается!
}
```
Если создание бухгалтерской проводки при приёмке товаров упадёт (например, из-за отсутствия счёта в плане счетов), **данные потеряются без уведомления пользователя**. Складские остатки обновятся, товар будет числиться, а в бухгалтерии — нет.

**Влияние:** Расхождение между складским учётом и бухгалтерией. Незаметно до момента сверки. Критично для ERP.

**Воспроизведение:**
1. Удалить счёт инвентаризации из плана счетов
2. Создать goods receipt
3. Статус "200 OK", но проводка не создана
4. Только warning в логах

### ❌ MEDIUM: Goods Receipt auto-completes без DRAFT workflow
**Проблема:** GoodsReceipt создаётся сразу со статусом DRAFT, а затем в том же transaction:
```typescript
await this.goodsReceiptRepository.updateStatus(
  receipt.id,
  GoodsReceiptStatus.COMPLETED,
  companyId,
  tx,
);
```
Это означает, что GR всегда создаётся как COMPLETED без возможности проверить и подтвердить. Нет отдельного шага review/approve. В реальном ERP это может приводить к ошибкам приёма.

**Влияние:** Нельзя отменить/скорректировать receipt до его подтверждения. Ошибка приёма = reverse через отдельную операцию.

---

## 5. Inventory — Склад

### Lifecycle
```
View Stock → Adjust Stock → Transfer Stock → View Movements → Warehouse CRUD
```

### Пройдено ✅
- Adjust с optimistic locking ✅
- Transfer с созданием двух movement записей ✅
- Warehouse CRUD ✅
- Stock movements history ✅
- Event-driven: InventoryAdjustedEvent, InventoryTransferredEvent ✅

### ❌ MEDIUM: `findAll()` loads ALL stock records and filters in-memory
**Проблема:** В `StockService.findAll()`:
```typescript
const stock = await this.inventoryRepository.findAllStock(companyId);
let filtered = StockMapper.toEntityList(stock);
// ...in-memory filtering
```
Нет пагинации на уровне БД — все записи загружаются в память. Для компании с 10,000+ товарами каждый запрос к `/inventory/stock` будет загружать 10,000+ строк, фильтровать в памяти и возвращать Response.

**Влияние:** По мере роста данных производительность будет деградировать. При 50,000+ товаров — timeout на запросе.

**Воспроизведение:**
1. Создать 10,000 товаров
2. GET /inventory/stock?search=test
3. Response: все 10,000 загружаются в память, фильтруются на бэкенде

---

## 6. Finance — Бухгалтерия

### Lifecycle
```
Chart of Accounts → Create JE (DRAFT) → Post (POSTED) → GL Ledger → Trial Balance → Period Close
```

### Пройдено ✅
- GL Engine с полным validation pipeline (period OPEN, entry date, lines count, debit=credit) ✅
- Journal Entry lifecycle: DRAFT → POSTED (через post endpoint) ✅
- GL posting через `POST /finance/gl/post` — immutable (сразу POSTED) ✅
- Reversal entries ✅
- Trial balance, account balances, ledger query ✅
- Fiscal year close endpoint ✅

### ❌ MEDIUM: Нет проверки, что account belongs to company
**Проблема:** В `JournalEntriesService.create()` (и GL Engine) нет валидации, что все `accountId` в lines принадлежат `companyId` пользователя. Теоретически можно создать проводку с account из другой компании. PostingValidationService не проверяет это.

**Влияние:** Меж-tenant утечка данных (хоть и маловероятная, т.к. accountId — UUID). Если пользователь угадает accountId другой компании, он может создать некорректную проводку.

---

## 7. RBAC — Роли и права

### Lifecycle
```
Create Role → Assign Permissions → Assign to User → Guard Check → Remove
```

### Пройдено ✅
- Role CRUD ✅
- Permission management ✅
- Assign/unassign roles to users ✅
- `@RequirePermission()` guard работает на всех защищённых endpoints ✅
- Users-with-roles query ✅

### ❌ MEDIUM: Нет защиты от удаления последней Admin роли
**Проблема:** Можно удалить последнюю роль Admin у последнего администратора компании. После этого никто не сможет управлять ролями/пользователями в компании.

**Влияние:** Lockout компании администрирования. Восстановление только через супер-админ доступ к БД.

**Воспроизведение:**
1. POST /rbac/roles/unassign с последней Admin ролью у последнего пользователя
2. Ответ: 200 OK
3. Больше никто не может назначать роли

---

## 8. Reports — Отчёты

### Lifecycle
```
Dashboard → Sales Report → Profit Report → Top Products → Low Stock → Customer/Supplier → Purchasing → Cash Shifts
```

### Пройдено ✅
- Dashboard — 8 метрик в одном запросе ✅
- Sales Report — revenue, profit, payment breakdown ✅
- Profit Report — daily/weekly/monthly агрегация ✅
- Все 9 report endpoints реализованы ✅ (getTopProducts, getLowStock, getInventoryValuation, getCustomerReport, getSupplierReport, getPurchasingReport, getCashShiftReport — все с реальной бизнес-логикой)
- Cash Shift Report — X/Z отчёты ✅

### ❌ LOW: Dashboard `lowStock` threshold hardcoded = 5
**Проблема:** `stocks.filter((s) => s.quantity > 0 && s.quantity <= 5)` — порог низкого остатка хардкодом 5. Должен быть конфигурируемым (на уровне товара или склада).

**Влияние:** Для разных типов товаров порог low stock должен различаться (для шин — 10, для болтов — 100). Сейчас — единый порог.

---

## 9. Billing — Биллинг

### Lifecycle
```
View Plans → Create Subscription (TRIAL) → Change Plan → Cancel → Resume → Invoices
```

### Пройдено ✅
- Subscription lifecycle с state machine (8 статусов) ✅
- Stripe provider (реализация присутствует, но Stripe SDK не установлен) ✅
- Invoice создание и markPaid ✅
- Subscription events ✅
- Audit log ✅

### ❌ HIGH: Stripe SDK не установлен
**Проблема:** `stripe.provider.ts` — хорошая реализация, но:
```
// NOTE: This provider uses a mock implementation that simulates
// contacting Stripe. In production, uses the Stripe SDK.
// Prerequisites:
// 1. `npm install stripe`
// 2. Set `STRIPE_SECRET_KEY` in environment
```
Stripe SDK (`npm install stripe`) не установлен. В production режиме платежи не будут работать.

**Влияние:** SaaS монетизация невозможна. Можно только вручную выставлять инвойсы через `POST /billing/invoices/:id/pay`.

### ❌ MEDIUM: Subscription expiration не проверяется автоматически
**Проблема:** BillingCronService существует, но не проверяет истекающие подписки:
```typescript
// BillingCronService содержит логику управления блокировками,
// но не имеет задачи на регулярную проверку expired subscriptions
```
Если `trialEndsAt` прошёл, статус не изменится автоматически. Подписка останется TRIAL навсегда.

**Влияние:** Бесплатный доступ после окончания триала. Потеря монетизации.

### ❌ LOW: Нет webhook для Stripe events
**Проблема:** StripeWebhookController существует, но:
- Stripe SDK не установлен
- Webhook secret не настроен
- Нет обработки `invoice.paid`, `customer.subscription.updated` и т.д.

**Влияние:** Автоматическая обработка платежей от Stripe не работает. Только ручной режим.

---

## 10. Cross-cutting concerns

### ❌ LOW: Нет rate limiting на публичных endpoints
**Проблема:** Rate limiting (`@nestjs/throttler`) настроен только на `/auth/login` (5 req/min). Остальные endpoints (особенно `/auth/register`, `/auth/refresh`) не защищены от brute force.

**Влияние:** Refresh token brute force. Регистрация спам-аккаунтов.

### ❌ LOW: Нет Health Check endpoint
**Проблема:** Нет `GET /health` или `GET /healthz` для проверки состояния сервиса. Railway и Docker полагаются на health check для мониторинга и рестарта.

**Влияние:** При деплое на Railway нет liveness probe. Контейнер может быть "живым", но не отвечать — и этого не будет обнаружено.

### ✅ LOW: Сессии не очищаются (no cron cleanup)
Проблема: Нет задачи на очистку истёкших сессий из БД. С практической точки зрения — не влияет на бизнес-процессы, только на объём данных.

---

## Production Checklist

### Blocker (1) — Обязательно исправить до запуска

- [ ] **B1: `updateStatusAfterReceipt` bypasses optimistic locking** — `PurchaseOrderService.updateStatusAfterReceipt()` передаёт `undefined` как `rowVersion`, что отключает optimistic lock. Две параллельные приёмки могут перезаписать статус PO. **Решение:** получить текущий `rowVersion` PO внутри транзакции и передать его.

### High (4) — Обязательно исправить до запуска

- [ ] **H1: Отсутствует защита от дубликатов SKU в Products** — Нет проверки уникальности sku/barcode при создании/обновлении товара. **Решение:** добавить проверку в ProductsService или `@unique` в Prisma schema + миграция.
- [ ] **H2: Receipt остаётся в DRAFT после complete** — Чек создаётся со статусом DRAFT и никогда не переводится в COMPLETED. **Решение:** установить статус COMPLETED при создании receipt или добавить endpoint для финализации.
- [ ] **H3: Silent data loss при ошибке finance journal в goods receipt** — Ошибка создания бухгалтерской проводки проглатывается (catch + warn). Складские остатки обновлены, проводки нет. **Решение:** пробросить ошибку пользователю или сделать finance journal обязательной частью транзакции.
- [ ] **H4: Stripe SDK не установлен** — SaaS платежи не работают. **Решение:** `npm install stripe` + настройка `STRIPE_SECRET_KEY` + настройка webhook.

### Medium (7) — Рекомендуется исправить до запуска

- [ ] **M1: `expiresIn` может быть в неверном формате** — Raw config значение может быть `"15m"` вместо `"900"`.
- [ ] **M2: `softDelete` в Sales использует permission `sales:cancel`** — Semantic mismatch между cancel и delete.
- [ ] **M3: Нет защиты от удаления последней Admin роли** — Lockout администрирования компании.
- [ ] **M4: Stock `findAll()` загружает все записи в память** — Нет DB-level пагинации.
- [ ] **M5: Отсутствует проверка account → company в journal entries** — Потенциальная меж-tenant утечка.
- [ ] **M6: Subscription expiration не проверяется автоматически** — Нет cron задачи.
- [ ] **M7: Goods Receipt auto-complete без DRAFT workflow** — Нет шага подтверждения приёмки.

### Low (5) — Можно после запуска

- [ ] **L1: Dashboard lowStock threshold hardcoded = 5**
- [ ] **L2: Нет rate limiting на /auth/register и /auth/refresh**
- [ ] **L3: Нет health check endpoint**
- [ ] **L4: Сессии не очищаются**
- [ ] **L5: Stripe webhooks не обрабатываются**

---

## Вердикт

### ❌ StockFlow НЕ готов к публичному запуску

| Критерий | Требование | Факт |
|----------|-----------|------|
| **Blocker** | 0 | **1** |
| **High** | ≤ 3 | **4** |
| **Medium** | — | 7 |
| **Low** | — | 5 |

### Почему Blocker критичен

`updateStatusAfterReceipt()` bypasses optimistic locking — это не теоретическая проблема, а **гарантированный data integrity issue** при параллельной работе. В реальном ERP с 10+ сотрудниками, принимающими товары одновременно, race condition произойдёт в первую же неделю. Результат: PO со статусом RECEIVED, но с непринятыми товарами.

### Что нужно сделать для запуска

1. **Исправить Blocker** (B1 — ~30 минут)
2. **Исправить 4 High** (H1-H4 — ~2-3 часа)
3. **Желательно исправить Medium** (M1-M7 — ~4-6 часов)
4. **Low — после запуска** (L1-L5 — не блокирует)

### Итоговая оценка Production Readiness

| Аспект | Оценка | Комментарий |
|--------|--------|-------------|
| **Бизнес-логика** | 8/10 | Полные lifecycle для всех модулей, status machines, event-driven |
| **Data Integrity** | 6/10 | Одна Blocker проблема — optimistic lock bypass. Есть silent error handling |
| **Multi-tenant** | 8/10 | companyId везде. Есть одна потенциальная утечка (finance accounts) |
| **Error Handling** | 7/10 | Хорошие user-facing ошибки. Но silent catch — проблема |
| **Billing/Monetization** | 4/10 | Stripe не подключён. Subscription expiration не проверяется |
| **Performance** | 7/10 | Stock findAll() — единственная проблема с масштабированием |
| **Security** | 8/10 | JWT, RBAC, rate limit (частично), bcrypt — всё есть |
| **Overall** | 7/10 | **Близко к готовности. 1 blocker + 4 high до запуска.** |

---

*Валидация проведена без изменения кода. Только анализ бизнес-процессов.*
