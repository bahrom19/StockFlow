import 'package:flutter/material.dart';

/// StockFlow Enterprise Design Tokens
/// Central source of truth for all design decisions.
class DesignTokens {
  DesignTokens._();

  // ──────────────────────────────────
  // Brand Colors
  // ──────────────────────────────────
  static const Color primary = Color(0xFF1A73E8);
  static const Color primaryLight = Color(0xFF4A90D9);
  static const Color primaryDark = Color(0xFF0D47A1);
  static const Color secondary = Color(0xFF34A853);
  static const Color accent = Color(0xFFFBBC04);
  static const Color error = Color(0xFFEA4335);
  static const Color warning = Color(0xFFFB8C00);
  static const Color success = Color(0xFF0F9D58);
  static const Color info = Color(0xFF4285F4);

  // ──────────────────────────────────
  // Neutral Colors
  // ──────────────────────────────────
  static const Color white = Color(0xFFFFFFFF);
  static const Color background = Color(0xFFF8F9FA);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color grey50 = Color(0xFFF8F9FA);
  static const Color grey100 = Color(0xFFF1F3F4);
  static const Color grey200 = Color(0xFFE8EAED);
  static const Color grey300 = Color(0xFFDADCE0);
  static const Color grey400 = Color(0xFFBDC1C6);
  static const Color grey500 = Color(0xFF9AA0A6);
  static const Color grey600 = Color(0xFF80868B);
  static const Color grey700 = Color(0xFF5F6368);
  static const Color grey800 = Color(0xFF3C4043);
  static const Color grey900 = Color(0xFF202124);
  static const Color black = Color(0xFF000000);

  // ──────────────────────────────────
  // Dark Theme Colors
  // ──────────────────────────────────
  static const Color darkBackground = Color(0xFF1A1C1E);
  static const Color darkSurface = Color(0xFF2D2F31);
  static const Color darkSurfaceHigh = Color(0xFF383B3E);
  static const Color darkText = Color(0xFFE8EAED);
  static const Color darkTextSecondary = Color(0xFF9AA0A6);

  // ──────────────────────────────────
  // Status Colors
  // ──────────────────────────────────
  static const Color statusDraft = Color(0xFF9AA0A6);
  static const Color statusPending = Color(0xFFFBBC04);
  static const Color statusActive = Color(0xFF34A853);
  static const Color statusCompleted = Color(0xFF0F9D58);
  static const Color statusCancelled = Color(0xFFEA4335);
  static const Color statusRefunded = Color(0xFFFB8C00);
  static const Color statusOverdue = Color(0xFFD93025);

  // ──────────────────────────────────
  // Financial Colors
  // ──────────────────────────────────
  static const Color revenue = Color(0xFF0F9D58);
  static const Color expense = Color(0xFFEA4335);
  static const Color profit = Color(0xFF1A73E8);
}
