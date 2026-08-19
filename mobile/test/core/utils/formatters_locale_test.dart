import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:stockflow/core/utils/formatters.dart';

void main() {
  setUpAll(() async {
    await initializeDateFormatting('en');
    await initializeDateFormatting('ru');
    await initializeDateFormatting('kk');
  });

  group('Formatters date locale', () {
    final date = DateTime(2026, 8, 18, 17, 5);

    test('date uses the explicitly selected EN locale', () {
      expect(Formatters.date(date, locale: 'en'), 'Aug 18, 2026');
      expect(Formatters.dateTime(date, locale: 'en'), 'Aug 18, 2026 17:05');
    });

    test('date uses the explicitly selected RU locale', () {
      final rendered = Formatters.dateTime(date, locale: 'ru');
      expect(rendered, contains('авг'));
      expect(rendered, isNot(contains('Aug')));
    });

    test('date uses the explicitly selected KK locale', () {
      final rendered = Formatters.dateTime(date, locale: 'kk');
      expect(rendered, isNot(contains('Aug')));
      expect(rendered, isNot(Formatters.dateTime(date, locale: 'en')));
    });
  });
}
