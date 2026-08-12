import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/widgets/app_snackbar.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/inventory/presentation/providers/inventory_provider.dart';
import 'package:stockflow/features/inventory/presentation/widgets/inventory_card.dart';
import 'package:stockflow/features/inventory/presentation/widgets/stock_action_dialogs.dart';

class InventoryListScreen extends ConsumerStatefulWidget {
  const InventoryListScreen({super.key});

  @override
  ConsumerState<InventoryListScreen> createState() =>
      _InventoryListScreenState();
}

class _InventoryListScreenState extends ConsumerState<InventoryListScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(inventoryListProvider.notifier).loadInventory();
    });
  }

  Future<void> _openAdjustDialog(InventoryLoaded? loaded) async {
    if (loaded == null || loaded.items.isEmpty) {
      AppSnackbar.info(context, context.l10n.inventoryLoadFirst);
      return;
    }
    await showAdjustmentDialog(
      context,
      items: loaded.items,
      warehouses: loaded.warehouses,
    );
  }

  Future<void> _openTransferDialog(InventoryLoaded? loaded) async {
    if (loaded == null || loaded.items.isEmpty) {
      AppSnackbar.info(context, context.l10n.inventoryLoadFirst);
      return;
    }
    if (loaded.warehouses.length < 2) {
      AppSnackbar.info(context, context.l10n.transferNeedTwoWarehouses);
      return;
    }
    await showTransferDialog(
      context,
      items: loaded.items,
      warehouses: loaded.warehouses,
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(inventoryListProvider);

    final loaded = state is InventoryLoaded ? state : null;
    final items = loaded?.items ?? const <StockItem>[];

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: context.l10n.inventory,
            subtitle: context.l10n.inventorySubtitle,
            actions: [
              OutlinedButton.icon(
                onPressed: () => _openAdjustDialog(loaded),
                icon: const Icon(Icons.tune, size: 18),
                label: Text(context.l10n.inventoryAdjust),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                onPressed: () => _openTransferDialog(loaded),
                icon: const Icon(Icons.swap_horiz, size: 18),
                label: Text(context.l10n.inventoryTransfer),
              ),
            ],
          ),
          Expanded(
            child: EntityTable<StockItem>(
              items: items,
              total: loaded?.total ?? items.length,
              isLoading: state is InventoryLoading,
              isRefreshing: loaded?.isRefreshing ?? false,
              search: loaded?.search,
              searchHint: context.l10n.searchByNameSkuBarcode,
              onSearch: (q) =>
                  ref.read(inventoryListProvider.notifier).search(q),
              onRefresh: () =>
                  ref.read(inventoryListProvider.notifier).refresh(),
              filters: [
                EntityFilter(context.l10n.all, null),
                for (final w in (loaded?.warehouses ?? const <Warehouse>[]))
                  EntityFilter(w.name, w.id),
              ],
              activeFilter: loaded?.warehouseFilter,
              onFilter: (v) =>
                  ref.read(inventoryListProvider.notifier).filterByWarehouse(v),
              exportFileName: 'inventory.csv',
              exportHeaders: [
                context.l10n.product,
                context.l10n.sku,
                context.l10n.warehouse,
                context.l10n.quantity,
                context.l10n.reserved,
                context.l10n.available,
                context.l10n.min,
              ],
              exportRows: () => [
                for (final i in items)
                  [
                    i.productName,
                    i.productSku,
                    i.warehouse?.name ?? '',
                    i.quantity.toString(),
                    i.reservedQuantity.toString(),
                    i.availableQuantity.toString(),
                    i.minQuantity.toString(),
                  ],
              ],
              columns: [
                DataColumn(label: Text(context.l10n.product)),
                DataColumn(label: Text(context.l10n.sku)),
                DataColumn(label: Text(context.l10n.warehouse)),
                DataColumn(
                  label: Text(context.l10n.qty,
                      style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(
                  label: Text(context.l10n.reserved,
                      style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(
                  label: Text(context.l10n.available,
                      style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(
                  label: Text(context.l10n.level,
                      style: theme.textTheme.labelMedium),
                ),
              ],
              buildRow: (i) => DataRow(
                cells: [
                  DataCell(Text(
                    i.productName,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  )),
                  DataCell(Text(i.productSku.isEmpty ? '-' : i.productSku)),
                  DataCell(Text(i.warehouse?.name ?? '-')),
                  DataCell(Text('${i.quantity}')),
                  DataCell(Text('${i.reservedQuantity}')),
                  DataCell(Text(
                    '${i.availableQuantity}',
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      color: i.availableQuantity <= i.minQuantity
                          ? theme.colorScheme.error
                          : null,
                    ),
                  )),
                  DataCell(_LevelBadge(item: i)),
                ],
              ),
              buildCard: (i) => InventoryCard(item: i, onTap: () {}),
              emptyTitle: context.l10n.inventoryEmptyTitle,
              emptySubtitle: context.l10n.inventoryEmptySubtitle,
              emptyIcon: Icons.inventory_2_outlined,
              errorMessage: state is InventoryError
                  ? (state as InventoryError).message
                  : null,
              onRetry: () =>
                  ref.read(inventoryListProvider.notifier).loadInventory(),
            ),
          ),
        ],
      ),
    );
  }
}

class _LevelBadge extends StatelessWidget {
  final StockItem item;

  const _LevelBadge({required this.item});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final l10n = context.l10n;
    final available = item.availableQuantity;
    final (String label, Color color) = available <= 0
        ? (l10n.levelOut, theme.colorScheme.error)
        : available <= item.minQuantity
            ? (l10n.levelLow, const Color(0xFFFB8C00))
            : (l10n.levelOk, const Color(0xFF0F9D58));

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 11,
        ),
      ),
    );
  }
}
