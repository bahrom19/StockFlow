# Dashboard v3 — Critical Design Audit

**Date:** 2026-08-07
**Role:** Senior Product Designer (Stripe / Linear / Vercel / Notion benchmark)
**Scope:** Read-only audit of the current Dashboard (v2). No code changes.
**Reference:** live browser render 1440×900, source of `dashboard_screen.dart`,
`kpi_card.dart`, `attention_section.dart`, `onboarding_hero.dart`,
`sales_chart.dart`, `recent_sales_list.dart`, `today_payments_card.dart`,
`app_top_bar.dart`, `app_sidebar.dart`.

**Current score:** 8.2/10 — solid structure, misses the last 20% of polish.

---

## Part 1 — Findings (28)

Each finding: **problem → solution → why it reads "expensive".**

### A. Hierarchy & Information Design

**A1. No date-range control anywhere.**
Problem: "Today's Revenue" and the chart ("Last N Days") live on the same page
with no way to switch Today / 7d / 30d / This month. The eye cannot answer
"is this good or bad?" without a baseline.
Solution: a segmented range switcher in the page header, plus a "vs previous
period" baseline on every KPI.
Why: Stripe's killer move is context. One control that re-frames every number
is the single highest-ROI addition; it turns a snapshot into a dashboard.

**A2. Greeting row mixes personal greeting with business data.**
Problem: "Hello, UX · Business snapshot" competes with KPI titles; the page
has no clear "Overview" page-title hierarchy.
Solution: split into (1) compact page header "Overview" + range switcher,
(2) greeting demoted to a subtitle.
Why: Linear separates "where you are" (breadcrumb/title) from "who you are"
(greeting). Clear hierarchy = the user always knows their location.

**A3. KPI cards are near-equal visual weight.**
Problem: Revenue is only ~30% wider with a faint tint; at 1440px all five
cards still read as a uniform row — the eye has no single anchor.
Solution: Revenue becomes a true hero card — larger value (28–32px), subtle
primary→success gradient wash, and its own sparkline; the other four shrink.
Why: "one dominant number" is how every Stripe dashboard opens. Three-second
comprehension requires a hierarchy, not a row.

**A4. Trend chips hide the comparison.**
Problem: "vs yesterday" is only a tooltip; the visible chip shows a bare %.
New users can't tell if the number is good.
Solution: always-visible line "▲ 18% vs yesterday" under the KPI value, with
color coding; keep the chip for micro-glance.
Why: the delta is the story. Exposing it inline removes a hover dependency
and makes every card self-explanatory.

**A5. "—" trend chip when no data.**
Problem: a neutral grey "—" chip looks broken, not empty.
Solution: replace with microcopy "First sale today?" or hide the chip and
show a muted "No data yet" under the value.
Why: Stripe never shows an em-dash where a human sentence fits. Empty states
should invite, not confuse.

### B. Data Visualization

**B1. Chart has no y-axis labels or value tooltips.**
Problem: bars are unlabelled; there is no hover tooltip with the exact
revenue/profit; gridlines exist but the axis scale is invisible.
Solution: y-axis ticks (0 / ½ / max), value labels on hover, and a
tooltip card with "Mon, Aug 3 — $4,200 revenue · $1,100 profit".
Why: Linear/Stripe charts are inspectable — every point answers "exactly?".
Tooltips are the difference between a graphic and an analytical instrument.

**B2. No totals row above the chart.**
Problem: the legend sits top-right, but "Total for period" is missing.
Solution: a stat strip above the plot: "Total revenue $X · Total profit $Y ·
Avg/day $Z".
Why: at-a-glance aggregates are what executives actually quote. The legend
tells you what colors mean; totals tell you the answer.

**B3. Chart supports no period switching.**
Problem: `chartData` is fixed at 7 days; title says "Last N Days" but there's
no way to change it.
Solution: 7/30/90 segmented control bound to the same profit-report data.
Why: a chart you can't re-frame is a screenshot. Interactivity is the
signature of a mature SaaS.

