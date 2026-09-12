import 'package:flutter/material.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/domain/supplier_purchase_summary_models.dart';

class SupplierOrderPipelineSection extends StatelessWidget {
  final SupplierOrderPipeline? orderPipeline;
  final bool isLoading;
  final String? error;
  final VoidCallback onRetry;

  const SupplierOrderPipelineSection({
    super.key,
    required this.orderPipeline,
    required this.isLoading,
    required this.error,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.reorder, size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.orderPipeline, style: theme.textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 12),
            if (isLoading)
              const Center(child: CircularProgressIndicator())
            else if (error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Column(
                  children: [
                    Text(error!,
                      style: theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.error),
                      textAlign: TextAlign.center),
                    const SizedBox(height: 8),
                    TextButton.icon(
                      onPressed: onRetry,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: Text(context.l10n.retry),
                    ),
                  ],
                ),
              )
            else if (orderPipeline == null)
              Text(context.l10n.noData, style: theme.textTheme.bodyMedium)
            else ...[
              Text('${context.l10n.totalOrders}: ${orderPipeline!.summary.totalOrders}',
                style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 4),
              Text('${context.l10n.totalOrderValue}: ₸${orderPipeline!.summary.totalOrderValue}',
                style: theme.textTheme.bodyMedium),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: [
                  if (orderPipeline!.summary.draftCount > 0)
                    _statusChip(context.l10n.draft, orderPipeline!.summary.draftCount, Colors.grey, theme),
                  if (orderPipeline!.summary.pendingCount > 0)
                    _statusChip(context.l10n.pending, orderPipeline!.summary.pendingCount, Colors.orange, theme),
                  if (orderPipeline!.summary.approvedCount > 0)
                    _statusChip(context.l10n.approved, orderPipeline!.summary.approvedCount, Colors.blue, theme),
                  if (orderPipeline!.summary.orderedCount > 0)
                    _statusChip(context.l10n.ordered, orderPipeline!.summary.orderedCount, Colors.indigo, theme),
                  if (orderPipeline!.summary.partiallyReceivedCount > 0)
                    _statusChip(context.l10n.partiallyReceived, orderPipeline!.summary.partiallyReceivedCount, Colors.teal, theme),
                  if (orderPipeline!.summary.receivedCount > 0)
                    _statusChip(context.l10n.received, orderPipeline!.summary.receivedCount, Colors.green, theme),
                  if (orderPipeline!.summary.cancelledCount > 0)
                    _statusChip(context.l10n.cancelled, orderPipeline!.summary.cancelledCount, Colors.red, theme),
                ],
              ),
              if (orderPipeline!.recentOrders.isNotEmpty) ...[
                const SizedBox(height: 12),
                Divider(color: theme.colorScheme.outlineVariant),
                const SizedBox(height: 8),
                Text(context.l10n.recentOrders, style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant)),
                const SizedBox(height: 4),
                ...orderPipeline!.recentOrders.map((order) => Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    children: [
                      Expanded(flex: 3, child: Text(order.orderNumber, style: theme.textTheme.bodySmall)),
                      Expanded(flex: 2, child: Text(order.orderDate.substring(0, 10), style: theme.textTheme.bodySmall)),
                      Expanded(flex: 2, child: Text(order.expectedDate?.substring(0, 10) ?? '-', style: theme.textTheme.bodySmall)),
                      Expanded(flex: 2, child: Text(order.status, style: theme.textTheme.bodySmall?.copyWith(
                        color: order.status == 'CANCELLED' ? theme.colorScheme.error : null))),
                      Expanded(flex: 2, child: Text('₸${order.grandTotal}', style: theme.textTheme.bodySmall, textAlign: TextAlign.end)),
                    ],
                  ),
                )),
              ],
            ],
          ],
        ),
      ),
    );
  }

  static Widget _statusChip(String label, int count, Color color, ThemeData theme) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text('$label ($count)', style: theme.textTheme.bodySmall?.copyWith(color: color)),
    );
  }
}
