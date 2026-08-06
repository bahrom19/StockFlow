import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
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
                      'Showing purchase history for this customer',
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onPrimaryContainer,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () =>
                        context.go(RouteNames.sales),
                    child: const Text('Clear filter'),
                  ),
                ],
              ),
            ),
          ],
          PageHeader(
            title: 'Sales',
            subtitle: customerFilterActive
                ? 'Purchase history for this customer'
                : 'Transactions, refunds and cash flow',
            actions: [
              FilledButton.icon(
                onPressed: () => context.push(RouteNames.saleNew),
                icon: const Icon(Icons.add, size: 18),
                label: const Text('New Sale'),
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
              searchHint: 'Search by sale number…',
              onSearch: (q) => ref.read(saleListProvider.notifier).search(q),
              onRefresh: () => ref.read(saleListProvider.notifier).refresh(),
              onCreate: () => context.push(RouteNames.saleNew),
              createLabel: 'New Sale',
              filters: const [
                EntityFilter('All', null),
                EntityFilter('Draft', 'DRAFT'),
                EntityFilter('Completed', 'COMPLETED'),
                EntityFilter('Refunded', 'REFUNDED'),
                EntityFilter('Cancelled', 'CANCELLED'),
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
                const DataColumn(label: Text('Sale')),
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
                DataColumn(
                  label: Text('Payment', style: theme.textTheme.labelMedium),
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
                  DataCell(Text(Formatters.currency(s.total))),
                  DataCell(Text(Formatters.currency(s.paidAmount))),
                  DataCell(Text(_paymentLabel(s.payments))),
                ],
              ),
              buildCard: (s) => SaleCard(
                sale: s,
                onTap: () => context.push('${RouteNames.saleDetail.replaceAll(':id', s.id)}'),
              ),
              onRowTap: (s) =>
                  context.push('${RouteNames.saleDetail.replaceAll(':id', s.id)}'),
              emptyTitle: 'No sales found',
              emptySubtitle: 'Complete your first sale to see it here',
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
    final methods = payments.map((p) => Formatters.status(p.method)).toSet();
    return methods.join(', ');
  }
}
