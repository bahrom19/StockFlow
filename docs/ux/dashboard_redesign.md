# StockFlow — Dashboard Redesign (Phase 0.5)

**Date:** 2026-08-07
**Scope:** Dashboard only. No backend, no DB, no new features, no business-logic changes.
**Target:** "How is my business today?" answered in <5 seconds. Commercial SaaS ERP look ($100k/yr class — Stripe / Shopify Admin / Zoho / Odoo).

---

## 1. Current Problems (from audit + source review)

| # | Problem | Evidence |
|---|---------|----------|
| P1 | **6 dead Quick Actions** (`onTap: () {}`) — New Sale, Purchase, Customer, Stock Take, Invoice, Transfer | `dashboard_screen.dart` `_QuickActionsGrid` |
| P2 | KPI cards are **flat rows of identical cards** — no trend, no comparison, no hierarchy | `_KpiGrid` / `_KpiRow` — 8 identical cards, same size, no emphasis |
| P3 | Empty states are **plain text** ("No sales data available", "No recent sales") with no onboarding CTA | `sales_chart.dart`, `recent_sales_list.dart` |
| P4 | Payments card empty state is a bare string ("No sales today yet") | `today_payments_card.dart` |
| P5 | Recent-sales rows **not tappable** (`onTap: () {}`) | `recent_sales_list.dart` |
| P6 | Chart labels at **9 px** (below readable), no axis labels, no tooltips | `sales_chart.dart` |
| P7 | **No vertical rhythm** — rows of cards packed with `md` gaps; no breathing room | `_DashboardContentView` |
| P8 | Typography not differentiated — value/label/helper all mid-size | `KpiCard` uses `titleLarge` for value |
| P9 | No hover/focus feedback on KPI cards (Card + InkWell with null onTap → no ripple) | `KpiCard` |
| P10 | Invoice quick action references a **feature that doesn't exist** — violates "no fake interactions" | `_QuickActionsGrid` |

---

## 2. Wireframe (desktop ≥1200px)

