import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

/// Phase 5B — Customers localization.
///
/// Guard 1 (EN contract): every user-facing Customers string stays
/// byte-for-byte with the pre-localization UI.
/// Guard 2: RU/KK get natural ERP translations — no raw backend enums
/// (PERSON/COMPANY) or English leftovers in user-facing UI.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('EN byte-for-byte contract — Customers', () {
    test('list screen chrome', () {
      expect(en().customers, 'Customers');
      expect(en().customersSubtitle,
          'Manage your customer base, contacts and loyalty');
      expect(en().customersSearchHint, 'Search by name, phone or email…');
      expect(en().newCustomer, 'New Customer');
      expect(en().all, 'All');
      expect(en().people, 'People');
      expect(en().companies, 'Companies');
      expect(en().customer, 'Customer');
      expect(en().type, 'Type');
      expect(en().phone, 'Phone');
      expect(en().email, 'Email');
      expect(en().bonus, 'Bonus');
      expect(en().bonusPoints, 'Bonus Points');
      expect(en().debt, 'Debt');
      expect(en().status, 'Status');
      expect(en().actions, 'Actions');
    });

    test('create/edit form chrome', () {
      expect(en().editCustomer, 'Edit Customer');
      expect(en().customerPerson, 'Person');
      expect(en().customerCompany, 'Company');
      expect(en().companyName, 'Company Name');
      expect(en().bin, 'BIN');
      expect(en().firstName, 'First Name');
      expect(en().lastName, 'Last Name');
      expect(en().iin, 'IIN');
      expect(en().notes, 'Notes');
      expect(en().statusActive, 'Active');
      expect(en().saveChanges, 'Save Changes');
      expect(en().createCustomer, 'Create Customer');
      expect(en().required, 'Required');
    });

    test('delete dialog + snackbars + empty state', () {
      expect(en().deleteCustomerTitle, 'Delete customer?');
      expect(en().deleteCustomerConfirm('Acme Ltd'),
          'Customer "Acme Ltd" will be archived.');
      expect(en().cancel, 'Cancel');
      expect(en().delete, 'Delete');
      expect(en().customerDeleted, 'Customer deleted');
      expect(en().deleteFailed, 'Delete failed');
      expect(en().customerCreated, 'Customer created');
      expect(en().customerUpdated, 'Customer updated');
      expect(en().noCustomersYet, 'No customers yet');
      expect(en().noCustomersSubtitle,
          'Add your first customer to start building relationships');
      expect(en().purchaseHistory, 'Purchase history');
    });
  });

  group('RU translations — Customers', () {
    test('list screen chrome localizes', () {
      expect(ru().customers, 'Клиенты');
      expect(ru().customersSubtitle,
          'Управляйте клиентской базой, контактами и лояльностью');
      expect(ru().customersSearchHint, 'Поиск по имени, телефону или email…');
      expect(ru().newCustomer, 'Новый клиент');
      expect(ru().people, 'Частные лица');
      expect(ru().companies, 'Компании');
      expect(ru().customer, 'Клиент');
      expect(ru().bonus, 'Бонусы');
      expect(ru().debt, 'Долг');
    });

    test('form + dialogs localize', () {
      expect(ru().editCustomer, 'Изменить клиента');
      expect(ru().customerPerson, 'Физлицо');
      expect(ru().customerCompany, 'Компания');
      expect(ru().bin, 'БИН');
      expect(ru().firstName, 'Имя');
      expect(ru().lastName, 'Фамилия');
      expect(ru().iin, 'ИИН');
      expect(ru().notes, 'Заметки');
      expect(ru().createCustomer, 'Создать клиента');
      expect(ru().deleteCustomerTitle, 'Удалить клиента?');
      expect(ru().deleteCustomerConfirm('ООО Ромашка'),
          'Клиент "ООО Ромашка" будет архивирован.');
      expect(ru().customerDeleted, 'Клиент удален');
      expect(ru().noCustomersYet, 'Клиентов пока нет');
      expect(ru().purchaseHistory, 'История покупок');
    });
  });

  group('KK translations — Customers', () {
    test('list screen chrome localizes', () {
      expect(kk().customers, 'Клиенттер');
      expect(kk().customersSubtitle,
          'Клиенттік базаны, байланыстарды және адалдықты басқарыңыз');
      expect(kk().customersSearchHint, 'Аты, телефоны немесе email бойынша іздеу…');
      expect(kk().newCustomer, 'Жаңа клиент');
      expect(kk().people, 'Жеке тұлғалар');
      expect(kk().companies, 'Компаниялар');
      expect(kk().customer, 'Клиент');
      expect(kk().bonus, 'Бонустар');
      expect(kk().debt, 'Қарыз');
    });

    test('form + dialogs localize', () {
      expect(kk().editCustomer, 'Клиентті өңдеу');
      expect(kk().customerPerson, 'Жеке тұлға');
      expect(kk().customerCompany, 'Компания');
      expect(kk().bin, 'БСН');
      expect(kk().firstName, 'Аты');
      expect(kk().lastName, 'Тегі');
      expect(kk().iin, 'ЖСН');
      expect(kk().notes, 'Ескертпелер');
      expect(kk().createCustomer, 'Клиент жасау');
      expect(kk().deleteCustomerTitle, 'Клиентті жою?');
      expect(kk().deleteCustomerConfirm('Acme Ltd'),
          '«Acme Ltd» клиенті мұрағатталады.');
      expect(kk().customerDeleted, 'Клиент жойылды');
      expect(kk().noCustomersYet, 'Әзірге клиенттер жоқ');
      expect(kk().purchaseHistory, 'Сатып алу тарихы');
    });
  });

  group('UI-layer enum safety', () {
    test('no raw backend enums in RU/KK customer UI strings', () {
      final raw = ['PERSON', 'COMPANY', 'ACTIVE', 'INACTIVE'];
      final ruText = [
        ru().customerPerson, ru().customerCompany, ru().people,
        ru().companies, ru().statusActive, ru().statusInactive,
      ].join(' ');
      final kkText = [
        kk().customerPerson, kk().customerCompany, kk().people,
        kk().companies, kk().statusActive, kk().statusInactive,
      ].join(' ');
      for (final e in raw) {
        expect(ruText.contains(e), isFalse, reason: 'raw $e in RU');
        expect(kkText.contains(e), isFalse, reason: 'raw $e in KK');
      }
    });

    test('CSV export status values localize (Phase 5D-8A)', () {
      // EN keeps the historical CSV display byte-for-byte via the ARB values.
      expect(en().statusActive, 'Active');
      expect(en().statusInactive, 'Inactive');
      // RU/KK are localized — never raw 'Active'/'Inactive'.
      expect(ru().statusActive, 'Активный');
      expect(ru().statusInactive, 'Неактивный');
      expect(kk().statusActive, 'Белсенді');
      expect(kk().statusInactive, 'Белсенді емес');
      for (final raw in ['Active', 'Inactive']) {
        expect(ru().statusActive.contains(raw), isFalse,
            reason: 'raw $raw in RU statusActive');
        expect(ru().statusInactive.contains(raw), isFalse,
            reason: 'raw $raw in RU statusInactive');
        expect(kk().statusActive.contains(raw), isFalse,
            reason: 'raw $raw in KK statusActive');
        expect(kk().statusInactive.contains(raw), isFalse,
            reason: 'raw $raw in KK statusInactive');
      }
    });
  });
}
