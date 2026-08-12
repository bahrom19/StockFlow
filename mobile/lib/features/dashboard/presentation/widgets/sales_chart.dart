import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/widgets/premium_empty_state.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';

/// Sales Bar Chart — custom painted with animated bars and gradient.
class SalesBarChart extends StatelessWidget {
  final List<ChartDataPoint> data;
  final String? title;
  final bool showProfit;

  /// Chart plot height (the whole card grows with it).
  final double height;

  const SalesBarChart({
    super.key,
    required this.data,
    this.title,
    this.showProfit = false,
    this.height = 160,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (data.isEmpty) {
      return PremiumEmptyState(
        icon: Icons.bar_chart,
        color: DesignTokens.primary,
        title: context.l10n.noSalesYet,
        description: context.l10n.noSalesYetDesc,
        ctaLabel: context.l10n.newSale,
        ctaIcon: Icons.add_shopping_cart,
        onCta: () => context.push(RouteNames.saleNew),
        hero: true,
      );
    }

    final maxRevenue =
        data.map((d) => d.revenue).reduce((a, b) => a > b ? a : b);
    final maxValue = maxRevenue > 0 ? maxRevenue : 1.0;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title ?? context.l10n.revenue,
                    style: theme.textTheme.titleMedium,
                  ),
                ),
                Row(
                  children: [
                    _LegendDot(color: DesignTokens.primary),
                    const SizedBox(width: 4),
                    Text(context.l10n.revenue,
                        style: theme.textTheme.labelSmall),
                    if (showProfit) ...[
                      const SizedBox(width: 12),
                      _LegendDot(color: DesignTokens.success),
                      const SizedBox(width: 4),
                      Text(context.l10n.profit,
                          style: theme.textTheme.labelSmall),
                    ],
                  ],
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              height: height,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final barWidth =
                      (constraints.maxWidth - (data.length - 1) * 4) /
                          data.length /
                          (showProfit ? 2.2 : 1.2);

                  return CustomPaint(
                    size: Size(constraints.maxWidth, height),
                    painter: _GridPainter(maxValue: maxValue),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: data.map((point) {
                        final revenueHeight =
                            (point.revenue / maxValue) * (height - 20);
                        return Expanded(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 2),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.end,
                              children: [
                                if (showProfit)
                                  _AnimatedBar(
                                    height: revenueHeight *
                                        (point.profit / (point.revenue > 0
                                            ? point.revenue
                                            : 1)),
                                    width: barWidth,
                                    color: DesignTokens.success,
                                    maxHeight: height - 20,
                                  ),
                                _AnimatedBar(
                                  height: revenueHeight,
                                  width: barWidth,
                                  color: DesignTokens.primary,
                                  maxHeight: height - 20,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  point.label,
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    fontSize: 11,
                                  ),
                                  textAlign: TextAlign.center,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AnimatedBar extends StatelessWidget {
  final double height;
  final double width;
  final Color color;
  final double maxHeight;

  const _AnimatedBar({
    required this.height,
    required this.width,
    required this.color,
    this.maxHeight = 160,
  });

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: height),
      duration: const Duration(milliseconds: 600),
      curve: Curves.easeOutCubic,
      builder: (context, value, _) {
        return Container(
          width: width.clamp(4, 24),
          height: value.clamp(0, maxHeight),
          decoration: BoxDecoration(
            color: color,
            borderRadius: const BorderRadius.vertical(
              top: Radius.circular(3),
            ),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                color.withOpacity(0.8),
                color,
              ],
            ),
          ),
        );
      },
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  const _LegendDot({required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(width: 8, height: 8, decoration: BoxDecoration(
      color: color,
      shape: BoxShape.circle,
    ));
  }
}

class _GridPainter extends CustomPainter {
  final double maxValue;

  _GridPainter({required this.maxValue});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.grey.withOpacity(0.12)
      ..strokeWidth = 0.5;

    // Draw 3 horizontal grid lines
    for (int i = 1; i <= 3; i++) {
      final y = size.height * (1 - i / 4);
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
