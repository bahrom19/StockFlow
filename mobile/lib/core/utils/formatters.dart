import 'package:intl/intl.dart';

/// StockFlow Formatting Utilities
class Formatters {
  Formatters._();

  // ──────────────────────────────────
  // Currency
  // ──────────────────────────────────
  static final NumberFormat _currencyFormat = NumberFormat.currency(
    symbol: '\$',
    decimalDigits: 2,
  );

  static String currency(dynamic value) {
    final num amount = _parseNumeric(value);
    return _currencyFormat.format(amount);
  }

  static String currencyShort(dynamic value) {
    final num amount = _parseNumeric(value);
    if (amount >= 1000000) {
      return '\$${(amount / 1000000).toStringAsFixed(1)}M';
    } else if (amount >= 1000) {
      return '\$${(amount / 1000).toStringAsFixed(1)}K';
    }
    return _currencyFormat.format(amount);
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
  static String date(DateTime? date) {
    if (date == null) return '-';
    return DateFormat('MMM dd, yyyy').format(date);
  }

  static String dateTime(DateTime? date) {
    if (date == null) return '-';
    return DateFormat('MMM dd, yyyy HH:mm').format(date);
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
