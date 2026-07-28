import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/widgets/empty_state_widget.dart';
import 'package:stockflow/core/widgets/error_state_widget.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/inventory/presentation/providers/inventory_provider.dart';
import 'package:stockflow/features/inventory/presentation/widgets/inventory_card.dart';

class MovementsScreen extends ConsumerStatefulWidget {
  final String? productId;
  final String? warehouseId;
  const MovementsScreen({super.key, this.productId, this.warehouseId});

  @override
  ConsumerState<MovementsScreen> createState() => _MovementsScreenState();
}

class _MovementsScreenState extends ConsumerState<MovementsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(movementsProvider.notifier).loadMovements(
            productId: widget.productId,
            warehouseId: widget.warehouseId,
          );
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(movementsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Stock Movements')),
      body: switch (state) {
        MovementsLoading() => const Center(
            child: CircularProgressIndicator(strokeWidth: 2)),
        MovementsEmpty() => const EmptyStateWidget(
            title: 'No movements',
            subtitle: 'Stock movements will appear here',
            icon: Icons.history),
        MovementsError(:final message) => ErrorStateWidget(
            message: message,
            onRetry: () => ref
                .read(movementsProvider.notifier)
                .loadMovements(
                  productId: widget.productId,
                  warehouseId: widget.warehouseId,
                ),
          ),
        MovementsLoaded(:final movements) => RefreshIndicator(
            onRefresh: () => ref
                .read(movementsProvider.notifier)
                .loadMovements(
                  productId: widget.productId,
                  warehouseId: widget.warehouseId,
                ),
            child: ListView(
              padding: AppSpacing.screenPadding,
              children: [
                Text('${movements.length} movements',
                    style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
                const SizedBox(height: AppSpacing.sm),
                ...movements.map((m) => MovementTile(movement: m)),
              ],
            ),
          ),
        _ => const SizedBox.shrink(),
      },
    );
  }
}
