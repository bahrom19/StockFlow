import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/core/widgets/error_state_widget.dart';
import 'package:stockflow/core/widgets/page_header.dart';
import 'package:stockflow/features/payments/domain/payment_models.dart';
import 'package:stockflow/features/payments/presentation/providers/payment_analytics_provider.dart';
import 'package:stockflow/features/payments/presentation/screens/payment_details_screen.dart';

/// Screen 1 — Payment Analytics Dashboard.
///
/// Top cards (Cash / Card / QR / Bank / Wallet with amount, % of revenue,
/// transaction count and average ticket) + animated charts:
///  - Pie: payment distribution
///  - Line: daily trend per method (selectable period)
///  - Bar: method comparison (amount / transactions / average ticket)
class PaymentAnalyticsScreen extends ConsumerStatefulWidget {
  const PaymentAnalyticsScreen({super.key});

  @override
  ConsumerState<PaymentAnalyticsScreen> createState() =>
      _PaymentAnalyticsScreenState();
}

class _PaymentAnalyticsScreenState extends ConsumerState<PaymentAnalyticsScreen> {
  _ComparisonMetric _metric = _ComparisonMetric.amount;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(paymentAnalyticsProvider.notifier).load();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final state = ref.watch(paymentAnalyticsProvider);
    final notifier = ref.read(paymentAnalyticsProvider.notifier);

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PageHeader(
            title: 'Payment Analytics',
            subtitle: 'How customers pay — every method, every day',
            actions: [
              // Period selector (Today / Week / Month / Custom).
              _PeriodSelector(
                current: notifier.period,
                onSelected: notifier.setPeriod,
                onCustom: () => _pickCustomRange(notifier),
              ),
              const SizedBox(width: AppSpacing.xs),
              IconButton(
                tooltip: 'Refresh',
                onPressed: () => notifier.refresh(),
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          Expanded(
            child: switch (state) {
              PaymentAnalyticsLoading() => const _AnalyticsSkeleton(),
              PaymentAnalyticsError(message: final msg) => ErrorStateWidget(
                  message: msg,
                  onRetry: () => notifier.load(),
                ),
              PaymentAnalyticsLoaded(data: final data) =>
                _buildContent(theme, data),
            },
          ),
        ],
      ),
    );
  }

  Widget _buildContent(ThemeData theme, PaymentAnalyticsData data) {
    final isDesktop =
        MediaQuery.of(context).size.width >= AppSpacing.breakpointDesktop;

    if (data.totalRevenue <= 0 && data.methods.every((m) => m.amount <= 0)) {
      return _EmptyAnalytics(
        periodLabel: data.period.label,
        onExplore: () => context.push(PaymentDetailsScreen.route),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        0,
        AppSpacing.md,
        AppSpacing.lg,
      ),
      children: [
        // Invariant banner (visual proof of Cash+Card+QR+Bank+Wallet == Total).
        if (!data.invariantOk)
          Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.sm),
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: theme.colorScheme.errorContainer,
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            ),
            child: Row(
              children: [
                Icon(Icons.warning_amber_rounded,
                    size: 18, color: theme.colorScheme.error),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    'Payment breakdown (${Formatters.currency(data.methodsSum)}) '
                    'differs from total revenue (${Formatters.currency(data.totalRevenue)}).',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onErrorContainer,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        // ── Top cards ──────────────────────────
        _MethodCardGrid(
          methods: data.methods,
          onTapMethod: (code) => context.push(
            '${PaymentDetailsScreen.route}?method=$code'
            '&from=${data.from.toIso8601String()}'
            '&to=${data.to.toIso8601String()}',
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        // ── Charts grid ────────────────────────
        if (isDesktop)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _ChartCard(
                  title: 'Payment Distribution',
                  child: _PaymentPieChart(methods: data.methods),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: _ChartCard(
                  title: 'Daily Trend — ${data.period.label}',
                  subtitle:
                      '${Formatters.date(data.from)} – ${Formatters.date(data.to)}',
                  child: _DailyTrendChart(points: data.dailyTrend),
                ),
              ),
            ],
          )
        else ...[
          _ChartCard(
            title: 'Payment Distribution',
            child: _PaymentPieChart(methods: data.methods),
          ),
          const SizedBox(height: AppSpacing.md),
          _ChartCard(
            title: 'Daily Trend — ${data.period.label}',
            subtitle:
                '${Formatters.date(data.from)} – ${Formatters.date(data.to)}',
            child: _DailyTrendChart(points: data.dailyTrend),
          ),
        ],
        const SizedBox(height: AppSpacing.md),
        // ── Comparison bar chart ───────────────
        _ChartCard(
          title: 'Payment Comparison',
          subtitle: 'By ${_metric.label}',
          trailing: _MetricToggle(
            metric: _metric,
            onChanged: (m) => setState(() => _metric = m),
          ),
          child: _ComparisonBarChart(methods: data.methods, metric: _metric),
        ),
        const SizedBox(height: AppSpacing.md),
        // ── Link to details ────────────────────
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            side: BorderSide(color: theme.colorScheme.outlineVariant),
          ),
          child: ListTile(
            leading: Icon(Icons.receipt_long_outlined,
                color: theme.colorScheme.primary),
            title: const Text('Payment Details'),
            subtitle: const Text('Every transaction, filterable and exportable'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => context.push(PaymentDetailsScreen.route),
          ),
        ),
      ],
    );
  }

  Future<void> _pickCustomRange(PaymentAnalyticsNotifier notifier) async {
    final now = DateTime.now();
    final from = await showDatePicker(
      context: context,
      initialDate: now.subtract(const Duration(days: 29)),
      firstDate: now.subtract(const Duration(days: 365 * 2)),
      lastDate: now,
      helpText: 'Start date',
    );
    if (from == null || !mounted) return;
    final to = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: from,
      lastDate: now,
      helpText: 'End date',
    );
    if (to == null || !mounted) return;
    notifier.setCustomRange(from, to);
  }
}

