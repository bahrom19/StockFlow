# StockFlow — Enterprise UX Redesign Roadmap

**Source:** `docs/ux/enterprise_ux_audit.md` (audit + scores first)
**Principle:** redesign before implementation; every phase ends green (analyze / test / web build).
**Cross-cutting rule from audit:** no rendered control may have an empty callback (`onTap: () {}`, `onPressed: () {}`, `onChanged: (_) {}`) — wire it, disable it, or remove it.

---

## Phase 0 — Foundation & Guardrails (0.5–1 day, Small)

**Goal:** stop the bleeding; make the codebase safe for redesign.

- [ ] Kill all dead UI (audit C1–C6): wire Quick Actions → routes; Settings dark-mode → persisted `ThemeMode`; notifications → popover or remove; Edit Profile → dialog + `PATCH /auth/me`; recent-sales rows → `/sales/:id`; Settings sub-rows → real actions
- [ ] Introduce `ThemeMode` persistence via `PreferencesStorage` (no new packages)
- [ ] Add `AppMotion` constants (durations 150/250/400 ms, curves) and start using them
- [ ] Normalize hardcoded colors (`Colors.red/green`) → `DesignTokens` (L1, L2)
- [ ] Grep-guard: CI lint step that fails on empty callbacks (custom analyzer rule or search in CI)

**Exit criteria:** zero dead controls; dark mode actually toggles and persists; analyze/test/build green.

---

## Phase 1 — Design Tokens & Component System (1–2 days, Medium)

**Goal:** one design language, tokenized.

- [ ] `AppTypography`: switch to Inter (bundled) + `tabularFigures` for all financial text; bump chart labels ≥11 px (L3)
- [ ] Data-viz palette: add `ChartTokens` (5–8 distinct hues) used by all charts
- [ ] Density tokens: `Density.compact/comfortable` applied to tables, lists, chips
- [ ] Unified icon system: outlined default + filled on selection (L4)
- [ ] Component pass: Cards (hover elevation + border), Buttons (focus ring, pressed scale), Dialogs (title/actions tokens), Forms (consistent field heights), Filters, Search, Date pickers (shared `showAppDateRangePicker`)
- [ ] `EmptyStateWidget` v2: brand illustration slot, 3-step onboarding hint, primary CTA (H9)
- [ ] `LoadingStateWidget` v2: skeleton primitives (`SkeletonBox`, `SkeletonTable`, `SkeletonCard`) replacing bare spinners
- [ ] `ErrorStateWidget` v2: icon + message + retry + "report" affordance
- [ ] `AppSnackbar` v2: success checkmark animation, severity icons, action slot

**Exit criteria:** all shared widgets consume tokens; screens visually consistent; dark/light parity; tests green.

---

## Phase 2 — Modern Tables (`EntityTable` v2) (2–3 days, Medium–Large)

**Goal:** ERP-grade tables — the daily driver.

- [ ] **Sticky header** (H1)
- [ ] **Column sorting** — provider-driven sort state + arrows (H2)
- [ ] **Density switch** in toolbar — comfortable/compact (H3)
- [ ] **Row selection + bulk bar** — checkbox column, Bulk Delete/Export/Status (H4)
- [ ] **Column resizing** — drag handles (H5; largest item, can ship after sorting)
- [ ] **Pagination v2** — page numbers + page-size selector (25/50/100) replacing "Load more" default (H6); keep Load-more as optional mode
- [ ] Hover row highlight + selected-row tint
- [ ] Apply `EntityTable` v2 to: Products, Inventory, Customers, Suppliers, Warehouses, Purchasing, Sales, Finance, Reports

**Exit criteria:** every list screen upgraded; sort/density/selection persist per-screen; tests green.

---

## Phase 3 — Dashboard Redesign (1.5–2 days, Medium)

**Goal:** store status in 5 seconds.

- [ ] KPI row: Revenue · Profit · Sales · Inventory Value · **Cash in Drawer** (M1)
- [ ] Row 2: **Sales Trend** (area, 30d) + **Payment Donut** (M3) + **Top Selling Products** (M2, top-5 ranked bars)
- [ ] Row 3: Low Stock alert list · Recent Sales · **Quick Actions (wired, Phase 0)**
- [ ] Row 4: AI Insights (real content or clearly-off state) · Business Recommendations · Notifications
- [ ] Refresh without full-screen flash: keep `isRefreshing` pattern; skeleton on first load only
- [ ] Empty dashboard (new company): onboarding checklist card ("Create product → Open shift → First sale")

