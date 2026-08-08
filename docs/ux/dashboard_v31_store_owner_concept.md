# Dashboard v3.1 — Store Owner Concept ("What's happening right now?")

**Date:** 2026-08-07
**Perspective:** store owner / cashier manager — not designer, not developer.
**Status:** CONCEPT — pending approval. No code implemented.
**Source of truth:** existing data only (verified in models/endpoints).

The dashboard must answer, in order, the questions an owner asks when they
walk in the door:

1. Сколько денег в кассе сейчас и сходится ли касса?
2. Продажи идут лучше или хуже, чем вчера в это же время?
3. Что нужно сделать прямо сейчас?
4. Что продаётся / что заканчивается?
5. Сколько я заработал и сколько ушло на закупки?

**Verified data we already have** (no backend changes needed):

| Data | Source |
|---|---|
| Opening balance, cash/card/QR sales, cash in/out, **expected closing, difference** | `CashShift` |
| Today/yesterday/month revenue + count + **average receipt** | `DaySales` |
| **Purchase total** (money out), orders count | `DashboardSummary` |
| Low stock / out of stock counts | `DashboardSummary` |
| **Top products** | `GET /reports/products/top` (exists) |
| Payment split Cash/Card/QR/Bank/Wallet | `PaymentBreakdown` |
| Recent sales + status (incl. REFUNDED) | `SalesReport` |

---

## Part 1 — 14 improvements for the owner

### A. Live operational block ("Что происходит сейчас?")

**O1. Cash-in-drawer hero — the first thing on the page.**
Problem: owner's #1 question ("сколько денег в кассе?") has no answer on the
dashboard today; shift info hides in an Attention tile.
Solution: a **"Cash drawer" hero card** at top-left: big **expected closing**
number, plus a mini ledger — opening, cash sales, card, QR, cash in/out,
and **difference** (green 0 / red Δ). One glance = "касса сходится".
Why: this is the daily ritual of every retail owner; answering it instantly
makes the dashboard indispensable, not decorative.

**O2. Pace vs yesterday at the same hour.**
Problem: "vs yesterday" compares full days; at 2pm the owner needs to know
if today is ahead of *yesterday's 2pm*, not yesterday's close.
Solution: on the Revenue KPI and the main chart, show **"now vs same time
yesterday"** (▲ 12% — today is on pace for $X). Compare cumulative revenue
up to the current hour.
Why: pace is how owners actually think ("иду лучше или хуже?"). Full-day
deltas at noon are misleading.

**O3. Refunds today visible.**
Problem: recent sales show REFUNDED status, but nothing sums "возвратов
сегодня — $X".
Solution: a **Net sales = gross − refunds** line on the Revenue card and a
small "Refunds today" chip (count + amount) in the cash block.
Why: cashiers/owners must reconcile the drawer against net sales; hiding
refunds creates silent discrepancy anxiety.

**O4. Shift status as a live strip, not a tile.**
Problem: shift is one of several Attention tiles.
Solution: top status strip under the top bar: `● Live 14:32 · Shift #123 open ·
Cashier: Alex · Warehouse: Main`. When closed — a prominent amber
"Shift closed — open one to sell" with one-click CTA.
Why: the strip answers "можно ли торговать?" in 0.5 s — the owner's second
question every morning.

### B. Money flow

**O5. "Money in / money out today" flow card.**
Problem: revenue and purchases live in different mental buckets; owner can't
see net position.
Solution: a compact flow row: **Sales in +$X · Purchases out −$Y · Refunds −$Z
· Net today = $W** (green/red). Uses existing `purchaseTotal` + today sales +
refunds.
Why: "сколько осталось в деле?" is the owner's weekly summary question —
seeing it daily builds the habit.

**O6. Average receipt as a KPI.**
Problem: `averageReceipt` exists but isn't shown.
Solution: replace the weakest current KPI (Customers — static) with
**"Average receipt"** + "vs yesterday" trend. Keep Customers in the sidebar.
Why: average receipt is an actionable lever (upsell, pricing); customer count
is a vanity metric that barely changes day to day.

