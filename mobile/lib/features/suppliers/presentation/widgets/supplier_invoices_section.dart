import 'package:flutter/material.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/domain/supplier_payment_models.dart';

class SupplierInvoicesSection extends StatelessWidget {
  final List<PurchaseInvoice> invoices;
  final bool isLoading;
  final String? error;
  final int invoicePage;
  final int invoiceTotal;
  final VoidCallback onRetry;
  final VoidCallback onLoadMore;

  const SupplierInvoicesSection({
    super.key,
    required this.invoices,
    required this.isLoading,
    required this.error,
    required this.invoicePage,
    required this.invoiceTotal,
    required this.onRetry,
    required this.onLoadMore,
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
                Icon(Icons.receipt_long,
                    size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.purchaseInvoices,
                    style: theme.textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 12),
            if (isLoading)
              const Center(child: CircularProgressIndicator(strokeWidth: 2))
            else if (error != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Column(
                  children: [
                    Text(error!,
                      style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.error),
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
            else if (invoices.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(context.l10n.noInvoices,
                    style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
              )
            else ...[
              ...invoices.map((inv) {
                final grandTotal = double.tryParse(inv.grandTotal) ?? 0;
                final paid = double.tryParse(inv.paidAmount) ?? 0;
                final outstanding = grandTotal - paid;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    children: [
                      Expanded(
                        flex: 4,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(inv.invoiceNumber,
                                style: theme.textTheme.bodyMedium?.copyWith(
                                    fontWeight: FontWeight.w600)),
                            Text(
                              '${context.l10n.invoiceDate}: ${inv.invoiceDate.substring(0, 10)}',
                              style: theme.textTheme.bodySmall?.copyWith(
                                  color: theme.colorScheme.onSurfaceVariant),
                            ),
                            if (inv.dueDate != null)
                              Text(
                                '${context.l10n.dueDate}: ${inv.dueDate!.substring(0, 10)}',
                                style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.onSurfaceVariant),
                              ),
                          ],
                        ),
                      ),
                      Expanded(
                        flex: 2,
                        child: _invoiceStatusBadge(context, inv.status, theme),
                      ),
                      Expanded(
                        flex: 3,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              CurrencyCatalog.format(inv.grandTotal, code: inv.currency),
                              style: theme.textTheme.bodyMedium?.copyWith(
                                  fontWeight: FontWeight.w600),
                            ),
                            Text(
                              '${context.l10n.paidAmount}: ${CurrencyCatalog.format(inv.paidAmount, code: inv.currency)}',
                              style: theme.textTheme.bodySmall,
                            ),
                            if (outstanding > 0)
                              Text(
                                '${context.l10n.outstanding}: ${CurrencyCatalog.format(outstanding.toStringAsFixed(4), code: inv.currency)}',
                                style: theme.textTheme.bodySmall?.copyWith(
                                    color: theme.colorScheme.error),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              }),
              if (invoices.length < invoiceTotal)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Center(
                    child: TextButton(
                      onPressed: onLoadMore,
                      child: Text(context.l10n.loadMore),
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _invoiceStatusBadge(BuildContext context, String status, ThemeData theme) {
    Color color;
    String label;
    switch (status) {
      case 'DRAFT':
        color = Colors.grey;
        label = context.l10n.statusDraft;
        break;
      case 'APPROVED':
        color = Colors.blue;
        label = context.l10n.statusApproved;
        break;
      case 'PAID':
        color = Colors.green;
        label = context.l10n.statusPaid;
        break;
      case 'CANCELLED':
        color = Colors.red;
        label = context.l10n.statusCancelled;
        break;
      default:
        color = Colors.grey;
        label = status;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(label,
          style: theme.textTheme.bodySmall?.copyWith(color: color)),
    );
  }
}
