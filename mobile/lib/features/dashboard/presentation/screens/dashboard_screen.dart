import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/error_state_widget.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/ai_insights_card.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/kpi_card.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/recent_sales_list.dart';
import 'package:stockflow/features/dashboard/presentation/widgets/sales_chart.dart';
import 'package:stockflow/features/payments/presentation/widgets/today_payments_card.dart';

/// Production Dashboard Screen
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(dashboardProvider.notifier).loadDashboard();
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final theme = Theme.of(context);
    final state = ref.watch(dashboardProvider);
    final user = ref.watch(currentUserProvider);

    // The Shell (TopBar) renders the page title and global actions;
    // the dashboard renders only its content. The greeting is kept as a
    // content header so the first screen still feels personal.
    return RefreshIndicator(
      onRefresh: () => ref.read(dashboardProvider.notifier).refresh(),
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
          padding: AppSpacing.screenPadding,
          children: [
            _buildKpiRow(theme, isLoading: true),
            const SizedBox(height: AppSpacing.md),
            _buildKpiRow(theme, isLoading: true),
            const SizedBox(height: AppSpacing.lg),
            const SizedBox(height: 160),
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
        ),
    };
  }

  Widget _buildKpiRow(ThemeData _, {bool isLoading = false}) {
    if (isLoading) {
      return const Row(
        children: [
          Expanded(child: KpiCardSkeleton()),
          SizedBox(width: AppSpacing.sm),
          Expanded(child: KpiCardSkeleton()),
        ],
      );
    }
    return const SizedBox.shrink();
  }
}

class _DashboardContentView extends StatelessWidget {
  final String? userName;
  final DashboardSummary summary;
  final SalesReport? recentSales;
  final List<ChartDataPoint> chartData;
  final bool isRefreshing;

