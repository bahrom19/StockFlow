import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/widgets/empty_state_widget.dart';
import 'package:stockflow/core/widgets/error_state_widget.dart';
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
  final TextEditingController _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(inventoryListProvider.notifier).loadInventory();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(inventoryListProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Inventory')),
      body: Column(
        children: [
          // Search + filter
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md, AppSpacing.xs, AppSpacing.md, AppSpacing.sm,
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _searchCtrl,
                    decoration: InputDecoration(
                      hintText: 'Search by name, SKU, barcode...',
                      prefixIcon: const Icon(Icons.search, size: 20),
                      suffixIcon: _searchCtrl.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18),
                              onPressed: () {
                                _searchCtrl.clear();
                                ref
                                    .read(inventoryListProvider.notifier)
                                    .search('');
                                setState(() {});
                              },
                            )
                          : null,
                      isDense: true,
                    ),
                    onChanged: (v) {
                      ref.read(inventoryListProvider.notifier).search(v);
                      setState(() {});
                    },
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                _WarehouseFilterButton(),
              ],
            ),
          ),
          // Content
          Expanded(child: _buildContent(theme, state)),
        ],
      ),
    );
  }

  Widget _buildContent(ThemeData theme, InventoryState state) {
    return switch (state) {
      InventoryLoading() => ListView.builder(
          padding: AppSpacing.screenPaddingHorizontal,
          itemCount: 8,
          itemBuilder: (_, __) => const Padding(
                padding: EdgeInsets.only(bottom: AppSpacing.sm),
                child: InventoryCardSkeleton(),
              ),
        ),
      InventoryEmpty(:final message) => EmptyStateWidget(
          title: message,
          subtitle: 'Stock data will appear once products are sold or received',
          icon: Icons.inventory_2_outlined,
        ),
      InventoryError(:final message) => ErrorStateWidget(
          message: message,
          onRetry: () =>
              ref.read(inventoryListProvider.notifier).loadInventory(),
        ),
      InventoryLoaded(:final items) =>
        RefreshIndicator(
          onRefresh: () =>
              ref.read(inventoryListProvider.notifier).refresh(),
          child: ListView.builder(
            padding: AppSpacing.screenPaddingHorizontal,
            itemCount: items.length,
            itemBuilder: (_, i) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: InventoryCard(
                item: items[i],
                onTap: () {}, // navigate to product detail
              ),
            ),
          ),
        ),
    };
  }
}

class _WarehouseFilterButton extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(inventoryListProvider);
    final theme = Theme.of(context);
    final currentFilter = state is InventoryLoaded ? state.warehouseFilter : null;

    return Material(
      color: currentFilter != null
          ? theme.colorScheme.primaryContainer
          : theme.colorScheme.surfaceContainerHighest,
      borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        onTap: () => _showWarehousePicker(context, ref, state),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.warehouse,
                size: 18,
                color: currentFilter != null
                    ? theme.colorScheme.onPrimaryContainer
                    : theme.colorScheme.onSurfaceVariant,
              ),
              if (currentFilter != null) ...[
                const SizedBox(width: 4),
                Text(
                  currentFilter.substring(0, 4),
                  style: theme.textTheme.labelSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _showWarehousePicker(
    BuildContext context,
    WidgetRef ref,
    InventoryState state,
  ) {
    if (state is! InventoryLoaded) return;
    final warehouses = state.warehouses;
    showModalBottomSheet(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Filter by Warehouse',
                  style: TextStyle(fontWeight: FontWeight.w600)),
            ),
            ListTile(
              leading: const Icon(Icons.all_inclusive),
              title: const Text('All Warehouses'),
              onTap: () {
                Navigator.pop(ctx);
                ref.read(inventoryListProvider.notifier).filterByWarehouse(null);
              },
            ),
            ...warehouses.map((w) => ListTile(
                  leading: const Icon(Icons.warehouse),
                  title: Text(w.name),
                  subtitle: w.code.isNotEmpty ? Text(w.code) : null,
                  onTap: () {
                    Navigator.pop(ctx);
                    ref
                        .read(inventoryListProvider.notifier)
                        .filterByWarehouse(w.id);
                  },
                )),
          ],
        ),
      ),
    );
  }
}
