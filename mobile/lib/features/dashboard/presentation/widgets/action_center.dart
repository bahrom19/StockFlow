import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/shimmer_box.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/attention_event.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';
import 'package:stockflow/features/warehouses/presentation/providers/warehouses_provider.dart';

/// Threshold (hours) for the "shift open too long" attention event.
///
/// Hard-coded for v3.3. This will become an owner-configurable setting in the
/// future Settings screen (UI-only, no backend) — per
/// docs/ux/dashboard_v33_action_center.md §7. The single named constant is the
/// seam where that setting will plug in.
const int kLongShiftHours = 12;

/// Action Center — the single attention block of the Dashboard (v3.3),
/// replacing the old Top Alert and AttentionSection.
///
/// Renders a prioritized list of real business events. Every event is built
/// ONLY from data that is already loaded on the Dashboard
/// ([dashboardProvider], [cashShiftProvider], [warehouseListProvider], and
/// the lightweight purchasing summary loaded by [dashboardProvider]) — the
/// Action Center never issues new backend requests and never re-fetches.
///
/// Ordering: Critical → Attention → Opportunities; within a category by
/// [AttentionEvent.weight]. Opportunities are collapsed by default whenever
/// any Critical/Attention event exists.
class ActionCenter extends ConsumerStatefulWidget {
  const ActionCenter({super.key});

  @override
  ConsumerState<ActionCenter> createState() => _ActionCenterState();
}

class _ActionCenterState extends ConsumerState<ActionCenter> {
  static const int _defaultVisible = 3;
  static const int _maxVisible = 6;

  DateTime? _lastChecked;
  bool _showAll = false;
  bool _showOpportunities = false;

  @override
  Widget build(BuildContext context) {
    final dashState = ref.watch(dashboardProvider);
    final shiftState = ref.watch(cashShiftProvider);
    final warehouseState = ref.watch(warehouseListProvider);

    // Track when fresh data arrives for the "Last checked …" line. No
    // setState in the listeners — the ref.watch above rebuilds this widget,
    // and the field mutation is picked up by the next build (same pattern as
    // the Cash Drawer Hero).
    ref.listen<DashboardUiState>(dashboardProvider, (prev, next) {
      if (next is DashboardData && !next.isRefreshing) {
        _lastChecked = DateTime.now();
      }
    });
    ref.listen<ShiftState>(cashShiftProvider, (prev, next) {
      if (next is ShiftLoaded && !identical(prev, next)) {
        _lastChecked = DateTime.now();
      }
    });

    if (dashState is! DashboardData) {
      return const ActionCenterSkeleton();
    }

    // Keep-alive: data may already be loaded when this widget mounts.
    _lastChecked ??= DateTime.now();

    final events = buildAttentionEvents(
      summary: dashState.summary,
      shiftState: shiftState,
      warehouseState: warehouseState,
      // Event #4 (pending POs). Null when loading/failed → no false "0"
      // event (per spec §10-11).
      pendingPoCount: dashState.purchasingSummary?.pendingPoCount ?? 0,
      // Event #3 (low stock) top-3 detail. Empty when loading/failed → no
      // invented items or numbers (Stage B impact rules).
      lowStockItems: dashState.lowStockItems,
    )..sort(compareAttentionEvents);

    final urgent =
        events.where((e) => e.category != AttentionCategory.opportunity).toList();
    final opportunities =
        events.where((e) => e.category == AttentionCategory.opportunity).toList();

    final theme = Theme.of(context);
    final isNarrow = MediaQuery.sizeOf(context).width < 640;

    // ── Header ────────────────────────────────────────────────
    final header = Row(
      children: [
        Expanded(
          child: Text(
            'Requires Attention',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: theme.colorScheme.onSurface,
            ),
          ),
        ),
        if (urgent.isNotEmpty) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: DesignTokens.error.withOpacity(0.1),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '${urgent.length}',
              style: theme.textTheme.labelSmall?.copyWith(
                color: DesignTokens.error,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          _LastCheckedLabel(lastChecked: _lastChecked!),
        ],
      ],
    );

    // ── Rows ──────────────────────────────────────────────────
    final rows = <Widget>[];

