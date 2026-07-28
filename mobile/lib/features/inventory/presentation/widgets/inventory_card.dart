import 'package:flutter/material.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';

class InventoryCard extends StatelessWidget {
  final StockItem item;
  final VoidCallback onTap;

  const InventoryCard({super.key, required this.item, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final available = item.availableQuantity;
    final reserved = item.reservedQuantity;
    final lowStock = available > 0 && available <= item.minQuantity;
    final outOfStock = available <= 0;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(item.productName,
                        style: theme.textTheme.bodyMedium
                            ?.copyWith(fontWeight: FontWeight.w600)),
                  ),
                  StockBadge(
                    quantity: available,
                    lowStock: lowStock,
                    outOfStock: outOfStock,
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  if (item.productSku.isNotEmpty)
                    Text(item.productSku,
                        style: theme.textTheme.labelSmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant)),
                  const Spacer(),
                  Text('$available available',
                      style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  if (item.warehouse != null)
                    WarehouseChip(warehouse: item.warehouse!),
                  const Spacer(),
                  Text('Reserved: $reserved',
                      style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class InventoryCardSkeleton extends StatelessWidget {
  const InventoryCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    final s = Theme.of(context).colorScheme.surfaceContainerHighest;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
                width: 160, height: 14,
                decoration: BoxDecoration(
                    color: s, borderRadius: BorderRadius.circular(4))),
            const SizedBox(height: 8),
            Container(
                width: 100, height: 12,
                decoration: BoxDecoration(
                    color: s, borderRadius: BorderRadius.circular(4))),
            const SizedBox(height: 8),
            Container(
                width: 80, height: 20,
                decoration: BoxDecoration(
                    color: s, borderRadius: BorderRadius.circular(4))),
          ],
        ),
      ),
    );
  }
}

class StockBadge extends StatelessWidget {
  final int quantity;
  final bool lowStock;
  final bool outOfStock;

  const StockBadge({
    super.key,
    required this.quantity,
    this.lowStock = false,
    this.outOfStock = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (Color color, String label) = outOfStock
        ? (DesignTokens.statusCancelled, 'Out')
        : lowStock
            ? (DesignTokens.warning, 'Low')
            : (DesignTokens.success, quantity.toString());

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label,
          style: theme.textTheme.labelSmall?.copyWith(
              color: color, fontWeight: FontWeight.w600, fontSize: 11)),
    );
  }
}

class WarehouseChip extends StatelessWidget {
  final Warehouse warehouse;
  const WarehouseChip({super.key, required this.warehouse});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: theme.colorScheme.primaryContainer,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.warehouse, size: 10,
              color: theme.colorScheme.onPrimaryContainer),
          const SizedBox(width: 4),
          Text(warehouse.name,
              style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onPrimaryContainer, fontSize: 10)),
        ],
      ),
    );
  }
}

class MovementTile extends StatelessWidget {
  final StockMovement movement;
  const MovementTile({super.key, required this.movement});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (IconData icon, Color color) = _movementIcon(movement.type);

    return ListTile(
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: color.withOpacity(0.12),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: color, size: 18),
      ),
      title: Text(movement.type.movementLabel,
          style: theme.textTheme.bodyMedium
              ?.copyWith(fontWeight: FontWeight.w600)),
      subtitle: Text('${movement.beforeQuantity} → ${movement.afterQuantity}',
          style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant)),
      trailing: Text(
        movement.quantity >= 0 ? '+${movement.quantity}' : movement.quantity.toString(),
        style: theme.textTheme.titleSmall?.copyWith(
          fontWeight: FontWeight.bold,
          color: movement.quantity >= 0 ? DesignTokens.success : DesignTokens.error,
        ),
      ),
    );
  }

  (IconData, Color) _movementIcon(String type) {
    switch (type) {
      case 'SALE': return (Icons.shopping_cart, DesignTokens.primary);
      case 'PURCHASE': return (Icons.add_shopping_cart, DesignTokens.success);
      case 'TRANSFER_IN': return (Icons.arrow_back, DesignTokens.info);
      case 'TRANSFER_OUT': return (Icons.arrow_forward, DesignTokens.warning);
      case 'ADJUSTMENT': return (Icons.tune, DesignTokens.accent);
      case 'RETURN': return (Icons.replay, DesignTokens.info);
      case 'LOSS': return (Icons.remove_circle, DesignTokens.error);
      case 'CORRECTION': return (Icons.edit, DesignTokens.warning);
      default: return (Icons.circle, DesignTokens.grey500);
    }
  }
}
