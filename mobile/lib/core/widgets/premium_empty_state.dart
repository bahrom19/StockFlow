import 'package:flutter/material.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';

/// Premium empty state — Stripe-grade "guided start" instead of "no data".
///
/// Anatomy: layered icon artboard (decorative backdrop ring + tinted squircle
/// + icon), bold title, supporting description, optional CTA. Consistent
/// rhythm so every module's empty state feels part of one design system.
class PremiumEmptyState extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String description;
  final String? ctaLabel;
  final IconData? ctaIcon;
  final VoidCallback? onCta;

  /// When true the icon artboard is drawn on a soft gradient band instead of
  /// the flat surface — reads as "content area" rather than an empty card.
  final bool hero;

  const PremiumEmptyState({
    super.key,
    required this.icon,
    required this.color,
    required this.title,
    required this.description,
    this.ctaLabel,
    this.ctaIcon,
    this.onCta,
    this.hero = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
        gradient: hero
            ? LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  color.withOpacity(0.08),
                  theme.colorScheme.surface,
                ],
              )
            : null,
        border: Border.all(
          color: theme.colorScheme.outlineVariant,
        ),
      ),
      padding: EdgeInsets.symmetric(
        horizontal: hero ? AppSpacing.xl : AppSpacing.lg,
        vertical: hero ? AppSpacing.xl : AppSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Artboard(color: color, icon: icon),
          const SizedBox(height: AppSpacing.md),
          // ddd97fb semantics pattern: a label-less boundary around the empty
          // state's title + description keeps them in their own merged leaf
          // (rendered as textContent in Flutter Web, so they stay visible to
          // document.body.innerText and screen readers) instead of being
          // hoisted into the group's aria-label by the interactive CTA below.
          // The CTA stays a separate sibling node.
          Semantics(
            container: true,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: theme.colorScheme.onSurface,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
          if (ctaLabel != null && onCta != null) ...[
            const SizedBox(height: AppSpacing.md),
            FilledButton.tonalIcon(
              onPressed: onCta,
              icon: Icon(ctaIcon ?? Icons.arrow_forward, size: 18),
              label: Text(ctaLabel!),
            ),
          ],
        ],
      ),
    );
  }
}

/// Layered icon artboard: decorative ring + tinted squircle + icon.
class _Artboard extends StatelessWidget {
  final Color color;
  final IconData icon;

  const _Artboard({required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 88,
      height: 88,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Decorative backdrop ring
          Container(
            width: 88,
            height: 88,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: color.withOpacity(0.15),
                width: 1,
              ),
            ),
          ),
          // Inner tinted squircle
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: color.withOpacity(0.10),
              borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
            ),
            child: Icon(icon, size: 26, color: color),
          ),
        ],
      ),
    );
  }
}
