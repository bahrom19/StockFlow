import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';

void main() {
  group('symbolFor — all 8 backend-supported currencies', () {
    test('maps each code to its symbol', () {
      expect(CurrencyCatalog.symbolFor('KZT'), '₸');
      expect(CurrencyCatalog.symbolFor('RUB'), '₽');
      expect(CurrencyCatalog.symbolFor('USD'), r'$');
      expect(CurrencyCatalog.symbolFor('EUR'), '€');
      expect(CurrencyCatalog.symbolFor('CNY'), '¥');
      expect(CurrencyCatalog.symbolFor('AED'), 'د.إ');
      expect(CurrencyCatalog.symbolFor('AUD'), r'A$');
      expect(CurrencyCatalog.symbolFor('VND'), '₫');
    });

    test('unknown code falls back to KZT symbol', () {
      expect(CurrencyCatalog.symbolFor(null), '₸');
      expect(CurrencyCatalog.symbolFor('BTC'), '₸');
    });
  });

  group('format', () {
    test('KZT default renders ₸ with 2 decimals', () {
      expect(CurrencyCatalog.format(1234.5), '₸1,234.50');
      expect(CurrencyCatalog.format(100), '₸100.00');
    });

    test('all supported codes render their symbol', () {
      expect(CurrencyCatalog.format(1234.5, code: 'RUB'), '₽1,234.50');
      expect(CurrencyCatalog.format(1234.5, code: 'USD'), r'$1,234.50');
      expect(CurrencyCatalog.format(1234.5, code: 'EUR'), '€1,234.50');
      expect(CurrencyCatalog.format(1234.5, code: 'CNY'), '¥1,234.50');
      expect(CurrencyCatalog.format(1234.5, code: 'AED'), 'د.إ1,234.50');
      expect(CurrencyCatalog.format(1234.5, code: 'AUD'), r'A$1,234.50');
      expect(CurrencyCatalog.format(1234.5, code: 'VND'), '₫1,234.50');
    });

    test('zero values', () {
      expect(CurrencyCatalog.format(0), '₸0.00');
      expect(CurrencyCatalog.format(null), '₸0.00');
      expect(CurrencyCatalog.format('0'), '₸0.00');
    });

    test('string input parsed', () {
      expect(CurrencyCatalog.format('2500.5'), '₸2,500.50');
    });

    test('rounding preserved at 2 decimals', () {
      expect(CurrencyCatalog.format(1234.567), '₸1,234.57');
      expect(CurrencyCatalog.format(0.004), '₸0.00');
    });
  });

  group('formatShort', () {
    test('compact large values', () {
      expect(CurrencyCatalog.formatShort(1200000), '₸1.2M');
      expect(CurrencyCatalog.formatShort(2000000, code: 'RUB'), '₽2.0M');
      expect(CurrencyCatalog.formatShort(1500, code: 'USD'), r'$1.5K');
    });

    test('below 1000 falls back to full format', () {
      expect(CurrencyCatalog.formatShort(999), '₸999.00');
      expect(CurrencyCatalog.formatShort(1000), '₸1.0K');
    });

    test('locale-aware suffixes for RU/KK', () {
      expect(CurrencyCatalog.formatShort(2000000, locale: 'ru'), '₸2.0млн');
      expect(CurrencyCatalog.formatShort(1500, locale: 'ru'), '₸1.5тыс.');
      expect(CurrencyCatalog.formatShort(2000000, locale: 'kk'), '₸2.0млн');
      expect(CurrencyCatalog.formatShort(1500, locale: 'kk'), '₸1.5мың');
      // Default (no locale) and explicit 'en' keep M/K.
      expect(CurrencyCatalog.formatShort(1500, code: 'USD'), r'$1.5K');
      expect(CurrencyCatalog.formatShort(1500, code: 'USD', locale: 'en'),
          r'$1.5K');
    });
  });

  group('formatPdf — PDF-safe symbols', () {
    test('ASCII/Latin-1 symbols render; others fall back to the code', () {
      expect(CurrencyCatalog.formatPdf(1234.5, code: 'USD'), r'$1,234.50');
      expect(CurrencyCatalog.formatPdf(1234.5, code: 'CNY'), '¥1,234.50');
      expect(CurrencyCatalog.formatPdf(1234.5, code: 'AUD'), r'A$1,234.50');
      // Outside the PDF font coverage → currency code prefix (no missing glyph).
      expect(CurrencyCatalog.formatPdf(1234.5, code: 'KZT'), 'KZT 1,234.50');
      expect(CurrencyCatalog.formatPdf(1234.5, code: 'RUB'), 'RUB 1,234.50');
      expect(CurrencyCatalog.formatPdf(1234.5, code: 'EUR'), 'EUR 1,234.50');
      expect(CurrencyCatalog.formatPdf(1234.5, code: 'VND'), 'VND 1,234.50');
      expect(CurrencyCatalog.formatPdf(1234.5, code: 'AED'), 'AED 1,234.50');
    });
  });

  group('isSupported', () {
    test('accepts only backend enum codes', () {
      for (final code in ['KZT', 'RUB', 'USD', 'EUR', 'CNY', 'AED', 'AUD', 'VND']) {
        expect(CurrencyCatalog.isSupported(code), isTrue);
      }
      expect(CurrencyCatalog.isSupported('BTC'), isFalse);
      expect(CurrencyCatalog.isSupported(null), isFalse);
    });
  });
}
