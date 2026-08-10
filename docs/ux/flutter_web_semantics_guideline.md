# Flutter Web Semantics Guideline

**Status:** Adopted · **Scope:** Flutter Web presentation layer · **Last updated:** 2026-08-10
**Applies to:** all UI components that pair non-interactive text with an interactive CTA/action inside a shared `Row` / `Column`.

---

## 1. Root cause

Flutter Web serializes the semantics tree into real DOM nodes. When a parent
widget (a `Row`/`Column`/`Card`/`InkWell` subtree) contains **interactive
children** (an `IconButton`, `FilledButton`, `TextButton`, `PopupMenuButton`,
or a `Container` with a `BoxDecoration` that Flutter treats as a semantics
boundary), Flutter may **merge the parent's non-interactive text into a single
`role="group"` node whose label lives in `aria-label`**.

Consequence:

- The text is **invisible to `document.body.innerText`** (E2E asserts and
  `innerText`-based probes silently lose it).
- Screen readers still hear the label, so this is primarily a **DOM/E2E
  discoverability** regression, but it breaks text-based automation and any
  consumer relying on `innerText`/`textContent`.

The exact trigger is a *text sibling sitting next to an interactive child*
inside one semantics parent **without an explicit boundary**.

---

## 2. The safe pattern

Non-interactive text that sits alongside an interactive CTA must get an
explicit, **label-less** semantics boundary:

```dart
Row(
  children: [
    Expanded(
      child: Semantics(
        container: true, // label-less boundary — the proven fix
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Title'),        // merged into one leaf
            Text('Subtitle'),     // same leaf → textContent, not aria-label
          ],
        ),
      ),
    ),
    FilledButton(
      onPressed: onAction,        // separate sibling — stays a button
      child: const Text('Do it'),
    ),
  ],
)
```

Why it works: `Semantics(container: true)` without a label creates a
non-interactive leaf boundary, so the text subtree is serialized as
`textContent` (visible to `document.body.innerText`) instead of being hoisted
into the parent group's `aria-label`.

---

## 3. Interactive CTA stays a separate sibling

- The CTA (`FilledButton` / `IconButton` / `TextButton` / menu trigger) must
  remain a **sibling of** the `Semantics(container: true)` block — never a
  child of it.
- This keeps the CTA as its own tappable semantics node.
- Widget tests assert this explicitly: the text leaf has **no** tap action,
  the CTA **has** `SemanticsAction.tap`.

---

## 4. When NOT to add the boundary

Do **not** add `Semantics(container: true)` when any of these is true:

1. **The whole card is already wrapped by `Material`/`InkWell` and browser
   evidence confirms the text is `textContent`.** Example: tappable sale rows
   in `RecentSalesList` (`InkWell(onTap:)` whole-row button) — the full row
   text was found in `document.body.innerText`; adding a boundary would be
   redundant.
2. **The component has no interactive children.** Pure-text headers (e.g.
   `Requires Attention` title row, `EntityTable` footer `Showing X of Y`,
   `SalesBarChart` legend) render fine as-is.
3. **Browser/widget tests prove the existing structure is safe.** When a
   `Column[Text, Text, FilledButton]` (e.g. `EmptyStateWidget`) and a
   `Row[Expanded(Column[Text, Text]), actions]` (e.g. `PageHeader`) are
   browser-verified as `inner=true`, leave them untouched — the boundary only
   helps when the parent is actually merging text into a group label.

Rule of thumb: **add the boundary only when you can demonstrate (or the
structure forces) the text being swallowed into a group `aria-label`.**

---

## 5. Testing

### Widget semantics test (required for every fix)

- Pump the widget, then `tester.ensureSemantics()`.
- Assert the text leaf: `getSemantics(find.text('…')).getSemanticsData()`
  carries the label **and has no `SemanticsAction.tap`**.
- Assert the CTA: its node **does** have `SemanticsAction.tap`.

Example shape (see `cash_drawer_hero_test.dart`, `onboarding_hero_test.dart`):

