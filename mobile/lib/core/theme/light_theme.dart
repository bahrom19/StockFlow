import 'package:flutter/material.dart';
import 'design_tokens.dart';
import 'app_typography.dart';
import 'app_spacing.dart';

/// StockFlow Enterprise Light Theme
class AppLightTheme {
  AppLightTheme._();

  static ThemeData get theme {
    final colorScheme = ColorScheme.light(
      primary: DesignTokens.primary,
      onPrimary: DesignTokens.white,
      primaryContainer: DesignTokens.primaryLight.withValues(alpha: 0.15),
      onPrimaryContainer: DesignTokens.primaryDark,
      secondary: DesignTokens.secondary,
      onSecondary: DesignTokens.white,
      secondaryContainer: DesignTokens.secondary.withValues(alpha: 0.15),
      onSecondaryContainer: DesignTokens.secondary,
      tertiary: DesignTokens.accent,
      onTertiary: DesignTokens.black,
      error: DesignTokens.error,
      onError: DesignTokens.white,
      errorContainer: DesignTokens.error.withValues(alpha: 0.15),
      onErrorContainer: DesignTokens.error,
      surface: DesignTokens.surface,
      onSurface: DesignTokens.grey900,
      onSurfaceVariant: DesignTokens.grey700,
      outline: DesignTokens.grey300,
      outlineVariant: DesignTokens.grey200,
      surfaceContainerHighest: DesignTokens.grey50,
      surfaceContainerLow: DesignTokens.white,
      surfaceContainer: DesignTokens.grey50,
      surfaceContainerHigh: DesignTokens.grey100,
      surfaceContainerHighest: DesignTokens.grey200,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      textTheme: AppTypography.lightTextTheme,
      scaffoldBackgroundColor: DesignTokens.background,
      appBarTheme: _appBarTheme(colorScheme),
      cardTheme: _cardTheme(colorScheme),
      elevatedButtonTheme: _elevatedButtonTheme(colorScheme),
      outlinedButtonTheme: _outlinedButtonTheme(colorScheme),
      textButtonTheme: _textButtonTheme(colorScheme),
      inputDecorationTheme: _inputDecorationTheme(colorScheme),
      chipTheme: _chipTheme(colorScheme),
      bottomNavigationBarTheme: _bottomNavTheme(colorScheme),
      navigationBarTheme: _navBarTheme(colorScheme),
      dividerTheme: _dividerTheme(colorScheme),
      dialogTheme: _dialogTheme(colorScheme),
      snackBarTheme: _snackBarTheme(colorScheme),
      bottomSheetTheme: _bottomSheetTheme(colorScheme),
      floatingActionButtonTheme: _fabTheme(colorScheme),
      progressIndicatorTheme: _progressTheme(colorScheme),
      listTileTheme: _listTileTheme(colorScheme),
      badgeTheme: _badgeTheme(colorScheme),
    );
  }

  static AppBarTheme _appBarTheme(ColorScheme colorScheme) {
    return AppBarTheme(
      elevation: 0,
      scrolledUnderElevation: 1,
      centerTitle: false,
      backgroundColor: colorScheme.surface,
      foregroundColor: colorScheme.onSurface,
      surfaceTintColor: Colors.transparent,
      titleTextStyle: AppTypography.lightTextTheme.titleLarge,
      iconTheme: IconThemeData(color: colorScheme.onSurfaceVariant),
    );
  }

