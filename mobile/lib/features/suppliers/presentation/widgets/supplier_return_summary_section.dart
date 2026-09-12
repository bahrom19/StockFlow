import 'package:flutter/material.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/domain/supplier_purchase_summary_models.dart';

class SupplierReturnSummarySection extends StatelessWidget {
  final SupplierReturnSummary? returnSummary;
  final bool isLoading;
  final String? error;
  final String companyCurrency;
  final VoidCallback onRetry;

  const SupplierReturnSummarySection({
    super.key,
    required this.returnSummary,
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
                Icon(Icons.assignment_return,
                    size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.returnAnalysis,
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
            else if (returnSummary != null) ...[
              Wrap(
                spacing: 16,
                runSpacing: 8,
                children: [
                  _analyticsStat(context.l10n.returnedAmount, '₸${returnSummary!.totalReturnedAmount}', theme),
                  _analyticsStat(context.l10n.returnedQty, '${returnSummary!.totalReturnedQuantity}', theme),
                  _analyticsStat(context.l10n.amountReturnRate, '${returnSummary!.amountReturnRate}%', theme),
                  _analyticsStat(context.l10n.qtyReturnRate, '${returnSummary!.quantityReturnRate}%', theme),
                  _analyticsStat(context.l10n.returnCount, '${returnSummary!.returnCount}', theme),
                ],
              ),
              if (returnSummary!.topReturnedProducts.isNotEmpty) ...[
                const SizedBox(height: 12),
                Divider(color: theme.colorScheme.outlineVariant),
                const SizedBox(height: 8),
                Text(context.l10n.topReturnedProducts,
                    style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
                const SizedBox(height: 8),
                ...returnSummary!.topReturnedProducts.map((p) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: Text(p.productName,
                            style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500)),
                      ),
                      SizedBox(
                        width: 50,
                        child: Text('×${p.returnedQuantity}',
                            style: theme.textTheme.bodySmall, textAlign: TextAlign.end),
                      ),
                      SizedBox(
                        width: 90,
                        child: Text('₸${p.returnedAmount}',
                            style: theme.textTheme.bodySmall, textAlign: TextAlign.end),
                      ),
                    ],
                  ),
                )),
              ],
            ]
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(context.l10n.noReturns,
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