// ──────────────────────────────────
// Period selector
// ──────────────────────────────────
class _PeriodSelector extends StatelessWidget {
  final PaymentPeriod current;
  final ValueChanged<PaymentPeriod> onSelected;
  final VoidCallback onCustom;

  const _PeriodSelector({
    required this.current,
    required this.onSelected,
    required this.onCustom,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final period in PaymentPeriod.values) ...[
            _PeriodChip(
              label: period.label,
              selected: current == period,
              onTap: () =>
                  period == PaymentPeriod.custom ? onCustom() : onSelected(period),
            ),
            const SizedBox(width: 2),
          ],
        ],
      ),
    );
  }
}

class _PeriodChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback onTap;

  const _PeriodChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: selected ? theme.colorScheme.surface : Colors.transparent,
      borderRadius: BorderRadius.circular(AppSpacing.radiusSm - 2),
      elevation: selected ? 1 : 0,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm - 2),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 6),
          child: Text(
            label,
            style: theme.textTheme.labelMedium?.copyWith(
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              color: selected
                  ? theme.colorScheme.primary
                  : theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
      ),
    );
  }
}

// ──────────────────────────────────
// Top cards
// ──────────────────────────────────
class _MethodCardGrid extends StatelessWidget {
  final List<PaymentMethodStat> methods;
  final void Function(String code) onTapMethod;

  const _MethodCardGrid({
    required this.methods,
    required this.onTapMethod,
  });

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;

    // Desktop: 5 across · Tablet: 3 across · Mobile: 2 across.
    final columns = width >= AppSpacing.breakpointWide
        ? 5
        : width >= AppSpacing.breakpointTablet
            ? 3
            : 2;

    return LayoutBuilder(
      builder: (context, constraints) {
        final gap = AppSpacing.sm;
        final cardWidth = (constraints.maxWidth - gap * (columns - 1)) / columns;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final m in methods)
              SizedBox(
                width: cardWidth,
                child: _MethodCard(stat: m, onTap: () => onTapMethod(m.code)),
              ),
          ],
        );
      },
    );
  }
}

class _MethodCard extends StatelessWidget {
  final PaymentMethodStat stat;
  final VoidCallback onTap;

  const _MethodCard({required this.stat, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final meta = PaymentMethodMeta.byCode(stat.code);

    return Material(
      color: theme.colorScheme.surface,
      borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      elevation: 0,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(color: theme.colorScheme.outlineVariant),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: meta.color.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                    ),
                    child: Icon(meta.icon, size: 18, color: meta.color),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      meta.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ),
                  Text(
                    Formatters.percentage(stat.percent),
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: meta.color,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                Formatters.currency(stat.amount),
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                '${stat.count} txns · avg ${Formatters.currency(stat.averageTicket)}',
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ──────────────────────────────────
// Chart card wrapper
// ──────────────────────────────────
class _ChartCard extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget child;
  final Widget? trailing;

  const _ChartCard({
    required this.title,
    this.subtitle,
    required this.child,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: theme.textTheme.titleSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          subtitle!,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: theme.colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(height: 260, child: child),
          ],
        ),
      ),
    );
  }
}

// ──────────────────────────────────
// Pie chart — payment distribution
// ──────────────────────────────────
class _PaymentPieChart extends StatelessWidget {
  final List<PaymentMethodStat> methods;

  const _PaymentPieChart({required this.methods});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final visible = methods.where((m) => m.amount > 0).toList();
    if (visible.isEmpty) {
      return _ChartEmpty(label: 'No payments in this period');
    }
    final total = visible.fold<double>(0, (s, m) => s + m.amount);

