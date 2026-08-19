import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

/// Phase 3 — hard-coded UI strings routed through `l10n.<key>`.
///
/// Guards that the keys introduced for P3 exist with the expected
/// translations in all supported locales (no re-hardcoding regressions).
void main() {
  group('P3 localization keys', () {
    test('aiInsightsNlp', () {
      expect(en().aiInsightsNlp, 'NLP');
      expect(ru().aiInsightsNlp, 'NLP');
      expect(kk().aiInsightsNlp, 'NLP');
    });

    test('noData', () {
      expect(en().noData, 'No data');
      expect(ru().noData, 'Нет данных');
      expect(kk().noData, 'Деректер жоқ');
    });

    test('goBack', () {
      expect(en().goBack, 'Go Back');
      expect(ru().goBack, 'Назад');
      expect(kk().goBack, 'Артқа');
    });

    test('comingSoonMessage is localized and multi-line', () {
      // EN
      expect(en().comingSoonMessage, contains('coming soon in the web client.'));
      expect(en().comingSoonMessage, contains('UI is being prepared'));
      // RU
      expect(ru().comingSoonMessage, contains('веб-клиенте'));
      expect(ru().comingSoonMessage, contains('интерфейс готовится'));
      // KK
      expect(kk().comingSoonMessage, contains('қолжетімді болады'));
      expect(kk().comingSoonMessage, contains('әзірленіп жатыр'));
      // The ARB "\n" escape must decode to a real newline separator on both halves.
      final nl = String.fromCharCode(10);
      expect(en().comingSoonMessage.contains(nl), isTrue);
      expect(en().comingSoonMessage.split(nl), hasLength(2));
    });
  });
}