    if (urgent.isEmpty) {
      // Full positive "All clear" state.
      rows.add(_AllClearRow(lastChecked: _lastChecked!));
      if (opportunities.isNotEmpty) {
        rows.add(_SectionToggle(
          label: _showOpportunities
              ? 'Hide opportunities'
              : 'Show opportunities (${opportunities.length})',
          icon: _showOpportunities
              ? Icons.expand_less
              : Icons.expand_more,
          onTap: () => setState(() => _showOpportunities = !_showOpportunities),
        ));
        if (_showOpportunities) {
          rows.addAll(opportunities.map((e) => _AttentionEventRow(event: e)));
        }
      }
    } else {
      final visible = _showAll
          ? urgent.take(_maxVisible).toList()
          : urgent.take(_defaultVisible).toList();
      rows.addAll(visible.map((e) => _AttentionEventRow(event: e)));

      if (_showAll && urgent.length > _maxVisible) {
        rows.add(_MoreNote(count: urgent.length - _maxVisible));
      }
      if (urgent.length > _defaultVisible) {
        rows.add(_SectionToggle(
          label: _showAll
              ? 'Show less'
              : 'Show all (${urgent.length - _defaultVisible})',
          icon: _showAll ? Icons.expand_less : Icons.expand_more,
          onTap: () => setState(() => _showAll = !_showAll),
        ));
      }
      if (opportunities.isNotEmpty) {
        rows.add(_SectionToggle(
          label: _showOpportunities
              ? 'Hide opportunities'
              : 'Show opportunities (${opportunities.length})',
          icon: _showOpportunities
              ? Icons.expand_less
              : Icons.expand_more,
          onTap: () => setState(() => _showOpportunities = !_showOpportunities),
        ));
        if (_showOpportunities) {
          rows.addAll(opportunities.map((e) => _AttentionEventRow(event: e)));
        }
      }
    }

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          header,
          const SizedBox(height: AppSpacing.sm),
          // Rows stack in a single column on every viewport; the row itself
          // reflows (CTA full-width) on narrow screens.
          for (final row in rows)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: isNarrow ? row : _WideRowWrapper(child: row),
            ),
        ],
      ),
    );
  }
}

/// Wraps rows with a subtle vertical hairline so stacked event rows read as a
/// list on wide viewports (desktop/tablet).
class _WideRowWrapper extends StatelessWidget {
  final Widget child;
  const _WideRowWrapper({required this.child});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Divider(height: 1, color: theme.colorScheme.outlineVariant),
        const SizedBox(height: AppSpacing.xs),
        child,
      ],
    );
  }
}

// ──────────────────────────────────
// Event building (pure, testable)
// ──────────────────────────────────

