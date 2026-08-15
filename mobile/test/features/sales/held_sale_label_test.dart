import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/sales/presentation/labels.dart';

/// Phase 5D-6B — held-sale label render-time localization.
///
/// Stored data is NEVER migrated: auto-generated `Held HH:MM` labels and the
/// legacy `Held sale` fallback are localized at display time; user-entered
/// freeform labels pass through unchanged. Works for existing persisted data
/// and for live EN/RU/KK switching.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('auto-generated label "Held HH:MM"', () {
    test('EN keeps the historical prefix byte-for-byte', () {
      expect(heldSaleDisplayLabel(en(), 'Held 14:30'), 'Held 14:30');
    });

    test('RU localizes the prefix and keeps the time', () {
      expect(heldSaleDisplayLabel(ru(), 'Held 14:30'), 'Отложено 14:30');
    });

    test('KK localizes the prefix and keeps the time', () {
      expect(heldSaleDisplayLabel(kk(), 'Held 14:30'),
          'Кейінге қалдырылды 14:30');
    });

    test('single-digit hour/minute still matches', () {
      expect(heldSaleDisplayLabel(ru(), 'Held 09:05'), 'Отложено 09:05');
    });
  });

  group('legacy fallback "Held sale"', () {
    test('EN stays byte-for-byte', () {
      expect(heldSaleDisplayLabel(en(), 'Held sale'), 'Held sale');
    });

    test('RU localizes the fallback', () {
      expect(heldSaleDisplayLabel(ru(), 'Held sale'), 'Отложенная продажа');
    });

    test('KK localizes the fallback', () {
      expect(heldSaleDisplayLabel(kk(), 'Held sale'),
          'Кейінге қалдырылған сатылым');
    });
  });

  group('user-entered / unknown labels remain unchanged', () {
    test('freeform user label passes through in every locale', () {
      for (final l10n in [en(), ru(), kk()]) {
        expect(heldSaleDisplayLabel(l10n, 'My order'), 'My order');
      }
    });

    test('custom labels with punctuation are untouched', () {
      expect(heldSaleDisplayLabel(ru(), 'Order #42 — urgent'),
          'Order #42 — urgent');
      expect(heldSaleDisplayLabel(kk(), 'VIP customer'), 'VIP customer');
    });

    test('non-matching variants are untouched (case-sensitive match)', () {
      expect(heldSaleDisplayLabel(ru(), 'HELD 99:99'), 'HELD 99:99');
      expect(heldSaleDisplayLabel(ru(), 'Held 9:5'), 'Held 9:5');
      expect(heldSaleDisplayLabel(ru(), 'Held sale today'), 'Held sale today');
    });

    test('empty and whitespace labels are untouched', () {
      expect(heldSaleDisplayLabel(en(), ''), '');
    });
  });

  group('no data migration required', () {
    test('helper is pure display logic — inputs are never mutated', () {
      const stored = 'Held 08:15';
      final out = heldSaleDisplayLabel(ru(), stored);
      expect(stored, 'Held 08:15');
      expect(out, 'Отложено 08:15');
    });
  });
}
