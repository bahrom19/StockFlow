import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/utils/validators.dart';

/// Phase 5D-4 — Core validators optional-l10n.
///
/// Guard 1 (EN contract): every validator message stays byte-for-byte with
/// the pre-localization output (including the composed "{field} is required"
/// template and the default field labels).
/// Guard 2: RU/KK localize the messages when [l10n] is provided — the
/// "{field} ..." templates render fully in the target language, never
/// mixed-language like "Название is required".
/// Guard 3: null [l10n] keeps the original English fallback, so existing
/// tear-off call sites are unchanged.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('EN byte-for-byte contract — validators', () {
    test('required (named field + default)', () {
      expect(Validators.required(''), 'This field is required');
      expect(Validators.required('', 'Name'), 'Name is required');
      expect(Validators.requiredL10n(en(), ''), 'This field is required');
      expect(Validators.required('x'), isNull);
    });

    test('phone / decimal / min / max', () {
      expect(Validators.phone('abc'), 'Please enter a valid phone number');
      expect(Validators.phone('+7 777 123-45-67'), isNull);
      expect(Validators.decimal('abc'),
          'Please enter a valid decimal number');
      expect(Validators.decimal(''), 'Value is required');
      expect(Validators.min(5, '3'), 'Value must be at least 5.0');
      expect(Validators.min(5, '3', 'Price'), 'Price must be at least 5.0');
      expect(Validators.max(10, '15'), 'Value must not exceed 10.0');
      expect(Validators.max(10, '5'), isNull);
    });
  });

  group('RU translations — validators', () {
    test('required localizes the template', () {
      expect(Validators.required('', 'Название', ru()),
          'Название обязательно');
    });

    test('phone / decimal / min / max localize', () {
      expect(Validators.phone('abc', ru()),
          'Введите корректный номер телефона');
      expect(Validators.decimal('abc', null, ru()),
          'Введите корректное десятичное число');
      expect(Validators.decimal('', null, ru()), 'Значение обязательно');
      expect(Validators.min(5, '3', 'Цена', ru()),
          'Цена должно быть не менее 5.0');
      expect(Validators.max(10, '15', 'Цена', ru()),
          'Цена не должно превышать 10.0');
    });
  });

  group('KK translations — validators', () {
    test('required localizes the template', () {
      expect(Validators.required('', 'Название', kk()),
          'Название қажет');
    });

    test('phone / decimal / min / max localize', () {
      expect(Validators.phone('abc', kk()),
          'Дұрыс телефон нөмірін енгізіңіз');
      expect(Validators.decimal('abc', null, kk()),
          'Дұрыс ондық сан енгізіңіз');
      expect(Validators.decimal('', null, kk()), 'Мәні қажет');
      expect(Validators.min(5, '3', 'Баға', kk()),
          'Баға кемінде 5.0 болуы керек');
      expect(Validators.max(10, '15', 'Баға', kk()),
          'Баға ең көбі 10.0 болуы керек');
    });
  });

  group('null-l10n fallback (existing callers unchanged)', () {
    test('messages stay English when l10n is null', () {
      expect(Validators.required('', 'Name'), 'Name is required');
      expect(Validators.phone('abc'), 'Please enter a valid phone number');
      expect(Validators.decimal('abc'), 'Please enter a valid decimal number');
      expect(Validators.min(5, '3', 'Price'), 'Price must be at least 5.0');
      expect(Validators.max(10, '15', 'Price'),
          'Price must not exceed 10.0');
    });

    test('no English template fragments leak into RU/KK', () {
      final ruText = [
        Validators.required('', 'Название', ru()),
        Validators.phone('abc', ru()),
        Validators.decimal('abc', null, ru()),
        Validators.min(5, '3', 'Цена', ru()),
        Validators.max(10, '15', 'Цена', ru()),
      ].join(' ');
      final kkText = [
        Validators.required('', 'Название', kk()),
        Validators.phone('abc', kk()),
        Validators.decimal('abc', null, kk()),
        Validators.min(5, '3', 'Баға', kk()),
        Validators.max(10, '15', 'Баға', kk()),
      ].join(' ');
      for (final fragment in [
        'is required', 'must be at least', 'must not exceed',
        'valid phone', 'valid decimal',
      ]) {
        expect(ruText.contains(fragment), isFalse,
            reason: 'EN fragment "$fragment" in RU');
        expect(kkText.contains(fragment), isFalse,
            reason: 'EN fragment "$fragment" in KK');
      }
    });
  });
}