/// Builds the event list from data that is ALREADY loaded on the Dashboard.
///
/// All 10 catalogued events (docs §3) are wired. Event #4 (pending purchase
/// orders) is derived from the lightweight `GET /reports/purchasing` summary
/// loaded by [dashboardProvider] with `limit=1` (Decision §3a — see
/// docs/ux/dashboard_v33_action_center.md). Count = strictly PENDING + ORDERED;
/// APPROVED / PARTIALLY_RECEIVED / RECEIVED / CANCELLED are excluded.
///
/// Event #3 (low stock) carries top-3 detail lines from [lowStockItems]
/// (Stage B — see docs §3 event 3): items sorted by deficit
/// (`minQuantity − currentStock`, largest first), limited to 3, formatted by
/// [lowStockDetailLines].
List<AttentionEvent> buildAttentionEvents({
  required DashboardSummary summary,
  required ShiftState shiftState,
  required WarehouseListState warehouseState,
  int pendingPoCount = 0,
  List<LowStockItem> lowStockItems = const [],
}) {
  final events = <AttentionEvent>[];
  final shift = shiftState is ShiftLoaded ? shiftState.current : null;

  // ── CRITICAL ──────────────────────────────────────────────
  // 1. Drawer difference (P0) — cash does not reconcile.
  if (shift != null && shift.isOpen && shift.differenceValue.abs() > 0.005) {
    final diff = shift.differenceValue;
    events.add(AttentionEvent(
      category: AttentionCategory.critical,
      weight: 200 + (diff.abs() / 100).clamp(0.0, 100.0).toDouble(),
      title: 'Drawer difference ${Formatters.currency(diff)}',
      reason:
          'Physical cash does not match the expected closing of '
          '${Formatters.currency(shift.expectedClosingValue)}.',
      action: 'Recount the drawer, verify cash in/out, then close the shift.',
      impact: '${Formatters.currency(diff.abs())} unaccounted right now',
      ctaLabel: 'Reconcile',
      ctaRoute: RouteNames.saleNew,
      source: 'cashShiftProvider (X-report)',
    ));
  }

  // 2. Out of stock (P0) — customers cannot buy these items.
  if (summary.outOfStockProducts > 0) {
    final avg = _averageReceipt(summary);
    events.add(AttentionEvent(
      category: AttentionCategory.critical,
      weight: 100 + summary.outOfStockProducts.toDouble().clamp(0.0, 100.0).toDouble(),
      title: '${summary.outOfStockProducts} products out of stock',
      reason: 'Zero stock left — customers cannot buy these items.',
      action: 'Create a purchase order to restock the fastest movers first.',
      // Stage B impact rule: average-receipt estimate is an orientation and
      // is explicitly labelled as an estimate; without a receipt baseline the
      // impact stays qualitative (never an invented $X).
      impact: avg != null
          ? '≈ ${Formatters.currency(avg * summary.outOfStockProducts)} lost sales/day (estimate)'
          : 'Risk of lost sales',
      ctaLabel: 'Restock',
      ctaRoute: RouteNames.products,
      source: 'dashboardProvider (/reports/dashboard)',
    ));
  }

  // ── ATTENTION ─────────────────────────────────────────────
  // Warehouse list unavailable → shift status is unknown.
  if (warehouseState is WarehouseListError) {
    events.add(const AttentionEvent(
      category: AttentionCategory.attention,
      weight: 600,
      title: 'Warehouse list unavailable',
      reason: 'Could not load warehouses, so shift status is unknown.',
      action: 'Retry loading the warehouse list.',
      impact: 'Shift monitoring is paused',
      ctaLabel: 'Retry',
      ctaRoute: RouteNames.warehouses,
      source: 'warehouseListProvider',
    ));
  }

  // 4. Pending purchase orders (P1) — owner must act on PENDING / ORDERED.
  // Strictly PENDING + ORDERED; APPROVED and PARTIALLY_RECEIVED are excluded
  // by approved decision (docs §3a). Event vanishes automatically at 0.
  if (pendingPoCount > 0) {
    events.add(AttentionEvent(
      category: AttentionCategory.attention,
      weight: 400 + pendingPoCount.toDouble().clamp(0.0, 100.0).toDouble(),
      title: '$pendingPoCount purchase orders awaiting action',
      reason: 'PENDING — requires confirmation; ORDERED — awaiting receiving',
      action: 'Confirm PENDING orders and receive ORDERED deliveries',
      impact: 'Delayed replenishment can increase out-of-stock risk',
      ctaLabel: 'View orders',
      ctaRoute: RouteNames.purchasing,
      source: 'dashboardProvider (/reports/purchasing)',
    ));
  }

  // 3. Low stock (P1) — reorder before these run out. Stage B: shows the
  // top-3 most critical items (name/SKU/stock/min/warehouse), sorted by
  // deficit desc; detail is empty when low-stock data is not loaded. When
  // more than the shown top-3 items are low, a compact "+N more" footer keeps
  // the event scannable without hiding the full scope (review-approved).
  if (summary.lowStockProducts > 0) {
    events.add(AttentionEvent(
      category: AttentionCategory.attention,
      weight: 500 + summary.lowStockProducts.toDouble().clamp(0.0, 100.0).toDouble(),
      title: '${summary.lowStockProducts} products low on stock',
      reason: 'Stock is below the reorder level — will run out soon.',
      action: 'Order from suppliers before these run out.',
      impact: '${summary.lowStockProducts} items at risk of stockout',
      details: lowStockDetailLines(lowStockItems),
      detailsMore: lowStockMoreNote(lowStockItems),
      ctaLabel: 'Review stock',
      ctaRoute: RouteNames.inventory,
      source: 'dashboardProvider (/reports/inventory/low-stock)',
    ));
  }

  // 5. No open shift (P1) — a shift is required to accept sales.
  // Only fires when the shift status is definitively known to be "no open
  // shift" (X-report returned 404 → ShiftLoaded(current: null)). While the
  // shift is still loading (`ShiftLoading`) or errored (`ShiftError`),
  // `shift == null` but the status is NOT known — a transient "No open
  // shift" would be a false alert (Stage D: mutual exclusion test caught
  // this).
  if (warehouseState is WarehouseListLoaded &&
      shiftState is ShiftLoaded &&
      shift == null) {
    events.add(const AttentionEvent(
      category: AttentionCategory.attention,
      weight: 400,
      title: 'No open shift',
      reason: 'A cash shift must be open to accept sales at the POS.',
      action: 'Open a shift to start selling.',
      impact: 'POS is blocked until a shift is opened',
      ctaLabel: 'Open shift',
      ctaRoute: RouteNames.saleNew,
      source: 'cashShiftProvider (X-report)',
    ));
  }

  // 6. Long shift (P1) — open longer than the configured threshold.
  if (shift != null && shift.isOpen) {
    final hours = DateTime.now().difference(shift.openedAt).inHours;
    if (hours >= kLongShiftHours) {
      events.add(AttentionEvent(
        category: AttentionCategory.attention,
        weight: 300 + hours.toDouble().clamp(0.0, 100.0).toDouble(),
        title: 'Shift open ${hours}h — longer than usual',
        reason: 'Long open shifts increase cashier fatigue and miscount risk.',
        action: 'Close the shift, reconcile the drawer and open a fresh one.',
        impact: 'Open since ${Formatters.time(shift.openedAt)}',
        ctaLabel: 'View shift',
        ctaRoute: RouteNames.saleNew,
        source: 'cashShiftProvider (X-report)',
      ));
    }
  }

  // 7. Revenue drop vs yesterday (P2).
  final today = double.tryParse(summary.todaySales.revenue) ?? 0;
  final yesterday = double.tryParse(summary.yesterdaySales.revenue) ?? 0;
  if (yesterday > 0 && today < yesterday) {
    final pct = ((yesterday - today) / yesterday) * 100;
    events.add(AttentionEvent(
      category: AttentionCategory.attention,
      weight: 200 + pct.clamp(0.0, 100.0).toDouble(),
      title: 'Revenue ${pct.toStringAsFixed(0)}% below yesterday',
      reason: 'Today is slower than yesterday at the same point in the day.',
      action: 'Open the sales report to find the cause.',
      impact: '${Formatters.currency(yesterday - today)} behind yesterday so far',
      ctaLabel: 'View report',
      ctaRoute: RouteNames.reports,
      source: 'dashboardProvider (/reports/dashboard)',
    ));
  }

  // 8. No sales today with an open shift (P2).
  if (shift != null && shift.isOpen && summary.todaySales.count == 0) {
    events.add(AttentionEvent(
      category: AttentionCategory.attention,
      weight: 100,
      title: 'No sales yet today',
      reason: 'The shift is open but no sale has been recorded.',
      action: 'Check POS readiness (scanner, printer, cashier).',
      impact: '0 revenue since ${Formatters.time(shift.openedAt)}',
      ctaLabel: 'Open POS',
      ctaRoute: RouteNames.saleNew,
      source: 'dashboardProvider + cashShiftProvider',
    ));
  }

  // ── OPPORTUNITIES ─────────────────────────────────────────
  // 9. No warehouse yet (onboarding).
  if (warehouseState is WarehouseListEmpty) {
    events.add(const AttentionEvent(
      category: AttentionCategory.opportunity,
      weight: 200,
      title: 'No warehouse yet',
      reason: 'Cash shifts open per warehouse — nothing can be sold without one.',
      action: 'Add your first warehouse to start selling.',
      impact: 'Cannot open shifts or record sales',
      ctaLabel: 'Add warehouse',
      ctaRoute: RouteNames.warehouses,
      source: 'warehouseListProvider',
    ));
  }

  // 10. Empty catalog / zero inventory (onboarding).
  final invValue = double.tryParse(summary.inventoryValue) ?? 0;
  if (invValue <= 0 && summary.customerCount == 0 && summary.ordersCount == 0) {
    events.add(const AttentionEvent(
      category: AttentionCategory.opportunity,
      weight: 100,
      title: 'Start building your inventory',
      reason: 'No products and zero stock value yet.',
      action: 'Create your first products and record opening stock.',
      impact: 'Nothing to sell until the catalog is filled',
      ctaLabel: 'Add product',
      ctaRoute: RouteNames.products,
      source: 'dashboardProvider (/reports/dashboard)',
    ));
  }

  return events;
}

