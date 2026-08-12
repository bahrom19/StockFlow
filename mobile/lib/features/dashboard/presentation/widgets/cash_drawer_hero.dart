import 'dart:async';
import 'dart:ui' show FontFeature;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/shimmer_box.dart';
import 'package:stockflow/features/sales/domain/cash_shift_models.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';
import 'package:stockflow/features/warehouses/presentation/providers/warehouses_provider.dart';

/// Cash Drawer Hero — the store owner's #1 question: "how much money is in the
/// drawer right now, and does it reconcile?" Rendered as the dominant hero
/// block of the Dashboard, answering that question in <5 seconds.
///
/// Stage 2: the hero auto-refreshes on a 20s timer (route-aware — it skips the
/// refresh while the dashboard is not the active route, so no background
/// X-report requests when the cashier is on another screen) and shows a live
/// "Updated X sec ago" line. The shift bootstrap (one X-report per page load)
/// lives in DashboardScreen; the timer only re-reads the same provider.
class CashDrawerHero extends ConsumerStatefulWidget {
  const CashDrawerHero({super.key});

  @override
  ConsumerState<CashDrawerHero> createState() => _CashDrawerHeroState();
}

class _CashDrawerHeroState extends ConsumerState<CashDrawerHero> {
  static const Duration _refreshInterval = Duration(seconds: 20);

  Timer? _refreshTimer;
  DateTime? _lastUpdated;
  bool _wasCurrent = true;

  @override
  void initState() {
    super.initState();
    _refreshTimer = Timer.periodic(_refreshInterval, (_) => _autoRefresh());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  /// Refresh immediately when the dashboard becomes the active route again
  /// (e.g. the cashier returns from POS after completing a sale) — so the
  /// drawer amount is fresh on arrival, not only after the next timer tick.
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final route = ModalRoute.of(context);
    final isCurrent = route?.isCurrent ?? true;
    if (isCurrent && !_wasCurrent) {
      Future.microtask(_autoRefresh);
    }
    _wasCurrent = isCurrent;
  }

  /// Background auto-refresh: re-reads the open shift while this screen is the
  /// active route. `refresh()` is a no-op when no warehouse is known yet, so
  /// this never fires before the bootstrap completes.
  ///
  /// X-report polling is skipped while no open shift exists (loading, error,
  /// or a definitive "no shift" from the 404 — all resolved via
  /// [ShiftState]): with no open shift the X-report endpoint 404s, so polling
  /// would spam 404s and console errors for zero value. Polling resumes
  /// automatically as soon as a shift is open (the state flips to
  /// [ShiftLoaded] with a non-null [ShiftLoaded.current]).
  Future<void> _autoRefresh() async {
    if (!mounted) return;
    final route = ModalRoute.of(context);
    if (route == null || !route.isCurrent) return; // not visible — skip
    final ws = ref.read(warehouseListProvider);
    if (ws is! WarehouseListLoaded) return;
    // Only poll while an open shift exists — otherwise the X-report endpoint
    // 404s (ShiftLoading / ShiftError / ShiftLoaded(current: null)).
    final shiftState = ref.read(cashShiftProvider);
    if (shiftState is! ShiftLoaded || shiftState.current == null) return;
    final shift = await ref.read(cashShiftProvider.notifier).refresh();
    if (mounted && shift != null) {
      _lastUpdated = DateTime.now();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Track when fresh shift data arrives (bootstrap or timer) for the
    // "Updated X sec ago" line. No setState here: the `ref.watch` below
    // already triggers a rebuild on every state change, so the field mutation
    // is picked up by the next build (and calling setState from a listener
    // could throw "setState during build").
    ref.listen<ShiftState>(cashShiftProvider, (prev, next) {
      if (next is ShiftLoaded && !identical(prev, next)) {
        _lastUpdated = DateTime.now();
      }
    });

    final warehouses = ref.watch(warehouseListProvider);

    // Warehouse list failed → the shift can never resolve; show an honest
    // error with a retry that reloads the list (not a misleading CTA).
    if (warehouses is WarehouseListError) {
      return _HeroError(
        onRetry: () =>
            ref.read(warehouseListProvider.notifier).loadWarehouses(),
      );
    }
    // No warehouses → nothing to open a shift in; meaningful onboarding state.
    if (warehouses is WarehouseListEmpty) {
      return const _NoShiftHero(noWarehouse: true);
    }

    final shiftState = ref.watch(cashShiftProvider);
    // Already loaded before this widget mounted (keep-alive) — stamp now.
    if (shiftState is ShiftLoaded && _lastUpdated == null) {
      _lastUpdated = DateTime.now();
    }

    return switch (shiftState) {
      ShiftLoading() => const CashDrawerHeroSkeleton(),
      ShiftError() => _HeroError(
          onRetry: () => ref.read(cashShiftProvider.notifier).refresh(),
        ),
      ShiftLoaded(:final current) => current == null
          ? const _NoShiftHero()
          : _ShiftHero(shift: current, updatedAt: _lastUpdated),
      _ => const SizedBox.shrink(),
    };
  }
}

/// Shared hero shell: accent-tinted surface with a soft shadow.
///
/// Informational only — deliberately NOT tappable: the hero answers "how much
/// money is in the drawer?", it must not navigate anywhere on a stray click.
/// The only interactive elements are the explicit CTAs in the empty states.
class _HeroCard extends StatelessWidget {
  final Color accent;
  final Widget child;

