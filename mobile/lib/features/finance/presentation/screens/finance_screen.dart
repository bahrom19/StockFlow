import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/currency/currency_ext.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/widgets/entity_table.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/features/finance/domain/finance_models.dart';
import 'package:stockflow/features/finance/presentation/providers/finance_provider.dart';

/// Finance screen — trial balance with account-type filters and CSV export.
class FinanceScreen extends ConsumerStatefulWidget {
  const FinanceScreen({super.key});

  @override
  ConsumerState<FinanceScreen> createState() => _FinanceScreenState();
}

class _FinanceScreenState extends ConsumerState<FinanceScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(trialBalanceProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(trialBalanceProvider);

    final loaded = state is TrialBalanceLoaded ? state : null;
    final rows = loaded?.rows ?? const <TrialBalanceRow>[];

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: context.l10n.financeTitle,
            subtitle: context.l10n.financeSubtitle,
          ),
          if (loaded != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Row(
                children: [
                  _TotalChip(
                    label: context.l10n.totalDebit,
                    value: loaded.totalDebit,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  _TotalChip(
                    label: context.l10n.totalCredit,
                    value: loaded.totalCredit,
                    color: theme.colorScheme.tertiary,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: Text(
                        context.l10n.balanced +
                            (loaded.totalDebit == loaded.totalCredit ? ' ✓' : ' ✗'),
                        style: theme.textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: loaded.totalDebit == loaded.totalCredit
                              ? theme.colorScheme.primary
                              : theme.colorScheme.error,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          Expanded(
            child: EntityTable<TrialBalanceRow>(
              items: rows,
              total: rows.length,
              isLoading: state is TrialBalanceLoading,
              isRefreshing: loaded?.isRefreshing ?? false,
              onRefresh: () => ref.read(trialBalanceProvider.notifier).refresh(),
              filters: [
                EntityFilter(context.l10n.all, null),
                EntityFilter(context.l10n.accountTypeAssets, 'ASSET'),
                EntityFilter(context.l10n.accountTypeLiabilities, 'LIABILITY'),
                EntityFilter(context.l10n.accountTypeEquity, 'EQUITY'),
                EntityFilter(context.l10n.revenue, 'REVENUE'),
                EntityFilter(context.l10n.accountTypeExpenses, 'EXPENSE'),
              ],
              onFilter: (v) =>
                  ref.read(trialBalanceProvider.notifier).filterByType(v),
              exportFileName: 'trial_balance.csv',
              exportHeaders: [
                context.l10n.code,
                context.l10n.account,
                context.l10n.type,
                context.l10n.debit,
                context.l10n.credit,
              ],
              exportRows: () => [
                for (final r in rows)
                  [r.accountCode, r.accountName, r.accountType, r.debit, r.credit],
              ],
              columns: [
                DataColumn(
                  label: Text(
                    context.l10n.code,
                    style: theme.textTheme.labelMedium,
                  ),
                ),
                DataColumn(label: Text(context.l10n.account)),
                DataColumn(label: Text(context.l10n.type)),
                DataColumn(
                  label: Text(
                    context.l10n.debit,
                    style: theme.textTheme.labelMedium,
                  ),
                  numeric: true,
                ),
                DataColumn(
                  label: Text(
                    context.l10n.credit,
                    style: theme.textTheme.labelMedium,
                  ),
                  numeric: true,
                ),
              ],
              buildRow: (r) => DataRow(
                cells: [
                  DataCell(Text(r.accountCode)),
                  DataCell(Text(
                    r.accountName,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  )),
                  DataCell(Text(_accountTypeLabel(r.accountType, context.l10n))),
                  DataCell(Text(
                    context.money(r.debit),
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  )),
                  DataCell(Text(
                    context.money(r.credit),
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  )),
                ],
              ),
              emptyTitle: context.l10n.noTrialBalanceData,
              emptySubtitle: context.l10n.trialBalanceEmptySubtitle,
              emptyIcon: Icons.account_balance_outlined,
              errorMessage: state is TrialBalanceError
                  ? (state as TrialBalanceError).message
                  : null,
              onRetry: () =>
                  ref.read(trialBalanceProvider.notifier).load(),
            ),
          ),
        ],
      ),
    );
  }
}

/// UI-layer label for backend account-type codes (ASSET/LIABILITY/EQUITY/
/// REVENUE/EXPENSE). Unknown codes fall back to the raw value — never invent
/// new enum values on the client.
String _accountTypeLabel(
  String type,
  AppLocalizations l10n,
) {
  switch (type) {
    case 'ASSET':
      return l10n.accountTypeAssets;
    case 'LIABILITY':
      return l10n.accountTypeLiabilities;
    case 'EQUITY':
      return l10n.accountTypeEquity;
    case 'REVENUE':
      return l10n.revenue;
    case 'EXPENSE':
      return l10n.accountTypeExpenses;
    default:
      return type;
  }
}

class _TotalChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _TotalChip({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: color,
                ),
          ),
          Text(
            context.money(value),
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: color,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}