/// Category order: Critical → Attention → Opportunities.
int compareAttentionEvents(AttentionEvent a, AttentionEvent b) {
  final byCategory = _categoryOrder(a.category).compareTo(_categoryOrder(b.category));
  if (byCategory != 0) return byCategory;
  return b.weight.compareTo(a.weight);
}

int _categoryOrder(AttentionCategory c) => switch (c) {
      AttentionCategory.critical => 0,
      AttentionCategory.attention => 1,
      AttentionCategory.opportunity => 2,
    };

/// Sorts low-stock items deterministically: largest deficit first
/// (`minQuantity − currentStock`), ties broken by product name (asc), then
/// SKU (asc). Only `LOW_STOCK` positions are considered (OUT_OF_STOCK is
/// handled by event #2). Pure — unit-tested.
List<LowStockItem> sortLowStockByDeficit(List<LowStockItem> items) {
  final low = items.where((i) => i.isLowStock).toList();
  low.sort((a, b) {
    final byDeficit = b.deficit.compareTo(a.deficit);
    if (byDeficit != 0) return byDeficit;
    final byName = a.productName.compareTo(b.productName);
    if (byName != 0) return byName;
    return a.sku.compareTo(b.sku);
  });
  return low;
}

/// Formats the top-[top] critical low-stock items as compact detail lines:
/// `Name (SKU) · stock/min · Warehouse`. Returns an empty list when there is
/// nothing to show (0 items or not loaded). Pure — unit-tested.
List<String> lowStockDetailLines(
  List<LowStockItem> items, {
  int top = 3,
}) {
  return sortLowStockByDeficit(items)
      .take(top)
      .map((i) =>
          '${i.productName} (${i.sku}) · ${i.currentStock}/${i.minQuantity} · ${i.warehouseName}')
      .toList();
}

