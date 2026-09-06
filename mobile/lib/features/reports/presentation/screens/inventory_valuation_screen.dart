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

/// Inventory Valuation report screen — shows quantity × average cost per product.
class InventoryValuationScreen extends ConsumerStatefulWidget {
  const InventoryValuationScreen({super.key});

  @override
  ConsumerState<InventoryValuationScreen> createState() =>
      _InventoryValuationScreenState();
}

class _InventoryValuationScreenState
    extends ConsumerState<InventoryValuationScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(inventoryValuationProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(inventoryValuationProvider);
    final data = state is ReportData<InventoryValuationResponse>
        ? state.data
        : null;
    final items = data?.items ?? <InventoryValuationItem>[];

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: context.l10n.reportInventoryValue,
            subtitle: context.l10n.reportInventoryValueSubtitle,
            actions: [
              IconButton(
                tooltip: context.l10n.refresh,
                onPressed: () =>
                    ref.read(inventoryValuationProvider.notifier).refresh(),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          Expanded(
            child: _buildBody(context, state, data, items, theme),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    ReportState<InventoryValuationResponse> state,
    InventoryValuationResponse? data,
    List<InventoryValuationItem> items,
    ThemeData theme,
  ) {
    if (state is ReportLoading) {
      return const Center(
          child: CircularProgressIndicator(strokeWidth: 2));
    }

    if (state is ReportError) {
      return ErrorStateWidget(
        message: state.message,
        onRetry: () =>
            ref.read(inventoryValuationProvider.notifier).refresh(),
      );
    }

    if (state is ReportEmpty || items.isEmpty) {
      return EmptyStateWidget(
        title: context.l10n.reportInventoryValueEmpty,
        subtitle: context.l10n.reportInventoryValueEmptySubtitle,
        icon: Icons.inventory_2_outlined,
      );
    }

    return Column(
      children: [
        // Total value summary card
        if (data != null)
          _SummaryCard(totalValue: data.totalValue, itemCount: data.items.length),
        Expanded(
          child: _buildTable(context, items, state, theme),
        ),
      ],
    );
  }

  Widget _buildTable(
    BuildContext context,
    List<InventoryValuationItem> items,
    ReportState<InventoryValuationResponse> state,
    ThemeData theme,
  ) {
    final provider = ref.read(inventoryValuationProvider.notifier);

    return Column(
      children: [
        Expanded(
          child: Card(
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
                      label: Text(context.l10n.averageCost), numeric: true),
                  DataColumn(
                      label: Text(context.l10n.value), numeric: true),
                ],
                rows: [
                  for (final item in items)
                    DataRow(cells: [
                      DataCell(Text(
                        item.productName,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      )),
                      DataCell(Text('${item.quantity}')),
                      DataCell(Text(context.money(item.averageCost))),
                      DataCell(Text(context.money(item.inventoryValue))),
                    ]),
                ],
              ),
            ),
          ),
        ),
        if (provider.hasMore)
          Padding(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Center(
              child: provider.isLoadingMore
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : OutlinedButton(
                      onPressed: () => provider.loadMore(),
                      child: Text(context.l10n.loadMore),
                    ),
            ),
          ),
      ],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  final String totalValue;
  final int itemCount;

  const _SummaryCard({required this.totalValue, required this.itemCount});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        0,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: theme.colorScheme.primary.withOpacity(0.12),
                borderRadius:
                    BorderRadius.circular(AppSpacing.radiusSm),
              ),
              child: Icon(
                Icons.inventory_2_outlined,
                size: 20,
                color: theme.colorScheme.primary,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  context.l10n.reportInventoryValueTotal,
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                Text(
                  context.money(totalValue),
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const Spacer(),
            Text(
              '$itemCount ${context.l10n.items}',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
