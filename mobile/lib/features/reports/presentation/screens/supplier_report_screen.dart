import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/currency/currency_ext.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/empty_state_widget.dart';
import 'package:stockflow/core/widgets/error_state_widget.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/features/reports/domain/report_models.dart';
import 'package:stockflow/features/reports/presentation/providers/reports_providers.dart';

/// Supplier Report screen — shows supplier purchase orders, totals, last purchase.
class SupplierReportScreen extends ConsumerStatefulWidget {
  const SupplierReportScreen({super.key});

  @override
  ConsumerState<SupplierReportScreen> createState() =>
      _SupplierReportScreenState();
}

class _SupplierReportScreenState extends ConsumerState<SupplierReportScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(supplierReportProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(supplierReportProvider);
    final data = state is ReportData<SupplierReportResponse>
        ? state.data
        : null;
    final items = data?.items ?? <SupplierReportItem>[];

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: context.l10n.reportSuppliers,
            subtitle: context.l10n.reportSuppliersSubtitle,
            actions: [
              IconButton(
                tooltip: context.l10n.refresh,
                onPressed: () =>
                    ref.read(supplierReportProvider.notifier).refresh(),
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
    ReportState<SupplierReportResponse> state,
    List<SupplierReportItem> items,
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
            ref.read(supplierReportProvider.notifier).refresh(),
      );
    }

    if (state is ReportEmpty || items.isEmpty) {
      return EmptyStateWidget(
        title: context.l10n.reportSuppliersEmpty,
        subtitle: context.l10n.reportSuppliersEmptySubtitle,
        icon: Icons.local_shipping_outlined,
      );
    }

    return _buildTable(context, state, items, theme);
  }

  Widget _buildTable(
    BuildContext context,
    ReportState<SupplierReportResponse> state,
    List<SupplierReportItem> items,
    ThemeData theme,
  ) {
    final provider = ref.read(supplierReportProvider.notifier);

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
                  DataColumn(label: Text(context.l10n.supplierName)),
                  DataColumn(
                      label: Text(context.l10n.purchaseOrders),
                      numeric: true),
                  DataColumn(
                      label: Text(context.l10n.total), numeric: true),
                  DataColumn(
                      label: Text(context.l10n.lastPurchase)),
                ],
                rows: [
                  for (final item in items)
                    DataRow(cells: [
                      DataCell(Text(
                        item.companyName,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      )),
                      DataCell(Text('${item.purchaseOrders}')),
                      DataCell(Text(context.money(item.purchaseTotal))),
                      DataCell(Text(
                        item.lastPurchase != null
                            ? Formatters.date(
                                DateTime.tryParse(item.lastPurchase!),
                                locale: Localizations.localeOf(context)
                                    .toLanguageTag(),
                              )
                            : '—',
                      )),
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
