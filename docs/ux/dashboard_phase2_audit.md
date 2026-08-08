# Dashboard UX Phase 2 — Enterprise Polish Audit

**Date:** 2026-08-07
**Scope:** Flutter UI only. No backend / API / models / business logic changes.
**Method:** Source audit of dashboard widgets + application shell, live browser
screenshot verification (1440×900), pixel analysis of rendered output.

---

## 1. Current State (after Phase 0.5 / v2)

Dashboard composition: greeting → compact KPI strip (5 cards) → Quick Actions
strip → Attention section (low stock / out of stock / open shift) → hero sales
chart + payments → recent sales + AI insights. New companies get a single
OnboardingHero instead of five scattered empty cards.

**Honest score before this pass: 7.0/10** — functional and clean, but the
"expensive SaaS" polish is missing in several places.

---

## 2. Findings

### P1 — Main KPI does not dominate (Visual hierarchy)

| Problem | Why it hurts UX |
|---|---|
| All 5 KPI cards share nearly equal weight (flex 13/10/10/10/10); Revenue is only ~30% wider | The owner cannot grasp "how is the business today" in 3 seconds — every metric screams equally |
| Compact cards are flat white; emphasized Revenue only differs by a faint border | No visual anchor at the top of the screen |

**Change:** Revenue card gets a hero treatment in compact mode — soft primary→success
gradient surface, slightly larger value, tinted border. Remaining four stay
compact but on a neutral surface. Result: one dominant figure, four supporting.

### P2 — Empty states are "decent" but not Stripe-grade

| Problem | Why it hurts UX |
|---|---|
| Chart / payments / recent-sales empties each hand-roll their own icon+text+CTA with inconsistent spacing | Feels like three separate implementations, not a design system |
| No layered icon illustration (icon in a tinted "artboard" with a decorative backdrop) | Flat single icon reads as "nothing here" instead of a guided start |

**Change:** one shared `PremiumEmptyState` widget (layered icon artboard, title,
description, CTA, correct rhythm) applied to chart, payments and recent sales.

### P3 — Top bar feels dead

| Problem | Why it hurts UX |
|---|---|
| Notifications button is `onPressed: () {}` — a dead control (flagged C3 in Phase 1 audit) | Users click it, nothing happens → trust loss |
| No "living system" cues: no sync status, no active shift, no current time | Static chrome; commercial ERPs always show a heartbeat |
| No placeholder when data is absent | Top bar can't degrade gracefully |

**Change:** notifications click → informative snackbar ("You're all caught up"),
not a dead button. Add a passive status cluster: green pulse dot + "Live" +
current HH:MM (self-updating timer) and a shift pill that reflects
`cashShiftProvider` *without triggering loads* (neutral "—" placeholder when
unknown). Pure UI, zero new API calls.

### P4 — Sidebar is functional but flat

| Problem | Why it hurts UX |
|---|---|
| Nav items have no hover tint (only ink ripple on press) | No affordance that items are interactive |
| Active item = translucent primaryContainer, no indicator bar | Selection state is ambiguous at a glance |
| Section labels / item paddings slightly inconsistent | Feels like a list, not a designed rail |

**Change:** hover background + icon color shift, 3px rounded active indicator
bar on the left, subtle scale/hover on the user card, tightened rhythm.

### P5 — Skeleton loaders are static

| Problem | Why it hurts UX |
|---|---|
| KPI skeletons are flat grey boxes, no shimmer | During load the page looks broken, not "loading" |

**Change:** animated shimmer (gradient sweep) for greeting + KPI skeletons.

### P6 — Color system leaks

| Problem | Why it hurts UX |
|---|---|
| `today_payments_card.dart` hardcodes five HEX values (`0xFF9334E6` etc.) instead of tokens | Inconsistent, breaks dark theme intent, no single source of truth |

**Change:** add payment-method tokens to `DesignTokens` and consume them.

---

## 3. What Will Change (summary)

| File | Change |
|---|---|
| `docs/ux/dashboard_phase2_audit.md` | This audit |
| `core/theme/design_tokens.dart` | Add payment tokens (cash/card/qr/bank/wallet) |
| `payments/.../today_payments_card.dart` | Use tokens instead of raw HEX |
| `core/widgets/premium_empty_state.dart` (new) | Shared Stripe-grade empty state |
| `dashboard/.../sales_chart.dart`, `recent_sales_list.dart` | Adopt `PremiumEmptyState` |
| `dashboard/.../kpi_card.dart` | Hero (dominant) compact treatment for Revenue |
| `dashboard/.../dashboard_screen.dart` | Wire hero flag + shimmer skeletons |
| `core/shell/app_sidebar.dart` | Hover, active indicator bar, user-card polish |
| `core/shell/app_top_bar.dart` | Live status cluster (dot+time+shift pill), notifications snackbar |

## 4. Expected Effect

- Owner sees the single most important number first → **hierarchy in 3 seconds**
- Empty screens feel designed, guided, complete → **Stripe-grade onboarding**
- Chrome feels alive (Live · HH:MM · shift pill) → **"expensive SaaS" feel**
- Sidebar selection is unambiguous + hover feedback → **desktop-grade UX**
- All colors from tokens, dark-theme safe → **design-system consistency**

## 5. Constraints Honored

No backend changes · no API changes · no model changes · no architecture
changes · no perf regression (status cluster is passive, no new requests;
shimmer is a single lightweight controller) · no new dependencies.
