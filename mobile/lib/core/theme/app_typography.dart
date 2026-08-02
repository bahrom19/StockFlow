import 'package:flutter/material.dart';
import 'design_tokens.dart';

/// StockFlow App Typography System
/// Follows Material 3 type scale with enterprise adjustments.
class AppTypography {
  AppTypography._();

  // ──────────────────────────────────
  // Font Families
  // ──────────────────────────────────
  static const String _primaryFont = 'Roboto';

  // ──────────────────────────────────
  // Light Theme Text Theme
  // ──────────────────────────────────
  static TextTheme get lightTextTheme {
    return const TextTheme(
      displayLarge: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 57,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.25,
        color: DesignTokens.grey900,
      ),
      displayMedium: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 45,
        fontWeight: FontWeight.w700,
        letterSpacing: 0,
        color: DesignTokens.grey900,
      ),
      displaySmall: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 36,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        color: DesignTokens.grey900,
      ),
      headlineLarge: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 32,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        color: DesignTokens.grey900,
      ),
      headlineMedium: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 28,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        color: DesignTokens.grey900,
      ),
      headlineSmall: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 24,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        color: DesignTokens.grey900,
      ),
      titleLarge: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 22,
        fontWeight: FontWeight.w500,
        letterSpacing: 0,
        color: DesignTokens.grey900,
      ),
      titleMedium: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 16,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.15,
        color: DesignTokens.grey900,
      ),
      titleSmall: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 14,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.1,
        color: DesignTokens.grey900,
      ),
      labelLarge: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 14,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.1,
        color: DesignTokens.grey900,
      ),
      labelMedium: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 12,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.5,
        color: DesignTokens.grey700,
      ),
      labelSmall: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 11,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.5,
        color: DesignTokens.grey700,
      ),
      bodyLarge: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 16,
        fontWeight: FontWeight.w400,
        letterSpacing: 0.5,
        color: DesignTokens.grey800,
      ),
      bodyMedium: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 14,
        fontWeight: FontWeight.w400,
        letterSpacing: 0.25,
        color: DesignTokens.grey800,
      ),
      bodySmall: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 12,
        fontWeight: FontWeight.w400,
        letterSpacing: 0.4,
        color: DesignTokens.grey700,
      ),
    );
  }

  // ──────────────────────────────────
  // Dark Theme Text Theme
  // ──────────────────────────────────
  static TextTheme get darkTextTheme {
    return const TextTheme(
      displayLarge: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 57,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.25,
        color: DesignTokens.darkText,
      ),
      displayMedium: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 45,
        fontWeight: FontWeight.w700,
        letterSpacing: 0,
        color: DesignTokens.darkText,
      ),
      displaySmall: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 36,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        color: DesignTokens.darkText,
      ),
      headlineLarge: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 32,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        color: DesignTokens.darkText,
      ),
      headlineMedium: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 28,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        color: DesignTokens.darkText,
      ),
      headlineSmall: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 24,
        fontWeight: FontWeight.w600,
        letterSpacing: 0,
        color: DesignTokens.darkText,
      ),
      titleLarge: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 22,
        fontWeight: FontWeight.w500,
        letterSpacing: 0,
        color: DesignTokens.darkText,
      ),
      titleMedium: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 16,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.15,
        color: DesignTokens.darkText,
      ),
      titleSmall: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 14,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.1,
        color: DesignTokens.darkText,
      ),
      labelLarge: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 14,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.1,
        color: DesignTokens.darkText,
      ),
      labelMedium: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 12,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.5,
        color: DesignTokens.darkTextSecondary,
      ),
      labelSmall: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 11,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.5,
        color: DesignTokens.darkTextSecondary,
      ),
      bodyLarge: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 16,
        fontWeight: FontWeight.w400,
        letterSpacing: 0.5,
        color: DesignTokens.darkText,
      ),
      bodyMedium: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 14,
        fontWeight: FontWeight.w400,
        letterSpacing: 0.25,
        color: DesignTokens.darkText,
      ),
      bodySmall: TextStyle(
        fontFamily: _primaryFont,
        fontSize: 12,
        fontWeight: FontWeight.w400,
        letterSpacing: 0.4,
        color: DesignTokens.darkTextSecondary,
      ),
    );
  }
}
