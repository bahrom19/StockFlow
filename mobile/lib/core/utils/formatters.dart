import 'package:intl/intl.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';

/// StockFlow Formatting Utilities
class Formatters {
  Formatters._();

  // ──────────────────────────────────
  // Currency
  // ──────────────────────────────────
  /// Formats [value] with the symbol of [currency] (default `KZT` → `₸`).
  ///
  /// Phase 4: symbol comes from [CurrencyCatalog]; layout/rounding/decimal
  /// digits are unchanged (symbol prefix, 2 decimals, `1,234.56` grouping).
  static String currency(dynamic value, {String currency = 'KZT'}) {
    return CurrencyCatalog.format(value, code: currency);
  }

  /// Backward-compatible compact variant; when [locale] is provided the RU/KK
  /// suffixes (`тыс.`/`млн`/`мың`) are applied instead of `K`/`M`.
  static String currencyShort(dynamic value,
      {String currency = 'KZT', String? locale}) {
    return CurrencyCatalog.formatShort(value, code: currency, locale: locale);
  }

  // ──────────────────────────────────
  // Percentage
  // ──────────────────────────────────
  static String percentage(dynamic value) {
    final num amount = _parseNumeric(value);
    return '${amount.toStringAsFixed(1)}%';
  }

  // ──────────────────────────────────
  // Quantity
  // ──────────────────────────────────
  static String quantity(dynamic value, {int decimals = 2}) {
    final num amount = _parseNumeric(value);
    return amount.toStringAsFixed(decimals);
  }

  // ──────────────────────────────────
  // Dates
  // ──────────────────────────────────
  static String date(DateTime? date, {String? locale}) {
    if (date == null) return '-';
    return DateFormat.yMMMd(locale).format(date);
  }

  static String dateTime(DateTime? date, {String? locale}) {
    if (date == null) return '-';
    return DateFormat.yMMMd(locale).add_Hm().format(date);
  }

  static String time(DateTime? date) {
    if (date == null) return '-';
    return DateFormat('HH:mm').format(date);
  }

  static String relativeTime(DateTime? date) {
    if (date == null) return '-';
    final now = DateTime.now();
    final diff = now.difference(date);

    if (diff.inDays > 365) return '${(diff.inDays / 365).floor()}y ago';
    if (diff.inDays > 30) return '${(diff.inDays / 30).floor()}mo ago';
    if (diff.inDays > 7) return '${(diff.inDays / 7).floor()}w ago';
    if (diff.inDays > 0) return '${diff.inDays}d ago';
    if (diff.inHours > 0) return '${diff.inHours}h ago';
    if (diff.inMinutes > 0) return '${diff.inMinutes}m ago';
    return 'just now';
  }

  // ──────────────────────────────────
  // Status
  // ──────────────────────────────────
  static String status(String? status) {
    if (status == null) return '-';
    return status.replaceAll('_', ' ').split(' ').map((word) {
      if (word.isEmpty) return '';
      return '${word[0].toUpperCase()}${word.substring(1).toLowerCase()}';
    }).join(' ');
  }

  // ──────────────────────────────────
  // Helpers
  // ──────────────────────────────────
  static num _parseNumeric(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value;
    if (value is String) return num.tryParse(value) ?? 0;
    return 0;
  }
}
