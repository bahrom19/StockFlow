import 'package:flutter/material.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/domain/supplier_payment_models.dart';
import 'package:stockflow/features/suppliers/domain/supplier_purchase_summary_models.dart';

class SupplierFinanceSection extends StatelessWidget {
  final SupplierFinanceSummary? financeSummary;
  final List<SupplierPayment> payments;
  final SupplierPaymentAging? paymentAging;
  final bool isLoadingPaymentAging;
  final String companyCurrency;
  final VoidCallback onAddPayment;
  final void Function(SupplierPayment) onVoidPayment;

  const SupplierFinanceSection({
    super.key,
    required this.financeSummary,
    required this.payments,
    required this.paymentAging,
    required this.isLoadingPaymentAging,
    required this.companyCurrency,
    required this.onAddPayment,
    required this.onVoidPayment,
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
                Icon(Icons.account_balance_wallet,
                    size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.financeSummary,
                    style: theme.textTheme.titleSmall),
                const Spacer(),
                FilledButton.tonalIcon(
                  onPressed: onAddPayment,
                  icon: const Icon(Icons.add, size: 16),
                  label: Text(context.l10n.addPayment),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (financeSummary != null) ...[
              Row(
                children: [
                  Expanded(
                    child: _financeStat(context.l10n.totalInvoiced,
                        financeSummary!.totalInvoiced, theme),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _financeStat(
                        context.l10n.totalPaid, financeSummary!.totalPaid, theme),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _financeStat(
                        context.l10n.outstanding, financeSummary!.outstanding, theme),
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
            // Payment Aging
            if (isLoadingPaymentAging)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8),
                child: SizedBox(
                  width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            else if (paymentAging != null && paymentAging!.invoiceCount > 0) ...[
              Divider(color: theme.colorScheme.outlineVariant),
              const SizedBox(height: 8),
              Text(context.l10n.paymentAging,
                  style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 12,
                runSpacing: 4,
                children: [
                  _financeStat(context.l10n.current, '${paymentAging!.aging.current}', theme),
                  _financeStat(context.l10n.days1To30, '${paymentAging!.aging.days1To30}', theme),
                  _financeStat(context.l10n.days31To60, '${paymentAging!.aging.days31To60}', theme),
                  _financeStat(context.l10n.days61To90, '${paymentAging!.aging.days61To90}', theme),
                  _financeStat(context.l10n.overdue90Plus, '${paymentAging!.aging.overdue90Plus}', theme),
                ],
              ),
              if (paymentAging!.overdueInvoices.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text('${paymentAging!.overdueCount})',
                    style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.error)),
                const SizedBox(height: 4),
                ...paymentAging!.overdueInvoices.take(5).map((inv) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(inv.invoiceNumber,
                            style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500)),
                      ),
                      SizedBox(
                        width: 80,
                        child: Text(inv.dueDate != null ? inv.dueDate!.substring(0, 10) : '—',
                            style: theme.textTheme.bodySmall),
                      ),
                      SizedBox(
                        width: 90,
                        child: Text('₸${inv.outstanding}',
                            style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w600),
                            textAlign: TextAlign.end),
                      ),
                      SizedBox(
                        width: 40,
                        child: Text('${inv.daysOverdue}d',
                            style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error),
                            textAlign: TextAlign.end),
                      ),
                    ],
                  ),
                )),
              ],
            ],
            if (payments.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(context.l10n.noPayments,
                    style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
              )
            else
              ...payments.map((p) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      p.method == 'CASH'
                          ? Icons.money
                          : Icons.account_balance,
                      size: 20,
                    ),
                    title: Text(p.paymentNumber),
                    subtitle: Text(
                      '${p.paymentDate.toString().substring(0, 10)} • ${p.method}',
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '+${CurrencyCatalog.format(p.amount, code: p.currency)}',
                          style: theme.textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600),
                        ),
                        PopupMenuButton<String>(
                          onSelected: (v) {
                            if (v == 'void') onVoidPayment(p);
                          },
                          itemBuilder: (_) => [
                            PopupMenuItem(
                              value: 'void',
                              child: Text(context.l10n.voidPayment),
                            ),
                          ],
                        ),
                      ],
                    ),
                  )),
          ],
        ),
      ),
    );
  }

  Widget _financeStat(String label, String value, ThemeData theme) {
    // Plain Column — this stat is used both inside Rows (wrapped in Expanded
    // at the call sites) and inside Wraps, where Expanded/Flexible ParentData
    // is invalid and crashes the build.
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: theme.textTheme.labelSmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        const SizedBox(height: 2),
        Text(CurrencyCatalog.format(value, code: companyCurrency),
            style: theme.textTheme.bodyMedium
                ?.copyWith(fontWeight: FontWeight.w600)),
      ],
    );
  }
}