**B4. Payments card uses a stacked bar, not a distribution.**
Problem: the stacked bar is thin (14px); the payment mix isn't instantly
legible.
Solution: a small donut with a center "Total" + method legend with amounts
and %, keeping the invariant Cash+Card+QR+Bank+Wallet == Total.
Why: Stripe's payout dashboard uses donuts precisely because proportions
read faster than bar segments; the center total doubles as a stat.

**B5. No empty-grid placeholder when chart has 1 day.**
Problem: with a single data point the bars look lonely/accidental.
Solution: minimum 7-slot axis with empty slots rendered as muted ghost bars,
or automatically widen to the available history.
Why: a chart that always looks "full" feels engineered, not broken.

### C. Quick Actions & Actions

**C1. All six quick actions are equal-weight colored tiles.**
Problem: "New Sale" (the money action) is visually identical to "Stock
Movements". Six saturated icons = visual noise.
Solution: promote "New Sale" to a filled primary button; demote the rest to
ghost/tonal tiles; introduce a "More" overflow.
Why: Linear gives exactly one primary CTA per surface. One clear action
reduces decision time and feels deliberate, not scattered.

**C2. No keyboard shortcut hints.**
Problem: the POS has F2/F8/F9, but the dashboard shows no shortcuts.
Solution: show ⌘N / ⌘K hints in the primary action tile and a "Press ⌘K to
search" hint in the top bar search.
Why: power-user affordances are the #1 "expensive tool" signal. Stripe and
Linear surface shortcuts on hover.

**C3. Quick Actions don't animate on tap destination.**
Problem: click → instant route, no feedback of where you're going.
Solution: subtle scale + chevron transition; consider a progress micro-state
during navigation.
Why: felt feedback makes actions feel alive and intentional.

### D. Attention & Status

**D1. Attention section header is plain text.**
Problem: the word "Attention" alone doesn't say "3 things need you".
Solution: a severity header: icon + count badge ("3"), red/amber tint
depending on worst issue; zero-issue state collapses to a slim green
"All clear" strip.
Why: an unread-count style badge is how Vercel surfaces incidents; severity
scans in milliseconds.

**D2. Attention tiles are full-width rows at 1024px.**
Problem: at <1200px tiles stack to 2 columns; the section takes a full
viewport height for 3 tiles.
Solution: compact horizontal severity bar (left color rail + icon + one-line
message), tap to expand.
Why: density = respect for vertical space; premium tools never waste a
screenful on three alerts.

**D3. No "cash in drawer" KPI.**
Problem: shift open/closed exists, but "expected closing / cash in drawer"
is absent from the KPI row.
Solution: add a "Cash in drawer" KPI fed by the open shift (opening balance +
cash sales + cash in − cash out).
Why: the single most asked question by a store owner at 6pm is "how much
cash should be in the drawer?". Answering it on the dashboard is the product
becoming indispensable.

### E. Empty States & Onboarding

**E1. Two different empty-state systems.**
Problem: chart/recent use `PremiumEmptyState`; payments still uses a bespoke
compact empty; onboarding has its own hero. Three visual languages.
Solution: one `PremiumEmptyState` variant family (hero / compact / inline)
with a single icon-artboard system.
Why: consistency is what makes a product feel like a *system* rather than a
collection of screens.

**E2. Onboarding hero has no progress.**
Problem: 4 steps, but no "2 of 4 done" — after adding products the hero
looks identical.
Solution: derive progress from real state (products>0, customers>0, shift
opened, sale completed) and render checkmarks + a progress bar.
Why: progress is the #1 motivation mechanic. Seeing "3 of 4" converts a
checklist into a game.

**E3. AI Insights card is a dead "Coming Soon" promo.**
Problem: a `Coming Soon` badge with decorative chips (Forecast/Analytics/NLP)
that do nothing is the cheapest-looking element on the page.
Solution: either remove it, or convert it into a real "Recommendations"
card fed by existing data (low stock → "Reorder X", no shift → "Open shift",
no sale today → "Ring up your first sale").
Why: Vercel/Stripe never ship decorative promo panels. A recommendation that
uses live data is the "smart product" signal; a Coming Soon badge is an MVP
signal.

### F. Motion & Micro-interactions

