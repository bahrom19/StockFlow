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