    return Row(
      children: [
        Expanded(
          flex: 3,
          child: PieChart(
            PieChartData(
              sectionsSpace: 2,
              centerSpaceRadius: 44,
              sections: [
                for (final m in visible)
                  PieChartSectionData(
                    value: m.amount,
                    title: '${(m.amount / total * 100).toStringAsFixed(0)}%',
                    color: PaymentMethodMeta.byCode(m.code).color,
                    radius: 52,
                    titleStyle: theme.textTheme.labelSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          flex: 2,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final m in visible) ...[
                _LegendRow(
                  color: PaymentMethodMeta.byCode(m.code).color,
                  label: PaymentMethodMeta.byCode(m.code).label,
                  value: Formatters.currency(m.amount),
                ),
                const SizedBox(height: AppSpacing.xs),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

// ──────────────────────────────────
// Line chart — daily trend per method
// ──────────────────────────────────
class _DailyTrendChart extends StatelessWidget {
  final List<PaymentDayPoint> points;

  const _DailyTrendChart({required this.points});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (points.isEmpty) {
      return _ChartEmpty(label: 'No sales in this period');
    }

    // Build one line per payment method, normalized across the period.
    final metas = PaymentMethodMeta.all;
    final maxValue = points.fold<double>(0, (mx, p) {
      final dayMax = p.byMethod.values.fold<double>(0, (a, b) => a > b ? a : b);
      return mx > dayMax ? mx : dayMax;
    });
    final safeMax = maxValue <= 0 ? 1.0 : maxValue * 1.15;

    return LineChart(
      LineChartData(
        minY: 0,
        maxY: safeMax,
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: safeMax / 4,
          getDrawingHorizontalLine: (v) => FlLine(
            color: theme.colorScheme.outlineVariant.withOpacity(0.5),
            strokeWidth: 1,
          ),
        ),
        titlesData: FlTitlesData(
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 44,
              interval: safeMax / 4,
              getTitlesWidget: (v, meta) => Text(
                Formatters.currencyShort(v),
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  fontSize: 10,
                ),
              ),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              interval: _xInterval(),
              getTitlesWidget: (v, meta) {
                final idx = v.toInt();
                if (idx < 0 || idx >= points.length) return const SizedBox.shrink();
                return Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    _dayLabel(points[idx].date),
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      fontSize: 10,
                    ),
                  ),
                );
              },
            ),
          ),
          rightTitles: const AxisTitles(),
          topTitles: const AxisTitles(),
        ),
        borderData: FlBorderData(show: false),
        lineTouchData: LineTouchData(
          touchTooltipData: LineTouchTooltipData(
            getTooltipItems: (spots) => [
              for (final spot in spots)
                LineTooltipItem(
                  '${metas[spot.barIndex % metas.length].label}: '
                  '${Formatters.currency(spot.y)}',
                  TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
                  ),
                ),
            ],
          ),
        ),
        lineBarsData: [
          for (var i = 0; i < metas.length; i++)
            LineChartBarData(
              spots: [
                for (var d = 0; d < points.length; d++)
                  FlSpot(
                    d.toDouble(),
                    points[d].byMethod[metas[i].code] ?? 0,
                  ),
              ],
              color: metas[i].color,
              barWidth: 2.4,
              isCurved: true,
              curveSmoothness: 0.35,
              dotData: const FlDotData(show: false),
              belowBarData: BarAreaData(
                show: i == 0,
                color: metas[i].color.withOpacity(0.08),
              ),
            ),
        ],
      ),
    );
  }

  double _xInterval() {
    final n = points.length;
    if (n <= 7) return 1;
    if (n <= 14) return 2;
    return (n / 8).ceilToDouble();
  }

  String _dayLabel(DateTime d) => '${d.day}/${d.month}';
}

// ──────────────────────────────────
// Bar chart — comparison by metric
// ──────────────────────────────────
enum _ComparisonMetric {
  amount('Amount'),
  transactions('Transactions'),
  averageTicket('Average Ticket');

  final String label;
  const _ComparisonMetric(this.label);
}

class _MetricToggle extends StatelessWidget {
  final _ComparisonMetric metric;
  final ValueChanged<_ComparisonMetric> onChanged;

  const _MetricToggle({required this.metric, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SegmentedButton<_ComparisonMetric>(
      segments: [
        for (final m in _ComparisonMetric.values)
          ButtonSegment(
            value: m,
            label: Text(m.label, style: theme.textTheme.labelSmall),
          ),
      ],
      selected: {metric},
      onSelectionChanged: (s) => onChanged(s.first),
      showSelectedIcon: false,
      style: SegmentedButton.styleFrom(
        visualDensity: VisualDensity.compact,
        textStyle: theme.textTheme.labelSmall,
      ),
    );
  }
}

class _ComparisonBarChart extends StatelessWidget {
  final List<PaymentMethodStat> methods;
  final _ComparisonMetric metric;

