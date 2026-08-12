import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show FilteringTextInputFormatter;
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/providers/monthly_goal_provider.dart';

// ─────────────────────────────────────────────────────────────
// Revenue Goal Card — Stage E.
//
// First KPI card of the Dashboard (emphasized): today's revenue + trend vs
// yesterday + a monthly-goal progress bar. The monthly goal is a LOCAL owner
// setting (SharedPreferences via [monthlyGoalProvider]) — zero new network
// requests, zero backend changes.
//
// States:
//  - goal unset (null/0)  → progress bar hidden, "Set monthly goal" + ✎
//  - goal set, under      → bar at monthRevenue/goal + "X of Y · Z%"
//  - goal reached         → bar clamped to 100%, success color, "Goal reached"
//  - trend: yesterday<=0  → neutral "—" (no invented percentage)
// ─────────────────────────────────────────────────────────────

/// Pure progress helper (unit-tested): returns the raw ratio (may exceed 1),
/// or null when no valid goal is set.
double? monthlyGoalProgress({
  required double monthRevenue,
  double? goal,
}) {
  if (goal == null || goal <= 0) return null;
  return monthRevenue / goal;
}

/// Clamped fill value 0..1 for the progress bar.
double monthlyGoalFill({
  required double monthRevenue,
  double? goal,
}) {
  return (monthlyGoalProgress(monthRevenue: monthRevenue, goal: goal) ?? 0)
      .clamp(0.0, 1.0);
}

/// "62%" — the real percentage (can exceed 100 for overachievement).
String monthlyGoalPercent({
  required double monthRevenue,
  double? goal,
}) {
  final p = monthlyGoalProgress(monthRevenue: monthRevenue, goal: goal);
  if (p == null) return '';
  return '${(p * 100).round()}%';
}

class RevenueGoalCard extends ConsumerStatefulWidget {
  final DashboardSummary summary;

  const RevenueGoalCard({super.key, required this.summary});

  @override
  ConsumerState<RevenueGoalCard> createState() => _RevenueGoalCardState();
}

class _RevenueGoalCardState extends ConsumerState<RevenueGoalCard> {
  bool _hovered = false;

  double get _todayRevenue =>
      double.tryParse(widget.summary.todaySales.revenue) ?? 0;
  double get _monthRevenue =>
      double.tryParse(widget.summary.monthSales.revenue) ?? 0;
  double get _yesterdayRevenue =>
      double.tryParse(widget.summary.yesterdaySales.revenue) ?? 0;

  double? get _trend {
    if (_yesterdayRevenue <= 0) return null;
    return ((_todayRevenue - _yesterdayRevenue) / _yesterdayRevenue) * 100;
  }

  /// "{amount} of {goal}" plus the optional "· {count} sales" suffix.
  /// Built from ARB keys so every fragment stays localized.
  String _goalSummaryText(AppLocalizations l10n, double monthGoal) {
    final base = l10n.revenueGoalProgress(
      Formatters.currencyShort(_monthRevenue),
      Formatters.currencyShort(monthGoal),
    );
    final count = widget.summary.monthSales.count;
    return count > 0 ? '$base${l10n.revenueGoalSalesCount(count)}' : base;
  }

  @override
  void initState() {
    super.initState();
    // Load the local goal once on mount (no network, no polling).
    Future.microtask(() {
      if (!mounted) return;
      ref.read(monthlyGoalProvider.notifier).load();
    });
  }