  static CardTheme _cardTheme(ColorScheme colorScheme) {
    return CardTheme(
      elevation: 0,
      margin: EdgeInsets.zero,
      color: colorScheme.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        side: BorderSide(color: colorScheme.outlineVariant, width: AppSpacing.borderSm),
      ),
      clipBehavior: Clip.antiAlias,
    );
  }

  static ElevatedButtonThemeData _elevatedButtonTheme(ColorScheme colorScheme) {
    return ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        elevation: 0,
        backgroundColor: colorScheme.primary,
        foregroundColor: colorScheme.onPrimary,
        disabledBackgroundColor: colorScheme.surfaceContainerHighest,
        disabledForegroundColor: colorScheme.onSurfaceVariant,
        minimumSize: const Size(double.infinity, AppSpacing.buttonMd),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        ),
        textStyle: AppTypography.lightTextTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w600,
        ),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl, vertical: AppSpacing.sm),
      ),
    );
  }

  static OutlinedButtonThemeData _outlinedButtonTheme(ColorScheme colorScheme) {
    return OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        elevation: 0,
        foregroundColor: colorScheme.primary,
        disabledForegroundColor: colorScheme.onSurfaceVariant,
        side: BorderSide(color: colorScheme.outline, width: AppSpacing.borderSm),
        minimumSize: const Size(double.infinity, AppSpacing.buttonMd),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        ),
        textStyle: AppTypography.lightTextTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w600,
        ),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl, vertical: AppSpacing.sm),
      ),
    );
  }

  static TextButtonThemeData _textButtonTheme(ColorScheme colorScheme) {
    return TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: colorScheme.primary,
        disabledForegroundColor: colorScheme.onSurfaceVariant,
        textStyle: AppTypography.lightTextTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w600,
        ),
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
      ),
    );
  }

  static InputDecorationTheme _inputDecorationTheme(ColorScheme colorScheme) {
    return InputDecorationTheme(
      filled: true,
      fillColor: colorScheme.surface,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        borderSide: BorderSide(color: colorScheme.outline, width: AppSpacing.borderSm),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        borderSide: BorderSide(color: colorScheme.outline, width: AppSpacing.borderSm),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        borderSide: BorderSide(color: colorScheme.primary, width: AppSpacing.borderMd),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        borderSide: BorderSide(color: colorScheme.error, width: AppSpacing.borderSm),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        borderSide: BorderSide(color: colorScheme.error, width: AppSpacing.borderMd),
      ),
      labelStyle: AppTypography.lightTextTheme.bodyMedium,
      hintStyle: AppTypography.lightTextTheme.bodySmall?.copyWith(
        color: colorScheme.onSurfaceVariant,
      ),
      errorStyle: AppTypography.lightTextTheme.bodySmall?.copyWith(
        color: colorScheme.error,
      ),
    );
  }

  static ChipThemeData _chipTheme(ColorScheme colorScheme) {
    return ChipThemeData(
      backgroundColor: colorScheme.surfaceContainerHighest,
      disabledColor: colorScheme.surfaceContainerHighest,
      selectedColor: colorScheme.primaryContainer,
      secondarySelectedColor: colorScheme.primaryContainer,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
      labelStyle: AppTypography.lightTextTheme.labelMedium,
      secondaryLabelStyle: AppTypography.lightTextTheme.labelMedium,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusFull),
      ),
    );
  }

  static BottomNavigationBarThemeData _bottomNavTheme(ColorScheme colorScheme) {
    return BottomNavigationBarThemeData(
      elevation: 0,
      backgroundColor: colorScheme.surface,
      selectedItemColor: colorScheme.primary,
      unselectedItemColor: colorScheme.onSurfaceVariant,
      type: BottomNavigationBarType.fixed,
      selectedLabelStyle: AppTypography.lightTextTheme.labelSmall,
      unselectedLabelStyle: AppTypography.lightTextTheme.labelSmall,
    );
  }

  static NavigationBarThemeData _navBarTheme(ColorScheme colorScheme) {
    return NavigationBarThemeData(
      elevation: 0,
      backgroundColor: colorScheme.surface,
      indicatorColor: colorScheme.primaryContainer,
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        if (states.contains(WidgetState.selected)) {
          return AppTypography.lightTextTheme.labelSmall?.copyWith(
            fontWeight: FontWeight.w600,
            color: colorScheme.primary,
          );
        }
        return AppTypography.lightTextTheme.labelSmall;
      }),
    );
  }

  static DividerThemeData _dividerTheme(ColorScheme colorScheme) {
    return DividerThemeData(
      color: colorScheme.outlineVariant,
      thickness: AppSpacing.borderSm,
      space: AppSpacing.md,
    );
  }

  static DialogTheme _dialogTheme(ColorScheme colorScheme) {
    return DialogTheme(
      backgroundColor: colorScheme.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
      ),
    );
  }

  static SnackBarThemeData _snackBarTheme(ColorScheme colorScheme) {
    return SnackBarThemeData(
      backgroundColor: colorScheme.inverseSurface,
      contentTextStyle: AppTypography.lightTextTheme.bodyMedium?.copyWith(
        color: colorScheme.onInverseSurface,
      ),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
      ),
      behavior: SnackBarBehavior.floating,
    );
  }

  static BottomSheetThemeData _bottomSheetTheme(ColorScheme colorScheme) {
    return BottomSheetThemeData(
      backgroundColor: colorScheme.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppSpacing.radiusLg)),
      ),
    );
  }

  static FloatingActionButtonThemeData _fabTheme(ColorScheme colorScheme) {
    return FloatingActionButtonThemeData(
      backgroundColor: colorScheme.primary,
      foregroundColor: colorScheme.onPrimary,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
      ),
    );
  }

  static ProgressIndicatorThemeData _progressTheme(ColorScheme colorScheme) {
    return ProgressIndicatorThemeData(
      color: colorScheme.primary,
      linearTrackColor: colorScheme.surfaceContainerHighest,
      circularTrackColor: colorScheme.surfaceContainerHighest,
    );
  }

  static ListTileThemeData _listTileTheme(ColorScheme colorScheme) {
    return ListTileThemeData(
      contentPadding: AppSpacing.listTilePadding,
      titleTextStyle: AppTypography.lightTextTheme.bodyLarge,
      subtitleTextStyle: AppTypography.lightTextTheme.bodySmall,
      leadingAndTrailingTextStyle: AppTypography.lightTextTheme.bodyMedium,
      iconColor: colorScheme.onSurfaceVariant,
    );
  }

  static BadgeThemeData _badgeTheme(ColorScheme colorScheme) {
    return BadgeThemeData(
      backgroundColor: colorScheme.error,
      textColor: colorScheme.onError,
      textStyle: AppTypography.lightTextTheme.labelSmall,
    );
  }
}
