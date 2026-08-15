import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/auth/auth_state.dart';
import 'package:stockflow/core/auth/models/auth_models.dart';
import 'package:stockflow/features/settings/presentation/screens/settings_screen.dart';

/// Phase 5D-2 — Settings localization.
///
/// Guard 1 (EN contract): every user-facing Settings string stays
/// byte-for-byte with the pre-localization UI.
/// Guard 2: RU/KK localize the Settings screen — no English leftovers.
/// Guard 3: existing language/currency picker behavior is preserved
/// (tile subtitles still show the catalog display names).
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

Widget _harness(Locale locale) {
  return ProviderScope(
    overrides: [
      currentUserProvider.overrideWithValue(
        const CurrentUser(
          id: 'u1',
          email: 'alice@stockflow.test',
          firstName: 'Alice',
          lastName: 'Smith',
          companyId: 'c1',
        ),
      ),
    ],
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: const SettingsScreen(),
    ),
  );
}

/// Tall viewport so the whole Settings ListView (incl. Sign Out at the
/// bottom) is built by the lazy ListView in the default 600px test window.
void _tallViewport(WidgetTester tester) {
  tester.view.physicalSize = const Size(900, 2000);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);
}

void main() {
  group('EN byte-for-byte contract — Settings', () {
    test('preferences + theme', () {
      expect(en().preferences, 'Preferences');
      expect(en().darkMode, 'Dark Mode');
      expect(en().darkModeSubtitle, 'Toggle dark/light theme');
    });

    test('language + currency', () {
      expect(en().language, 'Language');
      expect(en().english, 'English');
      expect(en().currency, 'Currency');
      expect(en().kztTenge, 'KZT ₸');
    });

    test('notifications + about + actions', () {
      expect(en().notifications, 'Notifications');
      expect(en().manageNotifications, 'Manage notification preferences');
      expect(en().about, 'About');
      expect(en().version, 'Version');
      expect(en().termsOfService, 'Terms of Service');
      expect(en().privacyPolicy, 'Privacy Policy');
    });

    test('reuse keys, not duplicated', () {
      expect(en().signOut, 'Sign Out');
      expect(en().user, 'User');
    });
  });

  group('RU translations — Settings', () {
    test('localized values', () {
      expect(ru().preferences, 'Предпочтения');
      expect(ru().darkMode, 'Тёмный режим');
      expect(ru().darkModeSubtitle, 'Переключить тёмную/светлую тему');
      expect(ru().language, 'Язык');
      expect(ru().english, 'Английский');
      expect(ru().currency, 'Валюта');
      expect(ru().kztTenge, 'KZT ₸');
      expect(ru().notifications, 'Уведомления');
      expect(ru().manageNotifications, 'Управление уведомлениями');
      expect(ru().about, 'О приложении');
      expect(ru().version, 'Версия');
      expect(ru().termsOfService, 'Условия использования');
      expect(ru().privacyPolicy, 'Политика конфиденциальности');
      expect(ru().signOut, 'Выйти');
    });

    test('no raw English UI copy in RU', () {
      final ruText = [
        ru().preferences, ru().darkMode, ru().darkModeSubtitle, ru().language,
        ru().english, ru().currency, ru().manageNotifications, ru().about,
        ru().version, ru().termsOfService, ru().privacyPolicy, ru().signOut,
      ].join(' ');
      for (final raw in ['Preferences', 'Dark Mode', 'Language', 'Currency',
          'Notifications', 'About', 'Version', 'Terms of Service',
          'Privacy Policy', 'Sign Out']) {
        expect(ruText.contains(raw), isFalse, reason: 'raw "$raw" in RU');
      }
    });
  });

  group('KK translations — Settings', () {
    test('localized values', () {
      expect(kk().preferences, 'Параметрлер');
      expect(kk().darkMode, 'Қараңғы режим');
      expect(kk().darkModeSubtitle, 'Қараңғы/жарық тақырыпты ауыстыру');
      expect(kk().language, 'Тіл');
      expect(kk().english, 'Ағылшын');
      expect(kk().currency, 'Валюта');
      expect(kk().kztTenge, 'KZT ₸');
      expect(kk().notifications, 'Хабарламалар');
      expect(kk().manageNotifications, 'Хабарландыруларды басқару');
      expect(kk().about, 'Қолданба туралы');
      expect(kk().version, 'Нұсқа');
      expect(kk().termsOfService, 'Пайдалану шарттары');
      expect(kk().privacyPolicy, 'Құпиялылық саясаты');
      expect(kk().signOut, 'Шығу');
    });

    test('no raw English UI copy in KK', () {
      final kkText = [
        kk().preferences, kk().darkMode, kk().darkModeSubtitle, kk().language,
        kk().english, kk().currency, kk().manageNotifications, kk().about,
        kk().version, kk().termsOfService, kk().privacyPolicy, kk().signOut,
      ].join(' ');
      for (final raw in ['Preferences', 'Dark Mode', 'Language', 'Currency',
          'Notifications', 'About', 'Version', 'Terms of Service',
          'Privacy Policy', 'Sign Out']) {
        expect(kkText.contains(raw), isFalse, reason: 'raw "$raw" in KK');
      }
    });
  });

  group('SettingsScreen renders localized strings', () {
    testWidgets('EN renders byte-for-byte UI', (tester) async {
      _tallViewport(tester);
      SharedPreferences.setMockInitialValues({});
      await tester.pumpWidget(_harness(const Locale('en')));
      await tester.pumpAndSettle();

      expect(find.text('Preferences'), findsOneWidget);
      expect(find.text('Dark Mode'), findsOneWidget);
      expect(find.text('Toggle dark/light theme'), findsOneWidget);
      expect(find.text('Language'), findsOneWidget);
      expect(find.text('Currency'), findsOneWidget);
      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('Manage notification preferences'), findsOneWidget);
      expect(find.text('About'), findsOneWidget);
      expect(find.text('Version'), findsOneWidget);
      expect(find.text('Terms of Service'), findsOneWidget);
      expect(find.text('Privacy Policy'), findsOneWidget);
      expect(find.text('Sign Out'), findsOneWidget);
    });

    testWidgets('RU renders localized strings, no English leftovers',
        (tester) async {
      _tallViewport(tester);
      SharedPreferences.setMockInitialValues({});
      await tester.pumpWidget(_harness(const Locale('ru')));
      await tester.pumpAndSettle();

      expect(find.text('Предпочтения'), findsOneWidget);
      expect(find.text('Тёмный режим'), findsOneWidget);
      expect(find.text('Язык'), findsOneWidget);
      expect(find.text('Валюта'), findsOneWidget);
      expect(find.text('Уведомления'), findsOneWidget);
      expect(find.text('О приложении'), findsOneWidget);
      expect(find.text('Версия'), findsOneWidget);
      expect(find.text('Условия использования'), findsOneWidget);
      expect(find.text('Политика конфиденциальности'), findsOneWidget);
      expect(find.text('Выйти'), findsOneWidget);
      expect(find.text('Preferences'), findsNothing);
      expect(find.text('Dark Mode'), findsNothing);
      expect(find.text('Sign Out'), findsNothing);
    });

    testWidgets('KK renders localized strings, no English leftovers',
        (tester) async {
      _tallViewport(tester);
      SharedPreferences.setMockInitialValues({});
      await tester.pumpWidget(_harness(const Locale('kk')));
      await tester.pumpAndSettle();

      expect(find.text('Параметрлер'), findsOneWidget);
      expect(find.text('Қараңғы режим'), findsOneWidget);
      expect(find.text('Тіл'), findsOneWidget);
      expect(find.text('Валюта'), findsOneWidget);
      expect(find.text('Хабарламалар'), findsOneWidget);
      expect(find.text('Қолданба туралы'), findsOneWidget);
      expect(find.text('Нұсқа'), findsOneWidget);
      expect(find.text('Пайдалану шарттары'), findsOneWidget);
      expect(find.text('Құпиялылық саясаты'), findsOneWidget);
      expect(find.text('Шығу'), findsOneWidget);
      expect(find.text('Preferences'), findsNothing);
      expect(find.text('About'), findsNothing);
      expect(find.text('Sign Out'), findsNothing);
    });

    testWidgets('language picker still opens with localized title',
        (tester) async {
      _tallViewport(tester);
      SharedPreferences.setMockInitialValues({});
      await tester.pumpWidget(_harness(const Locale('ru')));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Язык'));
      await tester.pumpAndSettle();
      // Catalog display names stay self-describing (not translated).
      // 'English' appears twice: the tile subtitle (locale still en) and the
      // dialog list item.
      expect(find.text('Русский'), findsOneWidget);
      expect(find.text('Қазақша'), findsOneWidget);
      expect(find.text('English'), findsWidgets);
    });

    testWidgets('currency picker still opens with localized title',
        (tester) async {
      _tallViewport(tester);
      SharedPreferences.setMockInitialValues({});
      await tester.pumpWidget(_harness(const Locale('kk')));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Валюта'));
      await tester.pumpAndSettle();
      expect(find.text('KZT ₸'), findsWidgets);
      expect(find.text('RUB ₽'), findsWidgets);
      expect(find.text(r'USD $'), findsWidgets);
    });
  });
}
