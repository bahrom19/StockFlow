import 'package:flutter/material.dart';
import '../theme/app_spacing.dart';

/// StockFlow Bottom Sheet Helpers
class AppBottomSheet {
  AppBottomSheet._();

  /// Options bottom sheet with a list of choices
  static Future<T?> options<T>(
    BuildContext context, {
    required String title,
    required List<BottomSheetOption<T>> options,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: AppSpacing.sm),
              ...options.map((option) => ListTile(
                    leading: option.icon != null ? Icon(option.icon) : null,
                    title: Text(option.label),
                    onTap: () => Navigator.of(context).pop(option.value),
                  )),
            ],
          ),
        ),
      ),
    );
  }

  /// Info bottom sheet
  static void info(
    BuildContext context, {
    required String title,
    required Widget content,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom,
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(title, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: AppSpacing.md),
                content,
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Bottom sheet option model
class BottomSheetOption<T> {
  final String label;
  final IconData? icon;
  final T value;

  const BottomSheetOption({
    required this.label,
    this.icon,
    required this.value,
  });
}
