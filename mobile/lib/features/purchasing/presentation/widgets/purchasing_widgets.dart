import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/purchasing/domain/purchasing_models.dart';
import 'package:stockflow/core/theme/app_colors.dart';
import 'package:stockflow/core/currency/currency_ext.dart';

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
          Text(_statusLabel(context, status), style: theme.textTheme.labelSmall?.copyWith(color: color, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  /// PO status label — localized through l10n (Phase 5C).
  ///
  /// EN keeps the historical display byte-for-byte (incl. "Partially
  /// Received", which differs from the shared StatusBadge's lower-cased
  /// "Partially received"). RU/KK localize every known status; unknown
  /// values fall back to the raw code. Backend enum is never changed.
  String _statusLabel(BuildContext context, String s) {
    switch (s) {
      case 'DRAFT':
        return context.l10n.statusDraft;
      case 'PENDING':
        return context.l10n.statusPending;
      case 'APPROVED':
        return context.l10n.statusApproved;
      case 'ORDERED':
        return context.l10n.statusOrdered;
      case 'PARTIALLY_RECEIVED':
        return context.l10n.poStatusPartiallyReceived;
      case 'RECEIVED':
        return context.l10n.statusReceived;
      case 'CANCELLED':
        return context.l10n.statusCancelled;
      default:
        return s;
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
                    Text(context.l10n.poCardDate(date),
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: theme.colorScheme.outline)),
                  ],
                ),
              ),
              Text(context.money(total), style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
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
