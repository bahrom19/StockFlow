import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';
import 'package:stockflow/core/theme/app_colors.dart';

// ── PO Status Badge ──
class POStatusBadge extends StatelessWidget {
  final String status;
  const POStatusBadge({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final rawColor = StockFlowColors.statusColor(status);
    final color = Color(rawColor);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 4),
          Text(_statusLabel(status), style: theme.textTheme.labelSmall?.copyWith(color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  String _statusLabel(String s) {
    switch (s) {
      case 'DRAFT': return 'Draft';
      case 'PENDING': return 'Pending';
      case 'APPROVED': return 'Approved';
      case 'ORDERED': return 'Ordered';
      case 'PARTIALLY_RECEIVED': return 'Partially Received';
      case 'RECEIVED': return 'Received';
      case 'CANCELLED': return 'Cancelled';
      default: return s;
    }
  }
}

// ── PO Card ──
class POCard extends StatelessWidget {
  final PurchaseOrder order;
  final VoidCallback? onTap;
  const POCard({super.key, required this.order, this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final total = double.tryParse(order.grandTotal) ?? 0;
    final date = DateFormat('MMM dd, yyyy').format(order.orderDate);
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(order.orderNumber, style: theme.textTheme.titleSmall),
                        const SizedBox(width: 8),
                        POStatusBadge(status: order.status),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Date: $date', style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.outline)),
                  ],
                ),
              ),
              Text('\$${total.toStringAsFixed(2)}', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right, color: theme.colorScheme.outline),
            ],
          ),
        ),
      ),
    );
  }
}

// ── PO Skeleton ──
class POSkeleton extends StatelessWidget {
  const POSkeleton({super.key});
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(width: 120, height: 14, decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(4))),
                  const SizedBox(height: 8),
                  Container(width: 180, height: 12, decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(4))),
                ],
              ),
            ),
            Container(width: 60, height: 14, decoration: BoxDecoration(color: theme.colorScheme.surfaceContainerHighest, borderRadius: BorderRadius.circular(4))),
          ],
        ),
      ),
    );
  }
}
