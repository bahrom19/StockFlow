import 'package:flutter/material.dart';

/// StockFlow Enterprise Spacing System
/// Based on 4px grid system for visual consistency.
class AppSpacing {
  AppSpacing._();

  // ──────────────────────────────────
  // Spacing Scale (4px base)
  // ──────────────────────────────────
  static const double xxxs = 2;
  static const double xxs = 4;
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 40;
  static const double xxxxl = 48;
  static const double huge = 64;

  // ──────────────────────────────────
  // Radius
  // ──────────────────────────────────
  static const double radiusXs = 4;
  static const double radiusSm = 8;
  static const double radiusMd = 12;
  static const double radiusLg = 16;
  static const double radiusXl = 20;
  static const double radiusFull = 999;

  // ──────────────────────────────────
  // Border Width
  // ──────────────────────────────────
  static const double borderXs = 0.5;
  static const double borderSm = 1;
  static const double borderMd = 1.5;
  static const double borderLg = 2;
  static const double borderXl = 3;

  // ──────────────────────────────────
  // Icon Sizes
  // ──────────────────────────────────
  static const double iconXs = 16;
  static const double iconSm = 20;
  static const double iconMd = 24;
  static const double iconLg = 28;
  static const double iconXl = 32;

  // ──────────────────────────────────
  // Button Heights
  // ──────────────────────────────────
  static const double buttonSm = 36;
  static const double buttonMd = 44;
  static const double buttonLg = 52;

  // ──────────────────────────────────
  // Input Heights
  // ──────────────────────────────────
  static const double inputSm = 40;
  static const double inputMd = 48;
  static const double inputLg = 56;

  // ──────────────────────────────────
  // App Bar / Sidebar
  // ──────────────────────────────────
  static const double appBarHeight = 64;

  /// Fixed width of the desktop navigation sidebar.
  ///
  /// The sidebar is a non-flexible child of the shell Row; without a bounded
  /// width Flutter lays it out with unbounded constraints and any internal
  /// Expanded (e.g. the brand row in _SidebarHeader) throws
  /// "RenderFlex children have non-zero flex but incoming width constraints
  /// are unbounded" → blank dashboard after login.
  static const double sidebarWidth = 260;

  // ──────────────────────────────────
  // Bottom Navigation
  // ──────────────────────────────────
  static const double bottomNavHeight = 64;

  // ──────────────────────────────────
  // Edge Insets
  // ──────────────────────────────────
  static const EdgeInsets screenPadding = EdgeInsets.all(md);
  static const EdgeInsets screenPaddingHorizontal = EdgeInsets.symmetric(horizontal: md);
  static const EdgeInsets screenPaddingVertical = EdgeInsets.symmetric(vertical: md);
  static const EdgeInsets cardPadding = EdgeInsets.all(md);
  static const EdgeInsets listTilePadding = EdgeInsets.symmetric(horizontal: md, vertical: sm);

  // ──────────────────────────────────
  // Responsive Breakpoints
  // ──────────────────────────────────
  static const double breakpointMobile = 360;
  static const double breakpointTablet = 600;
  static const double breakpointDesktop = 900;
  static const double breakpointWide = 1200;
}

/// Extension to get responsive values based on screen width.
extension ResponsiveExtension on BuildContext {
  bool get isMobile => MediaQuery.of(this).size.width < AppSpacing.breakpointTablet;
  bool get isTablet =>
      MediaQuery.of(this).size.width >= AppSpacing.breakpointTablet &&
      MediaQuery.of(this).size.width < AppSpacing.breakpointDesktop;
  bool get isDesktop => MediaQuery.of(this).size.width >= AppSpacing.breakpointDesktop;
  bool get isWide => MediaQuery.of(this).size.width >= AppSpacing.breakpointWide;

  T responsive<T>({required T mobile, T? tablet, T? desktop, T? wide}) {
    final width = MediaQuery.of(this).size.width;
    if (width >= AppSpacing.breakpointWide && wide != null) return wide;
    if (width >= AppSpacing.breakpointDesktop && desktop != null) return desktop;
    if (width >= AppSpacing.breakpointTablet && tablet != null) return tablet;
    return mobile;
  }

  double get responsiveWidth =>
      responsive<double>(mobile: 0.95, tablet: 0.85, desktop: 0.75, wide: 0.65);
}
