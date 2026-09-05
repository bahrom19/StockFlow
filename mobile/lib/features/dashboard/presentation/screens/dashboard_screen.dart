import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/widgets/error_state_widget.dart';
import 'package:stockflow/core/widgets/shimmer_box.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/action_center.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/ai_insights_card.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/cash_drawer_hero.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/kpi_card.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/onboarding_hero.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/quick_actions.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/recent_sales_list.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/revenue_goal_card.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/sales_chart.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/payments/presentation/widgets/today_payments_card.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';
import 'package:stockflow/features/warehouses/presentation/providers/warehouses_provider.dart';
import 'package:stockflow/core/currency/currency_ext.dart';
import 'package:stockflow/core/currency/currency_provider.dart';
import 'package:stockflow/core/currency/currency_selector.dart';

/// Production Dashboard Screen — answers "How is my business today?" in <5s.
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen>
    with AutomaticKeepAliveClientMixin {
  String? _shiftWarehouseId;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(dashboardProvider.notifier).loadDashboard();
      _bootstrapShift();
    });
  }

  /// Single owner of the cash-shift bootstrap for this screen: loads the
  /// warehouse list once, then loads the open shift for the default (or first)
  /// active warehouse — exactly one X-report request per page load. The hero
  /// and ActionCenter only watch the shared [cashShiftProvider].
  ///
  /// The warehouse list starts in `WarehouseListLoading` (its initial state),
  /// so we must trigger `loadWarehouses()` from that state too — otherwise the
  /// list never loads and the shift stays stuck in "Checking shift…" forever.
  void _bootstrapShift() {
    final ws = ref.read(warehouseListProvider);
    if (ws is WarehouseListLoaded) {
      _ensureShift(ws.warehouses);
    } else if (ws is WarehouseListEmpty) {
      return; // no warehouses — nothing to open a shift in
    } else {
      // Loading (initial or in-flight) or Error — trigger the load once;
      // ref.listen in build picks it up as soon as it arrives.
      Future.microtask(() {
        if (!mounted) return;
        final current = ref.read(warehouseListProvider);
        if (current is! WarehouseListLoaded &&
            current is! WarehouseListEmpty) {
          ref.read(warehouseListProvider.notifier).loadWarehouses();
        }
      });
    }
  }

  void _ensureShift(List<Warehouse> warehouses) {
    if (warehouses.isEmpty) return;
    final wh = warehouses.firstWhere(
      (w) => w.isDefault,
      orElse: () => warehouses.first,
    );
    if (_shiftWarehouseId != wh.id) {
      _shiftWarehouseId = wh.id;
      Future.microtask(() {
        if (mounted) {
          ref.read(cashShiftProvider.notifier).loadShift(wh.id);
        }
      });
    }
  }

  Future<void> _refreshAll() async {
    await ref.read(dashboardProvider.notifier).refresh();
    if (_shiftWarehouseId != null) {
      await ref.read(cashShiftProvider.notifier).refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    ref.listen<WarehouseListState>(warehouseListProvider, (prev, next) {
      if (next is WarehouseListLoaded) _ensureShift(next.warehouses);
    });
    final theme = Theme.of(context);
    final state = ref.watch(dashboardProvider);
    final user = ref.watch(currentUserProvider);

    return RefreshIndicator(
      onRefresh: _refreshAll,
      child: _buildBody(theme, state, user),
    );
  }

  Widget _buildBody(
    ThemeData theme,
    DashboardUiState state,
    CurrentUser? user,
  ) {
    return switch (state) {
      DashboardLoading() => ListView(
          padding: _pagePadding,
          children: const [
            _GreetingSkeleton(),
            SizedBox(height: AppSpacing.xl),
            CashDrawerHeroSkeleton(),
            SizedBox(height: AppSpacing.lg),
            _KpiSkeletonGrid(),
            SizedBox(height: AppSpacing.lg),
            ShimmerBox(width: 240, height: 32, radius: 8),
            SizedBox(height: AppSpacing.sm),
            _QuickActionsSkeleton(),
            SizedBox(height: AppSpacing.lg),
            ShimmerBox(width: double.infinity, height: 220, radius: 12),
          ],
        ),
      DashboardError(message: final msg) => ErrorStateWidget(
          message: msg,
          onRetry: () =>
              ref.read(dashboardProvider.notifier).loadDashboard(),
        ),
      DashboardData(
        :final summary,
        :final recentSales,
        :final chartData,
        :final isRefreshing,
      ) =>
        _DashboardContentView(
          userName: user?.fullName.split(' ').firstOrNull,
          summary: summary,
          recentSales: recentSales,
          chartData: chartData,
          isRefreshing: isRefreshing,
          onRefresh: () =>
              ref.read(dashboardProvider.notifier).refresh(),
        ),
    };
  }
}

