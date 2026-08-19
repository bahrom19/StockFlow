import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/localization/locale_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('default locale is English when nothing is persisted', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    expect(container.read(localeProvider), const Locale('en'));
    await container.read(localeProvider.notifier).load();
    expect(container.read(localeProvider), const Locale('en'));
  });

  test('setLocale updates state and persists to SharedPreferences', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container.read(localeProvider.notifier).setLocale('ru');
    expect(container.read(localeProvider), const Locale('ru'));

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('app_locale'), 'ru');
  });

  test('load applies a persisted locale', () async {
    SharedPreferences.setMockInitialValues({'app_locale': 'kk'});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container.read(localeProvider.notifier).load();
    expect(container.read(localeProvider), const Locale('kk'));
  });

  test('localeFromCode maps RU/KK and falls back to English', () {
    expect(LocaleNotifier.localeFromCode('ru'), const Locale('ru'));
    expect(LocaleNotifier.localeFromCode('kk'), const Locale('kk'));
    expect(LocaleNotifier.localeFromCode('en'), const Locale('en'));
    expect(LocaleNotifier.localeFromCode(null), const Locale('en'));
    expect(LocaleNotifier.localeFromCode('fr'), const Locale('en'));
  });

  test('initialLocale seeds the state so startup never flashes English',
      () async {
    SharedPreferences.setMockInitialValues({'app_locale': 'ru'});
    // Mimic main(): derive the initial locale from storage and construct the
    // notifier with it — the very first read is already RU (no English flash).
    final prefs = await SharedPreferences.getInstance();
    final initial =
        LocaleNotifier.localeFromCode(prefs.getString(LocaleNotifier.storageKey));
    final notifier = LocaleNotifier(initialLocale: initial);
    expect(notifier.state, const Locale('ru'));
  });

  test('invalid persisted value falls back to English', () async {
    SharedPreferences.setMockInitialValues({'app_locale': 'fr'});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container.read(localeProvider.notifier).load();
    expect(container.read(localeProvider), const Locale('en'));
  });

  test('setLocale ignores unsupported codes', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container.read(localeProvider.notifier).setLocale('fr');
    expect(container.read(localeProvider), const Locale('en'));
  });

  test('switching locales is reflected in state and storage', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container.read(localeProvider.notifier).setLocale('ru');
    await container.read(localeProvider.notifier).setLocale('en');
    expect(container.read(localeProvider), const Locale('en'));
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('app_locale'), 'en');
  });
}