/// Compact "+N more" footer for the low-stock detail list: `null` when the
/// low-stock set fits entirely inside the shown top items (<= [top]),
/// otherwise `+${count - top} more`. Only `LOW_STOCK` items count (the same
/// set [lowStockDetailLines] renders) — OUT_OF_STOCK is event #2. Returns
/// `null` when nothing is loaded. Pure — unit-tested.
String? lowStockMoreNote(
  List<LowStockItem> items, {
  int top = 3,
}) {
  final count = sortLowStockByDeficit(items).length;
  if (count <= top) return null;
  return '+${count - top} more';
}

/// Average receipt today (fallback: yesterday) — used for impact estimates.
double? _averageReceipt(DashboardSummary s) {
  final today = double.tryParse(s.todaySales.revenue) ?? 0;
  if (s.todaySales.count > 0 && today > 0) return today / s.todaySales.count;
  final yesterday = double.tryParse(s.yesterdaySales.revenue) ?? 0;
  if (s.yesterdaySales.count > 0 && yesterday > 0) {
    return yesterday / s.yesterdaySales.count;
  }
  return null;
}

// ──────────────────────────────────
// Row widgets
// ──────────────────────────────────

Color _categoryColor(AttentionCategory c) => switch (c) {
      AttentionCategory.critical => DesignTokens.error,
      AttentionCategory.attention => DesignTokens.warning,
      AttentionCategory.opportunity => DesignTokens.info,
    };

IconData _categoryIcon(AttentionCategory c) => switch (c) {
      AttentionCategory.critical => Icons.error_outline,
      AttentionCategory.attention => Icons.warning_amber_rounded,
      AttentionCategory.opportunity => Icons.lightbulb_outline,
    };

/// One event row: title → reason → action → impact, with a CTA button.
/// Reflows to a vertical layout (CTA full-width) on narrow screens.
class _AttentionEventRow extends StatefulWidget {
  final AttentionEvent event;

  const _AttentionEventRow({required this.event});

  @override
  State<_AttentionEventRow> createState() => _AttentionEventRowState();
}

