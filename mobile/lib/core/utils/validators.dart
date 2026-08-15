import 'package:flutter_gen/gen_l10n/app_localizations.dart';

/// StockFlow Form Validators
class Validators {
  Validators._();

  /// Required check with the English default message (used by non-localized
  /// forms). Pass [l10n] through [requiredL10n] to localize it, or pass
  /// [l10n] directly here to localize the "{field} is required" template so
  /// localized field names never render in mixed-language text.
  static String? required(String? value,
      [String fieldName = 'This field', AppLocalizations? l10n]) {
    if (value == null || value.trim().isEmpty) {
      return l10n?.requiredField(fieldName) ?? '$fieldName is required';
    }
    return null;
  }

  /// Localized variant of [required] for the default field name — used by
  /// localized screens (Phase 1: auth forms). Falls back to English when
  /// [l10n] is null, so existing call sites keep working unchanged.
  static String? requiredL10n(AppLocalizations? l10n, String? value) {
    if (value == null || value.trim().isEmpty) {
      return l10n?.fieldRequired ?? 'This field is required';
    }
    return null;
  }

  /// Email check. [l10n] is optional — when provided the messages are
  /// localized, otherwise the original English messages are returned, so
  /// existing tear-off call sites (`validator: Validators.email`) keep
  /// working unchanged.
  static String? email(String? value, [AppLocalizations? l10n]) {
    if (value == null || value.trim().isEmpty) {
      return l10n?.emailRequired ?? 'Email is required';
    }
    final emailRegex = RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');
    if (!emailRegex.hasMatch(value.trim())) {
      return l10n?.invalidEmail ?? 'Please enter a valid email address';
    }
    return null;
  }

  /// Password check with localized messages when [l10n] is provided.
  static String? password(String? value, [AppLocalizations? l10n]) {
    if (value == null || value.isEmpty) {
      return l10n?.passwordRequired ?? 'Password is required';
    }
    if (value.length < 8) {
      return l10n?.passwordMinLength ??
          'Password must be at least 8 characters';
    }
    if (!value.contains(RegExp(r'[A-Z]'))) {
      return l10n?.passwordUppercase ??
          'Password must contain at least one uppercase letter';
    }
    if (!value.contains(RegExp(r'[a-z]'))) {
      return l10n?.passwordLowercase ??
          'Password must contain at least one lowercase letter';
    }
    if (!value.contains(RegExp(r'[0-9]'))) {
      return l10n?.passwordNumber ??
          'Password must contain at least one number';
    }
    return null;
  }

  /// Phone check. [l10n] is optional — when provided the message is
  /// localized, otherwise the original English message is returned, so
  /// existing tear-off call sites keep working unchanged.
  static String? phone(String? value, [AppLocalizations? l10n]) {
    if (value == null || value.trim().isEmpty) {
      return null; // Phone is optional
    }
    final phoneRegex = RegExp(r'^\+?[\d\s\-()]{7,20}$');
    if (!phoneRegex.hasMatch(value.trim())) {
      return l10n?.invalidPhone ?? 'Please enter a valid phone number';
    }
    return null;
  }

  /// Decimal check. [l10n] is optional — when provided the messages are
  /// localized, otherwise the original English messages are returned.
  /// [fieldName] is the display label; when omitted the localized default
  /// label is used.
  static String? decimal(String? value,
      [String? fieldName, AppLocalizations? l10n]) {
    if (value == null || value.trim().isEmpty) {
      return l10n?.requiredField(fieldName ?? l10n.fieldValue) ??
          '${fieldName ?? 'Value'} is required';
    }
    final decimalRegex = RegExp(r'^\d+(\.\d{1,4})?$');
    if (!decimalRegex.hasMatch(value.trim())) {
      return l10n?.invalidDecimal ?? 'Please enter a valid decimal number';
    }
    return null;
  }

  /// Minimum-value check. [l10n] is optional — when provided the message is
  /// localized, otherwise the original English message is returned.
  static String? min(double minValue, String? value,
      [String? fieldName, AppLocalizations? l10n]) {
    if (value == null || value.trim().isEmpty) {
      return null;
    }
    final parsed = double.tryParse(value.trim());
    if (parsed == null || parsed < minValue) {
      return l10n?.minValueMessage(fieldName ?? l10n.fieldValue, minValue) ??
          '${fieldName ?? 'Value'} must be at least $minValue';
    }
    return null;
  }

  /// Maximum-value check. [l10n] is optional — when provided the message is
  /// localized, otherwise the original English message is returned.
  static String? max(double maxValue, String? value,
      [String? fieldName, AppLocalizations? l10n]) {
    if (value == null || value.trim().isEmpty) {
      return null;
    }
    final parsed = double.tryParse(value.trim());
    if (parsed == null || parsed > maxValue) {
      return l10n?.maxValueMessage(fieldName ?? l10n.fieldValue, maxValue) ??
          '${fieldName ?? 'Value'} must not exceed $maxValue';
    }
    return null;
  }
}
