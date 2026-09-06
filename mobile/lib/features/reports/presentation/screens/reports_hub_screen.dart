import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/widgets/page_header.dart';

/// Reports hub — navigation cards for all analytics report screens.
///
/// Replaces the legacy ReportsScreen which embedded Dashboard KPIs
/// directly. The Dashboard KPIs now live in the Dashboard tab; this screen
/// is purely a reports entry point.
class ReportsHubScreen extends ConsumerWidget {
  const ReportsHubScreen({super.key});

  @override
  Widget build(BuildContext context, _) {
    final theme = Theme.of(context);
    final l10n = context.l10n;

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: l10n.reportsTitle,
            subtitle: l10n.reportsSubtitle,
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                0,
                AppSpacing.md,
                AppSpacing.lg,
              ),
              children: [
                _ReportCard(
                  title: l10n.reportTopProducts,
                  subtitle: l10n.reportTopProductsSubtitle,
                  icon: Icons.leaderboard_outlined,
                  color: const Color(0xFF4285F4),
                  onTap: () =>
                      context.push('${RouteNames.reports}/top-products'),
                ),
                _ReportCard(
                  title: l10n.reportInventoryValue,
                  subtitle: l10n.reportInventoryValueSubtitle,
                  icon: Icons.inventory_2_outlined,
                  color: const Color(0xFFFB8C00),
                  onTap: () =>
                      context.push('${RouteNames.reports}/inventory-value'),
                ),
                _ReportCard(
                  title: l10n.reportCustomers,
                  subtitle: l10n.reportCustomersSubtitle,
                  icon: Icons.people_outlined,
                  color: const Color(0xFF0F9D58),
                  onTap: () =>
                      context.push('${RouteNames.reports}/customers'),
                ),
                _ReportCard(
                  title: l10n.reportSuppliers,
                  subtitle: l10n.reportSuppliersSubtitle,
                  icon: Icons.local_shipping_outlined,
                  color: const Color(0xFF9C27B0),
                  onTap: () =>
                      context.push('${RouteNames.reports}/suppliers'),
                ),
                _ReportCard(
                  title: l10n.reportCashShifts,
                  subtitle: l10n.reportCashShiftsSubtitle,
                  icon: Icons.payments_outlined,
                  color: const Color(0xFFE91E63),
                  onTap: () =>
                      context.push('${RouteNames.reports}/cash-shifts'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ReportCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: color.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Icon(icon, size: 24, color: color),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
