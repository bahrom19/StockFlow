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

/// Customer Report screen — shows customer orders, revenue, average receipt.
class CustomerReportScreen extends ConsumerStatefulWidget {
  const CustomerReportScreen({super.key});

  @override
  ConsumerState<CustomerReportScreen> createState() =>
      _CustomerReportScreenState();
}

class _CustomerReportScreenState extends ConsumerState<CustomerReportScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(customerReportProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(customerReportProvider);
    final data = state is ReportData<CustomerReportResponse>
        ? state.data
        : null;
    final items = data?.items ?? <CustomerReportItem>[];

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: context.l10n.reportCustomers,
            subtitle: context.l10n.reportCustomersSubtitle,
            actions: [
              IconButton(
                tooltip: context.l10n.refresh,
                onPressed: () =>
                    ref.read(customerReportProvider.notifier).refresh(),
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
    ReportState<CustomerReportResponse> state,
    List<CustomerReportItem> items,
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
            ref.read(customerReportProvider.notifier).refresh(),
      );
    }

    if (state is ReportEmpty || items.isEmpty) {
      return EmptyStateWidget(
        title: context.l10n.reportCustomersEmpty,
        subtitle: context.l10n.reportCustomersEmptySubtitle,
        icon: Icons.people_outlined,
      );
    }

    return _buildTable(context, state, items, theme);
  }

  Widget _buildTable(
    BuildContext context,
    ReportState<CustomerReportResponse> state,
    List<CustomerReportItem> items,
    ThemeData theme,
  ) {
    final provider = ref.read(customerReportProvider.notifier);

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
                  DataColumn(label: Text(context.l10n.customerName)),
                  DataColumn(
                      label: Text(context.l10n.orders), numeric: true),
                  DataColumn(
                      label: Text(context.l10n.revenue), numeric: true),
                  DataColumn(
                      label: Text(context.l10n.averageReceipt),
                      numeric: true),
                  DataColumn(
                      label: Text(context.l10n.lastPurchase)),
                ],
                rows: [
                  for (final item in items)
                    DataRow(cells: [
                      DataCell(Text(
                        item.name,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      )),
                      DataCell(Text('${item.orders}')),
                      DataCell(Text(context.money(item.revenue))),
                      DataCell(Text(context.money(item.averageReceipt))),
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