```
┌────────────────────────────────────────────────────────────────────────┐
│  Hello, Bahrom ☀️                         Wed, Aug 7 · Store snapshot   │
├────────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │Revenue  │ │ Profit  │ │ Sales   │ │Inv.Value│ │Customers│          │
│  │$12,450  │ │ $4,700  │ │ 32      │ │$86,200  │ │ 148     │          │
│  │▲ +18%   │ │▲ +6%    │ │vs 24    │ │ ─       │ │▲ +3     │          │
│  │vs yest. │ │vs yest. │ │yesterday│ │         │ │vs yest. │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
├────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────┐  ┌───────────────────────────────┐  │
│  │ Sales — Last 7 Days           │  │ Today's Payments              │  │
│  │  ██  ████  ██  ████  ██████   │  │  ▓▓▓▓▓▓▓▓▓░░░░░░░░           │  │
│  │  grid + axis labels + tooltip │  │  Cash $900 · Card $300 · ...  │  │
│  └───────────────────────────────┘  └───────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌────────────────────────┐  ┌────────────────────┐  │
│  │ Low Stock    │  │ Recent Sales           │  │ Quick Actions      │  │
│  │ ⚠ 4 items    │  │ #S-001 $1,200 · Done   │  │ ┌───────────────┐  │  │
│  │ list + CTA   │  │ #S-002 $860  · Done    │  │ │ ＋ New Sale   │  │  │
│  │              │  │ (rows tappable)        │  │ │   Start POS   │  │  │
│  │              │  │                        │  │ └───────────────┘  │  │
│  └──────────────┘  └────────────────────────┘  │ + Purchase ...     │  │
│                                               └────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ AI Insights · Business Recommendations · Notifications           │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

**Mobile/tablet (<900px):** KPI row wraps 2-col; chart/payments stack; low-stock/recent/actions stack.

---

## 3. New Visual Hierarchy

| Level | Element | Type style |
|-------|---------|-----------|
| H1 | Greeting + date context | `headlineSmall`/`titleLarge`, secondary color |
| H2 | KPI value (Revenue emphasized — larger card) | `headlineMedium` → `displaySmall`, w700, `tabularFigures` |
| H3 | KPI label + trend chip | `labelMedium` (label), `labelSmall` (trend, green/red chip) |
| H4 | Section titles (Recent Sales, Quick Actions…) | `titleMedium` w700 |
| H5 | Helper text, timestamps, footnotes | `bodySmall` / `labelSmall`, onSurfaceVariant |

### KPI card anatomy
```
┌────────────────────────────┐
│ [icon chip]           ▲chip │
│ $12,450                    │   ← big number (tabular)
│ Revenue                    │   ← medium label
│ ▲ +18% vs yesterday        │   ← trend + comparison, colored
└────────────────────────────┘
```
- Icon chip: 40×40 tinted container (existing pattern, kept).
- Trend chip: existing `changePercent` pattern (green/red), **always rendered** (0% → neutral grey) — never empty.
- Comparison line: `vs yesterday` / `vs last month` / `total` subtitle.
- Revenue card: slightly larger on desktop (emphasis), others uniform.
- Hover: elevation 0→2 + border tint + icon chip scale. Focus: visible ring. Pressed: subtle scale 0.98.

### Quick Action card anatomy
```
┌──────────────────────────────┐
│ [icon in tinted squircle]     │
│ New Sale                     │   ← titleMedium w600
│ Start a sale at the POS      │   ← bodySmall, onSurfaceVariant
└──────────────────────────────┘
```
- Card: hover lift + arrow-slide micro-interaction, min-height ~96px.
- **Only real routes** (see §5). No Invoice (feature doesn't exist) — remove.

---

## 4. Empty / Onboarding States (replace every bare string)

| Widget | Old | New |
|--------|-----|-----|
| Chart | "No sales data available" | Icon (bar_chart) + "No sales yet" + "Complete your first sale to see trends here." + [New Sale] tonal button |
| Recent sales | "No recent sales" | Icon (receipt) + "No recent sales" + "Start by creating your first sale" + [New Sale] |
| Payments | "No sales today yet" | Icon (payments) + "No payments today" + "Sales you make today will appear here." |
| Low stock (empty) | — | "All stocked up ✓" + "You have no low-stock items." (proactive positive state) |
| KPI values | "$0.00" raw | Keep values but add neutral trend chip "—" instead of hiding |

**Rule:** every empty state = icon + title + one-line explanation + primary CTA where an action exists.

---

## 5. Quick Actions — Final Wiring (no dead buttons)

| Action | Route | Notes |
|--------|-------|-------|
| New Sale | `/sales/new` | Opens POS |
| Purchase | `/purchasing/new` | New purchase order |
| Add Customer | `/customers/new` | |
| Add Product | `/products/new` | |
| Stock Movements | `/inventory/movements` | |
| Inventory | `/inventory` | Adjust/Transfer live there |

Invoice removed (no such feature). Every remaining action navigates.

---

## 6. Implementation Plan

1. **`dashboard_screen.dart`** — new content layout:
   - Greeting row (name + live date, keep "Hello, …" for e2e).
   - KPI row: desktop 5-up with Revenue emphasized; tablet 2-col wrap; mobile 2-col.
   - Chart + Payments side-by-side on ≥1200px (Row with Expanded), stacked below.
   - Grid: Low Stock | Recent Sales | Quick Actions (3-up ≥1400px, 2-up ≥1024px, stacked below).
   - AI Insights row (keep existing card, unchanged).
2. **`kpi_card.dart`** — v2: always-rendered trend chip, comparison subtitle, hover/focus/pressed states, `tabularFigures`, emphasized variant.
3. **`sales_chart.dart`** — empty state with CTA; labels ≥11px; optional tooltip on tap.
4. **`recent_sales_list.dart`** — tappable rows → `/sales/:id`; onboarding empty state with CTA.
5. **`today_payments_card.dart`** — professional empty state.
6. **New: `quick_actions.dart`** widget — premium action cards with real routes + hover animation.
7. **Spacing pass** — consistent `lg`/`xl` section gaps, cards breathe; `ListView` padding `xl`.
8. **Validation** — `flutter analyze`, `flutter test`, `flutter build web --release`; e2e strings "Today's Revenue"/"Today's Sales" preserved.

---

## 7. Acceptance Criteria

- [ ] 0 dead interactions on Dashboard (grep `onTap: () {}` → none in dashboard files)
- [ ] KPI shows trend + comparison on every card
- [ ] Every empty state has icon + title + copy + CTA where applicable
- [ ] Quick Actions all navigate to real routes; Invoice gone
- [ ] Recent Sales rows navigate to sale detail
- [ ] No horizontal overflow at 1920/1440/1366/1024
- [ ] `flutter analyze` 0 errors · `flutter test` green · `flutter build web --release` OK
- [ ] e2e strings "Today's Revenue" / "Today's Sales" still present
