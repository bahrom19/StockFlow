import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/inventory/domain/inventory_models.dart';
import 'package:stockflow/features/inventory/presentation/providers/inventory_provider.dart';

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

    final loaded = state is MovementsLoaded ? state : null;
    final items = loaded?.movements ?? const <StockMovement>[];

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: context.l10n.stockMovements,
            subtitle: context.l10n.movementsSubtitle,
            actions: [
              IconButton(
                tooltip: context.l10n.refresh,
                onPressed: () => ref.read(movementsProvider.notifier).loadMovements(
                      productId: widget.productId,
                      warehouseId: widget.warehouseId,
                    ),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          Expanded(
            child: EntityTable<StockMovement>(
              items: items,
              total: items.length,
              isLoading: state is MovementsLoading,
              searchHint: context.l10n.movementsSearchHint,
              exportFileName: 'stock_movements.csv',
              exportHeaders: [
                context.l10n.date,
                context.l10n.type,
                context.l10n.product,
                context.l10n.qty,
                context.l10n.before,
                context.l10n.after,
                context.l10n.reference,
              ],
              exportRows: () => [
                for (final m in items)
                  [
                    m.createdAt,
                    m.type,
                    m.productId,
                    m.quantity.toString(),
                    m.beforeQuantity.toString(),
                    m.afterQuantity.toString(),
                    m.referenceType ?? '',
                  ],
              ],
              columns: [
                DataColumn(label: Text(context.l10n.date)),
                DataColumn(label: Text(context.l10n.type)),
                DataColumn(label: Text(context.l10n.qty)),
                DataColumn(
                  label: Text(context.l10n.before,
                      style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(
                  label: Text(context.l10n.after,
                      style: theme.textTheme.labelMedium),
                  numeric: true,
                ),
                DataColumn(label: Text(context.l10n.reference)),
              ],
              buildRow: (m) => DataRow(
                cells: [
                  DataCell(Text(Formatters.dateTime(
                    DateTime.tryParse(m.createdAt),
                  ))),
                  DataCell(StatusBadge(
                    status: m.type,
                    color: m.type == 'SALE' || m.type == 'TRANSFER_OUT'
                        ? theme.colorScheme.error
                        : theme.colorScheme.primary,
                  )),
                  DataCell(Text(
                    '${m.quantity}',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  )),
                  DataCell(Text('${m.beforeQuantity}')),
                  DataCell(Text(
                    '${m.afterQuantity}',
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  )),
                  DataCell(Text(m.referenceType ?? '-')),
                ],
              ),
              emptyTitle: context.l10n.movementsEmptyTitle,
              emptySubtitle: context.l10n.movementsEmptySubtitle,
              emptyIcon: Icons.history,
              errorMessage: state is MovementsError
                  ? (state as MovementsError).message
                  : null,
              onRetry: () => ref.read(movementsProvider.notifier).loadMovements(
                    productId: widget.productId,
                    warehouseId: widget.warehouseId,
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
