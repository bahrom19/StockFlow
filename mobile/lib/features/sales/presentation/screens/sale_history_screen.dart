import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/currency/currency_ext.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/payments/presentation/labels.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/features/sales/presentation/providers/sales_provider.dart';
import 'package:stockflow/features/sales/presentation/widgets/sales_widgets.dart'
    hide StatusBadge;

// ──────────────────────────────────
// Sale History Screen
// ──────────────────────────────────
class SaleHistoryScreen extends ConsumerStatefulWidget {
  const SaleHistoryScreen({super.key});

  @override
  ConsumerState<SaleHistoryScreen> createState() => _SaleHistoryScreenState();
}

class _SaleHistoryScreenState extends ConsumerState<SaleHistoryScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    final customerId = GoRouterState.of(context).uri.queryParameters['customerId'];
    Future.microtask(() {
      final notifier = ref.read(saleListProvider.notifier);
      if (customerId != null && customerId.isNotEmpty) {
        notifier.filterByCustomer(customerId);
      } else {
        notifier.loadSales();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(saleListProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = context.l10n;
    final state = ref.watch(saleListProvider);

    final loaded = state is SaleListLoaded ? state : null;
    final items = loaded?.sales ?? const <Sale>[];

    final filteredCustomerId =
        GoRouterState.of(context).uri.queryParameters['customerId'];
    final customerFilterActive = filteredCustomerId?.isNotEmpty ?? false;

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (customerFilterActive) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              color: theme.colorScheme.primaryContainer,
              child: Row(
                children: [
                  Icon(Icons.history,
                      size: 16, color: theme.colorScheme.onPrimaryContainer),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      l10n.saleHistoryBanner,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onPrimaryContainer,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () =>
                        context.go(RouteNames.sales),
                    child: Text(l10n.clearFilter),
                  ),
                ],
              ),
            ),
          ],
          PageHeader(
            title: l10n.sales,
            subtitle: customerFilterActive
                ? l10n.saleHistoryCustomerSubtitle
                : l10n.saleHistorySubtitle,
            actions: [
              FilledButton.icon(
                onPressed: () => context.push(RouteNames.saleNew),
                icon: const Icon(Icons.add, size: 18),
                label: Text(l10n.newSale),
              ),
            ],
          ),
          Expanded(
            child: EntityTable<Sale>(
              items: items,
              total: loaded?.total ?? 0,
              hasMore: loaded?.hasMore ?? false,
              isLoading: state is SaleListLoading,
              isRefreshing: loaded?.isRefreshing ?? false,
              isLoadingMore: loaded?.isLoadingMore ?? false,
              onLoadMore: _onScroll,
              search: loaded?.search,
              searchHint: l10n.saleSearchHint,
              onSearch: (q) => ref.read(saleListProvider.notifier).search(q),
              onRefresh: () => ref.read(saleListProvider.notifier).refresh(),
              onCreate: () => context.push(RouteNames.saleNew),
              createLabel: l10n.newSale,
              filters: [
                EntityFilter(l10n.all, null),
                EntityFilter(l10n.statusDraft, 'DRAFT'),
                EntityFilter(l10n.statusCompleted, 'COMPLETED'),
                EntityFilter(l10n.statusRefunded, 'REFUNDED'),
                EntityFilter(l10n.statusCancelled, 'CANCELLED'),
              ],
              onFilter: (v) =>
                  ref.read(saleListProvider.notifier).filterByStatus(v),
              exportFileName: 'sales.csv',
              exportHeaders: const [
                'Number',
                'Date',
                'Status',
                'Subtotal',
                'Tax',
                'Total',
                'Paid',
              ],
              exportRows: () => [
                for (final s in items)
                  [
                    s.saleNumber,
                    s.createdAt.toIso8601String(),
                    s.status,
                    s.subtotal,
                    s.tax,
                    s.total,
                    s.paidAmount,
                  ],
              ],
              columns: [
                DataColumn(label: Text(l10n.sale)),
                DataColumn(label: Text(l10n.date)),
                DataColumn(label: Text(l10n.status)),
                DataColumn(
                  label: Text(l10n.total, style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(
                  label: Text(l10n.paid, style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(
                  label: Text(l10n.payment, style: theme.textTheme.labelMedium),
                ),
              ],
              buildRow: (s) => DataRow(
                cells: [
                  DataCell(Text(
                    s.saleNumber,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  )),
                  DataCell(Text(Formatters.dateTime(s.createdAt))),
                  DataCell(StatusBadge(status: s.status)),
                  DataCell(Text(context.money(s.total))),
                  DataCell(Text(context.money(s.paidAmount))),
                  DataCell(Text(_paymentLabel(s.payments))),
                ],
              ),
              buildCard: (s) => SaleCard(
                sale: s,
                onTap: () => context.push('${RouteNames.saleDetail.replaceAll(':id', s.id)}'),
              ),
              onRowTap: (s) =>
                  context.push('${RouteNames.saleDetail.replaceAll(':id', s.id)}'),
              emptyTitle: l10n.noSalesFound,
              emptySubtitle: l10n.noSalesFoundSubtitle,
              emptyIcon: Icons.receipt_long_outlined,
              errorMessage:
                  state is SaleListError ? (state as SaleListError).message : null,
              onRetry: () => ref.read(saleListProvider.notifier).loadSales(),
            ),
          ),
        ],
      ),
    );
  }

  String _paymentLabel(List<Payment> payments) {
    if (payments.isEmpty) return '-';
    final methods =
        payments.map((p) => paymentMethodLabel(p.method, context.l10n)).toSet();
    return methods.join(', ');
  }
}
