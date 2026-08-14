import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/services/receipt_print_service.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/app_snackbar.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/error_state_widget.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/dashboard/presentation/providers/dashboard_provider.dart';
import 'package:stockflow/features/reports/data/report_export.dart';
import 'package:stockflow/core/currency/currency_ext.dart';

/// Reports screen — business KPIs + recent sales table.
class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(dashboardProvider.notifier).loadDashboard();
    });
  }

  Future<void> _exportPdf(
    DashboardSummary summary,
    List<RecentSale> sales,
  ) async {
    try {
      final bytes = await ReportExport.buildPdf(
        summary: summary,
        sales: sales,
        currency: context.currencyCode,
      );
      final stamp = DateTime.now();
      final name =
          'report_${stamp.year}-${stamp.month.toString().padLeft(2, '0')}-${stamp.day.toString().padLeft(2, '0')}.pdf';
      await ReceiptPrintService.downloadPdf(bytes, name);
      if (mounted) {
        AppSnackbar.success(context, 'Report exported as PDF');
      }
    } catch (e) {
      if (mounted) AppSnackbar.error(context, 'PDF export failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(dashboardProvider);
    final data = state is DashboardData ? state : null;
    final summary = data?.summary;
    final sales = data?.recentSales?.sales ?? const <RecentSale>[];

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: 'Reports',
            subtitle: 'Business performance at a glance',
            actions: [
              IconButton(
                tooltip: 'Export PDF',
                onPressed: summary == null
                    ? null
                    : () => _exportPdf(summary, sales),
                icon: const Icon(Icons.picture_as_pdf_outlined),
              ),
              IconButton(
                tooltip: 'Refresh',
                onPressed: () {
                  ref.read(dashboardProvider.notifier).refresh();
                },
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                0,
                AppSpacing.md,
                AppSpacing.lg,
              ),
              children: [
                // ── KPI Cards ──────────────────────────
                if (state is DashboardLoading && summary == null)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: AppSpacing.xl),
                    child: Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                else if (state is DashboardError && summary == null)
                  SizedBox(
                    height: 220,
                    child: ErrorStateWidget(
                      message: (state as DashboardError).message,
                      onRetry: () =>
                          ref.read(dashboardProvider.notifier).loadDashboard(),
                    ),
                  )
                else if (summary != null)
                  _KpiGrid(summary: summary, theme: theme),
                const SizedBox(height: AppSpacing.lg),
                // ── Recent Sales Table ─────────────────
                Text(
                  'Recent Sales',
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                EntityTable<RecentSale>(
                  items: sales,
                  total: data?.recentSales?.total ?? sales.length,
                  isLoading: state is DashboardLoading && sales.isEmpty,
                  errorMessage:
                      state is DashboardError ? (state as DashboardError).message : null,
                  onRetry: () =>
                      ref.read(dashboardProvider.notifier).loadDashboard(),
                  exportFileName: 'recent_sales.csv',
                  exportHeaders: const ['Number', 'Date', 'Status', 'Total', 'Paid'],
                  exportRows: () => [
                    for (final s in sales)
                      [
                        s.saleNumber,
                        s.createdAt,
                        s.status,
                        s.total,
                        s.paidAmount,
                      ],
                  ],
                  columns: [
                    DataColumn(
                      label: Text('Number', style: theme.textTheme.labelMedium),
                    ),
                    const DataColumn(label: Text('Date')),
                    const DataColumn(label: Text('Status')),
                    DataColumn(
                      label: Text('Total', style: theme.textTheme.labelMedium),
                      numeric: true,
                    ),
                    DataColumn(
                      label: Text('Paid', style: theme.textTheme.labelMedium),
                      numeric: true,
                    ),
                  ],
                  buildRow: (s) => DataRow(
                    cells: [
                      DataCell(Text(
                        s.saleNumber,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      )),
                      DataCell(Text(Formatters.dateTime(
                        DateTime.tryParse(s.createdAt),
                      ))),
                      DataCell(StatusBadge(status: s.status)),
                      DataCell(Text(context.money(s.total))),
                      DataCell(Text(context.money(s.paidAmount))),
                    ],
                  ),
                  onRowTap: (s) => context.push('/sales/${s.id}'),
                  emptyTitle: 'No sales yet',
                  emptySubtitle: 'Recent sales will appear here',
                  emptyIcon: Icons.receipt_long_outlined,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ──────────────────────────────────
// KPI Grid
// ──────────────────────────────────
class _KpiGrid extends StatelessWidget {
  final DashboardSummary summary;
  final ThemeData theme;

  const _KpiGrid({required this.summary, required this.theme});

  @override
  Widget build(BuildContext context) {
    final cards = <(String, String, IconData, Color)>[
      (
        'Today Revenue',
        context.money(summary.todaySales.revenue),
        Icons.trending_up,
        theme.colorScheme.primary,
      ),
      (
        'Yesterday',
        context.money(summary.yesterdaySales.revenue),
        Icons.history,
        theme.colorScheme.tertiary,
      ),
      (
        'Month Revenue',
        context.money(summary.monthSales.revenue),
        Icons.calendar_month_outlined,
        theme.colorScheme.secondary,
      ),
      (
        'Gross Profit',
        context.money(summary.grossProfit),
        Icons.savings_outlined,
        const Color(0xFF0F9D58),
      ),
      (
        'Inventory Value',
        context.money(summary.inventoryValue),
        Icons.inventory_2_outlined,
        const Color(0xFFFB8C00),
      ),
      (
        'Orders',
        '${summary.ordersCount}',
        Icons.receipt_long_outlined,
        const Color(0xFF5F6368),
      ),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1100
            ? 6
            : constraints.maxWidth >= 700
                ? 3
                : 2;
        return GridView.count(
          crossAxisCount: columns,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: AppSpacing.sm,
          crossAxisSpacing: AppSpacing.sm,
          childAspectRatio: 1.7,
          children: [
            for (final (label, value, icon, color) in cards)
              _KpiCard(
                label: label,
                value: value,
                icon: icon,
                color: color,
              ),
          ],
        );
      },
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _KpiCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                  ),
                  child: Icon(icon, size: 18, color: color),
                ),
                const Spacer(),
                Text(
                  label,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            Text(
              value,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
