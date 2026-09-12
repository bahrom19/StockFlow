import 'package:flutter/material.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/features/suppliers/domain/supplier_purchase_summary_models.dart';

class SupplierPurchaseAnalyticsSection extends StatelessWidget {
  final SupplierPurchaseSummary? purchaseSummary;
  final bool isLoading;
  final String? error;
  final List<ProductPurchaseDetail> productPurchases;
  final bool isLoadingProductPurchases;
  final String? productPurchasesError;
  final int productPurchaseTotal;
  final String companyCurrency;
  final VoidCallback onRetry;
  final VoidCallback onRetryProducts;
  final ValueChanged<String?> onPeriodChanged;
  final ValueChanged<String> onSearchChanged;
  final VoidCallback onLoadMoreProducts;
  final void Function(String productId, String productName) onShowPriceHistory;

  const SupplierPurchaseAnalyticsSection({
    super.key,
    required this.purchaseSummary,
    required this.isLoading,
    required this.error,
    required this.productPurchases,
    required this.isLoadingProductPurchases,
    required this.productPurchasesError,
    required this.productPurchaseTotal,
    required this.companyCurrency,
    required this.onRetry,
    required this.onRetryProducts,
    required this.onPeriodChanged,
    required this.onSearchChanged,
    required this.onLoadMoreProducts,
    required this.onShowPriceHistory,
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
                Icon(Icons.analytics_outlined,
                    size: 20, color: theme.colorScheme.primary),
                const SizedBox(width: 8),
                Text(context.l10n.purchaseAnalytics,
                    style: theme.textTheme.titleSmall),
                const Spacer(),
                PopupMenuButton<String?>(
                  icon: Icon(Icons.date_range,
                      size: 20, color: theme.colorScheme.onSurfaceVariant),
                  onSelected: onPeriodChanged,
                  itemBuilder: (context) => [
                    PopupMenuItem(value: null, child: Text(context.l10n.periodAllTime)),
                    PopupMenuItem(value: '3m', child: Text(context.l10n.periodLast3Months)),
                    PopupMenuItem(value: '6m', child: Text(context.l10n.periodLast6Months)),
                    PopupMenuItem(value: '1y', child: Text(context.l10n.periodLastYear)),
                    PopupMenuItem(value: 'ytd', child: Text(context.l10n.periodYearToDate)),
                  ],
                ),
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
            else if (purchaseSummary != null) ...[
              // Summary stats
              Wrap(
                spacing: 16,
                runSpacing: 12,
                children: [
                  _analyticsStat(context.l10n.totalInvoiced, '₸${purchaseSummary!.totalInvoiced}', companyCurrency, theme),
                  _analyticsStat(context.l10n.returned, '₸${purchaseSummary!.totalReturned}', companyCurrency, theme),
                  _analyticsStat(context.l10n.netPurchaseSpend, '₸${purchaseSummary!.netPurchaseSpend}', companyCurrency, theme, highlighted: true),
                  _analyticsStat(context.l10n.purchasedQuantity, '${purchaseSummary!.totalPurchasedQuantity}', companyCurrency, theme),
                  _analyticsStat(context.l10n.weightedAvgCost, '₸${purchaseSummary!.weightedAverageUnitCost}', companyCurrency, theme),
                  _analyticsStat(context.l10n.invoices, '${purchaseSummary!.invoiceCount}', companyCurrency, theme),
                  _analyticsStat(context.l10n.returned, '${purchaseSummary!.returnCount}', companyCurrency, theme),
                ],
              ),
              const SizedBox(height: 16),
              Divider(color: theme.colorScheme.outlineVariant),
              const SizedBox(height: 12),
              Row(
                children: [
                  _analyticsStat(context.l10n.currentPaid, '₸${purchaseSummary!.currentTotalPaid}', companyCurrency, theme),
                  const SizedBox(width: 24),
                  _analyticsStat(context.l10n.outstanding, '₸${purchaseSummary!.currentOutstanding}', companyCurrency, theme),
                ],
              ),
              if (purchaseSummary!.firstPurchaseDate != null || purchaseSummary!.lastPurchaseDate != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (purchaseSummary!.firstPurchaseDate != null)
                      _analyticsStat(context.l10n.firstPurchase, purchaseSummary!.firstPurchaseDate!.substring(0, 10), companyCurrency, theme),
                    if (purchaseSummary!.firstPurchaseDate != null && purchaseSummary!.lastPurchaseDate != null)
                      const SizedBox(width: 24),
                    if (purchaseSummary!.lastPurchaseDate != null)
                      _analyticsStat(context.l10n.lastPurchase, purchaseSummary!.lastPurchaseDate!.substring(0, 10), companyCurrency, theme),
                  ],
                ),
              ],
              // Monthly spend
              if (purchaseSummary!.monthlySpend.isNotEmpty) ...[
                const SizedBox(height: 16),
                Divider(color: theme.colorScheme.outlineVariant),
                const SizedBox(height: 12),
                Text(context.l10n.monthlySpend, style: theme.textTheme.labelSmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant)),
                const SizedBox(height: 8),
                ...purchaseSummary!.monthlySpend.map((m) {
                  final maxSpend = _maxMonthlySpend;
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        SizedBox(
                          width: 70,
                          child: Text(m.month, style: theme.textTheme.bodySmall),
                        ),
                        Expanded(
                          child: LinearProgressIndicator(
                            value: maxSpend > 0
                                ? (double.tryParse(m.amount) ?? 0) / maxSpend
                                : 0,
                            minHeight: 14,
                            borderRadius: BorderRadius.circular(4),
                            backgroundColor: theme.colorScheme.surfaceContainerHighest,
                          ),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 90,
                          child: Text(
                            '₸${m.amount}',
                            style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w500),
                            textAlign: TextAlign.end,
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
              // ── Product Purchase Detail ───────────────
              const SizedBox(height: 16),
              Divider(color: theme.colorScheme.outlineVariant),
              const SizedBox(height: 12),
              Row(
                children: [
                  Icon(Icons.shopping_cart_outlined,
                      size: 18, color: theme.colorScheme.primary),
                  const SizedBox(width: 6),
                  Text(context.l10n.productPurchaseDetail,
                      style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                ],
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 36,
                child: TextField(
                  decoration: InputDecoration(
                    hintText: context.l10n.searchProducts,
                    prefixIcon: const Icon(Icons.search, size: 18),
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8)),
                  ),
                  onChanged: onSearchChanged,
                ),
              ),
              const SizedBox(height: 8),
              if (isLoadingProductPurchases)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: SizedBox(
                      width: 24, height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                )
              else if (productPurchasesError != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    children: [
                      Text(productPurchasesError!,
                          style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.error)),
                      const SizedBox(height: 8),
                      TextButton.icon(
                        onPressed: onRetryProducts,
                        icon: const Icon(Icons.refresh, size: 16),
                        label: Text(context.l10n.retry),
                      ),
                    ],
                  ),
                )
              else if (productPurchases.isEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(context.l10n.noProductPurchases,
                      style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant)),
                )
              else ...[
                ...productPurchases.map((p) => InkWell(
                  onTap: () => onShowPriceHistory(p.productId, p.productName),
                  borderRadius: BorderRadius.circular(12),
                  child: Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(p.productName,
                                        style: theme.textTheme.bodyMedium?.copyWith(
                                            fontWeight: FontWeight.w600)),
                                    if (p.sku != null && p.sku!.isNotEmpty)
                                      Text('SKU: ${p.sku}',
                                          style: theme.textTheme.bodySmall?.copyWith(
                                              color: theme.colorScheme.onSurfaceVariant)),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text('₸${p.netPurchaseSpend}',
                                      style: theme.textTheme.bodyMedium?.copyWith(
                                          fontWeight: FontWeight.w700)),
                                  Text('${context.l10n.netQty}: ${p.netPurchasedQuantity}',
                                      style: theme.textTheme.bodySmall),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 12,
                            runSpacing: 4,
                            children: [
                              _analyticsStat(context.l10n.totalSpend, '₸${p.totalPurchaseSpend}', companyCurrency, theme),
                              _analyticsStat(context.l10n.qtyReturned, '${p.totalReturnedQuantity}', companyCurrency, theme),
                              _analyticsStat(context.l10n.avgCost, '₸${p.weightedAverageUnitCost}', companyCurrency, theme),
                              _analyticsStat(context.l10n.minMaxCost, '₸${p.minUnitCost} / ₸${p.maxUnitCost}', companyCurrency, theme),
                              _analyticsStat(context.l10n.invoices, '${p.invoiceCount}', companyCurrency, theme),
                              if (p.lastPurchaseDate != null)
                                _analyticsStat(context.l10n.lastPurchase, p.lastPurchaseDate!.substring(0, 10), companyCurrency, theme),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                )),
                if (productPurchases.length < productPurchaseTotal)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Center(
                      child: TextButton(
                        onPressed: onLoadMoreProducts,
                        child: Text(context.l10n.loadMore),
                      ),
                    ),
                  ),
              ],
            ]
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Text(context.l10n.noPurchaseData,
                    style: theme.textTheme.bodyMedium?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant)),
              ),
          ],
        ),
      ),
    );
  }

  double get _maxMonthlySpend {
    if (purchaseSummary == null || purchaseSummary!.monthlySpend.isEmpty) return 0;
    return purchaseSummary!.monthlySpend
        .map((m) => double.tryParse(m.amount) ?? 0)
        .reduce((a, b) => a > b ? a : b);
  }

  static Widget _analyticsStat(String label, String value, String currency, ThemeData theme, {bool highlighted = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: theme.textTheme.labelSmall
                ?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
        const SizedBox(height: 2),
        Text(CurrencyCatalog.format(value, code: currency),
            style: theme.textTheme.bodyMedium?.copyWith(
              fontWeight: highlighted ? FontWeight.w700 : FontWeight.w600,
              color: highlighted ? theme.colorScheme.primary : null,
            )),
      ],
    );
  }
}
