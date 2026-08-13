import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/utils/formatters.dart';

/// StockFlow status badge — maps business status strings to consistent
/// colored pills across every module (sales, purchasing, inventory...).
class StatusBadge extends StatelessWidget {
  final String status;
  final Color? color;

  const StatusBadge({super.key, required this.status, this.color});

  /// Central localized label for a backend status value.
  ///
  /// Phase 3A: every module renders statuses through this helper so RU/KK UI
  /// never shows raw enums. Unknown values fall back to [Formatters.status]
  /// (title-cased), keeping the historical rendering for anything new.
  static String statusLabel(String status, AppLocalizations l10n) {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
        return l10n.statusActive;
      case 'INACTIVE':
        return l10n.statusInactive;
      case 'DRAFT':
        return l10n.statusDraft;
      case 'PENDING':
        return l10n.statusPending;
      case 'COMPLETED':
        return l10n.statusCompleted;
      case 'CANCELLED':
        return l10n.statusCancelled;
      case 'REFUNDED':
        return l10n.statusRefunded;
      case 'PARTIALLY_REFUNDED':
        return l10n.statusPartiallyRefunded;
      case 'APPROVED':
        return l10n.statusApproved;
      case 'ORDERED':
        return l10n.statusOrdered;
      case 'PARTIALLY_RECEIVED':
        return l10n.statusPartiallyReceived;
      case 'RECEIVED':
        return l10n.statusReceived;
      case 'OPEN':
        return l10n.statusOpen;
      case 'CLOSED':
        return l10n.statusClosed;
      case 'PAID':
        return l10n.statusPaid;
      case 'PARTIALLY_PAID':
        return l10n.statusPartiallyPaid;
      case 'EXPIRED':
        return l10n.statusExpired;
      case 'REJECTED':
        return l10n.statusRejected;
      // Stock movement types (Phase 3B) — rendered by the movements table.
      case 'SALE':
        return l10n.movementSale;
      case 'PURCHASE':
        return l10n.movementPurchase;
      case 'TRANSFER_IN':
        return l10n.movementTransferIn;
      case 'TRANSFER_OUT':
        return l10n.movementTransferOut;
      case 'ADJUSTMENT':
        return l10n.movementAdjustment;
      case 'RETURN':
        return l10n.movementReturn;
      case 'LOSS':
        return l10n.movementLoss;
      case 'CORRECTION':
        return l10n.movementCorrection;
      // Stock levels (POS catalog + inventory cells).
      case 'OUT':
        return l10n.levelOut;
      case 'LOW':
        return l10n.levelLow;
      case 'OK':
        return l10n.levelOk;
      default:
        return Formatters.status(status);
    }
  }

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
        StatusBadge.statusLabel(status, context.l10n),
        style: theme.textTheme.labelSmall?.copyWith(
          color: resolvedColor,
          fontWeight: FontWeight.w600,
          fontSize: 11,
        ),
      ),
    );
  }
}
