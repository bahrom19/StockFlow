# StockFlow Enterprise Roadmap

## Version 0.1

Foundation

* Project structure
* Docker
* PostgreSQL
* Redis
* Prisma
* Swagger

---

## Version 0.2

Authentication

* Login
* Register
* JWT
* Refresh Token

---

## Version 0.3

Companies

* Multi-tenant
* Employees
* Roles

---

## Version 0.4

Inventory

* Products
* Categories
* Warehouses
* Barcode

---

## Version 0.5

Sales

* POS
* Returns
* Receipts

---

## Version 0.6

CRM

* Customers
* Bonuses
* Purchase History

---

## Version 0.7

Finance

* Expenses
* Income
* Cash Flow

---

## Version 0.8

Analytics

* Dashboard
* Reports

---

## Version 0.9

AI Assistant

* Forecasting
* Recommendations
* Natural Language Queries

---

## Version 1.0

Commercial Release

---

## Version 1.2

Payment Analytics & Enterprise POS *(RELEASED & FROZEN — tag `v1.2.0`, branch `release/v1.2.x`)*

* Per-method payment allocation (CASH / CARD / QR / BANK_TRANSFER / MOBILE_WALLET)
* Cash Shift, X Report, Z Report with per-method breakdown
* Refunds reverse exact payment composition
* Payment Analytics UI (cards, pie/line/bar charts, details table, CSV + PDF export)
* Enterprise POS workspace (barcode, held sales, customer picker, shift panel, receipts)
* Phase 3 web deployment automation (Web Deploy workflow + nginx static service)
* Accounting core frozen from v1.1.1 — GL / Journal / Costing / FIFO / Average Cost unchanged

---

## Version 1.3 — Roadmap

Payment Analytics depth

* Payment method trending over custom ranges
* Cashier performance and shift analytics
* Payment Details export: scheduled CSV/PDF reports
* QR payment integration (local providers)

Operations

* Reorder automation (auto-PO from low stock)
* Multi-warehouse dashboards and stock projection
* Supplier scorecards (lead time, fill rate)
* Customer loyalty / price lists

Platform

* Provision Railway web static service (RAILWAY_TOKEN + RAILWAY_WEB_SERVICE_ID)
* PWA install + offline mode for POS
* Native OS print dialog integration for receipts
* Performance: query index review, report caching
* Multi-language + multi-currency support
