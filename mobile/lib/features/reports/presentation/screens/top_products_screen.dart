import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/currency/currency_ext.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/widgets/empty_state_widget.dart';
import 'package:stockflow/core/widgets/error_state_widget.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/features/reports/domain/report_models.dart';
import 'package:stockflow/features/reports/presentation/providers/reports_providers.dart';

/// Top Products report screen — shows best-selling products by revenue.
class TopProductsScreen extends ConsumerStatefulWidget {
  const TopProductsScreen({super.key});

  @override
  ConsumerState<TopProductsScreen> createState() => _TopProductsScreenState();
}

class _TopProductsScreenState extends ConsumerState<TopProductsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(topProductsProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(topProductsProvider);
    final items = state is ReportData<TopProductsResponse>
        ? state.data.items
        : <TopProductItem>[];

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: context.l10n.reportTopProducts,
            subtitle: context.l10n.reportTopProductsSubtitle,
            actions: [
              IconButton(
                tooltip: context.l10n.refresh,
                onPressed: () =>
                    ref.read(topProductsProvider.notifier).refresh(),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          Expanded(
            child: _buildBody(context, state, items, theme),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    ReportState<TopProductsResponse> state,
    List<TopProductItem> items,
    ThemeData theme,
  ) {
    if (state is ReportLoading) {
      return const Center(
          child: CircularProgressIndicator(strokeWidth: 2));
    }

    if (state is ReportError) {
      return ErrorStateWidget(
        message: state.message,
        onRetry: () => ref.read(topProductsProvider.notifier).refresh(),
      );
    }

    if (state is ReportEmpty || items.isEmpty) {
      return EmptyStateWidget(
        title: context.l10n.reportTopProductsEmpty,
        subtitle: context.l10n.reportTopProductsEmptySubtitle,
        icon: Icons.leaderboard_outlined,
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth >= AppSpacing.breakpointDesktop;
        if (isDesktop) {
          return _buildTable(context, items, theme);
        }
        return _buildList(context, items);
      },
    );
  }

  Widget _buildTable(
    BuildContext context,
    List<TopProductItem> items,
    ThemeData theme,
  ) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: SingleChildScrollView(
        child: DataTable(
          columnSpacing: 28,
          horizontalMargin: AppSpacing.md,
          headingRowHeight: 48,
          dataRowMinHeight: 52,
          dataRowMaxHeight: 64,
          headingTextStyle: theme.textTheme.labelMedium?.copyWith(
            fontWeight: FontWeight.w700,
            color: theme.colorScheme.onSurfaceVariant,
            letterSpacing: 0.4,
          ),
          columns: [
            DataColumn(label: Text(context.l10n.productName)),
            DataColumn(
                label: Text(context.l10n.quantity), numeric: true),
            DataColumn(
                label: Text(context.l10n.revenue), numeric: true),
            DataColumn(
                label: Text(context.l10n.profit), numeric: true),
            DataColumn(
                label: Text(context.l10n.margin), numeric: true),
          ],
          rows: [
            for (final item in items)
              DataRow(cells: [
                DataCell(Text(
                  item.productName,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                )),
                DataCell(Text('${item.quantitySold}')),
                DataCell(Text(context.money(item.revenue))),
                DataCell(Text(context.money(item.profit))),
                DataCell(Text('${double.tryParse(item.margin)?.toStringAsFixed(1) ?? '0.0'}%')),
              ]),
          ],
        ),
      ),
    );
  }

  Widget _buildList(BuildContext context, List<TopProductItem> items) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final item = items[index];
        return _ProductTile(item: item);
      },
    );
  }
}

class _ProductTile extends StatelessWidget {
  final TopProductItem item;

  const _ProductTile({required this.item});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: AppSpacing.xs),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    item.productName,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Text(
                  '${double.tryParse(item.margin)?.toStringAsFixed(1) ?? '0.0'}%',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.xs),
            Row(
              children: [
                _Metric(
                  label: context.l10n.quantity,
                  value: '${item.quantitySold}',
                ),
                const SizedBox(width: AppSpacing.md),
                _Metric(
                  label: context.l10n.revenue,
                  value: context.money(item.revenue),
                ),
                const SizedBox(width: AppSpacing.md),
                _Metric(
                  label: context.l10n.profit,
                  value: context.money(item.profit),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  final String label;
  final String value;

  const _Metric({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: theme.textTheme.labelSmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
          ),
        ),
        Text(
          value,
          style: theme.textTheme.bodySmall?.copyWith(
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
