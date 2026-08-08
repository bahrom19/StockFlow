# StockFlow — Enterprise UX Audit

**Date:** 2026-08-07
**Auditor role:** Senior Product Designer / UX Researcher / Senior Flutter Engineer
**Benchmark:** Stripe Dashboard · Linear · Notion · Shopify Admin · Zoho Inventory · Odoo Enterprise
**Method:** Full source-level audit of every screen, the shared widget system, theme system and navigation. No production code modified — this document precedes implementation.

---

## 1. Executive Summary

StockFlow already has a **solid enterprise foundation**: a real Material 3 theme system (light/dark), centralized design tokens, a consistent 4 px spacing grid, a strong flagship `EntityTable` component, and a functional desktop-first shell. The app is **not** visually broken — it is **inconsistent and unfinished at the edges**.

The three systemic problems:

1. **Dead UI everywhere** — dozens of controls render but do nothing (`onTap: () {}`, `onChanged: (_) {}`). This is the single largest destroyer of perceived quality: enterprise users click once, nothing happens, and trust is gone.
2. **Tables are good but not great** — `EntityTable` covers search/filter/export/load-more, but has no sticky headers, sorting, density switch, column resizing or bulk actions. ERP lives in tables; this is where the biggest gains are.
3. **States are functional but plain** — empty states are text-only, loading is mostly a bare spinner, success is a plain snackbar. No illustration, no skeleton tables, no micro-interaction feedback.

**Overall readiness:** good engineering, mid-market UX. With ~4 focused phases it can reach the Stripe/Linear benchmark.

---

## 2. Screen-by-Screen Scorecard

| # | Screen | Score | One-line verdict |
|---|--------|:-----:|------------------|
| 1 | Login | **8** | Clean M3, validation, show/hide password, register link |
| 2 | Register | **8** | Complete first-user flow with confirm-password validation |
| 3 | Dashboard | **6** | KPI cards good; **6 dead quick-action buttons**, no Cash-in-Drawer, basic chart |
| 4 | Products list | **7** | Flagship `EntityTable`: search, filters, CSV, pagination, detail nav |
| 5 | Product detail/form | **7** | Solid forms; no image preview beyond placeholder |
| 6 | Inventory | **7** | Table + Adjust/Transfer dialogs + level badges (Out/Low/OK) |
| 7 | Warehouses | **6.5** | Table fine; no stock-overview panel, no default-warehouse affordance |
| 8 | Customers | **7** | Table + form; no purchase history tab |
| 9 | Suppliers | **7** | Table + form; no PO history tab |
| 10 | Purchasing (PO) | **6.5** | Functional; status flow not surfaced visually in list |
| 11 | Sales history / detail | **6.5** | Table + detail; detail screen is spartan |
| 12 | POS workspace | **8** | Two-panel catalog/cart, keyboard shortcuts, barcode support |
| 13 | Reports | **6** | KPI grid + sales table + PDF; no date range, no charts |
| 14 | Finance (Trial Balance) | **7** | Balance chip, type filters, CSV export |
| 15 | Payment Analytics | **8** | Cards, pie/trend/bar charts, details table (v1.2 Phase 2) |
| 16 | Settings | **4** | **Dark-mode switch does nothing**, Language/Notifications/Terms dead |
| 17 | Profile | **5** | Static info card; **"Edit Profile" button does nothing** |
| 18 | Shell (Sidebar+TopBar) | **7** | Fixed-width sidebar (just fixed a crash), global search routes but drops the query |

**Average:** **6.7 / 10** — functional, not yet enterprise-polished.

---

## 3. Design System Assessment (the foundation)

