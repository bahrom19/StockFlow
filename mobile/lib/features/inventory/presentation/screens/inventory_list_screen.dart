import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/inventory/presentation/providers/inventory_provider.dart';
import 'package:stockflow/features/inventory/presentation/widgets/inventory_card.dart';

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
            title: 'Inventory',
            subtitle: 'Live stock levels across all warehouses',
          ),
          Expanded(
            child: EntityTable<StockItem>(
              items: items,
              total: loaded?.total ?? items.length,
              isLoading: state is InventoryLoading,
              isRefreshing: loaded?.isRefreshing ?? false,
              search: loaded?.search,
              searchHint: 'Search by name, SKU or barcode…',
              onSearch: (q) =>
                  ref.read(inventoryListProvider.notifier).search(q),
              onRefresh: () =>
                  ref.read(inventoryListProvider.notifier).refresh(),
              filters: [
                EntityFilter('All', null),
                for (final w in (loaded?.warehouses ?? const <Warehouse>[]))
                  EntityFilter(w.name, w.id),
              ],
              activeFilter: loaded?.warehouseFilter,
              onFilter: (v) =>
                  ref.read(inventoryListProvider.notifier).filterByWarehouse(v),
              exportFileName: 'inventory.csv',
              exportHeaders: const [
                'Product',
                'SKU',
                'Warehouse',
                'Quantity',
                'Reserved',
                'Available',
                'Min',
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
                const DataColumn(label: Text('Product')),
                const DataColumn(label: Text('SKU')),
                const DataColumn(label: Text('Warehouse')),
                DataColumn(
                  label: Text('Qty', style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(
                  label: Text('Reserved', style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(
                  label: Text('Available', style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(
                  label: Text('Level', style: theme.textTheme.labelMedium),
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
              emptyTitle: 'No inventory items found',
              emptySubtitle:
                  'Stock data will appear once products are sold or received',
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
    final available = item.availableQuantity;
    final (String label, Color color) = available <= 0
        ? ('Out', theme.colorScheme.error)
        : available <= item.minQuantity
            ? ('Low', const Color(0xFFFB8C00))
            : ('OK', const Color(0xFF0F9D58));

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