**F1. No page-transition on dashboard load.**
Problem: content pops in after skeleton; no fade/rise.
Solution: a single shared fade-up (120–200ms, 8px rise, staggered for
sections) when data lands.
Why: entrance motion is the #1 "designed by people who care" cue. Notion's
subtle rise is exactly this.

**F2. Skeleton→content swap is abrupt.**
Problem: shimmer boxes vanish instantly.
Solution: cross-fade skeletons into content via `AnimatedSwitcher`.
Why: continuity of layout during load feels engineered, not jarring.

**F3. Hover states are uniform everywhere.**
Problem: every card lifts the same way; no differentiation between
interactive and static.
Solution: only tappable cards lift+shadow; static surfaces get a faint
background tint instead.
Why: differentiated affordance teaches the user what's clickable — a
hallmark of refined systems (Linear).

**F4. Numbers don't count up.**
Problem: KPI values snap to final on load.
Solution: 300–500ms count-up on first render only.
Why: animated numbers draw the eye to the delta and make the dashboard feel
alive (Stripe/Coinbase do this).

### G. Consistency & Color System

**G1. Rainbow accent per KPI card.**
Problem: Revenue=green, Sales=blue, Profit=blue, Inventory=amber,
Customers=blue — five accents compete.
Solution: monochrome surface for secondary KPIs (onSurfaceVariant icon),
one brand accent for Revenue, semantic colors reserved for Attention only.
Why: Stripe is famously almost-monochrome. Restraint reads as confidence;
color becomes meaningful instead of decorative.

**G2. Card shadows are fixed black.**
Problem: `Colors.black.withOpacity(0.04–0.14)` — in dark mode black shadows
vanish on dark surfaces.
Solution: theme-aware shadows (`theme.colorScheme.shadow`, elevation tint)
via a shared `SurfaceCard` widget.
Why: dark mode that holds up is table stakes for "expensive".

**G3. Radius/padding drift between widgets.**
Problem: cards use `radiusMd` but onboarding uses `radiusLg`; paddings
vary md/xl across sections.
Solution: a single `SurfaceCard` + section spec (radius 12, padding 16,
gap 16, section-gap 24) enforced everywhere.
Why: a consistent spatial grid is what makes UIs feel "designed". The eye
instantly forgives less — but punishes drift.

### H. Responsive & Platform

**H1. Content stretches edge-to-edge at 1920px.**
Problem: at 1920 the KPI row spans the full width; cards get comically wide.
Solution: max-width container (≈1600px) centered, with fluid gutters.
Why: Stripe constrains content width even on ultrawide; constraint = focus.

**H2. KPI row breaks awkwardly at 1024–1200.**
Problem: the Wrap drops to 3 columns, leaving 2 cards orphaned on a new row.
Solution: at <1200 switch to a 2+3 or "hero + 2x2" composition instead of
uneven wrap.
Why: broken grids are the first thing a designer's eye catches. Intentional
breakpoints = premium.

**H3. Top bar crowds on small desktop.**
Problem: title + search + Live cluster + bell + user menu compete for space
at 900–1200px.
Solution: collapse search to icon, Live cluster to dot-only below 1100px.
Why: breathing room in the chrome reads as composure.

### I. Accessibility & Trust

**I1. KPI cards show hover lift but no tap target.**
Problem: they lift on hover but `onTap` is null — the affordance lies.
Solution: either wire drill-down (tap Revenue → sales history) or suppress
the lift for non-tappable cards.
Why: honest affordance is trust. Fake interactivity is a "cheap" tell.

**I2. No "last updated" timestamp.**
Problem: `Refresh` exists, but the user can't tell if data is fresh.
Solution: "Updated 2m ago" text beside the refresh affordance.
Why: freshness = reliability. Stripe shows "Updated just now" for exactly
this reason.

**I3. Recent Sales rows lack hover feedback.**
Problem: rows are tappable (→ detail) but have no hover tint or chevron.
Solution: hover row background + trailing chevron, keyboard focus ring.
Why: discoverability of interactivity + keyboard-first support = the
difference between a list and an instrument.

---

## Part 2 — Dashboard v3 Wireframe (1440×900 desktop)

