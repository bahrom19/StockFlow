import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/customers/domain/customer_models.dart';
import 'package:stockflow/features/customers/presentation/providers/customers_provider.dart';

/// Customers management screen — desktop-first DataTable.
class CustomersListScreen extends ConsumerStatefulWidget {
  const CustomersListScreen({super.key});

  @override
  ConsumerState<CustomersListScreen> createState() =>
      _CustomersListScreenState();
}

class _CustomersListScreenState extends ConsumerState<CustomersListScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    Future.microtask(() {
      ref.read(customersListProvider.notifier).loadCustomers();
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
      ref.read(customersListProvider.notifier).loadMore();
    }
  }

  Future<void> _confirmDelete(Customer customer) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete customer?'),
        content: Text('Customer "${customer.displayName}" will be archived.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final ok = await ref.read(customersListProvider.notifier).delete(customer.id);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ok ? 'Customer deleted' : 'Delete failed')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(customersListProvider);

    final loaded = state is CustomersListLoaded ? state : null;
    final items = loaded?.customers ?? const <Customer>[];

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: 'Customers',
            subtitle: 'Manage your customer base, contacts and loyalty',
          ),
          Expanded(
            child: EntityTable<Customer>(
              items: items,
              total: loaded?.total ?? 0,
              hasMore: loaded?.hasMore ?? false,
              isLoading: state is CustomersListLoading,
              isRefreshing: loaded?.isRefreshing ?? false,
              isLoadingMore: loaded?.isLoadingMore ?? false,
              onLoadMore: _onScroll,
              search: loaded?.search,
              searchHint: 'Search by name, phone or email…',
              onSearch: (q) =>
                  ref.read(customersListProvider.notifier).search(q),
              onRefresh: () =>
                  ref.read(customersListProvider.notifier).refresh(),
              onCreate: () => context.push(RouteNames.customerNew),
              createLabel: 'New Customer',
              filters: const [
                EntityFilter('All', null),
                EntityFilter('People', 'PERSON'),
                EntityFilter('Companies', 'COMPANY'),
              ],
              activeFilter: loaded?.typeFilter,
              onFilter: (v) =>
                  ref.read(customersListProvider.notifier).filterByType(v),
              exportFileName: 'customers.csv',
              exportHeaders: const [
                'Name',
                'Type',
                'Phone',
                'Email',
                'Bonus Points',
                'Debt',
                'Status',
              ],
              exportRows: () => [
                for (final c in items)
                  [
                    c.displayName,
                    c.type,
                    c.phoneOrMobile,
                    c.email ?? '',
                    c.bonusPoints.toString(),
                    c.currentDebt ?? '',
                    c.isActive ? 'Active' : 'Inactive',
                  ],
              ],
              columns: [
                const DataColumn(label: Text('Customer')),
                const DataColumn(label: Text('Type')),
                const DataColumn(label: Text('Phone')),
                const DataColumn(label: Text('Email')),
                const DataColumn(label: Text('Bonus')),
                const DataColumn(label: Text('Status')),
                DataColumn(
                  label: Text(
                    'Actions',
                    style: theme.textTheme.labelMedium,
                  ),
                ),
              ],
              buildRow: (c) => DataRow(
                cells: [
                  DataCell(Text(c.displayName,
                      style: const TextStyle(fontWeight: FontWeight.w600))),
                  DataCell(Text(CustomerType.fromApi(c.type).label)),
                  DataCell(Text(c.phoneOrMobile.isEmpty ? '-' : c.phoneOrMobile)),
                  DataCell(Text(c.email ?? '-')),
                  DataCell(Text('${c.bonusPoints}')),
                  DataCell(StatusBadge(
                    status: c.isActive ? 'ACTIVE' : 'INACTIVE',
                  )),
                  DataCell(
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: 'Edit',
                          icon: const Icon(Icons.edit_outlined, size: 18),
                          onPressed: () => context.push(
                            '${RouteNames.customerDetail.replaceAll(':id', c.id)}',
                          ),
                        ),
                        IconButton(
                          tooltip: 'Delete',
                          icon: Icon(
                            Icons.delete_outline,
                            size: 18,
                            color: theme.colorScheme.error,
                          ),
                          onPressed: () => _confirmDelete(c),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              onRowTap: (c) => context.push(
                '${RouteNames.customerDetail.replaceAll(':id', c.id)}',
              ),
              emptyTitle: 'No customers yet',
              emptySubtitle: 'Add your first customer to start building relationships',
              emptyIcon: Icons.people_outline,
              errorMessage: state is CustomersListError
                  ? (state as CustomersListError).message
                  : null,
              onRetry: () =>
                  ref.read(customersListProvider.notifier).loadCustomers(),
            ),
          ),
        ],
      ),
    );
  }
}
