import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:stockflow/core/navigation/route_names.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';

/// Quick action definitions — shared by the dashboard strip.
List<_QuickAction> _buildActions() {
  return [
    _QuickAction(
      icon: Icons.add_shopping_cart,
      title: 'New Sale',
      description: 'Start a sale at the POS',
      color: DesignTokens.primary,
      route: RouteNames.saleNew,
    ),
    _QuickAction(
      icon: Icons.add_box_outlined,
      title: 'Purchase',
      description: 'Create a purchase order',
      color: DesignTokens.secondary,
      route: RouteNames.poNew,
    ),
    _QuickAction(
      icon: Icons.person_add_alt_1,
      title: 'Add Customer',
      description: 'Register a new customer',
      color: DesignTokens.accent,
      route: RouteNames.customerNew,
    ),
    _QuickAction(
      icon: Icons.add,
      title: 'Add Product',
      description: 'Add a product to catalog',
      color: DesignTokens.info,
      route: RouteNames.productCreate,
    ),
    _QuickAction(
      icon: Icons.history,
      title: 'Stock Movements',
      description: 'View stock movement history',
      color: DesignTokens.warning,
      route: RouteNames.movements,
    ),
    _QuickAction(
      icon: Icons.inventory_2_outlined,
      title: 'Inventory',
      description: 'Adjust or transfer stock',
      color: DesignTokens.profit,
      route: RouteNames.inventory,
    ),
  ];
}

/// Compact Quick Actions — a single strip of icon+label tiles placed directly
/// under the KPI row. Full-height cards only; keeps the top of the dashboard
/// dense and scannable.
class QuickActionsStrip extends StatelessWidget {
  const QuickActionsStrip({super.key});

  @override
  Widget build(BuildContext context) {
    final actions = _buildActions();

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxW = constraints.maxWidth;
        final cols = maxW >= 1400
            ? 6
            : (maxW >= 1000
                ? 3
                : (maxW >= 640
                    ? 2
                    : 1));
        final tileW = (maxW - (cols - 1) * AppSpacing.xs) / cols;

        return Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            for (final action in actions)
              SizedBox(
                width: tileW,
                child: _QuickActionTile(action: action),
              ),
          ],
        );
      },
    );
  }
}

/// Compact tile: icon squircle + label, minimal height.
class _QuickActionTile extends StatefulWidget {
  final _QuickAction action;

  const _QuickActionTile({required this.action});

  @override
  State<_QuickActionTile> createState() => _QuickActionTileState();
}

class _QuickActionTileState extends State<_QuickActionTile> {
  bool _hovered = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final color = widget.action.color;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _hovered = true),
      onExit: (_) => setState(() => _hovered = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        height: 56,
        decoration: BoxDecoration(
          color: _hovered
              ? color.withOpacity(0.06)
              : theme.colorScheme.surface,
          borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
          border: Border.all(
            color: _hovered
                ? color.withOpacity(0.45)
                : theme.colorScheme.outlineVariant,
          ),
          boxShadow: _hovered
              ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.08),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : const [],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            onTap: () => context.push(widget.action.route),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
              child: Row(
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
                    ),
                    child: Icon(widget.action.icon, color: color, size: 18),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      widget.action.title,
                      style: theme.textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: theme.colorScheme.onSurface,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  AnimatedOpacity(
                    opacity: _hovered ? 1 : 0,
                    duration: const Duration(milliseconds: 200),
                    child: Icon(
                      Icons.arrow_forward,
                      size: 14,
                      color: color,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _QuickAction {
  final IconData icon;
  final String title;
  final String description;
  final Color color;
  final String route;

  const _QuickAction({
    required this.icon,
    required this.title,
    required this.description,
    required this.color,
    required this.route,
  });
}