  Future<void> _editGoal() async {
    final goal = ref.read(monthlyGoalProvider);
    final controller = TextEditingController(
      text: goal != null && goal > 0 ? goal.toStringAsFixed(0) : '',
    );
    String? error;

    final saved = await showDialog<double>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) {
          final l10n = dialogContext.l10n;
          return AlertDialog(
            title: Text(l10n.revenueGoalTitle),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.revenueGoalDialogBody,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: AppSpacing.md),
                TextField(
                  key: const Key('monthly_goal_field'),
                  controller: controller,
                  autofocus: true,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                  ),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                  ],
                  decoration: InputDecoration(
                    labelText: l10n.revenueGoalAmount,
                    hintText: l10n.revenueGoalHint,
                    helperText: l10n.revenueGoalHelper,
                    errorText: error,
                    border: const OutlineInputBorder(),
                  ),
                  onSubmitted: (_) {},
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: Text(l10n.cancel),
              ),
              FilledButton(
                onPressed: () {
                  final parsed = double.tryParse(controller.text.trim());
                  if (parsed == null || parsed <= 0) {
                    setDialogState(() {
                      error = l10n.revenueGoalError;
                    });
                    return;
                  }
                  Navigator.of(dialogContext).pop(parsed);
                },
                child: Text(l10n.save),
              ),
            ],
          );
        },
      ),
    );

    // Note: the local controller is intentionally not disposed here —
    // showDialog resolves at pop while the dialog's exit animation is still
    // running, and the TextField inside it keeps referencing the controller;
    // disposing here would throw "used after being disposed". It is a
    // short-lived local, unreferenced after this frame, so GC handles it.
    if (saved != null && mounted) {
      await ref.read(monthlyGoalProvider.notifier).setGoal(saved);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = context.l10n;
    const color = DesignTokens.revenue;
    final goal = ref.watch(monthlyGoalProvider);
    final monthGoal = goal ?? 0;
    final hasGoal = goal != null && goal > 0;
    final fill = monthlyGoalFill(monthRevenue: _monthRevenue, goal: goal);
    final percent = monthlyGoalPercent(monthRevenue: _monthRevenue, goal: goal);
    final reached = hasGoal && _monthRevenue >= monthGoal;

    return MouseRegion(
      cursor: SystemMouseCursors.basic,
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        decoration: BoxDecoration(
          color: color.withOpacity(0.07),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: _hovered
                ? color.withOpacity(0.45)
                : color.withOpacity(0.35),
            width: AppSpacing.borderMd,
          ),
          boxShadow: _hovered
              ? [
                  BoxShadow(
                    color: color.withOpacity(0.14),
                    blurRadius: 18,
                    offset: const Offset(0, 6),
                  ),
                ]
              : [
                  BoxShadow(
                    color: color.withOpacity(0.06),
                    blurRadius: 6,
                    offset: const Offset(0, 2),
                  ),
                ],
        ),
        // ── Semantics isolation (browser-level E2E fix) ──────────────
        // The old all-KpiCard strip serialized its labels as textContent in
        // Flutter Web. Adding an interactive IconButton to this card made
        // Flutter Web collapse the whole KPI strip into one role="group"
        // whose text lives in aria-label (invisible to innerText) — breaking
        // innerText-based E2E and screen-reader output.
        //
        // Fix: a label-less Semantics(container: true) boundary around the
        // card keeps its subtree out of the strip's text merge; all
        // non-interactive text is folded into ONE merged leaf (children=0,
        // rendered as textContent — identical to the pre-Stage-E KpiCard),
        // and the pencil button stays a SEPARATE interactive sibling node.
        child: Semantics(
          container: true,
          child: Stack(
            children: [
              MergeSemantics(
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.sm,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ── Header: icon | value + title | trend ──
                      Row(
                        children: [
                          AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: color.withOpacity(
                                _hovered ? 0.20 : 0.14,
                              ),
                              borderRadius:
                                  BorderRadius.circular(AppSpacing.radiusSm),
                            ),
                            child: const Icon(
                              Icons.trending_up,
                              color: DesignTokens.revenue,
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  Formatters.currency(_todayRevenue),
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w800,
                                    fontFeatures: const [
                                      FontFeature.tabularFigures(),
                                    ],
                                    color: theme.colorScheme.onSurface,
                                    fontSize: 21,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 1),
                                Text(
                                  l10n.todaysRevenue,
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    color: color,
                                    fontWeight: FontWeight.w700,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          _TrendChip(percent: _trend),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xs),

                      Padding(
                        // Reserve the pencil's lane (bottom-right) so the
                        // goal line never runs underneath the button.
                        padding: const EdgeInsets.only(right: 34),
                        child: !hasGoal
                            ? Text(
                                l10n.setMonthlyGoal,
                                style: theme.textTheme.labelSmall?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              )
                            : Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // ── Goal set: progress bar + % ──
                                  Row(
                                    children: [
                                      Expanded(
                                        child: ClipRRect(
                                          borderRadius:
                                              BorderRadius.circular(4),
                                          child: LinearProgressIndicator(
                                            value: fill,
                                            minHeight: 6,
                                            backgroundColor:
                                                color.withOpacity(0.12),
                                            valueColor:
                                                AlwaysStoppedAnimation<Color>(
                                              reached
                                                  ? DesignTokens.success
                                                  : color,
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: AppSpacing.xs),
                                      Text(
                                        percent,
                                        style: theme.textTheme.labelSmall
                                            ?.copyWith(
                                          fontWeight: FontWeight.w700,
                                          color: reached
                                              ? DesignTokens.success
                                              : theme
                                                  .colorScheme
                                                  .onSurfaceVariant,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    reached
                                        ? l10n.goalReached
                                        : _goalSummaryText(l10n, monthGoal),
                                    style: theme.textTheme.labelSmall?.copyWith(
                                      fontWeight:
                                          reached ? FontWeight.w700 : null,
                                      color: reached
                                          ? DesignTokens.success
                                          : theme.colorScheme.onSurfaceVariant,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                      ),
                    ],
                  ),
                ),
              ),
              // Edit button: independent interactive sibling (never merged
              // into the text leaf, so the strip keeps plain textContent).
              Positioned(
                right: 2,
                bottom: 4,
                child: IconButton(
                  key: const Key('monthly_goal_edit'),
                  tooltip: l10n.setMonthlyGoal,
                  visualDensity: VisualDensity.compact,
                  iconSize: 16,
                  onPressed: _editGoal,
                  icon: const Icon(
                    Icons.edit_outlined,
                    color: DesignTokens.revenue,
                    size: 16,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Trend chip — neutral "—" when there is no yesterday baseline.
class _TrendChip extends StatelessWidget {
  final double? percent;

  const _TrendChip({required this.percent});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (percent == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          '—',
          style: theme.textTheme.labelSmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
            fontWeight: FontWeight.w600,
          ),
        ),
      );
    }

    final up = percent! >= 0;
    final color = up ? DesignTokens.success : DesignTokens.error;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            up ? Icons.trending_up : Icons.trending_down,
            size: 12,
            color: color,
          ),
          const SizedBox(width: 2),
          Text(
            '${percent!.abs().toStringAsFixed(1)}%',
            style: theme.textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