```dart
final titleData = tester.getSemantics(find.text('Title')).getSemanticsData();
expect(titleData.label, contains('Title'));
expect(titleData.hasAction(SemanticsAction.tap), isFalse);

final ctaData = tester.getSemantics(find.text('Do it')).getSemanticsData();
expect(ctaData.hasAction(SemanticsAction.tap), isTrue);
```

### Browser regression test (when innerText is an explicit contract)

- Assert `document.body.innerText` contains the text.
- The widget-level tap-action assertions plus a real click outcome cover the
  CTA side.

---

## 6. Flutter Web probe caveats

When verifying in the browser (Playwright / manual DevTools):

1. **Semantics nodes can be `role=""`** rather than `role="button"` — an
   `InkWell`-wrapped tappable card is serialized as a generic node with a tap
   action. Selectors that filter on `role="button"` will miss it; match on
   `textContent`/geometry instead.
2. **Scrolling / off-screen culling:** Flutter culls semantics of widgets
   below the fold inside lazy lists. Use a tall viewport (e.g. 1440×6000) or
   scroll before probing, otherwise off-screen text is absent from the DOM.
3. **Semantics re-enable:** after navigation or full reload Flutter re-shows
   the "Enable accessibility" placeholder; click it (or re-run the
   enable-semantics helper) before reading `innerText` — otherwise the DOM is
   empty.
4. **CTA clickability must be verified by the actual UI outcome**, not only by
   DOM role selectors: click the real node (by geometry) and assert the
   navigation/screen change (e.g. onboarding step card → "New Product" form
   with `Back / New Product / Save …` in `innerText`).

---

## 7. Historical examples (do not change these commits)

The rule was established and hardened across five sequential fixes. Each
commit is the reference implementation of the pattern:

| Commit | Scope | What it proved |
|---|---|---|
| `f72701d` | KPI strip / `RevenueGoalCard` | Adding an interactive pencil `IconButton` to a card collapses the whole strip into `role="group" aria-label`; label-less `Semantics(container: true)` + sibling button restores `textContent`. |
| `ddd97fb` | Action Center event rows | `Row[text, FilledButton(CTA)]` swallows the text; boundary around the text Column keeps it a leaf, CTA stays tappable. |
| `2dac3ea` | `_NoShiftHero` + GreetingRow | `Row[Expanded(Column[Text, Text]), CTA]` — the exact pattern this guideline formalizes. |
| `b5ed460` | Recent Sales header + `PremiumEmptyState` | `Column[title, description, CTA]` needs the boundary when the parent merges; also proved `EmptyStateWidget`/`PageHeader` are safe without it (browser-verified `inner=true`). |
| `e18da05` | OnboardingHero header (`Welcome to StockFlow` + subtitle + `0 of 4`) + `_HeroError` | Same pattern applied to the header `Row` and the error-state `Row[Icon, Column[Text, Text], TextButton(Retry)]`; `0 of 4` progress pill also wrapped. |

### Source files carrying the pattern

- `mobile/lib/features/dashboard/presentation/widgets/kpi_card.dart`
- `mobile/lib/features/dashboard/presentation/widgets/revenue_goal_card.dart`
- `mobile/lib/features/dashboard/presentation/widgets/action_center.dart`
- `mobile/lib/features/dashboard/presentation/widgets/cash_drawer_hero.dart`
- `mobile/lib/features/dashboard/presentation/widgets/onboarding_hero.dart`
- `mobile/lib/features/dashboard/presentation/widgets/recent_sales_list.dart`
- `mobile/lib/core/widgets/premium_empty_state.dart`

---

## Quick checklist

- [ ] Text sits next to an interactive CTA in the same `Row`/`Column`?
  → wrap the text block in label-less `Semantics(container: true)`.
- [ ] CTA is a separate sibling? → yes.
- [ ] Whole-row `InkWell`/`Material` card with browser-confirmed
  `textContent`? → no boundary needed.
- [ ] No interactive children? → no boundary needed.
- [ ] Widget test asserts text leaf (no tap) + CTA (tap)? → yes.
- [ ] Browser probe uses tall viewport, re-enabled semantics, real-click
  outcome, and doesn't filter only on `role="button"`? → yes.
