import 'package:flutter/material.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/domain/supplier_purchase_summary_models.dart';

class SupplierPerformanceSection extends StatelessWidget {
  final SupplierPerformance? performance;
  final bool isLoading;
  final String? error;
  final VoidCallback onRetry;

  const SupplierPerformanceSection({
    super.key,
    required this.performance,
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
                Icon(Icons.analytics_outlined, size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.performanceOverview, style: theme.textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 4),
            Text(context.l10n.periodBased, style: theme.textTheme.bodySmall),
            const SizedBox(height: 12),
            if (isLoading)
              const Center(child: CircularProgressIndicator())
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
            else if (performance == null)
              Text(context.l10n.noData, style: theme.textTheme.bodyMedium)
            else ...[
              Row(
                children: [
                  Expanded(child: _buildPerformanceCard(
                    context.l10n.purchasePerformance,
                    [
                      '${context.l10n.netPurchase}: ₸${performance!.purchase.netPurchaseSpend}',
                      '${context.l10n.purchasedQuantity}: ${performance!.purchase.totalPurchasedQuantity}',
                      '${context.l10n.invoiceCount}: ${performance!.purchase.invoiceCount}',
                    ],
                    theme,
                  )),
                  const SizedBox(width: 8),
                  Expanded(child: _buildPerformanceCard(
                    context.l10n.deliveryPerformance,
                    [
                      '${context.l10n.onTimeRate}: ${performance!.delivery.onTimeDeliveryRate}%',
                      '${context.l10n.avgLeadTime}: ${performance!.delivery.averageLeadTimeDays} ${context.l10n.days}',
                      '${context.l10n.cancellationRate}: ${performance!.delivery.cancellationRate}%',
                    ],
                    theme,
                    deliveryRate: performance!.delivery.onTimeDeliveryRate,
                  )),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: _buildPerformanceCard(
                    context.l10n.returnPerformance,
                    [
                      '${context.l10n.amountReturnRate}: ${performance!.returns.amountReturnRate}%',
                      '${context.l10n.qtyReturnRate}: ${performance!.returns.quantityReturnRate}%',
                      '${context.l10n.returnCount}: ${performance!.returns.returnCount}',
                    ],
                    theme,
                    returnRate: performance!.returns.amountReturnRate,
                  )),
                  const SizedBox(width: 8),
                  Expanded(child: _buildPerformanceCard(
                    context.l10n.financialRisk,
                    [
                      '${context.l10n.totalOutstanding}: ₸${performance!.financialRisk.totalOutstanding}',
                      '${context.l10n.overdueCount}: ${performance!.financialRisk.overdueCount}',
                      '${context.l10n.overdue90Plus}: ₸${performance!.financialRisk.overdue90plus}',
                    ],
                    theme,
                    financialRisk: performance!.financialRisk.overdue90plus,
                  )),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  static Widget _buildPerformanceCard(
    String title,
    List<String> lines,
    ThemeData theme, {
    double? deliveryRate,
    double? returnRate,
    String? financialRisk,
  }) {
    Color? borderColor;
    if (deliveryRate != null) {
      if (deliveryRate >= 90) {
        borderColor = Colors.green.shade300;
      } else if (deliveryRate >= 70) {
        borderColor = Colors.orange.shade300;
      } else {
        borderColor = Colors.red.shade300;
      }
    } else if (returnRate != null) {
      if (returnRate < 5) {
        borderColor = Colors.green.shade300;
      } else if (returnRate < 15) {
        borderColor = Colors.orange.shade300;
      } else {
        borderColor = Colors.red.shade300;
      }
    } else if (financialRisk != null) {
      final riskVal = double.tryParse(financialRisk) ?? 0;
      borderColor = riskVal > 0 ? Colors.orange.shade300 : Colors.green.shade300;
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: borderColor != null ? Border.all(color: borderColor, width: 1.5) : null,
        borderRadius: BorderRadius.circular(8),
        color: theme.colorScheme.surface,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: theme.textTheme.labelLarge?.copyWith(
            fontWeight: FontWeight.w600,
          )),
          const SizedBox(height: 8),
          ...lines.map((line) => Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(line, style: theme.textTheme.bodySmall),
          )),
        ],
      ),
    );
  }
}
