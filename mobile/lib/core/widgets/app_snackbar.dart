import 'package:flutter/material.dart';
import 'package:stockflow/core/localization/error_labels.dart';
import 'package:stockflow/core/localization/l10n_ext.dart';

/// StockFlow Snackbar Helpers
class AppSnackbar {
  AppSnackbar._();

  static void success(BuildContext context, String message) {
    _show(context, message, Colors.green);
  }

  static void error(BuildContext context, String message) {
    _show(context, message, Colors.red);
  }

  static void warning(BuildContext context, String message) {
    _show(context, message, Colors.orange);
  }

  static void info(BuildContext context, String message) {
    _show(context, message, Colors.blue);
  }

  static void _show(BuildContext context, String message, Color color) {
    // Render-time localization applies to FAILURE messages only (red
    // snackbars): canonical English fallbacks baked into `Failure.message`
    // are substituted with the localized err* label (RU/KK). Success / info /
    // warning messages are always composed from l10n at the call site, so
    // they must pass through unchanged — routing them through
    // `localizedErrorLabel` overwrote them with the generic server fallback
    // (`errGenericServer`) in RU/KK (e.g. after successfully adding a
    // product the user saw an error text instead of the success message).
    final label = color == Colors.red
        ? localizedErrorLabel(context.l10n, message)
        : message;
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          content: Row(
            children: [
              Icon(
                _iconForColor(color),
                color: Colors.white,
                size: 20,
              ),
              const SizedBox(width: 12),
              Expanded(child: Text(label)),
            ],
          ),
          backgroundColor: color,
          behavior: SnackBarBehavior.floating,
          margin: const EdgeInsets.all(16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          action: SnackBarAction(
            label: context.l10n.dismiss,
            textColor: Colors.white,
            onPressed: () => ScaffoldMessenger.of(context).hideCurrentSnackBar(),
          ),
        ),
      );
  }

  static IconData _iconForColor(Color color) {
    if (color == Colors.green) return Icons.check_circle;
    if (color == Colors.red) return Icons.error;
    if (color == Colors.orange) return Icons.warning;
    return Icons.info;
  }
}
