import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
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
            title: context.l10n.suppliers,
            subtitle: context.l10n.suppliersSubtitle,
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
              searchHint: context.l10n.suppliersSearchHint,
              onSearch: (q) =>
                  ref.read(supplierListProvider.notifier).search(q),
              onRefresh: () =>
                  ref.read(supplierListProvider.notifier).refresh(),
              onCreate: () => context.push(RouteNames.supplierNew),
              createLabel: context.l10n.newSupplier,
              exportFileName: 'suppliers.csv',
              exportHeaders: [
                context.l10n.company,
                context.l10n.bin,
                context.l10n.phone,
                context.l10n.email,
                context.l10n.website,
                context.l10n.status,
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
                DataColumn(label: Text(context.l10n.company)),
                DataColumn(label: Text(context.l10n.bin)),
                DataColumn(label: Text(context.l10n.phone)),
                DataColumn(label: Text(context.l10n.email)),
                DataColumn(label: Text(context.l10n.status)),
                DataColumn(
                  label: Text(context.l10n.actions,
                      style: theme.textTheme.labelMedium),
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
                      tooltip: context.l10n.edit,
                      icon: const Icon(Icons.edit_outlined, size: 18),
                      onPressed: () =>
                          context.push('/suppliers/${s.id}/edit'),
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
              emptyTitle: context.l10n.noSuppliersFound,
              emptySubtitle: context.l10n.suppliersEmptySubtitle,
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
