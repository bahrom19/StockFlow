import 'package:flutter/material.dart';
import '../theme/app_spacing.dart';

/// StockFlow Loading Widgets
class AppLoading {
  AppLoading._();

  /// Full-screen loading overlay
  static OverlayEntry overlay({String? message}) {
    return OverlayEntry(
      builder: (context) => Container(
        color: Colors.black26,
        child: Center(
          child: Card(
            margin: const EdgeInsets.all(AppSpacing.xl),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const CircularProgressIndicator(),
                  if (message != null) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(message, style: Theme.of(context).textTheme.bodyMedium),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// Inline loading spinner
  static Widget inline({double size = 24}) => Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: SizedBox(
            width: size,
            height: size,
            child: const CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );

  /// Button-sized loading indicator
  static Widget button({double size = 20}) => SizedBox(
        width: size,
        height: size,
        child: const CircularProgressIndicator(
          strokeWidth: 2,
          color: Colors.white,
        ),
      );
}
