import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/theme/app_theme.dart';
import 'package:stockflow/core/theme/design_tokens.dart';
import 'package:stockflow/core/theme/app_spacing.dart';

void main() {
  group('AppTheme', () {
    test('light theme should have correct brightness', () {
      final theme = AppTheme.light;
      expect(theme.brightness, Brightness.light);
      expect(theme.useMaterial3, isTrue);
    });

    test('dark theme should have correct brightness', () {
      final theme = AppTheme.dark;
      expect(theme.brightness, Brightness.dark);
      expect(theme.useMaterial3, isTrue);
    });
  });

  group('DesignTokens', () {
    test('should have correct primary color', () {
      expect(DesignTokens.primary, const Color(0xFF1A73E8));
    });

    test('should have correct error color', () {
      expect(DesignTokens.error, const Color(0xFFEA4335));
    });

    test('should have correct success color', () {
      expect(DesignTokens.success, const Color(0xFF0F9D58));
    });
  });

  group('AppSpacing', () {
    test('should have valid spacing values', () {
      expect(AppSpacing.xs, 8);
      expect(AppSpacing.md, 16);
      expect(AppSpacing.lg, 20);
      expect(AppSpacing.xl, 24);
    });

    test('should have valid radius values', () {
      expect(AppSpacing.radiusSm, 8);
      expect(AppSpacing.radiusMd, 12);
    });
  });
}
