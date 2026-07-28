import 'package:flutter/material.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';

/// Sales Bar Chart — custom painted with animated bars and gradient.
class SalesBarChart extends StatelessWidget {
  final List<ChartDataPoint> data;
  final String title;
  final bool showProfit;

  const SalesBarChart({
    super.key,
    required this.data,
    this.title = 'Revenue',
    this.showProfit = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (data.isEmpty) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Center(
            child: Text('No sales data available',
                style: theme.textTheme.bodyMedium),
          ),
        ),
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
                  child: Text(title, style: theme.textTheme.titleMedium),
                ),
                Row(
                  children: [
                    _LegendDot(color: DesignTokens.primary),
                    const SizedBox(width: 4),
                    Text('Revenue',
                        style: theme.textTheme.labelSmall),
                    if (showProfit) ...[
                      const SizedBox(width: 12),
                      _LegendDot(color: DesignTokens.success),
                      const SizedBox(width: 4),
                      Text('Profit',
                          style: theme.textTheme.labelSmall),
                    ],
                  ],
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            SizedBox(
              height: 160,
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final barWidth =
                      (constraints.maxWidth - (data.length - 1) * 4) /
                          data.length /
                          (showProfit ? 2.2 : 1.2);

                  return CustomPaint(
                    size: Size(constraints.maxWidth, 160),
                    painter: _GridPainter(maxValue: maxValue),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: data.map((point) {
                        final revenueHeight =
                            (point.revenue / maxValue) * 140;
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
                                  ),
                                _AnimatedBar(
                                  height: revenueHeight,
                                  width: barWidth,
                                  color: DesignTokens.primary,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  point.label,
                                  style: theme.textTheme.labelSmall?.copyWith(
                                    fontSize: 9,
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

  const _AnimatedBar({
    required this.height,
    required this.width,
    required this.color,
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
          height: value.clamp(0, 160),
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
