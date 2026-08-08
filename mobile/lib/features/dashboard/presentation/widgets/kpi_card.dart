import 'dart:ui' show FontFeature;
import 'package:flutter/material.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/widgets/shimmer_box.dart';

/// KPI Card v2 — enterprise dashboard metric.
///
/// Anatomy (top → bottom): icon chip + trend chip, large tabular value,
/// medium label, small comparison/helper line. Hover lifts the card and
/// tints the border; focus shows a ring; press scales slightly.
///
/// In [compact] mode (dashboard strip) the card renders with a horizontal
/// icon | value + label layout and reduced paddings so five KPIs fit on one
/// desktop row without dominating the screen.
class KpiCard extends StatefulWidget {
  final String title;
  final String value;
  final IconData icon;
  final Color color;
  final String? subtitle;
  final double? changePercent;
  final VoidCallback? onTap;

  /// Revenue-style emphasis: accent border + tinted surface.
  final bool emphasized;

  /// Compact strip layout for the dashboard KPI row.
  final bool compact;

  const KpiCard({
    super.key,
    required this.title,
    required this.value,
    required this.icon,
    required this.color,
    this.subtitle,
    this.changePercent,
    this.onTap,
    this.emphasized = false,
    this.compact = false,
  });

  @override
  State<KpiCard> createState() => _KpiCardState();
}

class _KpiCardState extends State<KpiCard> {
  bool _hovered = false;
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = widget.color;

    final body = widget.compact ? _buildCompact(theme, color) : _buildVertical(theme, color);

    return MouseRegion(
      cursor: widget.onTap != null
          ? SystemMouseCursors.click
          : SystemMouseCursors.basic,
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: AnimatedScale(
        scale: _pressed ? 0.98 : 1.0,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          decoration: BoxDecoration(
            color: widget.emphasized
                ? color.withOpacity(0.07)
                : theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: Border.all(
              color: _hovered
                  ? color.withOpacity(0.45)
                  : widget.emphasized
                      ? color.withOpacity(0.35)
                      : theme.colorScheme.outlineVariant,
              width: widget.emphasized ? AppSpacing.borderMd : AppSpacing.borderSm,
            ),
            boxShadow: _hovered
                ? [
                    BoxShadow(
                      color: color.withOpacity(0.14),
                      blurRadius: 18,
                      offset: const Offset(0, 6),
                    ),
                  ]
                : widget.emphasized
                    ? [
                        BoxShadow(
                          color: color.withOpacity(0.06),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ]
                    : [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.04),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              onTap: widget.onTap,
              onHighlightChanged: (v) => setState(() => _pressed = v),
              child: body,
            ),
          ),
        ),
      ),
    );
  }

  /// Compact horizontal layout: icon | (value + label) | trend chip.
  /// In emphasized (hero) mode the value is larger and the label uses the
  /// accent color so the single most important KPI dominates the row.
  Widget _buildCompact(ThemeData theme, Color color) {
    final valueSize = widget.emphasized ? 21.0 : 17.0;
    final body = Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.sm),
      child: Row(
        children: [
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: widget.emphasized ? 44 : 38,
            height: widget.emphasized ? 44 : 38,
            decoration: BoxDecoration(
              color: color.withOpacity(_hovered ? 0.20 : 0.14),
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
            ),
            child: Icon(widget.icon, color: color, size: widget.emphasized ? 22 : 20),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.value,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    fontFeatures: const [FontFeature.tabularFigures()],
                    color: theme.colorScheme.onSurface,
                    fontSize: valueSize,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 1),
                Text(
                  widget.title,
                  style: theme.textTheme.labelSmall?.copyWith(
                    color: widget.emphasized
                        ? color
                        : theme.colorScheme.onSurfaceVariant,
                    fontWeight: widget.emphasized ? FontWeight.w700 : null,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          _TrendChip(percent: widget.changePercent, emphasized: widget.emphasized),
        ],
      ),
    );

    // Keep the card compact but preserve the comparison context on hover.
    if (widget.subtitle == null) return body;
    return Tooltip(message: widget.subtitle!, child: body);
  }

  /// Original vertical layout with icon chip on top.
  Widget _buildVertical(ThemeData theme, Color color) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withOpacity(_hovered ? 0.18 : 0.12),
                  borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                ),
                child: Icon(widget.icon, color: color, size: 22),
              ),
              const Spacer(),
              _TrendChip(
                percent: widget.changePercent,
                emphasized: widget.emphasized,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            widget.value,
            style: theme.textTheme.headlineMedium?.copyWith(
              fontWeight: FontWeight.w700,
              fontFeatures: const [FontFeature.tabularFigures()],
              color: theme.colorScheme.onSurface,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            widget.title,
            style: theme.textTheme.labelMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (widget.subtitle != null) ...[
            const SizedBox(height: 2),
            Text(
              widget.subtitle!,
              style: theme.textTheme.labelSmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }
}

/// Trend chip — always rendered. Null percent renders a neutral "—" so the
/// card never has an empty corner.
class _TrendChip extends StatelessWidget {
  final double? percent;
  final bool emphasized;

  const _TrendChip({required this.percent, this.emphasized = false});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (percent == null) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(
          color: theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          '—',
          style: theme.textTheme.labelSmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
            fontWeight: FontWeight.w600,
          ),
        ),
      );
    }

    final up = percent! >= 0;
    final color = up ? DesignTokens.success : DesignTokens.error;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            up ? Icons.trending_up : Icons.trending_down,
            size: 12,
            color: color,
          ),
          const SizedBox(width: 2),
          Text(
            '${percent!.abs().toStringAsFixed(1)}%',
            style: theme.textTheme.labelSmall?.copyWith(
              color: color,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

/// Skeleton placeholder for KPI cards during loading — animated shimmer.
class KpiCardSkeleton extends StatelessWidget {
  const KpiCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const ShimmerBox(width: 44, height: 44, radius: AppSpacing.radiusSm),
                const Spacer(),
                const ShimmerBox(width: 48, height: 18, radius: 6),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            const ShimmerBox(width: 110, height: 30, radius: 6),
            const SizedBox(height: 6),
            const ShimmerBox(width: 90, height: 14, radius: 4),
          ],
        ),
      ),
    );
  }
}
