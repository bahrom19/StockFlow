import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/premium_empty_state.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';

/// Recent Sales List
class RecentSalesList extends StatelessWidget {
  final List<RecentSale> sales;

  const RecentSalesList({super.key, required this.sales});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (sales.isEmpty) {
      return PremiumEmptyState(
        icon: Icons.receipt_long,
        color: DesignTokens.primary,
        title: context.l10n.noRecentSales,
        description: context.l10n.noRecentSalesDesc,
        ctaLabel: context.l10n.newSale,
        ctaIcon: Icons.add_shopping_cart,
        onCta: () => context.push(RouteNames.saleNew),
      );
    }

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.md, AppSpacing.md, AppSpacing.md, 0),
            child: Row(
              children: [
                // ddd97fb semantics pattern: a label-less boundary around the
                // header text keeps it in its own merged leaf (rendered as
                // textContent in Flutter Web, so it stays visible to
                // document.body.innerText and screen readers) instead of being
                // hoisted into the row's role="group" aria-label by the
                // interactive "View all" button. The button stays a sibling.
                Expanded(
                  child: Semantics(
                    container: true,
                    child: Text(
                      context.l10n.recentSales,
                      style: theme.textTheme.titleMedium
                          ?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () => context.push(RouteNames.sales),
                  child: Text(context.l10n.viewAll),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          ...sales.map((sale) => _SaleItem(sale: sale)),
        ],
      ),
    );
  }
}

class _SaleItem extends StatelessWidget {
  final RecentSale sale;

  const _SaleItem({required this.sale});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: () => context.push(
        RouteNames.saleDetail.replaceAll(':id', sale.id),
      ),
      child: Padding(
        padding: AppSpacing.listTilePadding,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    sale.saleNumber,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    Formatters.dateTime(DateTime.tryParse(sale.createdAt)),
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            _StatusChip(status: sale.status, l10n: context.l10n),
            const SizedBox(width: AppSpacing.sm),
            Text(
              Formatters.currency(sale.total),
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
                color: theme.colorScheme.onSurface,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  final AppLocalizations l10n;

  const _StatusChip({required this.status, required this.l10n});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (Color color, String label) = _statusColor(status, l10n);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: theme.textTheme.labelSmall?.copyWith(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 10,
        ),
      ),
    );
  }

  (Color, String) _statusColor(String status, AppLocalizations l10n) {
    switch (status) {
      case 'COMPLETED':
        return (DesignTokens.statusCompleted, l10n.done);
      case 'PENDING':
        return (DesignTokens.statusPending, l10n.statusPending);
      case 'DRAFT':
        return (DesignTokens.statusDraft, l10n.statusDraft);
      case 'CANCELLED':
        return (DesignTokens.statusCancelled, l10n.statusCancelled);
      case 'REFUNDED':
        return (DesignTokens.statusRefunded, l10n.statusRefunded);
      case 'PARTIALLY_REFUNDED':
        return (DesignTokens.statusRefunded, l10n.statusPartiallyRefunded);
      default:
        return (DesignTokens.grey500, status);
    }
  }
}
