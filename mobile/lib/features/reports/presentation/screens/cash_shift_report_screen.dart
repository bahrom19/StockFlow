import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/currency/currency_ext.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/empty_state_widget.dart';
import 'package:stockflow/core/widgets/error_state_widget.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/reports/domain/report_models.dart';
import 'package:stockflow/features/reports/presentation/providers/reports_providers.dart';

/// Cash Shift Report screen — shows open/closed shifts, totals, differences.
class CashShiftReportScreen extends ConsumerStatefulWidget {
  const CashShiftReportScreen({super.key});

  @override
  ConsumerState<CashShiftReportScreen> createState() =>
      _CashShiftReportScreenState();
}

class _CashShiftReportScreenState
    extends ConsumerState<CashShiftReportScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(cashShiftReportProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(cashShiftReportProvider);
    final data = state is ReportData<CashShiftReportResponse>
        ? state.data
        : null;
    final items = data?.items ?? <CashShiftReportItem>[];

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: context.l10n.reportCashShifts,
            subtitle: context.l10n.reportCashShiftsSubtitle,
            actions: [
              IconButton(
                tooltip: context.l10n.refresh,
                onPressed: () =>
                    ref.read(cashShiftReportProvider.notifier).refresh(),
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
    ReportState<CashShiftReportResponse> state,
    List<CashShiftReportItem> items,
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
            ref.read(cashShiftReportProvider.notifier).refresh(),
      );
    }

    if (state is ReportEmpty || items.isEmpty) {
      return EmptyStateWidget(
        title: context.l10n.reportCashShiftsEmpty,
        subtitle: context.l10n.reportCashShiftsEmptySubtitle,
        icon: Icons.payments_outlined,
      );
    }

    return _buildTable(context, state, items, theme);
  }

  Widget _buildTable(
    BuildContext context,
    ReportState<CashShiftReportResponse> state,
    List<CashShiftReportItem> items,
    ThemeData theme,
  ) {
    final provider = ref.read(cashShiftReportProvider.notifier);

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
                  DataColumn(label: Text(context.l10n.status)),
                  DataColumn(label: Text(context.l10n.openedAt)),
                  DataColumn(label: Text(context.l10n.cashier)),
                  DataColumn(label: Text(context.l10n.warehouse)),
                  DataColumn(
                      label: Text(context.l10n.totalSales), numeric: true),
                  DataColumn(
                      label: Text(context.l10n.expectedClosing),
                      numeric: true),
                  DataColumn(
                      label: Text(context.l10n.difference), numeric: true),
                ],
                rows: [
                  for (final item in items)
                    DataRow(cells: [
                      DataCell(StatusBadge(status: item.status)),
                      DataCell(Text(
                        Formatters.dateTime(
                          DateTime.tryParse(item.openedAt),
                          locale: Localizations.localeOf(context)
                              .toLanguageTag(),
                        ),
                      )),
                      DataCell(Text(item.cashierName)),
                      DataCell(Text(item.warehouseName)),
                      DataCell(Text(context.money(item.totalSales))),
                      DataCell(Text(context.money(item.expectedClosing))),
                      DataCell(_DifferenceCell(
                        value: item.differenceAmount,
                        money: context.money(item.difference),
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

class _DifferenceCell extends StatelessWidget {
  final double value;
  final String money;

  const _DifferenceCell({required this.value, required this.money});

  @override
  Widget build(BuildContext context) {
    final color = value == 0
        ? Theme.of(context).colorScheme.onSurface
        : value > 0
            ? Colors.green
            : Colors.red;
    return Text(
      money,
      style: TextStyle(
        color: color,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}