**O7. Month-to-date progress.**
Problem: `monthSales` exists but is unused.
Solution: a thin progress bar on the Revenue hero: **"Month: $X of $Y · 62%"**
(vs last month's full value as a soft baseline).
Why: owners run monthly mental targets; a progress bar converts a number into
motivation.

### C. Tasks needing attention

**O8. Attention becomes a ranked task list with urgency.**
Problem: Attention tiles are equal weight; "2 out of stock" and "5 low stock"
read the same.
Solution: **ranked by severity** — red (out of stock / shift closed) first,
amber (low stock / pending POs) second, blue (informational). Each row: icon +
one-line action ("Restock: 2 items") + count badge + arrow.
Why: owners scan for "what will bite me first". Ordering = prioritization.

**O9. Pending purchase orders surfaced.**
Problem: nothing on the dashboard says "заказ на 200 шт. ещё не принят".
Solution: add a task chip when there are open/ordered POs (data exists in
purchasing module) — "3 POs awaiting receipt →".
Why: a broken supply chain is the silent killer; the owner must see it
without opening Purchasing.

**O10. Low-stock list preview (not just a count).**
Problem: "5 low on stock" forces a click to Inventory to learn *which* items.
Solution: expand the Attention low-stock row into a mini-list of the top 3
items (name + qty left + "Reorder") using the existing `inventory/low-stock`
endpoint.
Why: names, not counts, trigger action. "Осталось 2 шт. Wireless Mouse" is
a decision; "5 товаров" is a number.

### D. What's selling / what's ending

**O11. "Top selling today" mini-list.**
Problem: the endpoint `products/top` exists but the dashboard never shows it.
Solution: a compact ranked list (top 5 by revenue today): name, qty, amount —
next to Recent Sales.
Why: "что берут сейчас" informs restocking, display, and promotion. It's
the merchandising pulse of the store.

**O12. Sales-by-hour curve replaces/augments the bar chart.**
Problem: the 7-day bar chart doesn't answer "когда у меня пик?".
Solution: a **today-by-hour area chart** (8:00–22:00) with the same-time
yesterday overlaid as a faint line; 7/30d stays available as a tab.
Why: hours are the operational unit of a store (staffing, promos, closing).

### E. Readability & trust

**O13. Bigger money, quieter decoration.**
Problem: KPI cards show icons, chips, borders; the *number* competes for
attention.
Solution: money values get **tabular figures, larger size, one accent**;
secondary cards become monochrome (icon in onSurfaceVariant); color reserved
for money-green and alert-red only.
Why: the owner reads numbers, not icons. Every decorative element that
steals from the number is a tax on the primary job.

**O14. "Last updated" + sync confidence.**
Problem: no freshness signal; owner can't tell if "0 sales" is real or stale.
Solution: "Updated 2m ago" next to the refresh control, plus the Live dot.
Why: trust in data freshness is the foundation; a stale dashboard that looks
fresh is worse than none.

---

## Part 2 — Dashboard v3.1 Wireframe (1440×900)

```
┌──────────┬────────────────────────────────────────────────────────────────────┐
│ SIDEBAR  │ TOP BAR  [Overview]        [⌘K Search…]  ●Live 14:32 [🔔] [👤]     │
│          ├────────────────────────────────────────────────────────────────────┤
│          │ STATUS STRIP: ● Shift #123 open · Cashier Alex · Warehouse Main    │
│          │               (amber if closed: "Open shift →")                    │
│          ├────────────────────────────────────────────────────────────────────┤
│ Overview │  OVERVIEW                 [Today ▾]  [Updated 2m ago]      [⭮]    │
│ Products │  Thursday, Aug 7 · Hello, UX                                      │
│ Inventory│                                                                   │
│ Warehouses│ ┌────────────────────────────┐ ┌────────────┐┌─────────────────┐  │
│ Sales    │ │ 💰 CASH DRAWER (hero)       │ │ Revenue    ││ Avg receipt     │  │
│ Purchasing││ EXPECTED CLOSING  $65,400   │ │ $469,000   ││ $3,450          │  │
│ Suppliers││ opening 50,000 · cash +45,000│ │ ▲ 12% same ││ ▲ 8% vs yest    │  │
│ Customers││ card 15,000 · qr 5,400      │ │ time yest. ││                 │  │
│ Reports  ││ cash in 0 · out 0           │ │ Month 62% ▓▓▓░░ │                 │  │
│ Payments ││ DIFFERENCE  0  (✓ balanced) │ └────────────┘└─────────────────┘  │
│ Finance  │ └────────────────────────────┘                                    │
│          │  MONEY FLOW:  Sales in +469k · Purchases −12k · Refunds −0 · Net +457k │
│          │                                                                   │
│          │  TASKS (3)  [🔴 2 out of stock] [🟠 5 low stock → list preview]   │
│          │             [🟠 3 POs awaiting receipt]  [🟢 shift ok]             │
│          │                                                                   │
│          │  ┌──────────────────────────────────────────┐┌──────────────────┐ │
│          │  │ SALES TODAY BY HOUR      [Today|7d|30d]  ││ TOP SELLING TODAY│ │
│          │  │   ▁▂▃▅▇▅▃  (today area)                 ││ 1. Mouse  … $75k │ │
│          │  │   ······  (yesterday line)               ││ 2. Keyboard…$42k │ │
│          │  │  peak 14:00 · current 12:00              ││ 3. Monitor …$185k│ │
│          │  └──────────────────────────────────────────┘└──────────────────┘ │
│          │                                                                   │
│          │  ┌──────────────────────────────┐┌───────────────────────────────┐│
│          │  │ RECENT SALES      [View all→]││ PAYMENTS (donut + Σ)          ││
│          │  │ SALE-0006 Done $45.0k        ││ ● Cash 67% ● Card 33%         ││
│          │  │ SALE-0005 Done $75.0k        ││ Total $45.0k                  ││
│          │  └──────────────────────────────┘└───────────────────────────────┘│
└──────────┴────────────────────────────────────────────────────────────────────┘
```

**Layout logic (top → bottom = owner's question order):**
1. **Status strip** — "можно ли торговать?" (shift/warehouse/cashier)
2. **Cash drawer hero + Revenue/Avg** — "сколько денег и как идёт торговля?"
3. **Money flow** — "сколько осталось в деле?"
4. **Tasks** — "что сделать прямо сейчас?"
5. **By-hour sales + top selling** — "что происходит/продаётся сейчас?"
6. **Recent + payments** — "кто и чем платил?"

**Deferred (needs backend — flagged, NOT in scope):** customer/supplier
balances (debts), expenses ledger, intraday target setting. Owner concept
first, backend additions later.

---

## Part 3 — Approval checklist

| # | Improvement | Uses existing data? | Effort |
|---|---|---|---|
| O1 Cash drawer hero | ✅ (CashShift) | Medium |
| O2 Pace vs same time yesterday | ✅ (yesterdaySales+hour) | Medium |
| O3 Refunds today | ✅ (sales status) | Small |
| O4 Shift status strip | ✅ (CashShift) | Small |
| O5 Money flow card | ✅ (purchaseTotal+sales) | Small |
| O6 Avg receipt KPI | ✅ (averageReceipt) | Small |
| O7 Month progress | ✅ (monthSales) | Small |
| O8 Ranked tasks | ✅ | Small |
| O9 Pending POs task | ✅ (purchasing module) | Small |
| O10 Low-stock list preview | ✅ (inventory/low-stock) | Medium |
| O11 Top selling today | ✅ (products/top) | Medium |
| O12 Sales-by-hour chart | ✅ (sales report) | Large |
| O13 Money-first typography | ✅ | Small |
| O14 Last updated | ✅ | Small |

**Proposed build order after approval:** O4, O6, O14, O1, O2, O3, O5, O7,
O8, O9, O13 → then O10, O11, O12.