**What is already strong (keep, don't touch):**

- `ThemeData` split into `light_theme.dart` / `dark_theme.dart` with proper Material 3 `ColorScheme` — surfaces, containers, error states all mapped.
- `DesignTokens` — single source of truth for brand/neutral/status/financial colors.
- `AppTypography` — complete M3 type scale with light/dark variants.
- `AppSpacing` — 4 px grid, radius, breakpoints (360/600/900/1200).
- `CardTheme` / button themes / `InputDecorationTheme` — consistent surface styling everywhere for free.
- `EntityTable` — genuinely good architecture: toolbar (search + filter chips + refresh + CSV + create), desktop DataTable + mobile card fallback, loading/empty/error states, "Showing X of Y" + Load more.

**What is missing from the system:**

| Missing | Impact | Effort |
|---|---|---|
| Skeleton loaders (only KPI has one) | Loading feels unpolished | Small |
| Table skeleton rows | First paint looks empty | Small |
| Empty-state illustrations/branding | Onboarding feels generic | Small |
| Standardized hover/focus elevation transitions | Flat interactions | Small |
| Motion system (durations/curves constants) | Inconsistent animation timings | Small |
| Density tokens (comfortable/compact) | No table density switch | Medium |
| Data-visualization palette (distinct 5-8 hues) | Charts reuse status colors | Small |
| Icon set consistency (outlined vs filled mixed) | Visual noise | Small |
| Standardized page-layout max-width | Ultra-wide screens stretch rows | Small |

---

## 4. UX Problems — Prioritized

### 🔴 CRITICAL — broken/dead interactions (fix first, cheap, huge trust impact)

| # | Problem | Where | Proposed redesign | Effort |
|---|---------|-------|-------------------|--------|
| C1 | **6 dead Quick Actions** — New Sale, Purchase, Customer, Stock Take, Invoice, Transfer all `onTap: () {}` | `dashboard_screen.dart` `_QuickActionsGrid` | Wire to routes: `/sales/new`, `/purchasing/new`, `/customers/new`, `/inventory`, `/sales/new` (invoice), `/inventory` (transfer) | Small |
| C2 | **Dark Mode switch does nothing** (`onChanged: (_) {}`) | `settings_screen.dart` | Persist `ThemeMode` via `PreferencesStorage`, apply at app root, animated transition | Small |
| C3 | **Notifications bell does nothing** | `app_top_bar.dart` | Open a notifications popover (unread list from backend) or remove the button until feature exists | Small |
| C4 | **Edit Profile does nothing** | `profile_screen.dart` | Open edit dialog (name/phone), wire to `PATCH /auth/me` | Small |
| C5 | **Recent-sales rows not tappable** (`onTap: () {}`) | `recent_sales_list.dart` | Navigate to `/sales/:id` | Small |
| C6 | **Settings sub-rows dead** — Language, Notifications, Terms, Privacy | `settings_screen.dart` | Wire Language (locale switch), Notifications (real prefs), Terms/Privacy (info dialog or docs URL) | Small |

**Rule going forward:** never ship a rendered control with an empty callback. Either wire it, disable it visually, or remove it.

### 🟠 HIGH — tables & data-dense surfaces

| # | Problem | Where | Proposed redesign | Effort |
|---|---------|-------|-------------------|--------|
| H1 | No **sticky table header** | `entity_table.dart` | `DataTable` header pinned with `CustomScrollView`/two-tables or `Table` + `NestedScrollView` | Medium |
| H2 | No **column sorting** | `entity_table.dart` | `onSort` on `DataColumn`, sortable state in provider, sort arrow indicators | Medium |
| H3 | No **density switch** (comfortable/compact) | `entity_table.dart` | Density segmented control in toolbar; row heights 52/40 | Small |
| H4 | No **bulk actions / row selection** | `entity_table.dart` | Checkbox column, selection chipbar (Delete, Export selected, Status) | Medium |
| H5 | No **column resizing** | `entity_table.dart` | Drag handles on headers (custom `Table` or package) | Large |
| H6 | **"Load more" instead of pagination** | `entity_table.dart` footer | Page-numbered pagination (1 2 3 … N) + per-page selector (25/50/100) | Medium |
| H7 | Global search **drops the query** — routes to module but search box is empty | `app_top_bar.dart` | Pass `?q=` through route → destination screen pre-fills search | Small |
| H8 | **SalesBarChart minimal** — no axis labels, no tooltips, no hover, 9 px labels | `sales_chart.dart` | Add Y-axis grid labels, value tooltips on hover, min 11 px labels; or adopt `fl_chart` | Medium |
| H9 | Empty states **text-only, generic** | `empty_state_widget.dart` + defaults | Illustrated empty states with brand color, 3-step onboarding hint, primary CTA | Small |

### 🟡 MEDIUM — polish & information architecture

| # | Problem | Proposed redesign | Effort |
|---|---------|-------------------|--------|
| M1 | Dashboard lacks **Cash in Drawer** KPI (owner wants it in 5-second scan) | Add KPI from open-shift/cash data | Small |
| M2 | No **Top Selling Products** panel | Top-N by qty from sales report, ranked list with progress bars | Medium |
| M3 | Payment distribution on dashboard is stacked bar + rows; no **pie/donut** | Donut with legend (matches Payment Analytics module) | Medium |
| M4 | Sidebar cannot **collapse to rail**; 260 px fixed | Collapse toggle → 72 px rail with tooltips (Linear-style) | Medium |
| M5 | No **keyboard shortcuts** outside POS | Global shortcuts: `/` focus search, `N` new, `Alt+1..9` nav sections; shortcut help `?` | Medium |
| M6 | Typography is plain Roboto; numbers not tabular | Add `Inter` + `tabularFigures` for financial columns | Small |
| M7 | No consistent **success animation** (snackbar only) | Animated checkmark toast / inline banner; POS uses success dialog already | Small |
| M8 | `AppScaffold` default empty title is **"No data"** | Default to contextual copy passed by each screen; remove bare "No data" | Small |
| M9 | Purchasing status flow not visible in list | Status stepper (Pending→Approved→Ordered→Received) inline | Medium |
| M10 | Reports lacks **date-range picker** and chart | Period segmented control (Today/Week/Month/Custom) + sales trend chart | Medium |

### 🟢 LOW — micro-polish

| # | Problem | Fix | Effort |
|---|---------|-----|--------|
| L1 | Mixed `Colors.green/red` hardcoded in KPI delta | Use `DesignTokens.success/error` | Trivial |
| L2 | `Colors.red` for Sign Out in Settings | Use `colorScheme.error` | Trivial |
| L3 | Chart label font 9 px below readable minimum | ≥11 px | Trivial |
| L4 | Inconsistent icon styles (outlined vs filled) | Normalize to outlined + selected filled | Trivial |
| L5 | Table column spacing fixed 28 | Token-driven (`tableColumnSpacing`) | Trivial |
| L6 | No focus-visible ring for keyboard nav | `Focus`/`MaterialState` focus ring tokens | Small |

---

## 5. Proposed Redesign — Target Information Architecture

### Dashboard (5-second owner scan)

```
┌─ Row 1: KPI row ──────────────────────────────────────────────┐
│ Revenue │ Profit │ Sales (count) │ Inventory Value │ Cash in Drawer │
└───────────────────────────────────────────────────────────────┘
┌─ Row 2: charts ───────────────────────────────────────────────┐
│ Sales Trend (area, 30d)   │ Payment Donut  │ Top Products (top-5 bars) │
└───────────────────────────────────────────────────────────────┘
┌─ Row 3 ───────────────────────────────────────────────────────┐
│ Low Stock (red alert list) │ Recent Sales │ Quick Actions (WIRED) │
└───────────────────────────────────────────────────────────────┘
┌─ Row 4 ───────────────────────────────────────────────────────┐
│ AI Insights │ Business Recommendations │ Notifications        │
└───────────────────────────────────────────────────────────────┘
```

### Table (target)

Sticky header · sortable columns · density switch (comfortable/compact) · checkbox selection + bulk bar · page-numbered pagination with page-size · CSV/PDF export · inline status badges · hover row highlight · empty state with illustration + primary CTA.

### Shell (target)

Collapsible sidebar (260 px ↔ 72 px rail, tooltips) · global search that deep-links with the query pre-filled · notification bell with real badge · keyboard shortcut palette (`?`/`/`).

---

## 6. Estimated Impact

| Change group | Effort | UX impact |
|---|---|---|
| Kill dead UI (C1–C6) | Small | **Very high** — restores trust in every screen |
| Table upgrades (H1–H6) | Medium | **Very high** — the daily driver for ERP staff |
| Dashboard redesign (M1–M3) | Medium | High — owner gets status in 5 s |
| Empty/loading/error states (H9) | Small | High — perceived quality on every first-run |
| Shell/nav (M4–M6, H7) | Medium | High — navigation speed for power users |
| Motion + micro-interactions | Small | Medium — perceived polish |
| Responsive tuning (768–1920) | Small–Medium | Medium — no overflow on any target |
| Task-path reduction (POS/stock/sale) | Medium | Medium — fewer clicks per shift |

---

## 7. Verification Plan (after each phase)

- `flutter analyze` → 0 errors
- `flutter test` → all green (existing 244 + new widget tests per component)
- `flutter build web --release` → success
- Manual checklist: no dead controls on any screen (grep `onTap: () {}` / `onPressed: () {}` / `onChanged: (_) {}` returns nothing but intentional stubs)
- Responsive: 1920/1600/1440/1366/1280/1024/768 — no horizontal overflow, no RenderFlex errors in console

---

*Next: see `docs/ux/ux_redesign_roadmap.md` for the phased implementation plan.*