const EdgeInsets _pagePadding = EdgeInsets.fromLTRB(
  AppSpacing.xl,
  AppSpacing.xl,
  AppSpacing.xl,
  AppSpacing.xxl,
);

class _DashboardContentView extends ConsumerWidget {
  final String? userName;
  final DashboardSummary summary;
  final SalesReport? recentSales;
  final List<ChartDataPoint> chartData;
  final bool isRefreshing;
  final VoidCallback onRefresh;

  const _DashboardContentView({
    this.userName,
    required this.summary,
    this.recentSales,
    required this.chartData,
    required this.isRefreshing,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final width = MediaQuery.sizeOf(context).width;
    final isWide = width >= AppSpacing.breakpointWide;
    final recentSalesWidget = RecentSalesList(
      sales: recentSales?.sales ?? const [],
    );
    // CURRENCY-4: the Dashboard currency filter scopes every monetary metric
    // (summary, sales, profit chart) to ONE currency. Selecting a currency
    // re-queries the backend with `currency=<code>`; display formatting
    // (CurrencyScope/context.money) follows automatically.
    final selectedCurrency = ref.watch(currencyProvider);

    Future<void> onCurrencyChanged(String code) async {
      await ref.read(currencyProvider.notifier).setCurrency(code);
      if (context.mounted) {
        // onRefresh is a VoidCallback (fire-and-forget) — just invoke it.
        onRefresh();
      }
    }

    // Brand-new company → one informative onboarding block instead of the
    // five scattered "No data" cards (chart, payments, recent, low stock, AI).
    final isOnboarding = summary.customerCount == 0 &&
        summary.ordersCount == 0 &&
        chartData.every((d) => d.revenue == 0) &&
        (recentSales?.sales.isEmpty ?? true);

    return ListView(
      padding: _pagePadding,
      children: [
        _GreetingRow(
          userName: userName,
          isRefreshing: isRefreshing,
          onRefresh: onRefresh,
        ),
        const SizedBox(height: AppSpacing.md),

        // ── Currency filter (CURRENCY-4) ─────────
        Align(
          alignment: Alignment.centerRight,
          child: SizedBox(
            width: 160,
            child: CurrencySelector(
              key: const Key('dashboard_currency_filter'),
              value: selectedCurrency,
              label: context.l10n.currency,
              onChanged: (code) => onCurrencyChanged(code),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        // ── Cash Drawer Hero — the page's #1 answer ──
        const CashDrawerHero(),
        const SizedBox(height: AppSpacing.lg),

        // ── KPI strip (compact) ─────────────────
        _KpiSection(summary: summary),
        const SizedBox(height: AppSpacing.sm),

        // ── Quick Actions — directly under KPI ──
        const QuickActionsStrip(),
        const SizedBox(height: AppSpacing.lg),

        if (isOnboarding) ...[
          // ── Single onboarding hero ────────────
          const OnboardingHero(),
        ] else ...[
          // ── Action Center: prioritized issues ──
          const ActionCenter(),
          const SizedBox(height: AppSpacing.lg),

          // ── Hero: chart (central) + payments ──
          if (isWide)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 7,
                  child: SalesBarChart(
                    data: chartData,
                    title: context.l10n.salesLastDays(chartData.length),
                    showProfit: true,
                    height: 220,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                const Expanded(flex: 5, child: TodayPaymentsCard()),
              ],
            )
          else ...[
            SalesBarChart(
              data: chartData,
              title: context.l10n.salesLastDays(chartData.length),
              showProfit: true,
              height: 200,
            ),
            const SizedBox(height: AppSpacing.md),
            const TodayPaymentsCard(),
          ],

          const SizedBox(height: AppSpacing.lg),

          // ── Recent Sales | AI Insights ────────
          if (width >= 1024)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 6, child: recentSalesWidget),
                const SizedBox(width: AppSpacing.sm),
                const Expanded(flex: 4, child: AiInsightsCard()),
              ],
            )
          else ...[
            recentSalesWidget,
            const SizedBox(height: AppSpacing.md),
            const AiInsightsCard(),
          ],
        ],
      ],
    );
  }
}

// ──────────────────────────────────
// Greeting
// ──────────────────────────────────
class _GreetingRow extends StatelessWidget {
  final String? userName;
  final bool isRefreshing;
  final VoidCallback onRefresh;

