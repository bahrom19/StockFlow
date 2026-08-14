import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';
import 'package:stockflow/features/purchasing/presentation/providers/purchasing_provider.dart';
import 'package:stockflow/features/purchasing/presentation/widgets/purchasing_widgets.dart';
import 'package:stockflow/core/currency/currency_ext.dart';

class PurchaseOrderListScreen extends ConsumerStatefulWidget {
  const PurchaseOrderListScreen({super.key});
  @override
  ConsumerState<PurchaseOrderListScreen> createState() =>
      _PurchaseOrderListScreenState();
}

class _PurchaseOrderListScreenState
    extends ConsumerState<PurchaseOrderListScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    Future.microtask(() => ref.read(poListProvider.notifier).loadOrders());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(poListProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(poListProvider);

    final loaded = state is POListLoaded ? state : null;
    final items = loaded?.orders ?? const <PurchaseOrder>[];

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: 'Purchasing',
            subtitle: 'Purchase orders, goods receipts and returns',
          ),
          Expanded(
            child: EntityTable<PurchaseOrder>(
              items: items,
              total: loaded?.total ?? 0,
              hasMore: loaded?.hasMore ?? false,
              isLoading: state is POListLoading,
              isRefreshing: loaded?.isRefreshing ?? false,
              isLoadingMore: loaded?.isLoadingMore ?? false,
              onLoadMore: _onScroll,
              search: loaded?.search,
              searchHint: 'Search by order number…',
              onSearch: (q) => ref.read(poListProvider.notifier).search(q),
              onRefresh: () => ref.read(poListProvider.notifier).refresh(),
              onCreate: () => context.push(RouteNames.poNew),
              createLabel: 'New Order',
              filters: const [
                EntityFilter('All', null),
                EntityFilter('Draft', 'DRAFT'),
                EntityFilter('Pending', 'PENDING'),
                EntityFilter('Approved', 'APPROVED'),
                EntityFilter('Received', 'RECEIVED'),
                EntityFilter('Cancelled', 'CANCELLED'),
              ],
              activeFilter: loaded?.search,
              onFilter: (v) {
                if (v != null) {
                  ref.read(poListProvider.notifier).filterByStatus(v);
                }
              },
              exportFileName: 'purchase_orders.csv',
              exportHeaders: const [
                'Number',
                'Date',
                'Status',
                'Items',
                'Grand Total',
                'Paid',
              ],
              exportRows: () => [
                for (final o in items)
                  [
                    o.orderNumber,
                    o.orderDate.toIso8601String(),
                    o.status,
                    o.items.length.toString(),
                    o.grandTotal,
                    o.paidAmount,
                  ],
              ],
              columns: [
                const DataColumn(label: Text('Order')),
                const DataColumn(label: Text('Date')),
                const DataColumn(label: Text('Status')),
                DataColumn(
                  label: Text('Items', style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(
                  label: Text('Total', style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(
                  label: Text('Paid', style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
              ],
              buildRow: (o) => DataRow(
                cells: [
                  DataCell(Text(
                    o.orderNumber,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  )),
                  DataCell(Text(Formatters.date(o.orderDate))),
                  DataCell(StatusBadge(status: o.status)),
                  DataCell(Text('${o.items.length}')),
                  DataCell(Text(context.money(o.grandTotal))),
                  DataCell(Text(context.money(o.paidAmount))),
                ],
              ),
              buildCard: (o) => POCard(
                order: o,
                onTap: () =>
                    context.push('${RouteNames.poDetail.replaceAll(':id', o.id)}'),
              ),
              onRowTap: (o) =>
                  context.push('${RouteNames.poDetail.replaceAll(':id', o.id)}'),
              emptyTitle: 'No purchase orders',
              emptySubtitle: 'Create your first purchase order to start',
              emptyIcon: Icons.receipt_outlined,
              errorMessage:
                  state is POListError ? (state as POListError).message : null,
              onRetry: () => ref.read(poListProvider.notifier).loadOrders(),
            ),
          ),
        ],
      ),
    );
  }
}
