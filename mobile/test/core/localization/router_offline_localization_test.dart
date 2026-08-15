import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/widgets/offline_state_widget.dart';

/// Phase 5D-1 — Router error pages + OfflineStateWidget localization.
///
/// Guard 1 (EN contract): every user-facing router/offline string stays
/// byte-for-byte with the pre-localization UI.
/// Guard 2: RU/KK localize the router error pages and the shared offline
/// strings — no English leftovers.
/// Guard 3: the shared offline strings (title/message) use ONE shared ARB
/// key set, and `retry` is reused (not duplicated).
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('EN byte-for-byte contract — Router + Offline', () {
    test('404 page chrome', () {
      expect(en().pageNotFound, 'Page Not Found');
      expect(en().pageNotFoundCode, '404');
      expect(en().pageNotFoundMessage,
          'The page you are looking for does not exist.');
      expect(en().goHome, 'Go Home');
    });

    test('maintenance page chrome', () {
      expect(en().maintenanceTitle, 'Under Maintenance');
      expect(en().maintenanceMessage,
          'We are performing scheduled maintenance.\nPlease check back shortly.');
    });

    test('no-internet page chrome (shared with offline widget)', () {
      expect(en().noInternetTitle, 'No Internet Connection');
      expect(en().noInternetMessage,
          'Please check your connection and try again.');
    });

    test('retry is reused, not duplicated', () {
      expect(en().retry, 'Retry');
    });
  });

  group('RU translations — Router + Offline', () {
    test('404 page localizes', () {
      expect(ru().pageNotFound, 'Страница не найдена');
      expect(ru().pageNotFoundCode, '404');
      expect(ru().pageNotFoundMessage,
          'Страница, которую вы ищете, не существует.');
      expect(ru().goHome, 'На главную');
    });

    test('maintenance + no-internet localize', () {
      expect(ru().maintenanceTitle, 'Ведутся технические работы');
      expect(ru().maintenanceMessage,
          'Мы проводим плановые технические работы.\nПожалуйста, зайдите позже.');
      expect(ru().noInternetTitle, 'Нет подключения к интернету');
      expect(ru().noInternetMessage,
          'Проверьте подключение и попробуйте снова.');
      expect(ru().retry, 'Повторить');
    });
  });

  group('KK translations — Router + Offline', () {
    test('404 page localizes', () {
      expect(kk().pageNotFound, 'Бет табылмады');
      expect(kk().pageNotFoundCode, '404');
      expect(kk().pageNotFoundMessage, 'Сіз іздеген бет жоқ.');
      expect(kk().goHome, 'Басты бетке');
    });

    test('maintenance + no-internet localize', () {
      expect(kk().maintenanceTitle, 'Техникалық жұмыстар жүріп жатыр');
      expect(kk().maintenanceMessage,
          'Біз жоспарлы техникалық жұмыстарды жүргізіп жатырмыз.\nКейінірек қайта кіріп көріңіз.');
      expect(kk().noInternetTitle, 'Интернетке қосылу жоқ');
      expect(kk().noInternetMessage,
          'Қосылымды тексеріп, қайталап көріңіз.');
      expect(kk().retry, 'Қайталау');
    });
  });

  group('OfflineStateWidget renders localized strings', () {
    testWidgets('EN default strings render', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(body: OfflineStateWidget(onRetry: () {})),
        ),
      );
      expect(find.text('No Internet Connection'), findsOneWidget);
      expect(find.text('Please check your connection and try again.'),
          findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);
    });

    testWidgets('RU renders localized strings, no English leftovers',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ru'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(body: OfflineStateWidget(onRetry: () {})),
        ),
      );
      expect(find.text('Нет подключения к интернету'), findsOneWidget);
      expect(find.text('Проверьте подключение и попробуйте снова.'),
          findsOneWidget);
      expect(find.text('Повторить'), findsOneWidget);
      expect(find.text('No Internet Connection'), findsNothing);
      expect(find.text('Retry'), findsNothing);
    });

    testWidgets('KK renders localized strings, no English leftovers',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('kk'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(body: OfflineStateWidget(onRetry: () {})),
        ),
      );
      expect(find.text('Интернетке қосылу жоқ'), findsOneWidget);
      expect(find.text('Қосылымды тексеріп, қайталап көріңіз.'), findsOneWidget);
      expect(find.text('Қайталау'), findsOneWidget);
      expect(find.text('No Internet Connection'), findsNothing);
      expect(find.text('Retry'), findsNothing);
    });

    testWidgets('custom message overrides the default title', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('ru'),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: OfflineStateWidget(message: 'Своё сообщение', onRetry: () {}),
          ),
        ),
      );
      expect(find.text('Своё сообщение'), findsOneWidget);
      expect(find.text('Нет подключения к интернету'), findsNothing);
      expect(find.text('Проверьте подключение и попробуйте снова.'),
          findsOneWidget);
    });
  });
}