  const _ComparisonBarChart({required this.methods, required this.metric});

  double _valueOf(PaymentMethodStat m) => switch (metric) {
        _ComparisonMetric.amount => m.amount,
        _ComparisonMetric.transactions => m.count.toDouble(),
        _ComparisonMetric.averageTicket => m.averageTicket,
      };

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (methods.isEmpty || methods.every((m) => _valueOf(m) <= 0)) {
      return _ChartEmpty(label: 'No data in this period');
    }

    final maxValue = methods.fold<double>(0, (mx, m) {
      final v = _valueOf(m);
      return mx > v ? mx : v;
    });
    final safeMax = maxValue <= 0 ? 1.0 : maxValue * 1.2;

    return BarChart(
      BarChartData(
        alignment: BarChartAlignment.spaceAround,
        maxY: safeMax,
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval: safeMax / 4,
          getDrawingHorizontalLine: (v) => FlLine(
            color: theme.colorScheme.outlineVariant.withOpacity(0.5),
            strokeWidth: 1,
          ),
        ),
        titlesData: FlTitlesData(
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 48,
              interval: safeMax / 4,
              getTitlesWidget: (v, meta) => Text(
                Formatters.currencyShort(v),
                style: theme.textTheme.labelSmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                  fontSize: 10,
                ),
              ),
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 28,
              getTitlesWidget: (v, meta) {
                final idx = v.toInt();
                if (idx < 0 || idx >= methods.length) {
                  return const SizedBox.shrink();
                }
                return Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    PaymentMethodMeta.byCode(methods[idx].code).label,
                    style: theme.textTheme.labelSmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                      fontSize: 10,
                    ),
                  ),
                );
              },
            ),
          ),
          rightTitles: const AxisTitles(),
          topTitles: const AxisTitles(),
        ),
        borderData: FlBorderData(show: false),
        barTouchData: BarTouchData(
          touchTooltipData: BarTouchTooltipData(
            getTooltipItem: (group, groupIndex, rod, rodIndex) {
              final m = methods[group.x.toInt()];
              return BarTooltipItem(
                '${m.label}\n${Formatters.currency(_valueOf(m))}',
                TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              );
            },
          ),
        ),
        barGroups: [
          for (var i = 0; i < methods.length; i++)
            BarChartGroupData(
              x: i,
              barRods: [
                BarChartRodData(
                  toY: _valueOf(methods[i]),
                  color: PaymentMethodMeta.byCode(methods[i].code).color,
                  width: 26,
                  borderRadius: BorderRadius.circular(4),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

// ──────────────────────────────────
// Legend / empty / skeleton helpers
// ──────────────────────────────────
class _LegendRow extends StatelessWidget {
  final Color color;
  final String label;
  final String value;

  const _LegendRow({required this.color, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Row(
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: AppSpacing.xs),
        Expanded(
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.bodySmall,
          ),
        ),
        Text(
          value,
          style: theme.textTheme.bodySmall?.copyWith(
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _ChartEmpty extends StatelessWidget {
  final String label;

  const _ChartEmpty({required this.label});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.bar_chart, size: 40, color: theme.colorScheme.outlineVariant),
          const SizedBox(height: AppSpacing.sm),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyAnalytics extends StatelessWidget {
  final String periodLabel;
  final VoidCallback onExplore;

  const _EmptyAnalytics({required this.periodLabel, required this.onExplore});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.payments_outlined,
                size: 64, color: theme.colorScheme.onSurfaceVariant.withOpacity(0.5)),
            const SizedBox(height: AppSpacing.md),
            Text('No payments for $periodLabel',
                style: theme.textTheme.titleMedium),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Complete a sale in the POS to see payment analytics here.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            FilledButton.tonalIcon(
              onPressed: onExplore,
              icon: const Icon(Icons.receipt_long_outlined),
              label: const Text('Browse payment details'),
            ),
          ],
        ),
      ),
    );
  }
}

class _AnalyticsSkeleton extends StatelessWidget {
  const _AnalyticsSkeleton();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final box = theme.colorScheme.surfaceContainerHighest;

    Widget skeletonBox(double h) => Container(
          height: h,
          decoration: BoxDecoration(
            color: box,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          ),
        );

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        0,
        AppSpacing.md,
        AppSpacing.lg,
      ),
      children: [
        Row(
          children: [
            for (var i = 0; i < 5; i++) ...[
              Expanded(child: skeletonBox(110)),
              if (i < 4) const SizedBox(width: AppSpacing.sm),
            ],
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        skeletonBox(280),
        const SizedBox(height: AppSpacing.md),
        skeletonBox(280),
      ],
    );
  }
}
