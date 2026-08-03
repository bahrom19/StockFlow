import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/warehouses/presentation/providers/warehouses_provider.dart';

/// Warehouses management screen — desktop-first DataTable with search,
/// CSV export and full CRUD.
class WarehousesListScreen extends ConsumerStatefulWidget {
  const WarehousesListScreen({super.key});

  @override
  ConsumerState<WarehousesListScreen> createState() =>
      _WarehousesListScreenState();
}

class _WarehousesListScreenState extends ConsumerState<WarehousesListScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(warehouseListProvider.notifier).loadWarehouses();
    });
  }

  Future<void> _confirmDelete(Warehouse warehouse) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete warehouse?'),
        content: Text(
          'Warehouse "${warehouse.name}" (${warehouse.code}) will be archived. '
          'This cannot be undone.',
        ),
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

    final notifier = ref.read(warehouseListProvider.notifier);
    final ok = await notifier.delete(warehouse.id);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(ok ? 'Warehouse deleted' : 'Delete failed')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(warehouseListProvider);

    final loaded = state is WarehouseListLoaded ? state : null;
    final items = loaded?.warehouses ?? const <Warehouse>[];

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: 'Warehouses',
            subtitle: 'Manage your storage locations and default warehouse',
          ),
          Expanded(
            child: EntityTable<Warehouse>(
              items: items,
              total: items.length,
              isLoading: state is WarehouseListLoading,
              isRefreshing: loaded?.isRefreshing ?? false,
              search: loaded?.search,
              searchHint: 'Search by name or code…',
              onSearch: (q) =>
                  ref.read(warehouseListProvider.notifier).search(q),
              onRefresh: () =>
                  ref.read(warehouseListProvider.notifier).refresh(),
              onCreate: () => context.push(RouteNames.warehouseNew),
              createLabel: 'New Warehouse',
              exportFileName: 'warehouses.csv',
              exportHeaders: const [
                'Name',
                'Code',
                'Address',
                'Phone',
                'Manager',
                'Default',
                'Status',
              ],
              exportRows: () => [
                for (final w in items)
                  [
                    w.name,
                    w.code,
                    w.address ?? '',
                    w.phone ?? '',
                    w.managerName ?? '',
                    w.isDefault ? 'Yes' : 'No',
                    w.isActive ? 'Active' : 'Inactive',
                  ],
              ],
              columns: [
                const DataColumn(label: Text('Warehouse')),
                const DataColumn(label: Text('Code')),
                const DataColumn(label: Text('Address')),
                const DataColumn(label: Text('Manager')),
                const DataColumn(label: Text('Default')),
                const DataColumn(label: Text('Status')),
                DataColumn(
                  label: Text(
                    'Actions',
                    style: theme.textTheme.labelMedium,
                  ),
                ),
              ],
              buildRow: (w) => DataRow(
                cells: [
                  DataCell(Text(w.name,
                      style: const TextStyle(fontWeight: FontWeight.w600))),
                  DataCell(Text(w.code)),
                  DataCell(Text(w.address ?? '-')),
                  DataCell(Text(w.managerName ?? '-')),
                  DataCell(
                    w.isDefault
                        ? const Icon(Icons.star, color: Colors.amber, size: 18)
                        : const Text('-'),
                  ),
                  DataCell(StatusBadge(
                    status: w.isActive ? 'ACTIVE' : 'INACTIVE',
                  )),
                  DataCell(
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: 'Edit',
                          icon: const Icon(Icons.edit_outlined, size: 18),
                          onPressed: () => context
                              .push('${RouteNames.warehouseEdit.replaceAll(':id', w.id)}'),
                        ),
                        IconButton(
                          tooltip: 'Delete',
                          icon: Icon(
                            Icons.delete_outline,
                            size: 18,
                            color: theme.colorScheme.error,
                          ),
                          onPressed: () => _confirmDelete(w),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              onRowTap: (w) => context
                  .push('${RouteNames.warehouseEdit.replaceAll(':id', w.id)}'),
              emptyTitle: 'No warehouses',
              emptySubtitle: 'Create your first warehouse to start tracking stock',
              emptyIcon: Icons.warehouse_outlined,
              errorMessage: state is WarehouseListError
                  ? (state as WarehouseListError).message
                  : null,
              onRetry: () =>
                  ref.read(warehouseListProvider.notifier).loadWarehouses(),
            ),
          ),
        ],
      ),
    );
  }
}
