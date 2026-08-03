import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/suppliers/domain/supplier_models.dart';
import 'package:stockflow/features/suppliers/presentation/providers/suppliers_provider.dart';
import 'package:stockflow/features/suppliers/presentation/widgets/supplier_widgets.dart';

class SuppliersListScreen extends ConsumerStatefulWidget {
  const SuppliersListScreen({super.key});
  @override
  ConsumerState<SuppliersListScreen> createState() =>
      _SuppliersListScreenState();
}

class _SuppliersListScreenState extends ConsumerState<SuppliersListScreen> {
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    Future.microtask(
        () => ref.read(supplierListProvider.notifier).loadSuppliers());
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(supplierListProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(supplierListProvider);

    final loaded = state is SupplierListLoaded ? state : null;
    final items = loaded?.suppliers ?? const <Supplier>[];

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: 'Suppliers',
            subtitle: 'Manage vendors, contracts and purchasing partners',
          ),
          Expanded(
            child: EntityTable<Supplier>(
              items: items,
              total: loaded?.total ?? 0,
              hasMore: loaded?.hasMore ?? false,
              isLoading: state is SupplierListLoading,
              isRefreshing: loaded?.isRefreshing ?? false,
              isLoadingMore: loaded?.isLoadingMore ?? false,
              onLoadMore: _onScroll,
              search: loaded?.search,
              searchHint: 'Search by company name or BIN…',
              onSearch: (q) =>
                  ref.read(supplierListProvider.notifier).search(q),
              onRefresh: () =>
                  ref.read(supplierListProvider.notifier).refresh(),
              onCreate: () => context.push(RouteNames.supplierNew),
              createLabel: 'New Supplier',
              exportFileName: 'suppliers.csv',
              exportHeaders: const [
                'Company',
                'BIN',
                'Phone',
                'Email',
                'Website',
                'Status',
              ],
              exportRows: () => [
                for (final s in items)
                  [
                    s.companyName,
                    s.bin ?? '',
                    s.phone ?? '',
                    s.email ?? '',
                    s.website ?? '',
                    s.isActive ? 'Active' : 'Inactive',
                  ],
              ],
              columns: [
                const DataColumn(label: Text('Company')),
                const DataColumn(label: Text('BIN')),
                const DataColumn(label: Text('Phone')),
                const DataColumn(label: Text('Email')),
                const DataColumn(label: Text('Status')),
                DataColumn(
                  label: Text('Actions', style: theme.textTheme.labelMedium),
                ),
              ],
              buildRow: (s) => DataRow(
                cells: [
                  DataCell(Text(
                    s.companyName,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  )),
                  DataCell(Text(s.bin ?? '-')),
                  DataCell(Text(s.phone ?? '-')),
                  DataCell(Text(s.email ?? '-')),
                  DataCell(StatusBadge(
                    status: s.isActive ? 'ACTIVE' : 'INACTIVE',
                  )),
                  DataCell(
                    IconButton(
                      tooltip: 'Edit',
                      icon: const Icon(Icons.edit_outlined, size: 18),
                      onPressed: () =>
                          context.push('${RouteNames.supplierDetail.replaceAll(':id', s.id)}'),
                    ),
                  ),
                ],
              ),
              buildCard: (s) => SupplierCard(
                supplier: s,
                onTap: () =>
                    context.push('${RouteNames.supplierDetail.replaceAll(':id', s.id)}'),
              ),
              onRowTap: (s) =>
                  context.push('${RouteNames.supplierDetail.replaceAll(':id', s.id)}'),
              emptyTitle: 'No suppliers found',
              emptySubtitle: 'Add your first supplier to start purchasing',
              emptyIcon: Icons.business_outlined,
              errorMessage: state is SupplierListError
                  ? (state as SupplierListError).message
                  : null,
              onRetry: () =>
                  ref.read(supplierListProvider.notifier).loadSuppliers(),
            ),
          ),
        ],
      ),
    );
  }
}