class _AttentionEventRowState extends State<_AttentionEventRow> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final event = widget.event;
    final color = _categoryColor(event.category);
    final isNarrow = MediaQuery.sizeOf(context).width < 640;

    // f72701d semantics pattern: a label-less boundary around the event text
    // keeps it in its own merged leaf (rendered as textContent in Flutter
    // Web, so it stays visible to document.body.innerText and screen
    // readers) instead of being hoisted into the row's role="group"
    // aria-label by the interactive CTA button.
    final content = Semantics(
      container: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
        Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: color.withOpacity(0.12),
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              ),
              child: Icon(
                _categoryIcon(event.category),
                size: 16,
                color: color,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                event.title,
                style: theme.textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: theme.colorScheme.onSurface,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Text(
              event.category.name.toUpperCase(),
              style: theme.textTheme.labelSmall?.copyWith(
                color: color,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.4,
              ),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          event.reason,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(height: 2),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.arrow_forward, size: 12, color: color),
            const SizedBox(width: 4),
            Expanded(
              child: Text(
                event.action,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        if (event.impact != null) ...[
          const SizedBox(height: 2),
          Text(
            event.impact!,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
        if (event.details != null && event.details!.isNotEmpty) ...[
          const SizedBox(height: 4),
          for (final line in event.details!) ...[
            Padding(
              padding: const EdgeInsets.only(left: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.circle, size: 6, color: color),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      line,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
        if (event.detailsMore != null) ...[
          const SizedBox(height: 2),
          Padding(
            padding: const EdgeInsets.only(left: 4),
            child: Text(
              event.detailsMore!,
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                fontStyle: FontStyle.italic,
              ),
            ),
          ),
          ],
        ],
      ),
    );

    final cta = FilledButton.tonalIcon(
      onPressed: event.ctaRoute == null
          ? null
          : () => context.push(event.ctaRoute!),
      icon: const Icon(Icons.arrow_forward, size: 16),
      label: Text(event.ctaLabel),
      style: FilledButton.styleFrom(
        backgroundColor: color.withOpacity(0.12),
        foregroundColor: color,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        textStyle: theme.textTheme.labelMedium?.copyWith(
          fontWeight: FontWeight.w700,
        ),
      ),
    );

    return MouseRegion(
      cursor: event.ctaRoute == null
          ? SystemMouseCursors.basic
          : SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: isNarrow ? AppSpacing.xs : AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: _hovered ? color.withOpacity(0.05) : Colors.transparent,
          borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        ),
        child: isNarrow
            ? Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  content,
                  const SizedBox(height: AppSpacing.sm),
                  cta,
                ],
              )
            : Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: content),
                  const SizedBox(width: AppSpacing.sm),
                  cta,
                ],
              ),
      ),
    );
  }
}

/// Full positive "All clear" state (docs §5): green check, no urgent actions,
/// last checked stamp.
class _AllClearRow extends StatelessWidget {
  final DateTime lastChecked;
  const _AllClearRow({required this.lastChecked});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    const green = DesignTokens.success;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: green.withOpacity(0.06),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border.all(color: green.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle, color: green, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Everything looks good',
                  style: theme.textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'No urgent actions.',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          _LastCheckedLabel(lastChecked: lastChecked),
        ],
      ),
    );
  }
}

/// Expand/collapse toggle for "Show all" and "Show opportunities".
class _SectionToggle extends StatelessWidget {
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  const _SectionToggle({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 16),
        label: Text(label),
        style: TextButton.styleFrom(
          foregroundColor: theme.colorScheme.primary,
          textStyle: theme.textTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.w600,
          ),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
        ),
      ),
    );
  }
}

/// Muted "+N more" note when the expanded list exceeds the 6-event cap.
class _MoreNote extends StatelessWidget {
  final int count;
  const _MoreNote({required this.count});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Text(
        '+$count more',
        style: theme.textTheme.labelSmall?.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
      ),
    );
  }
}

/// Live "Last checked …" label — ticks every 30s with its own timer so the
/// rest of the Action Center does not rebuild every 30 seconds.
class _LastCheckedLabel extends StatefulWidget {
  final DateTime lastChecked;
  const _LastCheckedLabel({required this.lastChecked});

  @override
  State<_LastCheckedLabel> createState() => _LastCheckedLabelState();
}

class _LastCheckedLabelState extends State<_LastCheckedLabel> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  String _label() {
    final diff = DateTime.now().difference(widget.lastChecked);
    if (diff.inMinutes < 1) return 'Last checked just now';
    if (diff.inHours < 1) return 'Last checked ${diff.inMinutes}m ago';
    if (diff.inDays < 1) return 'Last checked ${diff.inHours}h ago';
    return 'Last checked ${diff.inDays}d ago';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          Icons.schedule,
          size: 12,
          color: theme.colorScheme.onSurfaceVariant,
        ),
        const SizedBox(width: 4),
        Text(
          _label(),
          style: theme.textTheme.labelSmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

/// Shimmer skeleton while dashboard data is still loading.
class ActionCenterSkeleton extends StatelessWidget {
  const ActionCenterSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ShimmerBox(width: 180, height: 16, radius: 4),
          const SizedBox(height: AppSpacing.md),
          for (var i = 0; i < 3; i++) ...[
            const ShimmerBox(
              width: double.infinity,
              height: 44,
              radius: AppSpacing.radiusSm,
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
        ],
      ),
    );
  }
}