  const _GreetingRow({
    this.userName,
    required this.isRefreshing,
    required this.onRefresh,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = context.l10n;
    final today = DateFormat(
      'EEEE, MMM d',
      Localizations.localeOf(context).toLanguageTag(),
    ).format(DateTime.now());

    return Row(
      children: [
        // ddd97fb semantics pattern: a label-less boundary around the greeting
        // text keeps it in its own merged leaf (rendered as textContent in
        // Flutter Web, so it stays visible to document.body.innerText and
        // screen readers) instead of being hoisted into the row's
        // role="group" aria-label by the interactive Refresh button. The
        // Refresh button stays a sibling.
        Expanded(
          child: Semantics(
            container: true,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.greetingHello(userName ?? l10n.user),
                  style: theme.textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.greetingSubtitle(today),
                  style: theme.textTheme.bodyMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (isRefreshing)
          const Padding(
            padding: EdgeInsets.all(AppSpacing.sm),
            child: SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          )
        else
          IconButton(
            tooltip: l10n.refresh,
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh),
          ),
      ],
    );
  }
}

// ──────────────────────────────────
// KPI Section — 5 cards, Revenue emphasized
// ──────────────────────────────────
class _KpiSection extends StatelessWidget {
  final DashboardSummary summary;

  const _KpiSection({required this.summary});

  double? _countTrend() {
    final y = summary.yesterdaySales.count;
    if (y <= 0) return null;
    return ((summary.todaySales.count - y) / y) * 100;
  }

  List<Widget> _cards(AppLocalizations l10n, BuildContext context) {
    return [
      // Stage E — Revenue + Monthly Goal (first KPI, emphasized). The monthly
      // goal is a LOCAL owner setting (SharedPreferences), zero new requests.
      RevenueGoalCard(summary: summary),
      KpiCard(
        title: l10n.kpiTodaySales,
        value: summary.todaySales.count.toString(),
        subtitle: l10n.kpiYesterdayCount(summary.yesterdaySales.count),
        changePercent: _countTrend(),
        icon: Icons.receipt_long,
        color: DesignTokens.primary,
        compact: true,
      ),
      KpiCard(
        title: l10n.kpiGrossProfit,
        value: context.money(summary.grossProfit),
        subtitle: l10n.kpiPeriodProfit,
        icon: Icons.account_balance,
        color: DesignTokens.profit,
        compact: true,
      ),
      KpiCard(
        title: l10n.kpiInventoryValue,
        value: context.moneyShort(summary.inventoryValue),
        subtitle: l10n.kpiTotalStockValue,
        icon: Icons.warehouse,
        color: DesignTokens.accent,
        compact: true,
      ),
      KpiCard(
        title: l10n.customers,
        value: summary.customerCount.toString(),
        subtitle: l10n.kpiTotalCustomers,
        icon: Icons.people,
        color: DesignTokens.info,
        compact: true,
      ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final cards = _cards(context.l10n, context);

    if (width >= AppSpacing.breakpointWide) {
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 13, child: cards[0]),
          const SizedBox(width: AppSpacing.xs),
          for (var i = 1; i < cards.length; i++) ...[
            Expanded(flex: 10, child: cards[i]),
            if (i < cards.length - 1) const SizedBox(width: AppSpacing.xs),
          ],
        ],
      );
    }

    // Wrap: 3-up on desktop, 2-up on tablet/mobile.
    final cols = width >= AppSpacing.breakpointDesktop ? 3 : 2;
    final usable = width - AppSpacing.xl * 2 - (cols - 1) * AppSpacing.sm;
    final cardWidth = usable / cols;

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        for (final card in cards)
          SizedBox(width: cardWidth, child: card),
      ],
    );
  }
}

// ──────────────────────────────────
// Skeletons
// ──────────────────────────────────
class _GreetingSkeleton extends StatelessWidget {
  const _GreetingSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ShimmerBox(width: 220, height: 28, radius: AppSpacing.radiusSm),
        SizedBox(height: AppSpacing.xs),
        ShimmerBox(width: 180, height: 14, radius: AppSpacing.radiusXs),
      ],
    );
  }
}

class _KpiSkeletonGrid extends StatelessWidget {
  const _KpiSkeletonGrid();

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final cols = width >= AppSpacing.breakpointWide
        ? 5
        : (width >= AppSpacing.breakpointDesktop ? 3 : 2);
    final usable = width - AppSpacing.xl * 2 - (cols - 1) * AppSpacing.sm;

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        for (var i = 0; i < cols; i++)
          SizedBox(
            width: usable / cols,
            child: const KpiCardSkeleton(),
          ),
      ],
    );
  }
}

class _QuickActionsSkeleton extends StatelessWidget {
  const _QuickActionsSkeleton();

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final cols = width >= 1400
        ? 6
        : (width >= 1000
            ? 3
            : 2);
    final usable = width - AppSpacing.xl * 2 - (cols - 1) * AppSpacing.xs;

    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        for (var i = 0; i < cols; i++)
          ShimmerBox(
            width: usable / cols,
            height: 56,
            radius: AppSpacing.radiusMd,
          ),
      ],
    );
  }
}