```
┌──────────────┬────────────────────────────────────────────────────────────────┐
│  SIDEBAR 260 │  TOP BAR 64  [Overview]        [⌘K Search…] [Live·14:32][🔔][👤] │
│              ├────────────────────────────────────────────────────────────────┤
│  Overview ✓  │  OVERVIEW                                [Today ▾] [Updated 2m] │
│  Products    │  Thursday, Aug 7 · Hello, UX                         [⭮ Sync] │
│  Inventory   │                                                              │
│  Warehouses  │  ┌───────────────────────┐ ┌──────────┐┌──────────┐┌────────┐ │
│  Sales       │  │ REVENUE  (hero)       │ │ Sales    ││ Profit   ││ Cash   │ │
│  Purchasing  │  │ $469,000.00           │ │ 6        ││ $163,900 ││ drawer │ │
│  Suppliers   │  │ ▲ 18% vs yesterday    │ │ ▲ 20%    ││ ~ period ││  $…    │ │
│  Customers   │  │ ▂▃▅▆▇▆▅  (sparkline)  │ │ ▂▃▅▄    ││ ▂▃▅▆    ││  ▂▃▅   │ │
│  Reports     │  └───────────────────────┘ └──────────┘└──────────┘└────────┘ │
│  Payments    │                                                              │
│  Finance     │  QUICK ACTIONS:  [➕ New Sale ⌘N] [Purchase] [Customer] [⋯]  │
│              │                                                              │
│              │  ATTENTION (3) ⚠  [2 out of stock] [5 low stock] [Shift open]│
│              │                                                              │
│  Settings    │  ┌────────────────────────────────────────────┐┌────────────┐│
│              │  │ SALES TREND      [7d|30d|90d] R P          ││ PAYMENTS   ││
│              │  │  $10k┤   ▄▄▄                              ││  ●Cash 67% ││
│              │  │  $5k ┤ ▄▄ ▄▄▄▄ ▄▄▄▄▄ ▄▄▄ ▄▄▄▄  ▄▄▄▄▄     ││  ●Card 33% ││
│              │  │      └───────────────────────────────     ││  ●QR  —    ││
│              │  │  Total $469k · Profit $163.9k · Avg $67k  ││  donut+Σ   ││
│              │  └────────────────────────────────────────────┘└────────────┘│
│              │                                                              │
│              │  ┌────────────────────────────┐┌───────────────────────────┐ │
│              │  │ RECENT SALES    [View all→]││ RECOMMENDATIONS           │ │
│              │  │ SALE-0006  Done  $45.0k ›  ││ ✓ 3 of 4 setup done       │ │
│              │  │ SALE-0005  Done  $75.0k ›  ││ ⚠ Reorder: Wireless Mouse │ │
│              │  └────────────────────────────┘└───────────────────────────┘ │
└──────────────┴────────────────────────────────────────────────────────────────┘
```

**Key structural changes vs v2:**
1. Page header with **range switcher** + **"Updated 2m ago"** + explicit Sync.
2. **Revenue hero card** with sparkline; **Cash in drawer** KPI replaces the
   weakest current KPI (Customers).
3. Quick Actions: **one primary** ("New Sale ⌘N") + ghost tiles + overflow.
4. Attention: **severity header with count badge**, compact layout.
5. Chart: **period tabs**, y-axis, totals strip, hover tooltips.
6. Payments: **donut with center total**.
7. **Recommendations** card (real data) replaces the "Coming Soon" AI card.
8. New-company state: same skeleton but **progress checkmarks** in onboarding.

---

## Part 3 — Priority & Effort

| Priority | Items | Effort |
|---|---|---|
| P1 (impact/effort best) | A1 range, A3 hero+sparkline, D3 cash-in-drawer, G1 monochrome, I1 honest affordance, B4 donut | Small–Medium |
| P2 | B1 tooltips/axis, B2 totals strip, C1 primary CTA, D1 severity header, E2 progress, F4 count-up | Medium |
| P3 | B3 period switch, E1 unified empty system, F1/F2 entrance motion, H1 max-width, I2 updated-at | Medium–Large |

Target after v3: **9.3/10**. No backend / API / model / business-logic changes
required — every finding is presentation-layer.