  const _HeroCard({required this.accent, required this.child});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    // On dark surfaces a 6% tint + soft shadow is nearly invisible — the card
    // would merge into the scaffold. Raise the tint and border in dark mode so
    // the hero always reads as a distinct surface.
    final tint = isDark ? 0.12 : 0.06;
    final borderAlpha = isDark ? 0.45 : 0.3;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      decoration: BoxDecoration(
        color: accent.withOpacity(tint),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(
          color: accent.withOpacity(borderAlpha),
          width: AppSpacing.borderMd,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.30 : 0.04),
            blurRadius: isDark ? 10 : 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: child,
    );
  }
}

/// Open shift → full hero. Visual hierarchy (owner's questions in order):
///  1. how much cash is in the drawer right now  → big number
///  2. what does that consist of                 → mini cash accounting
///  3. expected closing + does it balance        → footer status
/// Shift status line (Open/Closed + opening time) sits in the header, and the
/// whole card is tinted by the state:
///  - green  → drawer balances (Difference 0)
///  - red    → Difference ≠ 0
///  - grey   → shift closed
class _ShiftHero extends StatelessWidget {
  final CashShift shift;
  final DateTime? updatedAt;

  const _ShiftHero({required this.shift, this.updatedAt});

  double get _nonCash =>
      shift.cardSalesValue +
      shift.qrSalesValue +
      shift.bankTransferSalesValue +
      shift.mobileWalletSalesValue;

  bool get _balances => shift.differenceValue.abs() < 0.005;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = context.l10n;

    // ── State → color + footer pill ──
    final Color stateColor;
    final IconData pillIcon;
    final String pillText;
    if (!shift.isOpen) {
      stateColor = DesignTokens.grey500;
      pillIcon = Icons.lock_outline;
      pillText = l10n.shiftClosed;
    } else if (_balances) {
      stateColor = DesignTokens.success;
      pillIcon = Icons.check_circle;
      pillText = l10n.differenceZero;
    } else {
      stateColor = DesignTokens.error;
      pillIcon = Icons.error_outline;
      pillText = l10n.differenceAmount(
        Formatters.currencyShort(shift.differenceValue),
      );
    }

    final statusText = shift.isOpen
        ? l10n.shiftOpenOpenedAt(Formatters.time(shift.openedAt))
        : l10n.shiftClosedOpenedAt(Formatters.time(shift.openedAt));

