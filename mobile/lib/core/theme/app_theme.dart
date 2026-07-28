import 'package:flutter/material.dart';
import 'light_theme.dart';
import 'dark_theme.dart';

/// StockFlow Enterprise Theme Manager
class AppTheme {
  AppTheme._();

  static ThemeData get light => AppLightTheme.theme;
  static ThemeData get dark => AppDarkTheme.theme;

  static ThemeData of(BuildContext context) =>
      Theme.of(context);

  static ColorScheme colorsOf(BuildContext context) =>
      Theme.of(context).colorScheme;

  static TextTheme textOf(BuildContext context) =>
      Theme.of(context).textTheme;
}