**Exit criteria:** 5-second comprehension verified by review; no dead widgets; tests green.

---

## Phase 4 — Micro-interactions & Motion (1 day, Small)

**Goal:** the app feels alive.

- [ ] Hover: cards lift (elevation+shadow), rows tint, buttons subtle scale
- [ ] Focus: visible focus ring for keyboard users (L6)
- [ ] Selection: animated checkboxes, row selection ripple
- [ ] Loading: skeleton shimmer everywhere (from Phase 1)
- [ ] Success/Error: animated snackbars, dialog success states, POS completion celebration
- [ ] Transitions: consistent route fade/slide (250 ms), list item entrance (staggered fade)
- [ ] Scroll: smooth scroll-to-top FAB on long tables, edge fade on tables

**Exit criteria:** interactions feel intentional; reduced-motion preference respected (`MediaQuery.disableAnimations`).

---

## Phase 5 — Shell, Navigation & Keyboard (1.5–2 days, Medium)

**Goal:** power-user speed.

- [ ] Sidebar collapse ↔ rail (260 px ↔ 72 px) with tooltips (M4); persist state
- [ ] Global search deep-links **with query pre-filled** (H7): `?q=` through routes
- [ ] Notification bell → real popover (Phase 0) + unread badge
- [ ] Global keyboard shortcuts (M5): `/` focus search · `N` new entity · `Alt+1..9` sections · `?` shortcut palette
- [ ] Breadcrumbs on detail screens (`Products / Coca-Cola 0.5L`)
- [ ] Command palette (Linear-style) for actions + navigation

**Exit criteria:** power-user flow: any module in ≤2 keystrokes; tests green.

---

## Phase 6 — Responsive & Density (1 day, Small–Medium)

**Goal:** no overflow anywhere, 768 → 1920.

- [ ] Verify all breakpoints: 1920 / 1600 / 1440 / 1366 / 1280 / 1024 / 768 (audit H: zero horizontal overflow, no RenderFlex errors)
- [ ] Table behavior at 1024/768: hide low-priority columns (responsive column priority list per table)
- [ ] POS at laptop/tablet widths: panels stack or collapsible
- [ ] Dashboard grid reflow at tablet widths
- [ ] Touch targets ≥48 px on narrow widths
- [ ] Landscape-tablet POS optimization

**Exit criteria:** console clean at every width; screenshot matrix captured.

---

## Phase 7 — Task-Path Optimization & Reports (1–2 days, Medium)

**Goal:** fewer clicks for common work.

- [ ] Create Product: from list, one-click New → pre-filled unit/category defaults
- [ ] Create Sale / POS: keep keyboard-only path; add "last used" defaults (customer, payment)
- [ ] Receive Inventory (Goods Receipt): pre-fill from PO, quantity=ordered
- [ ] Open/Close Shift: one-tap from POS header with confirmation
- [ ] Reports: date-range picker + period segmented control + sales trend chart (M10); PDF/CSV parity
- [ ] Purchasing status stepper inline (M9)
- [ ] Command palette integration for all of the above

**Exit criteria:** task-path walkthrough shows ≥30% click reduction on core flows.

---

## Phase 8 — QA, Hardening & Release (1 day)

**Goal:** ship with confidence.

- [ ] Full manual pass of every screen at 1440×900 + 1366×768
- [ ] Empty-state coverage: every module with real onboarding copy (audit H9)
- [ ] Keyboard-only walkthrough (no mouse)
- [ ] `flutter analyze` = 0 · `flutter test` = green · `flutter build web --release` ✓
- [ ] Regenerate screenshots matrix for docs
- [ ] Update `docs/ux/enterprise_ux_audit.md` scores → post-implementation scores
- [ ] Release notes + freeze

**Exit criteria:** audit scores ≥8 for every screen; zero dead controls; all gates green.

---

## Sequencing & Dependencies

```
Phase 0 (foundation) ──► Phase 1 (tokens) ──► Phase 2 (tables)
                          │                     │
                          ├──► Phase 3 (dashboard) ◄──┘ (needs tokens + wired actions)
                          ├──► Phase 4 (motion)   (needs tokens)
                          └──► Phase 5 (shell)    (independent, can parallelize with 3–4)
Phase 6 (responsive) ──► Phase 7 (task paths) ──► Phase 8 (QA/release)
```

**Suggested parallel tracks:** (3 + 5) and (4) can run concurrently after Phase 1.

**Total estimate:** ~10–13 focused engineering days for the full program; Phase 0 alone delivers the largest perceived-quality jump in under a day.
