import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// BuildContext Extensions
extension ContextExtensions on BuildContext {
  // ──────────────────────────────────
  // Theme
  // ──────────────────────────────────
  ThemeData get theme => Theme.of(this);
  TextTheme get textTheme => theme.textTheme;
  ColorScheme get colorScheme => theme.colorScheme;

  bool get isDark => theme.brightness == Brightness.dark;

  // ──────────────────────────────────
  // Media Query
  // ──────────────────────────────────
  MediaQueryData get mediaQuery => MediaQuery.of(this);
  Size get screenSize => mediaQuery.size;
  double get screenWidth => screenSize.width;
  double get screenHeight => screenSize.height;
  double get statusBarHeight => mediaQuery.padding.top;
  double get bottomBarHeight => mediaQuery.padding.bottom;

  bool get isKeyboardVisible => mediaQuery.viewInsets.bottom > 0;

  // ──────────────────────────────────
  // Navigation
  // ──────────────────────────────────
  void pop<T extends Object?>([T? result]) => context.pop<T>(result);
  void go(String location) => context.go(location);
  void push(String location) => context.push(location);
  void replace(String location) => context.replace(location);

  // ──────────────────────────────────
  // Safe Area
  // ──────────────────────────────────
  EdgeInsets get padding => MediaQuery.paddingOf(this);
}