  const _DashboardContentView({
    this.userName,
    required this.summary,
    this.recentSales,
    required this.chartData,
    required this.isRefreshing,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDesktop = MediaQuery.of(context).size.width >= AppSpacing.breakpointDesktop;

    return ListView(
      padding: AppSpacing.screenPadding,
      children: [
        // ── Greeting ──
        Text(
          'Hello, ${userName ?? 'User'}',
          style: theme.textTheme.titleMedium
              ?.copyWith(color: theme.colorScheme.onSurfaceVariant),
        ),
        const SizedBox(height: AppSpacing.md),

        // ── KPI Cards (2 columns on phone, 4 on desktop) ──
        if (isDesktop) ...[
          _KpiGrid(summary: summary),
        ] else ...[
          _KpiRow(summary: summary),
        ],

        const SizedBox(height: AppSpacing.lg),

        // ── Chart ──
        SalesBarChart(
          data: chartData,
          title: 'Sales — Last ${chartData.length} Days',
          showProfit: true,
        ),

        const SizedBox(height: AppSpacing.md),

        // ── Today's Payments (v1.2) ──
        TodayPaymentsCard(),

        const SizedBox(height: AppSpacing.md),

        // ── Recent Sales ──
        if (recentSales != null)
          RecentSalesList(sales: recentSales!.sales),

        const SizedBox(height: AppSpacing.md),

        // ── AI Insights ──
        AiInsightsCard(),

        const SizedBox(height: AppSpacing.md),

        // ── Quick Actions ──
        _QuickActionsGrid(),

        const SizedBox(height: AppSpacing.xxl),
      ],
    );
  }
}

class _KpiRow extends StatelessWidget {
  final DashboardSummary summary;
  const _KpiRow({required this.summary});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: KpiCard(
                title: "Today's Revenue",
                value: Formatters.currency(summary.todaySales.revenue),
                icon: Icons.trending_up,
                color: DesignTokens.success,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: KpiCard(
                title: "Today's Sales",
                value: summary.todaySales.count.toString(),
                icon: Icons.receipt_long,
                color: DesignTokens.primary,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: KpiCard(
                title: 'Gross Profit',
                value: Formatters.currency(summary.grossProfit),
                icon: Icons.account_balance,
                color: DesignTokens.profit,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: KpiCard(
                title: 'Customers',
                value: summary.customerCount.toString(),
                icon: Icons.people,
                color: DesignTokens.info,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: KpiCard(
                title: 'Low Stock',
                value: summary.lowStockProducts.toString(),
                subtitle: '${summary.outOfStockProducts} out of stock',
                icon: Icons.inventory,
                color: DesignTokens.warning,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: KpiCard(
                title: 'Inventory Value',
                value: Formatters.currencyShort(summary.inventoryValue),
                icon: Icons.warehouse,
                color: DesignTokens.accent,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _KpiGrid extends StatelessWidget {
  final DashboardSummary summary;
  const _KpiGrid({required this.summary});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        SizedBox(
          width: _cardWidth(context),
          child: KpiCard(
            title: "Today's Revenue",
            value: Formatters.currency(summary.todaySales.revenue),
            icon: Icons.trending_up,
            color: DesignTokens.success,
          ),
        ),
        SizedBox(
          width: _cardWidth(context),
          child: KpiCard(
            title: "Today's Sales",
            value: summary.todaySales.count.toString(),
            icon: Icons.receipt_long,
            color: DesignTokens.primary,
          ),
        ),
        SizedBox(
          width: _cardWidth(context),
          child: KpiCard(
            title: 'Gross Profit',
            value: Formatters.currency(summary.grossProfit),
            icon: Icons.account_balance,
            color: DesignTokens.profit,
          ),
        ),
        SizedBox(
          width: _cardWidth(context),
          child: KpiCard(
            title: 'Customers',
            value: summary.customerCount.toString(),
            icon: Icons.people,
            color: DesignTokens.info,
          ),
        ),
        SizedBox(
          width: _cardWidth(context),
          child: KpiCard(
            title: 'Low Stock',
            value: summary.lowStockProducts.toString(),
            subtitle: '${summary.outOfStockProducts} out of stock',
            icon: Icons.inventory,
            color: DesignTokens.warning,
          ),
        ),
        SizedBox(
          width: _cardWidth(context),
          child: KpiCard(
            title: 'Monthly Sales',
            value: summary.monthSales.count.toString(),
            subtitle: Formatters.currency(summary.monthSales.revenue),
            icon: Icons.calendar_month,
            color: DesignTokens.info,
          ),
        ),
        SizedBox(
          width: _cardWidth(context),
          child: KpiCard(
            title: 'Inventory Value',
            value: Formatters.currencyShort(summary.inventoryValue),
            icon: Icons.warehouse,
            color: DesignTokens.accent,
          ),
        ),
        SizedBox(
          width: _cardWidth(context),
          child: KpiCard(
            title: 'Orders',
            value: summary.ordersCount.toString(),
            icon: Icons.shopping_cart,
            color: DesignTokens.secondary,
          ),
        ),
      ],
    );
  }

  double _cardWidth(BuildContext context) {
    final w = MediaQuery.of(context).size.width;
    if (w >= AppSpacing.breakpointWide) return (w - 64) / 4 - 8;
    if (w >= AppSpacing.breakpointDesktop) return (w - 48) / 3 - 8;
    return (w - 32) / 2 - 4;
  }
}

class _QuickActionsGrid extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Quick Actions', style: theme.textTheme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            _QuickActionChip(
              icon: Icons.add_shopping_cart,
              label: 'New Sale',
              onTap: () {},
            ),
            _QuickActionChip(
              icon: Icons.add_box,
              label: 'Purchase',
              onTap: () {},
            ),
            _QuickActionChip(
              icon: Icons.person_add,
              label: 'Customer',
              onTap: () {},
            ),
            _QuickActionChip(
              icon: Icons.inventory,
              label: 'Stock Take',
              onTap: () {},
            ),
            _QuickActionChip(
              icon: Icons.receipt,
              label: 'Invoice',
              onTap: () {},
            ),
            _QuickActionChip(
              icon: Icons.local_shipping,
              label: 'Transfer',
              onTap: () {},
            ),
          ],
        ),
      ],
    );
  }
}

class _QuickActionChip extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _QuickActionChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar: Icon(icon, size: 18),
      label: Text(label),
      onPressed: onTap,
    );
  }
}