    return _HeroCard(
      accent: stateColor,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header: title + shift status line + updated stamp ──
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: stateColor.withOpacity(0.14),
                    borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                  ),
                  child: Icon(Icons.payments_outlined, color: stateColor, size: 22),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        l10n.cashDrawer,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: theme.colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: stateColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              statusText,
                              style: theme.textTheme.labelSmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                if (updatedAt != null)
                  _UpdatedLabel(updatedAt: updatedAt!),
              ],
            ),
            const SizedBox(height: AppSpacing.md),

            // ── 1. Current money — the dominant answer ──
            Text(
              l10n.cashInDrawer,
              style: theme.textTheme.labelMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 2),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                Formatters.currency(shift.expectedClosingValue),
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  fontFeatures: const [FontFeature.tabularFigures()],
                  color: theme.colorScheme.onSurface,
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            const Divider(height: 1),
            const SizedBox(height: AppSpacing.sm),

            // ── 2. Mini cash accounting ──
            Row(
              children: [
                _MiniStat(
                  label: l10n.cashIn,
                  value: Formatters.currencyShort(shift.cashInValue),
                  color: DesignTokens.paymentCash,
                ),
                _MiniStat(
                  label: l10n.cashSales,
                  value: Formatters.currencyShort(shift.cashSalesValue),
                  color: DesignTokens.success,
                ),
                _MiniStat(
                  label: l10n.nonCash,
                  value: Formatters.currencyShort(_nonCash),
                  color: DesignTokens.info,
                ),
                _MiniStat(
                  label: l10n.cashOut,
                  value: Formatters.currencyShort(shift.cashOutValue),
                  color: DesignTokens.warning,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            const Divider(height: 1),
            const SizedBox(height: AppSpacing.sm),

            // ── 3. Expected closing + difference status ──
            Row(
              children: [
                Expanded(
                  child: Row(
                    children: [
                      Icon(
                        Icons.savings_outlined,
                        size: 14,
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          l10n.expectedClosing(
                            Formatters.currency(shift.expectedClosingValue),
                          ),
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: stateColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(pillIcon, size: 14, color: stateColor),
                      const SizedBox(width: 4),
                      Text(
                        pillText,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: stateColor,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Live "Updated X sec ago" label — ticks once per second with its own timer
/// so the rest of the hero does not rebuild every second.
class _UpdatedLabel extends StatefulWidget {
  final DateTime updatedAt;

  const _UpdatedLabel({required this.updatedAt});

  @override
  State<_UpdatedLabel> createState() => _UpdatedLabelState();
}

class _UpdatedLabelState extends State<_UpdatedLabel> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  String _label(AppLocalizations l10n) {
    final diff = DateTime.now().difference(widget.updatedAt);
    if (diff.inSeconds < 5) return l10n.updatedJustNow;
    if (diff.inSeconds < 60) return l10n.updatedSecondsAgo(diff.inSeconds);
    if (diff.inMinutes < 60) return l10n.updatedMinutesAgo(diff.inMinutes);
    if (diff.inHours < 24) return l10n.updatedHoursAgo(diff.inHours);
    return l10n.updatedDaysAgo(diff.inDays);
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
          _label(context.l10n),
          style: theme.textTheme.labelSmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _MiniStat({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: theme.textTheme.labelSmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
              color: theme.colorScheme.onSurface,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

/// No open shift (or no warehouse) → neutral state with a clear CTA instead
/// of empty zeros or an endless skeleton.
class _NoShiftHero extends StatelessWidget {
  final bool noWarehouse;

  const _NoShiftHero({this.noWarehouse = false});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = context.l10n;
    final warn = DesignTokens.warning;

    final title = noWarehouse ? l10n.noWarehouseYet : l10n.noOpenShift;
    final subtitle = noWarehouse
        ? l10n.noWarehouseSubtitle
        : l10n.noShiftSubtitle;
    final icon = noWarehouse ? Icons.warehouse_outlined : Icons.point_of_sale;
    final buttonLabel = noWarehouse ? l10n.addWarehouse : l10n.openShift;
    final route = noWarehouse ? RouteNames.warehouses : RouteNames.saleNew;

    return _HeroCard(
      accent: warn,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: warn.withOpacity(0.14),
                borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              ),
              child: Icon(icon, color: warn, size: 22),
            ),
            const SizedBox(width: AppSpacing.sm),
            // ddd97fb semantics pattern: a label-less boundary around the hero
            // text keeps title + subtitle in their own merged leaf (rendered
            // as textContent in Flutter Web, so they stay visible to
            // document.body.innerText and screen readers) instead of being
            // hoisted into the row's role="group" aria-label by the
            // interactive "Open shift" button. The CTA stays a sibling.
            Expanded(
              child: Semantics(
                container: true,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: theme.colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            FilledButton.tonalIcon(
              onPressed: () => context.push(route),
              icon: const Icon(Icons.play_arrow, size: 18),
              label: Text(buttonLabel),
            ),
          ],
        ),
      ),
    );
  }
}

/// Compact error state with retry.
class _HeroError extends StatelessWidget {
  final VoidCallback onRetry;

  const _HeroError({required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = context.l10n;
    final err = DesignTokens.error;

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: err.withOpacity(0.05),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: Border.all(color: err.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline, color: err, size: 20),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Semantics(
              container: true,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    l10n.cashDrawerUnavailable,
                    style: theme.textTheme.labelLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                      color: theme.colorScheme.onSurface,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    l10n.couldNotLoadOpenShift,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
          ),
          TextButton(onPressed: onRetry, child: Text(l10n.retry)),
        ],
      ),
    );
  }
}

/// Shimmer skeleton for the hero while the shift loads.
class CashDrawerHeroSkeleton extends StatelessWidget {
  const CashDrawerHeroSkeleton({super.key});

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
          Row(
            children: [
              const ShimmerBox(
                width: 44,
                height: 44,
                radius: AppSpacing.radiusSm,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    ShimmerBox(width: 130, height: 14, radius: 4),
                    SizedBox(height: 6),
                    ShimmerBox(width: 160, height: 12, radius: 4),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          const ShimmerBox(width: 180, height: 30, radius: 6),
          const SizedBox(height: AppSpacing.md),
          const Divider(height: 1),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              for (var i = 0; i < 4; i++) ...[
                if (i > 0) const SizedBox(width: AppSpacing.sm),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ShimmerBox(width: 54, height: 12, radius: 4),
                      SizedBox(height: 4),
                      ShimmerBox(width: 80, height: 18, radius: 4),
                    ],
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          const Divider(height: 1),
          const SizedBox(height: AppSpacing.sm),
          // Footer: expected closing + difference pill shimmer.
          Row(
            children: [
              const ShimmerBox(width: 190, height: 14, radius: 4),
              const Spacer(),
              ShimmerBox(width: 90, height: 22, radius: 8),
            ],
          ),
        ],
      ),
    );
  }
}
