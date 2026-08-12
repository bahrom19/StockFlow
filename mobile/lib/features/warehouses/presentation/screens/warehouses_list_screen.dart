import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
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
        title: Text(ctx.l10n.deleteWarehouseTitle),
        content: Text(
          ctx.l10n.deleteWarehouseConfirm(warehouse.name, warehouse.code),
        ),
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

    final notifier = ref.read(warehouseListProvider.notifier);
    final ok = await notifier.delete(warehouse.id);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok ? context.l10n.warehouseDeleted : context.l10n.deleteFailed,
        ),
      ),
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
            title: context.l10n.warehouses,
            subtitle: context.l10n.warehousesSubtitle,
          ),
          Expanded(
            child: EntityTable<Warehouse>(
              items: items,
              total: items.length,
              isLoading: state is WarehouseListLoading,
              isRefreshing: loaded?.isRefreshing ?? false,
              search: loaded?.search,
              searchHint: context.l10n.searchByNameOrCode,
              onSearch: (q) =>
                  ref.read(warehouseListProvider.notifier).search(q),
              onRefresh: () =>
                  ref.read(warehouseListProvider.notifier).refresh(),
              onCreate: () => context.push(RouteNames.warehouseNew),
              createLabel: context.l10n.newWarehouse,
              exportFileName: 'warehouses.csv',
              exportHeaders: [
                context.l10n.name,
                context.l10n.code,
                context.l10n.address,
                context.l10n.phone,
                context.l10n.managerName,
                context.l10n.defaultLabel,
                context.l10n.status,
              ],
              exportRows: () => [
                for (final w in items)
                  [
                    w.name,
                    w.code,
                    w.address ?? '',
                    w.phone ?? '',
                    w.managerName ?? '',
                    w.isDefault ? context.l10n.yes : context.l10n.no,
                    w.isActive
                        ? context.l10n.statusActive
                        : context.l10n.statusInactive,
                  ],
              ],
              columns: [
                DataColumn(label: Text(context.l10n.warehouse)),
                DataColumn(label: Text(context.l10n.code)),
                DataColumn(label: Text(context.l10n.address)),
                DataColumn(label: Text(context.l10n.managerName)),
                DataColumn(label: Text(context.l10n.defaultLabel)),
                DataColumn(label: Text(context.l10n.status)),
                DataColumn(
                  label: Text(
                    context.l10n.actions,
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
                          tooltip: context.l10n.edit,
                          icon: const Icon(Icons.edit_outlined, size: 18),
                          onPressed: () => context
                              .push('${RouteNames.warehouseEdit.replaceAll(':id', w.id)}'),
                        ),
                        IconButton(
                          tooltip: context.l10n.delete,
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
              emptyTitle: context.l10n.warehousesEmptyTitle,
              emptySubtitle: context.l10n.warehousesEmptySubtitle,
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
