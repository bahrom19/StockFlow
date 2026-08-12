import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';

/// Unified onboarding block — replaces the five scattered empty states
/// (chart, payments, recent sales, low stock, quick actions) with one
/// informative, action-oriented hero shown for a brand-new company.
///
/// Stage C: the static 4-step grid became a real **progress tracker**
/// (`N of 4 complete`). Each step's [done] flag is derived ONLY from data that
/// is already loaded on the Dashboard ([dashboardProvider] /
/// [cashShiftProvider]) — the hero never issues a new backend request.
/// Completed steps are shown with a checkmark and a muted "Done" state;
/// incomplete steps keep their CTA to the existing screens.
class OnboardingHero extends ConsumerWidget {
  const OnboardingHero({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashState = ref.watch(dashboardProvider);
    final shiftState = ref.watch(cashShiftProvider);

    // Loading / error: fall back to a compact skeleton so the hero never
    // invents a false "0 of 4" (Stage C — no false states on Loading/Error).
    if (dashState is! DashboardData) {
      return const _OnboardingHeroSkeleton();
    }

    final steps = buildOnboardingSteps(
      l10n: context.l10n,
      summary: dashState.summary,
      shiftState: shiftState,
    );
    final done = steps.where((s) => s.done).length;

    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            DesignTokens.primary.withOpacity(0.10),
            DesignTokens.secondary.withOpacity(0.06),
            theme.colorScheme.surface,
          ],
        ),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [DesignTokens.primary, DesignTokens.secondary],
                  ),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                child: const Icon(Icons.rocket_launch, color: Colors.white),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Semantics(
                  container: true,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        context.l10n.welcomeToStockFlow,
                        style: theme.textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: theme.colorScheme.onSurface,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        context.l10n.onboardingSubtitle,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Semantics(
                container: true,
                child: _ProgressPill(
                  l10n: context.l10n,
                  done: done,
                  total: steps.length,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: steps.isEmpty ? 0 : done / steps.length,
              minHeight: 6,
              backgroundColor: theme.colorScheme.surfaceContainerHighest,
              color: DesignTokens.success,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          LayoutBuilder(
            builder: (context, constraints) {
              final maxW = constraints.maxWidth;
              final cols = maxW >= 1000
                  ? 4
                  : (maxW >= 640
                      ? 2
                      : 1);
              final cardW = (maxW - (cols - 1) * AppSpacing.sm) / cols;

              return Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (var i = 0; i < steps.length; i++)
                    SizedBox(
                      width: cardW,
                      child: _OnboardingStepCard(
                        step: steps[i],
                        index: i,
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

/// One onboarding step with its live completion state. Pure data — built by
/// [buildOnboardingSteps] from already-loaded providers; unit-tested.
class OnboardingStepView {
  final IconData icon;
  final String title;
  final String description;
  final String route;
  final Color color;
  final bool done;

  const OnboardingStepView({
    required this.icon,
    required this.title,
    required this.description,
    required this.route,
    required this.color,
    required this.done,
  });
}

/// Builds the 4 onboarding steps with real completion state.
///
/// Data rules (no new requests, no invented sources):
///  - "Add products"      — done once any stock value / stock position exists
///    (`inventoryValue > 0` or low/out-of-stock positions are tracked).
///  - "Register customers" — done once at least one customer exists.
///  - "Open a cash shift"  — done once an open shift is loaded (X-report).
///  - "Complete first sale" — done once any sale exists.
List<OnboardingStepView> buildOnboardingSteps({
  required AppLocalizations l10n,
  required DashboardSummary summary,
  required ShiftState shiftState,
}) {
  final hasStock = (double.tryParse(summary.inventoryValue) ?? 0) > 0 ||
      summary.lowStockProducts > 0 ||
      summary.outOfStockProducts > 0;
  final shiftOpen = shiftState is ShiftLoaded && shiftState.current != null;

  return [
    OnboardingStepView(
      icon: Icons.inventory_2_outlined,
      title: l10n.onbAddProducts,
      description: l10n.onbAddProductsDesc,
      route: RouteNames.productCreate,
      color: DesignTokens.primary,
      done: hasStock,
    ),
    OnboardingStepView(
      icon: Icons.person_add_alt_1,
      title: l10n.onbRegisterCustomers,
      description: l10n.onbRegisterCustomersDesc,
      route: RouteNames.customerNew,
      color: DesignTokens.accent,
      done: summary.customerCount > 0,
    ),
    OnboardingStepView(
      icon: Icons.point_of_sale,
      title: l10n.onbOpenCashShift,
      description: l10n.onbOpenCashShiftDesc,
      route: RouteNames.saleNew,
      color: DesignTokens.secondary,
      done: shiftOpen,
    ),
    OnboardingStepView(
      icon: Icons.add_shopping_cart,
      title: l10n.onbCompleteFirstSale,
      description: l10n.onbCompleteFirstSaleDesc,
      route: RouteNames.saleNew,
      color: DesignTokens.info,
      done: summary.ordersCount > 0 || summary.todaySales.count > 0,
    ),
  ];
}

/// Compact "N of 4" progress pill in the hero header.
class _ProgressPill extends StatelessWidget {
  final AppLocalizations l10n;
  final int done;
  final int total;
  const _ProgressPill({
    required this.l10n,
    required this.done,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final complete = done >= total;
    final color = complete ? DesignTokens.success : DesignTokens.primary;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(
        complete ? l10n.allDone : l10n.progressOf(done, total),
        style: theme.textTheme.labelMedium?.copyWith(
          color: color,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _OnboardingStepCard extends StatefulWidget {
  final OnboardingStepView step;
  final int index;

  const _OnboardingStepCard({required this.step, required this.index});

  @override
  State<_OnboardingStepCard> createState() => _OnboardingStepCardState();
}

class _OnboardingStepCardState extends State<_OnboardingStepCard> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = context.l10n;
    final color = widget.step.done ? DesignTokens.success : widget.step.color;
    final done = widget.step.done;

    return MouseRegion(
      cursor: done ? SystemMouseCursors.basic : SystemMouseCursors.click,
      onEnter: done ? null : (_) => setState(() => _hovered = true),
      onExit: done ? null : (_) => setState(() => _hovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        decoration: BoxDecoration(
          color: _hovered
              ? theme.colorScheme.surface
              : theme.colorScheme.surface.withOpacity(0.6),
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: _hovered
                ? color.withOpacity(0.5)
                : (done
                    ? color.withOpacity(0.35)
                    : theme.colorScheme.outlineVariant),
          ),
          boxShadow: _hovered
              ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ]
              : const [],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            onTap: done ? null : () => context.push(widget.step.route),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: color.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                        ),
                        child: Icon(
                          done ? Icons.check_circle : widget.step.icon,
                          color: color,
                          size: 20,
                        ),
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: color.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          done ? l10n.done : '${widget.index + 1}',
                          style: theme.textTheme.labelSmall?.copyWith(
                            color: color,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    widget.step.title,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: done
                          ? theme.colorScheme.onSurfaceVariant
                          : theme.colorScheme.onSurface,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    widget.step.description,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    done ? l10n.completed : l10n.getStarted,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: done
                          ? theme.colorScheme.onSurfaceVariant
                          : color,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Skeleton while dashboard data is loading — never a false "0 of 4".
class _OnboardingHeroSkeleton extends StatelessWidget {
  const _OnboardingHeroSkeleton();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: theme.colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 200,
                      height: 20,
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      width: 260,
                      height: 12,
                      decoration: BoxDecoration(
                        color: theme.colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            height: 6,
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        ],
      ),
    );
  }
}
