import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/localization/error_labels.dart';

AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

/// Tests for Product SKU/barcode duplicate error localization (STEP E1).
///
/// Backend P2002 returns English messages that must be mapped to localized
/// versions for RU/KK users.
void main() {
  group('Duplicate SKU/barcode error localization', () {
    test('EN: SKU duplicate message is preserved as-is', () {
      final result = localizedErrorLabel(
        en(),
        'A product with this SKU already exists',
      );
      expect(result, 'A product with this SKU already exists');
    });

    test('EN: barcode duplicate message is preserved as-is', () {
      final result = localizedErrorLabel(
        en(),
        'A product with this barcode already exists',
      );
      expect(result, 'A product with this barcode already exists');
    });

    test('RU: SKU duplicate message is localized', () {
      final result = localizedErrorLabel(
        ru(),
        'A product with this SKU already exists',
      );
      expect(result, 'Товар с таким SKU уже существует');
    });

    test('RU: barcode duplicate message is localized', () {
      final result = localizedErrorLabel(
        ru(),
        'A product with this barcode already exists',
      );
      expect(result, 'Товар с таким штрихкодом уже существует');
    });

    test('KK: SKU duplicate message is localized', () {
      final result = localizedErrorLabel(
        kk(),
        'A product with this SKU already exists',
      );
      expect(result, 'Мұндай SKU бар тауар бұрыннан бар');
    });

    test('KK: barcode duplicate message is localized', () {
      final result = localizedErrorLabel(
        kk(),
        'A product with this barcode already exists',
      );
      expect(result, 'Мұндай штрихкоды бар тауар бұрыннан бар');
    });

    test('Unknown 409 message falls back to generic for RU/KK', () {
      final result = localizedErrorLabel(
        ru(),
        'Some other conflict',
      );
      expect(result, isNot('Some other conflict'));
      // Should be the generic server error for non-EN
      expect(result, ru().errGenericServer);
    });

    test('Unknown 409 message preserved for EN', () {
      final result = localizedErrorLabel(
        en(),
        'Some other conflict',
      );
      expect(result, 'Some other conflict');
    });
  });
}
