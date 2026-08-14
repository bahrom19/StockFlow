import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/navigation/route_names.dart';
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
        title: Text(ctx.l10n.deleteCustomerTitle),
        content: Text(ctx.l10n.deleteCustomerConfirm(customer.displayName)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(ctx.l10n.cancel),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(ctx.l10n.delete),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final ok = await ref.read(customersListProvider.notifier).delete(customer.id);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok ? context.l10n.customerDeleted : context.l10n.deleteFailed,
        ),
      ),
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
            title: context.l10n.customers,
            subtitle: context.l10n.customersSubtitle,
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
              searchHint: context.l10n.customersSearchHint,
              onSearch: (q) =>
                  ref.read(customersListProvider.notifier).search(q),
              onRefresh: () =>
                  ref.read(customersListProvider.notifier).refresh(),
              onCreate: () => context.push(RouteNames.customerNew),
              createLabel: context.l10n.newCustomer,
              filters: [
                EntityFilter(context.l10n.all, null),
                EntityFilter(context.l10n.people, 'PERSON'),
                EntityFilter(context.l10n.companies, 'COMPANY'),
              ],
              activeFilter: loaded?.typeFilter,
              onFilter: (v) =>
                  ref.read(customersListProvider.notifier).filterByType(v),
              exportFileName: 'customers.csv',
              exportHeaders: [
                context.l10n.name,
                context.l10n.type,
                context.l10n.phone,
                context.l10n.email,
                context.l10n.bonusPoints,
                context.l10n.debt,
                context.l10n.status,
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
                DataColumn(label: Text(context.l10n.customer)),
                DataColumn(label: Text(context.l10n.type)),
                DataColumn(label: Text(context.l10n.phone)),
                DataColumn(label: Text(context.l10n.email)),
                DataColumn(label: Text(context.l10n.bonus)),
                DataColumn(label: Text(context.l10n.status)),
                DataColumn(
                  label: Text(
                    context.l10n.actions,
                    style: theme.textTheme.labelMedium,
                  ),
                ),
              ],
              buildRow: (c) => DataRow(
                cells: [
                  DataCell(Text(c.displayName,
                      style: const TextStyle(fontWeight: FontWeight.w600))),
                  DataCell(Text(_customerTypeLabel(c.type, context.l10n))),
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
                          tooltip: context.l10n.purchaseHistory,
                          icon: const Icon(Icons.history, size: 18),
                          onPressed: () => context.push(
                            '${RouteNames.sales}?customerId=${c.id}',
                          ),
                        ),
                        IconButton(
                          tooltip: context.l10n.edit,
                          icon: const Icon(Icons.edit_outlined, size: 18),
                          onPressed: () => context.push(
                            '${RouteNames.customerDetail.replaceAll(':id', c.id)}',
                          ),
                        ),
                        IconButton(
                          tooltip: context.l10n.delete,
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
              emptyTitle: context.l10n.noCustomersYet,
              emptySubtitle: context.l10n.noCustomersSubtitle,
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

/// UI-layer label for the backend customer-type code (PERSON | COMPANY).
/// Unknown codes fall back to the raw value — never invent new enum values
/// on the client.
String _customerTypeLabel(String type, AppLocalizations l10n) {
  switch (type) {
    case 'PERSON':
      return l10n.customerPerson;
    case 'COMPANY':
      return l10n.customerCompany;
    default:
      return type;
  }
}
