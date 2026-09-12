import 'package:flutter/material.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/domain/supplier_purchase_summary_models.dart';

class SupplierReliabilitySection extends StatelessWidget {
  final SupplierReliability? reliability;
  final bool isLoading;
  final String? error;
  final String companyCurrency;
  final VoidCallback onRetry;

  const SupplierReliabilitySection({
    super.key,
    required this.reliability,
    required this.isLoading,
    required this.error,
    required this.companyCurrency,
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
                Icon(Icons.local_shipping_outlined,
                    size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.supplierReliability,
                    style: theme.textTheme.titleSmall),
              ],
            ),
            const SizedBox(height: 12),
            if (isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              )
            else if (error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Column(
                  children: [
                    Text(
                      error!,
                      style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.error),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    TextButton.icon(
                      onPressed: onRetry,
                      icon: const Icon(Icons.refresh, size: 16),
                      label: Text(context.l10n.retry),
                    ),
                  ],
                ),
              )
            else if (reliability != null) ...[
              Row(
                children: [
                  _analyticsStat(context.l10n.onTimeDeliveryRate, '${reliability!.onTimeDeliveryRate}%', theme),
                  const SizedBox(width: 16),
                  _analyticsStat(context.l10n.avgLeadTime, '${reliability!.averageLeadTimeDays} ${context.l10n.days}', theme),
                ],
              ),
              if (reliability!.minLeadTimeDays != null || reliability!.maxLeadTimeDays != null) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    if (reliability!.minLeadTimeDays != null)
                      _analyticsStat(context.l10n.minLeadTime, '${reliability!.minLeadTimeDays} ${context.l10n.days}', theme),
                    if (reliability!.minLeadTimeDays != null && reliability!.maxLeadTimeDays != null)
                      const SizedBox(width: 16),
                    if (reliability!.maxLeadTimeDays != null)
                      _analyticsStat(context.l10n.maxLeadTime, '${reliability!.maxLeadTimeDays} ${context.l10n.days}', theme),
                  ],
                ),
              ],
              const SizedBox(height: 12),
              Divider(color: theme.colorScheme.outlineVariant),
              const SizedBox(height: 12),
              Wrap(
                spacing: 16,
                runSpacing: 8,
                children: [
                  _analyticsStat(context.l10n.ordersReceived, '${reliability!.ordersReceived}', theme),
                  _analyticsStat(context.l10n.ordersPartiallyReceived, '${reliability!.ordersPartiallyReceived}', theme),
                  _analyticsStat(context.l10n.ordersCancelled, '${reliability!.ordersCancelled}', theme),
                  _analyticsStat(context.l10n.cancellationRate, '${reliability!.cancellationRate}%', theme),
                ],
              ),
              if (reliability!.recentDeliveries.isNotEmpty) ...[
                const SizedBox(height: 12),
                Divider(color: theme.colorScheme.outlineVariant),
                const SizedBox(height: 12),
                Text(context.l10n.recentDeliveries,
                    style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
                const SizedBox(height: 8),
                ...reliability!.recentDeliveries.map((d) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: Text(d.orderNumber,
                            style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500)),
                      ),
                      Expanded(
                        flex: 2,
                        child: Text(
                          d.receiptDate != null ? d.receiptDate!.substring(0, 10) : '—',
                          style: theme.textTheme.bodySmall,
                        ),
                      ),
                      SizedBox(
                        width: 50,
                        child: d.leadTimeDays != null
                            ? Text('${d.leadTimeDays}d', style: theme.textTheme.bodySmall)
                            : Text('—', style: theme.textTheme.bodySmall),
                      ),
                      SizedBox(
                        width: 24,
                        child: d.onTime == true
                            ? const Icon(Icons.check_circle, size: 16, color: Colors.green)
                            : d.onTime == false
                                ? const Icon(Icons.cancel, size: 16, color: Colors.red)
                                : const Icon(Icons.help_outline, size: 16, color: Colors.grey),
                      ),
                    ],
                  ),
                )),
              ],
            ]
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(context.l10n.noOrderData,
                    style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
              ),
          ],
        ),
      ),
    );
  }

  Widget _analyticsStat(String label, String value, ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: theme.textTheme.labelSmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        const SizedBox(height: 2),
        Text(CurrencyCatalog.format(value, code: companyCurrency),
            style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
      ],
    );
  }
}
