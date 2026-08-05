import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';
import 'package:stockflow/features/payments/presentation/providers/today_payments_provider.dart';
import 'package:stockflow/core/navigation/route_names.dart';

/// Dashboard widget — Today's Payments.
///
/// Shows the payment-method distribution for today as a stacked bar plus a
/// per-method breakdown with share-of-revenue. Tapping opens the full
/// Payment Analytics screen.
///
/// Invariant (always rendered): Cash + Card + QR + Bank + Wallet == Total.
class TodayPaymentsCard extends ConsumerWidget {
  const TodayPaymentsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final state = ref.watch(todayPaymentsProvider);

    return Card(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push(RouteNames.payments),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.payments_outlined,
                      size: 18, color: theme.colorScheme.primary),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    "Today's Payments",
                    style: theme.textTheme.titleSmall
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const Spacer(),
                  Icon(Icons.chevron_right,
                      size: 18, color: theme.colorScheme.onSurfaceVariant),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              switch (state) {
                AsyncLoading() => const SizedBox(
                    height: 90,
                    child: Center(
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                AsyncError() => SizedBox(
                    height: 90,
                    child: Center(
                      child: Text(
                        'Payment data unavailable',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  ),
                AsyncData(:final value) => switch (value) {
                    TodayPaymentsLoaded(payments: final p) =>
                      _Breakdown(payments: p),
                    _ => SizedBox(
                        height: 90,
                        child: Center(
                          child: Text(
                            'Payment data unavailable',
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ),
                      ),
                  },
                _ => const SizedBox.shrink(),
              },
            ],
          ),
        ),
      ),
    );
  }
}

class _Breakdown extends StatelessWidget {
  final PaymentBreakdown payments;

  const _Breakdown({required this.payments});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final entries = [
      ('CASH', 'Cash', const Color(0xFF0F9D58), double.tryParse(payments.cash) ?? 0),
      ('CARD', 'Card', const Color(0xFF1A73E8), double.tryParse(payments.card) ?? 0),
      ('QR', 'QR', const Color(0xFF9334E6), double.tryParse(payments.qr) ?? 0),
      ('BANK_TRANSFER', 'Bank', const Color(0xFFF9A825), double.tryParse(payments.bankTransfer) ?? 0),
      ('MOBILE_WALLET', 'Wallet', const Color(0xFF00ACC1), double.tryParse(payments.mobileWallet) ?? 0),
    ];
    final visible = entries.where((e) => e.$4 > 0).toList();
    final total = payments.total;

    if (total <= 0) {
      return SizedBox(
        height: 90,
        child: Center(
          child: Text(
            'No sales today yet',
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Stacked distribution bar ──────────
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: SizedBox(
            height: 14,
            child: Row(
              children: [
                for (final (_, _, color, amount) in visible)
                  Expanded(
                    flex: (amount / total * 1000).round(),
                    child: ColoredBox(color: color),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        // ── Per-method rows with % of revenue ──
        for (final (_, label, color, amount) in visible) ...[
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    label,
                    style: theme.textTheme.bodySmall,
                  ),
                ),
                Text(
                  '${payments.percentOf(amount).toStringAsFixed(0)}% · '
                  '${Formatters.currency(amount)}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
        const Divider(height: AppSpacing.md),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Total',
              style: theme.textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w600,
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
            Text(
              Formatters.currency(total),
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
