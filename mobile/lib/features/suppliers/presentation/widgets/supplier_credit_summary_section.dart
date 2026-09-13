import 'package:flutter/material.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/domain/supplier_credit_summary_models.dart';

/// G9-D1: small read-only Credit Summary block for the supplier detail
/// screen. Observability only — no blocking badges, no enforcement.
/// All values are in the company base currency.
class SupplierCreditSummarySection extends StatelessWidget {
  final SupplierCreditSummary? creditSummary;
  final bool isLoading;
  final String? error;
  final VoidCallback onRetry;

  const SupplierCreditSummarySection({
    super.key,
    required this.creditSummary,
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
                Icon(Icons.credit_score_outlined,
                    size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.creditSummary,
                    style: theme.textTheme.titleSmall),
              ],
            ),
            const SizedBox(height: 12),
            if (isLoading)
              const Center(child: CircularProgressIndicator(strokeWidth: 2))
            else if (error != null)
              Column(
                children: [
                  Text(
                    error!,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: theme.colorScheme.error),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh, size: 16),
                    label: Text(context.l10n.retry),
                  ),
                ],
              )
            else if (creditSummary == null)
              Text(context.l10n.noData, style: theme.textTheme.bodyMedium)
            else ...[
              _creditRow(
                context,
                context.l10n.creditLimitLabel,
                // null limit shown as '—' — null is NOT the same as 0.
                creditSummary!.creditLimit ?? '—',
                theme,
              ),
              _creditRow(
                context,
                context.l10n.outstanding,
                creditSummary!.outstandingAP,
                theme,
              ),
              _creditRow(
                context,
                context.l10n.availableCredit,
                creditSummary!.availableCredit ?? '—',
                theme,
              ),
              _creditRow(
                context,
                context.l10n.utilizationPercent,
                creditSummary!.utilizationPercent != null
                    ? '${creditSummary!.utilizationPercent}%'
                    : '—',
                theme,
              ),
              const SizedBox(height: 4),
              Text(
                context.l10n.creditSummaryCurrencyNote(
                    creditSummary!.currency),
                style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _creditRow(
      BuildContext context, String label, String value, ThemeData theme) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: theme.textTheme.bodyMedium
                  ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
          Text(value,
              style: theme.textTheme.bodyMedium
                  ?.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}