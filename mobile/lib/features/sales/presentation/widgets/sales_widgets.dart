import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';
import 'package:stockflow/core/theme/app_colors.dart';
import 'package:stockflow/core/currency/currency_ext.dart';

// ──────────────────────────────────
// Sale Card — List item for sale history
// ──────────────────────────────────
class SaleCard extends StatelessWidget {
  final Sale sale;
  final VoidCallback? onTap;

  const SaleCard({super.key, required this.sale, this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final total = double.tryParse(sale.total) ?? 0;
    final date = DateFormat('MMM dd, HH:mm').format(sale.createdAt);
    final itemCount = sale.items.length;

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
                        Text(sale.saleNumber,
                            style: theme.textTheme.titleSmall),
                        const SizedBox(width: 8),
                        StatusBadge(status: sale.status),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '$itemCount item${itemCount == 1 ? '' : 's'}  •  $date',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.outline),
                    ),
                  ],
                ),
              ),
              Text(
                context.money(total),
                style: theme.textTheme.titleMedium
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right, color: theme.colorScheme.outline),
            ],
          ),
        ),
      ),
    );
  }
}

// ──────────────────────────────────
// Status Badge
// ──────────────────────────────────
class StatusBadge extends StatelessWidget {
  final String status;

  const StatusBadge({super.key, required this.status});

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
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            _statusLabel(status),
            style: theme.textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'DRAFT':
        return 'Draft';
      case 'PENDING':
        return 'Pending';
      case 'COMPLETED':
        return 'Completed';
      case 'REFUNDED':
        return 'Refunded';
      case 'CANCELLED':
        return 'Cancelled';
      case 'PARTIALLY_REFUNDED':
        return 'Partially Refunded';
      default:
        return status;
    }
  }
}

// ──────────────────────────────────
// Payment Method Chip
// ──────────────────────────────────
class PaymentChip extends StatelessWidget {
  final String method;
  final String? amount;

  const PaymentChip({super.key, required this.method, this.amount});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Chip(
      avatar: Icon(_paymentIcon(method), size: 16),
      label: Text(
        amount != null
            ? '${method} ${context.money(amount!)}'
            : method,
        style: theme.textTheme.labelSmall,
      ),
      visualDensity: VisualDensity.compact,
    );
  }

  IconData _paymentIcon(String method) {
    switch (method) {
      case 'CASH':
        return Icons.money;
      case 'CARD':
        return Icons.credit_card;
      case 'QR':
        return Icons.qr_code;
      default:
        return Icons.payment;
    }
  }
}

// ──────────────────────────────────
// Sale Skeleton (loading placeholder)
// ──────────────────────────────────
class SaleSkeleton extends StatelessWidget {
  const SaleSkeleton({super.key});

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
                  Container(
                    width: 120,
                    height: 14,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    width: 180,
                    height: 12,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.surfaceContainerHighest,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              width: 60,
              height: 14,
              decoration: BoxDecoration(
                color: theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ──────────────────────────────────
// POS Product Search Card
// ──────────────────────────────────
class ProductSearchCard extends StatelessWidget {
  final String name;
  final String sku;
  final double price;
  final VoidCallback onAdd;

  const ProductSearchCard({
    super.key,
    required this.name,
    required this.sku,
    required this.price,
    required this.onAdd,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: theme.colorScheme.primaryContainer,
          child: const Icon(Icons.inventory_2, size: 20),
        ),
        title: Text(name, maxLines: 1, overflow: TextOverflow.ellipsis),
        subtitle: Text('$sku  •  ${context.money(price)}',
            style: theme.textTheme.bodySmall),
        trailing: FilledButton.tonal(
          onPressed: onAdd,
          child: const Text('Add'),
        ),
      ),
    );
  }
}
