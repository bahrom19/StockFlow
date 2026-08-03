import 'package:flutter/material.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/utils/formatters.dart';

/// StockFlow status badge — maps business status strings to consistent
/// colored pills across every module (sales, purchasing, inventory...).
class StatusBadge extends StatelessWidget {
  final String status;
  final Color? color;

  const StatusBadge({super.key, required this.status, this.color});

  /// Central mapping of backend status values to brand colors.
  static Color colorFor(String status) {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
      case 'APPROVED':
      case 'ORDERED':
      case 'RECEIVED':
      case 'COMPLETED':
      case 'OPEN':
      case 'PAID':
        return DesignTokens.statusCompleted;
      case 'DRAFT':
      case 'PENDING':
        return DesignTokens.statusPending;
      case 'PARTIALLY_RECEIVED':
      case 'PARTIALLY_REFUNDED':
      case 'PARTIALLY_PAID':
        return DesignTokens.warning;
      case 'REFUNDED':
        return DesignTokens.statusRefunded;
      case 'CANCELLED':
      case 'CLOSED':
      case 'EXPIRED':
      case 'REJECTED':
        return DesignTokens.statusCancelled;
      default:
        return DesignTokens.grey500;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final resolvedColor = color ?? colorFor(status);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xs,
        vertical: 3,
      ),
      decoration: BoxDecoration(
        color: resolvedColor.withOpacity(0.12),
        borderRadius: BorderRadius.circular(AppSpacing.radiusXs + 2),
        border: Border.all(color: resolvedColor.withOpacity(0.25)),
      ),
      child: Text(
        Formatters.status(status),
        style: theme.textTheme.labelSmall?.copyWith(
          color: resolvedColor,
          fontWeight: FontWeight.w600,
          fontSize: 11,
        ),
      ),
    );
  }
}
