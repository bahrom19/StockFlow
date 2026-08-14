import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:stockflow/core/currency/currency_provider.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('default currency is KZT when nothing is persisted', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    expect(container.read(currencyProvider), 'KZT');
    await container.read(currencyProvider.notifier).load();
    expect(container.read(currencyProvider), 'KZT');
  });

  test('setCurrency updates state and persists to SharedPreferences', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container.read(currencyProvider.notifier).setCurrency('RUB');
    expect(container.read(currencyProvider), 'RUB');

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('app_currency'), 'RUB');
  });

  test('load applies a persisted currency', () async {
    SharedPreferences.setMockInitialValues({'app_currency': 'USD'});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container.read(currencyProvider.notifier).load();
    expect(container.read(currencyProvider), 'USD');
  });

  test('invalid persisted value falls back to KZT', () async {
    SharedPreferences.setMockInitialValues({'app_currency': 'BTC'});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container.read(currencyProvider.notifier).load();
    expect(container.read(currencyProvider), 'KZT');
  });

  test('setCurrency ignores unsupported codes', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container.read(currencyProvider.notifier).setCurrency('BTC');
    expect(container.read(currencyProvider), 'KZT');
  });

  test('all backend-supported codes are accepted', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    for (final code in [
      'KZT', 'RUB', 'USD', 'EUR', 'CNY', 'AED', 'AUD', 'VND',
    ]) {
      await container.read(currencyProvider.notifier).setCurrency(code);
      expect(container.read(currencyProvider), code, reason: '$code accepted');
    }
  });

  test('switching currencies is reflected in state and storage', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer();
    addTearDown(container.dispose);

    await container.read(currencyProvider.notifier).setCurrency('RUB');
    await container.read(currencyProvider.notifier).setCurrency('KZT');
    expect(container.read(currencyProvider), 'KZT');
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('app_currency'), 'KZT');
  });
}
