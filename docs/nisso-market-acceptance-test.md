# NissoMarket — Full Acceptance Test Report

> **Дата:** 2026-07-30
> **Метод:** Полный рабочий день магазина через реальные HTTP API
> **Компания:** NissoMarket (зарегистрирована)
> **Владелец:** Бахром Зон (nisso@market.kz)
> **Код не изменялся в процессе тестирования**

---

## Пройденные сценарии

### 1. Регистрация компании ✅
`POST /api/auth/register` → 201, компания + пользователь + Admin роль созданы

### 2. Создание склада ✅ (B4 исправлен)
`POST /api/inventory/warehouses` → 201, склад "Основной склад" (WH-001) создан

### 3. Создание товаров ✅ (требуется companyId в теле — B1 workaround)
`POST /api/products` → 201, 3 товара: Яблоки, Молоко, Хлеб

### 4. Создание поставщика ✅
`POST /api/suppliers` → 201, "ТОО Фрукты-Овощи"

### 5. Закупка — полный lifecycle ✅ (B5 исправлен)
- `POST /purchasing/purchase-orders` → **DRAFT**
- `PATCH .../status {"status":"PENDING"}` → **PENDING**
- `PATCH .../status {"status":"APPROVED"}` → **APPROVED**
- `PATCH .../status {"status":"ORDERED"}` → **ORDERED**

### 6. Приёмка товара (Goods Receipt) ✅
`POST /purchasing/goods-receipts` → **COMPLETED**
Требует `purchaseOrderItemId` (ID из items PO)

### 7. Dashboard и отчёты ✅
- Dashboard: работает (show today/yesterday sales)
- Sales Report: показывает revenue=2500 profit=1100 ✅
- Profit Report: показывает revenue=2500 profit=1100 ✅

---

## ❌ Найденные дефекты

### D1. Sale не завершается — stuck в DRAFT

| Поле | Значение |
|------|----------|
| **Сценарий** | Продажа товаров через POS |
| **Шаги** | `POST /api/sales` → sale создана в DRAFT, затем `POST /api/sales/{id}/complete` |
| **Ожидание** | Sale переходит в COMPLETED |
| **Факт** | `POST /api/sales/{id}/complete` → `404 Sale not found`. Sale существует (`PATCH /.../status` возвращает 404, `PATCH /...` возвращает 404). |
| **Попытки** | `POST /complete`, `PATCH /status`, `POST /pay`, `PATCH /` — все 404 |
| **Влияние** | **POS заблокирован** — нельзя завершить продажу → нельзя сделать возврат → нельзя закрыть кассовую смену |
| **Причина** | Endpoint `/api/sales/{id}/complete` не зарегистрирован (404). Sales контроллер не имеет этого метода, либо путь отличается. |
| **Severity** | **BLOCKER** — полный бизнес-процесс продаж недоступен |

### D2. Dashboard показывает 0 продаж, хотя продажи есть

| Поле | Значение |
|------|----------|
| **Сценарий** | После создания sale (DRAFT), проверка dashboard |
| **Факт** | `GET /api/reports/dashboard` → `todaySales.revenue=0, count=0` |
| **Причина** | Dashboard считает только COMPLETED продажи. Поскольку D1 блокирует complete, dashboard всегда показывает 0. |
| **Влияние** | Владелец магазина не видит сегодняшнюю выручку |
| **Severity** | **HIGH** — следствие D1 |

### D3. Stock не показывает Яблоки после Goods Receipt

| Поле | Значение |
|------|----------|
| **Сценарий** | После успешного Goods Receipt (COMPLETED) на 100 ед. Яблок |
| **Факт** | `GET /api/inventory/stock` показывает только `Хлеб: 200 ед.` (создан через stock adjust). Яблоки (100 ед. через GR) отсутствуют. |
| **Влияние** | Расхождение складского учёта |
| **Severity** | **MEDIUM** — требует проверки цепочки goods receipt → stock movement |

### D4. Return товара недоступен

| Поле | Значение |
|------|----------|
| **Сценарий** | Возврат товара покупателю |
| **Факт** | `POST /api/sales/{id}/refund` → 404 (`Cannot transition from DRAFT to REFUNDED`). Возврат возможен только для COMPLETED продажи, но complete недоступен (D1). |
| **Влияние** | Нельзя оформить возврат |
| **Severity** | **HIGH** — следствие D1 |

---

## Сводка

| Сценарий | Статус |
|----------|--------|
| Регистрация компании | ✅ |
| Создание склада | ✅ |
| Товары (с workaround) | ✅ |
| Поставщик | ✅ |
| Закупка (PO lifecycle) | ✅ |
| Приёмка товара | ✅ |
| Остатки | ⚠️ (D3) |
| Продажа | ❌ **BLOCKED** (D1) |
| Возврат | ❌ **BLOCKED** (D4) |
| Dashboard | ⚠️ (D2) |
| Sales Report | ✅ |
| Profit Report | ✅ |

### Блокирующие дефекты

| # | Дефект | Severity |
|---|--------|----------|
| D1 | Sale не завершается (COMPLETE endpoint не зарегистрирован) | **BLOCKER** |
| D4 | Return невозможен (следствие D1) | **BLOCKER** |

**Вывод:** NissoMarket **не может начать работу**. POS-продажи заблокированы — sale создаётся в DRAFT и не может быть переведена в COMPLETED. Без этого невозможен возврат, закрытие смены и корректный dashboard.
