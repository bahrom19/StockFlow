import 'package:intl/intl.dart';

/// Currency codes supported by StockFlow — mirrors the backend Prisma
/// `Currency` enum (backend/prisma/schema.prisma). The UI layer never invents
/// its own currency set; unknown codes fall back to the safe default (KZT).
const List<String> supportedCurrencyCodes = [
  'KZT',
  'RUB',
  'USD',
  'EUR',
  'CNY',
  'AED',
  'AUD',
  'VND',
];

/// Display names shown in the Settings currency picker. Kept untranslated
/// (code + symbol), following the `localeDisplayNames` precedent — the picker
/// labels never depend on the active UI locale.
const Map<String, String> currencyDisplayNames = {
  'KZT': 'KZT ₸',
  'RUB': 'RUB ₽',
  'USD': 'USD \$',
  'EUR': 'EUR €',
  'CNY': 'CNY ¥',
  'AED': 'AED د.إ',
  'AUD': 'AUD A\$',
  'VND': 'VND ₫',
};

/// Central currency symbol catalog + formatters.
///
/// Phase 4 — the single source of truth for "what symbol does a currency
/// code render with". All user-facing money values go through
/// [CurrencyCatalog.format] (or the `context.money` accessor); no widget
/// hardcodes `$`/`₸`.
class CurrencyCatalog {
  CurrencyCatalog._();

  /// Symbol for a currency code. Unknown codes fall back to `₸` (KZT) —
  /// the app default.
  static String symbolFor(String? code) {
    switch (code) {
      case 'KZT':
        return '₸';
      case 'RUB':
        return '₽';
      case 'USD':
        return r'$';
      case 'EUR':
        return '€';
      case 'CNY':
        return '¥';
      case 'AED':
        return 'د.إ';
      case 'AUD':
        return r'A$';
      case 'VND':
        return '₫';
      default:
        return '₸';
    }
  }

  /// Validates a code against the supported backend set.
  static bool isSupported(String? code) =>
      supportedCurrencyCodes.contains(code);

  static final Map<String, NumberFormat> _cache = {};

  /// Number format for a currency code: symbol prefix, 2 decimals — identical
  /// layout/rounding to the legacy `Formatters.currency` (only the symbol
  /// changes). Cached per code; intl default locale keeps `1,234.56` grouping.
  static NumberFormat numberFormatFor(String code) {
    return _cache.putIfAbsent(
      code,
      () => NumberFormat.currency(
        symbol: symbolFor(code),
        decimalDigits: 2,
      ),
    );
  }

  /// Formats [value] with the symbol of [code] (e.g. `₸1,234.56`).
  static String format(dynamic value, {String code = 'KZT'}) {
    final num amount = _parseNumeric(value);
    return numberFormatFor(code).format(amount);
  }

  /// Compact variant: `₸1.2M` / `₸1.2K` / `₸1,234.56` in the default (English)
  /// UI, or the locale-aware suffixes for RU (`тыс.`/`млн`) and KK
  /// (`мың`/`млн`) when [locale] is provided.
  static String formatShort(dynamic value, {String code = 'KZT', String? locale}) {
    final num amount = _parseNumeric(value);
    final symbol = symbolFor(code);
    final String millionSuffix;
    final String thousandSuffix;
    if (locale?.startsWith('ru') == true) {
      millionSuffix = 'млн';
      thousandSuffix = 'тыс.';
    } else if (locale?.startsWith('kk') == true) {
      millionSuffix = 'млн';
      thousandSuffix = 'мың';
    } else {
      millionSuffix = 'M';
      thousandSuffix = 'K';
    }
    if (amount >= 1000000) {
      return '$symbol${(amount / 1000000).toStringAsFixed(1)}$millionSuffix';
    } else if (amount >= 1000) {
      return '$symbol${(amount / 1000).toStringAsFixed(1)}$thousandSuffix';
    }
    return numberFormatFor(code).format(amount);
  }

  /// Symbol rendered inside PDF documents (built-in helvetica = WinAnsi).
  ///
  /// `₸`/`₽`/`₫`/`د.إ` are outside the base PDF font coverage; falling back to
  /// the currency code keeps the export readable (e.g. `KZT 1,234.56`)
  /// instead of rendering a missing glyph. The Flutter UI (and HTML receipts,
  /// rendered by the browser) keep the full symbol via [format].
  static String pdfSymbolFor(String code) {
    switch (code) {
      case 'USD':
        return r'$';
      case 'CNY':
        return '¥'; // Latin-1
      case 'AUD':
        return r'A$'; // ASCII
      default:
        // KZT/RUB/EUR/AED/VND → code prefix (₸/₽/€/₫/د.إ not in helvetica).
        return '$code ';
    }
  }

  /// PDF-safe variant: same layout/rounding, symbol replaced by
  /// [pdfSymbolFor] when the font cannot render the glyph.
  static String formatPdf(dynamic value, {String code = 'KZT'}) {
    final num amount = _parseNumeric(value);
    return NumberFormat.currency(
      symbol: pdfSymbolFor(code),
      decimalDigits: 2,
    ).format(amount);
  }

  static num _parseNumeric(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value;
    if (value is String) return num.tryParse(value) ?? 0;
    return 0;
  }
}
