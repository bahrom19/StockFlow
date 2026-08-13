import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';
import 'package:stockflow/core/theme/app_spacing.dart';
import 'package:stockflow/core/utils/formatters.dart';
import 'package:stockflow/features/sales/domain/cash_shift_models.dart';
import 'package:stockflow/features/sales/presentation/providers/cash_shift_provider.dart';

/// Cash shift strip above the POS workspace.
///
/// When no shift is open: an "Open Shift" prompt button.
/// When open: live totals + actions (X report, cash in/out, close shift).
/// Everything stays keyboard-accessible via the workspace hotkeys.
class PosShiftPanel extends ConsumerWidget {
  final String? warehouseId;
  final String warehouseName;
  final VoidCallback onOpenShift;
  final VoidCallback onXReport;
  final VoidCallback onCloseShift;
  final VoidCallback onCashIn;
  final VoidCallback onCashOut;

  const PosShiftPanel({
    super.key,
    required this.warehouseId,
    required this.warehouseName,
    required this.onOpenShift,
    required this.onXReport,
    required this.onCloseShift,
    required this.onCashIn,
    required this.onCashOut,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = Theme.of(context);
    final state = ref.watch(cashShiftProvider);
    final shift = state is ShiftLoaded ? state.current : null;
    final isOperating = state is ShiftLoaded && state.isOperating;

    final Color accent =
        (shift?.isOpen ?? false) ? const Color(0xFF0F9D58) : theme.colorScheme.primary;

    return Container(
      key: const Key('pos_shift_panel'),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      constraints: const BoxConstraints(minHeight: 40),
      decoration: BoxDecoration(
        color: accent.withOpacity(0.08),
        border: Border(
          bottom: BorderSide(color: accent.withOpacity(0.35)),
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.schedule, size: 16, color: accent),
          const SizedBox(width: AppSpacing.xs),
          if (shift?.isOpen ?? false) ...[
            Text(
              context.l10n.posShiftOpen,
              style: theme.textTheme.labelMedium?.copyWith(
                color: accent,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Flexible(
              child: Text(
                context.l10n.posShiftTotals(
                  Formatters.currency(shift!.bankTransferSalesValue),
                  Formatters.currency(shift.cardSalesValue),
                  Formatters.currency(shift.cashSalesValue),
                  Formatters.currency(shift.qrSalesValue),
                  Formatters.currency(shift.totalSalesValue),
                  Formatters.currency(shift.mobileWalletSalesValue),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            _ActionButton(
              icon: Icons.description_outlined,
              label: context.l10n.posXReport,
              tooltip: context.l10n.posTooltipXReport,
              onPressed: isOperating ? null : onXReport,
            ),
            const SizedBox(width: AppSpacing.xs),
            _ActionButton(
              icon: Icons.south_east,
              label: context.l10n.posCashInLabel,
              tooltip: context.l10n.posTooltipCashIn,
              onPressed: isOperating ? null : onCashIn,
            ),
            const SizedBox(width: AppSpacing.xs),
            _ActionButton(
              icon: Icons.north_west,
              label: context.l10n.posCashOutLabel,
              tooltip: context.l10n.posTooltipCashOut,
              onPressed: isOperating ? null : onCashOut,
            ),
            const Spacer(),
            _ActionButton(
              icon: Icons.lock_outline,
              label: context.l10n.posCloseShiftLabel,
              tooltip: context.l10n.posTooltipCloseShift,
              emphasize: true,
              onPressed: isOperating ? null : onCloseShift,
            ),
          ] else ...[
            Text(
              context.l10n.noOpenShift,
              style: theme.textTheme.labelMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                fontWeight: FontWeight.w600,
              ),
            ),
            if (warehouseId == null) ...[
              const SizedBox(width: AppSpacing.sm),
              Text(
                context.l10n.posSelectWarehouseFirstHint,
                style: theme.textTheme.bodySmall?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            ],
            const Spacer(),
            _ActionButton(
              icon: Icons.play_arrow,
              label: context.l10n.posOpenShift,
              tooltip: context.l10n.posTooltipOpenShift,
              emphasize: true,
              onPressed:
                  isOperating || warehouseId == null ? null : onOpenShift,
            ),
          ],
        ],
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final String tooltip;
  final VoidCallback? onPressed;
  final bool emphasize;

  const _ActionButton({
    required this.icon,
    required this.label,
    required this.tooltip,
    required this.onPressed,
    this.emphasize = false,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Tooltip(
      message: tooltip,
      child: TextButton.icon(
        style: TextButton.styleFrom(
          visualDensity: VisualDensity.compact,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          foregroundColor: emphasize ? const Color(0xFF0F9D58) : null,
          backgroundColor: emphasize
              ? const Color(0xFF0F9D58).withOpacity(0.1)
              : null,
        ),
        onPressed: onPressed,
        icon: Icon(icon, size: 15),
        label: Text(label, style: theme.textTheme.labelMedium),
      ),
    );
  }
}

/// Shared summary layout for X/Z reports.
class ShiftReportView extends StatelessWidget {
  final CashShift shift;
  final bool isZ; // Z closes the shift — shows difference/expected closing
  final DateTime? closedAt;

  const ShiftReportView({
    super.key,
    required this.shift,
    this.isZ = false,
    this.closedAt,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    Widget row(String label, double amount, {bool bold = false, Color? color}) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: theme.textTheme.bodyMedium?.copyWith(
                  fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
                )),
            Text(
              Formatters.currency(amount),
              style: theme.textTheme.bodyMedium?.copyWith(
                fontWeight: bold ? FontWeight.w800 : FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(
          child: Text(
            isZ ? context.l10n.posZReport : context.l10n.posXReport,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: 2),
        Center(
          child: Text(
            Formatters.dateTime(shift.openedAt),
            style: theme.textTheme.bodySmall?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ),
        const Divider(height: AppSpacing.md),
        row(context.l10n.posOpeningBalance, shift.openingBalanceValue),
        row(context.l10n.posCashSales, shift.cashSalesValue),
        row(context.l10n.posCardSales, shift.cardSalesValue),
        row(context.l10n.posQrSales, shift.qrSalesValue),
        row(context.l10n.posBankSales, shift.bankTransferSalesValue),
        row(context.l10n.posWalletSales, shift.mobileWalletSalesValue),
        row(context.l10n.posTotalSales, shift.totalSalesValue, bold: true),
        // Invariant: Cash + Card + QR + Bank + Wallet == Total Sales.
        if ((shift.methodsSum - shift.totalSalesValue).abs() > 0.005)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Text(
              context.l10n.posBreakdownWarning(
                Formatters.currency(shift.methodsSum),
              ),
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.error,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        row(context.l10n.posCashIn, shift.cashInValue),
        row(context.l10n.posCashOut, shift.cashOutValue),
        if (isZ) ...[
          const Divider(height: AppSpacing.sm),
          row(context.l10n.posExpectedClosing, shift.expectedClosingValue,
              bold: true),
          row(
            context.l10n.posDifference,
            shift.differenceValue,
            bold: true,
            color: shift.differenceValue.abs() < 0.005
                ? const Color(0xFF0F9D58)
                : const Color(0xFFD93025),
          ),
          if (closedAt != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Center(
                child: Text(
                  context.l10n.posClosedAt(Formatters.dateTime(closedAt)),
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ),
        ],
      ],
    );
  }
}
