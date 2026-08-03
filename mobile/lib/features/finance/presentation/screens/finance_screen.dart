import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/formatters.dart';
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
            title: 'Finance',
            subtitle: 'Trial balance and general ledger overview',
          ),
          if (loaded != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Row(
                children: [
                  _TotalChip(
                    label: 'Total Debit',
                    value: loaded.totalDebit,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  _TotalChip(
                    label: 'Total Credit',
                    value: loaded.totalCredit,
                    color: theme.colorScheme.tertiary,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: Text(
                        'Balanced' + (loaded.totalDebit == loaded.totalCredit ? ' ✓' : ' ✗'),
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
              filters: const [
                EntityFilter('All', null),
                EntityFilter('Assets', 'ASSET'),
                EntityFilter('Liabilities', 'LIABILITY'),
                EntityFilter('Equity', 'EQUITY'),
                EntityFilter('Revenue', 'REVENUE'),
                EntityFilter('Expenses', 'EXPENSE'),
              ],
              onFilter: (v) =>
                  ref.read(trialBalanceProvider.notifier).filterByType(v),
              exportFileName: 'trial_balance.csv',
              exportHeaders: const [
                'Code',
                'Account',
                'Type',
                'Debit',
                'Credit',
              ],
              exportRows: () => [
                for (final r in rows)
                  [r.accountCode, r.accountName, r.accountType, r.debit, r.credit],
              ],
              columns: [
                DataColumn(
                  label: Text('Code', style: theme.textTheme.labelMedium),
                ),
                const DataColumn(label: Text('Account')),
                const DataColumn(label: Text('Type')),
                DataColumn(
                  label: Text(
                    'Debit',
                    style: theme.textTheme.labelMedium,
                  ),
                  numeric: true,
                ),
                DataColumn(
                  label: Text(
                    'Credit',
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
                  DataCell(Text(Formatters.status(r.accountType))),
                  DataCell(Text(
                    Formatters.currency(r.debit),
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  )),
                  DataCell(Text(
                    Formatters.currency(r.credit),
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  )),
                ],
              ),
              emptyTitle: 'No trial balance data',
              emptySubtitle:
                  'Balances will appear once journal entries are posted',
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
            Formatters.currency(value),
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
