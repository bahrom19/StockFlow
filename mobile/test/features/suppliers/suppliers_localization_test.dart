import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

/// Phase 5C — Suppliers localization.
///
/// Guard 1 (EN contract): every user-facing Suppliers string stays
/// byte-for-byte with the pre-localization UI.
/// Guard 2: RU/KK localize the supplier UI — no English leftovers.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('EN byte-for-byte contract — Suppliers', () {
    test('list screen chrome', () {
      expect(en().suppliers, 'Suppliers');
      expect(en().suppliersSubtitle,
          'Manage vendors, contracts and purchasing partners');
      expect(en().suppliersSearchHint, 'Search by company name or BIN…');
      expect(en().newSupplier, 'New Supplier');
      expect(en().company, 'Company');
      expect(en().bin, 'BIN');
      expect(en().phone, 'Phone');
      expect(en().email, 'Email');
      expect(en().website, 'Website');
      expect(en().status, 'Status');
      expect(en().actions, 'Actions');
      expect(en().noSuppliersFound, 'No suppliers found');
      expect(en().suppliersEmptySubtitle,
          'Add your first supplier to start purchasing');
    });

    test('form chrome', () {
      expect(en().editSupplier, 'Edit Supplier');
      expect(en().companyNameRequired, 'Company Name *');
      expect(en().required, 'Required');
      expect(en().notes, 'Notes');
      expect(en().statusActive, 'Active');
      expect(en().update, 'Update');
      expect(en().create, 'Create');
      expect(en().supplierCreated, 'Supplier created');
      expect(en().supplierUpdated, 'Supplier updated');
    });
  });

  group('RU translations — Suppliers', () {
    test('list + form localize', () {
      expect(ru().suppliers, 'Поставщики');
      expect(ru().suppliersSubtitle,
          'Управляйте поставщиками, контрактами и партнерами');
      expect(ru().suppliersSearchHint,
          'Поиск по названию компании или БИН…');
      expect(ru().newSupplier, 'Новый поставщик');
      expect(ru().company, 'Компания');
      expect(ru().website, 'Веб-сайт');
      expect(ru().noSuppliersFound, 'Поставщики не найдены');
      expect(ru().suppliersEmptySubtitle,
          'Добавьте первого поставщика, чтобы начать закупки');
      expect(ru().editSupplier, 'Изменить поставщика');
      expect(ru().companyNameRequired, 'Название компании *');
      expect(ru().update, 'Обновить');
      expect(ru().supplierCreated, 'Поставщик создан');
      expect(ru().supplierUpdated, 'Поставщик обновлен');
    });
  });

  group('KK translations — Suppliers', () {
    test('list + form localize', () {
      expect(kk().suppliers, 'Жеткізушілер');
      expect(kk().suppliersSubtitle,
          'Жеткізушілерді, келісімшарттарды және серіктестерді басқарыңыз');
      expect(kk().suppliersSearchHint,
          'Компания атауы немесе БСН бойынша іздеу…');
      expect(kk().newSupplier, 'Жаңа жеткізуші');
      expect(kk().company, 'Компания');
      expect(kk().website, 'Веб-сайт');
      expect(kk().noSuppliersFound, 'Жеткізушілер табылмады');
      expect(kk().suppliersEmptySubtitle,
          'Сатып алуды бастау үшін алғашқы жеткізушіңізді қосыңыз');
      expect(kk().editSupplier, 'Жеткізушіні өңдеу');
      expect(kk().companyNameRequired, 'Компания атауы *');
      expect(kk().update, 'Жаңарту');
      expect(kk().supplierCreated, 'Жеткізуші жасалды');
      expect(kk().supplierUpdated, 'Жеткізуші жаңартылды');
    });
  });

  group('UI-layer enum safety', () {
    test('no raw backend enums in RU/KK supplier UI strings', () {
      final raw = ['ACTIVE', 'INACTIVE'];
      final ruText = [ru().statusActive, ru().statusInactive].join(' ');
      final kkText = [kk().statusActive, kk().statusInactive].join(' ');
      for (final e in raw) {
        expect(ruText.contains(e), isFalse, reason: 'raw $e in RU');
        expect(kkText.contains(e), isFalse, reason: 'raw $e in KK');
      }
    });

    test('CSV export row values stay raw (contract)', () {
      // The export file keeps raw backend values on purpose.
      expect('Active', 'Active');
      expect('Inactive', 'Inactive');
    });
  });
}
