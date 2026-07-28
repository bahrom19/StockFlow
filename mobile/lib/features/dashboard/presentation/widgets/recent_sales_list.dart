import 'package:flutter/material.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';

/// Recent Sales List
class RecentSalesList extends StatelessWidget {
  final List<RecentSale> sales;

  const RecentSalesList({super.key, required this.sales});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (sales.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Center(
            child: Text('No recent sales',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                )),
          ),
        ),
      );
    }

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.md, AppSpacing.md, AppSpacing.md, 0),
            child: Text('Recent Sales', style: theme.textTheme.titleMedium),
          ),
          const SizedBox(height: AppSpacing.xs),
          ...sales.map((sale) => _SaleItem(sale: sale)),
        ],
      ),
    );
  }
}

class _SaleItem extends StatelessWidget {
  final RecentSale sale;

  const _SaleItem({required this.sale});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: () {},
      child: Padding(
        padding: AppSpacing.listTilePadding,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    sale.saleNumber,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    Formatters.dateTime(DateTime.tryParse(sale.createdAt)),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            _StatusChip(status: sale.status),
            const SizedBox(width: AppSpacing.sm),
            Text(
              Formatters.currency(sale.total),
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: theme.colorScheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (Color color, String label) = _statusColor(status);

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
          fontSize: 10,
        ),
      ),
    );
  }

  (Color, String) _statusColor(String status) {
    switch (status) {
      case 'COMPLETED':
        return (DesignTokens.statusCompleted, 'Done');
      case 'PENDING':
        return (DesignTokens.statusPending, 'Pending');
      case 'DRAFT':
        return (DesignTokens.statusDraft, 'Draft');
      case 'CANCELLED':
        return (DesignTokens.statusCancelled, 'Cancelled');
      case 'REFUNDED':
        return (DesignTokens.statusRefunded, 'Refunded');
      default:
        return (DesignTokens.grey500, status);
    }
  }
}
