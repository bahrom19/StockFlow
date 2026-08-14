import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

/// Phase 5A — Finance (trial balance) localization.
///
/// Guard 1 (EN contract): user-facing strings stay byte-for-byte with the
/// pre-localization UI.
/// Guard 2: RU/KK natural ERP translations.
/// Guard 3: backend account-type codes (ASSET/LIABILITY/EQUITY/REVENUE/
/// EXPENSE) render localized UI labels — the screen maps them on the UI layer
/// via the same ARB keys used by the filters.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  group('EN byte-for-byte contract — Finance screen', () {
    test('header + totals', () {
      expect(en().financeTitle, 'Finance');
      expect(en().financeSubtitle,
          'Trial balance and general ledger overview');
      expect(en().totalDebit, 'Total Debit');
      expect(en().totalCredit, 'Total Credit');
      expect(en().balanced, 'Balanced');
    });

    test('table chrome (filters + columns + empty state)', () {
      expect(en().all, 'All');
      expect(en().accountTypeAssets, 'Assets');
      expect(en().accountTypeLiabilities, 'Liabilities');
      expect(en().accountTypeEquity, 'Equity');
      expect(en().revenue, 'Revenue');
      expect(en().accountTypeExpenses, 'Expenses');
      expect(en().code, 'Code');
      expect(en().account, 'Account');
      expect(en().type, 'Type');
      expect(en().debit, 'Debit');
      expect(en().credit, 'Credit');
      expect(en().noTrialBalanceData, 'No trial balance data');
      expect(en().trialBalanceEmptySubtitle,
          'Balances will appear once journal entries are posted');
    });
  });

  group('RU translations', () {
    test('header + totals localize', () {
      expect(ru().financeTitle, 'Финансы');
      expect(ru().financeSubtitle,
          'Пробный баланс и обзор главной книги');
      expect(ru().totalDebit, 'Итого дебет');
      expect(ru().totalCredit, 'Итого кредит');
      expect(ru().balanced, 'Сбалансировано');
    });

    test('filters/columns/empty localize', () {
      expect(ru().all, 'Все');
      expect(ru().accountTypeAssets, 'Активы');
      expect(ru().accountTypeLiabilities, 'Обязательства');
      expect(ru().accountTypeEquity, 'Капитал');
      expect(ru().revenue, 'Выручка');
      expect(ru().accountTypeExpenses, 'Расходы');
      expect(ru().account, 'Счет');
      expect(ru().debit, 'Дебет');
      expect(ru().credit, 'Кредит');
      expect(ru().noTrialBalanceData, 'Нет данных пробного баланса');
      expect(ru().trialBalanceEmptySubtitle,
          'Остатки появятся после проведения журнальных записей');
    });
  });

  group('KK translations', () {
    test('header + totals localize', () {
      expect(kk().financeTitle, 'Қаржы');
      expect(kk().financeSubtitle,
          'Бақылау балансы және бас кітап шолуы');
      expect(kk().totalDebit, 'Барлығы дебет');
      expect(kk().totalCredit, 'Барлығы кредит');
      expect(kk().balanced, 'Теңгерімделген');
    });

    test('filters/columns/empty localize', () {
      expect(kk().accountTypeAssets, 'Активтер');
      expect(kk().accountTypeLiabilities, 'Міндеттемелер');
      expect(kk().accountTypeEquity, 'Меншікті капитал');
      expect(kk().revenue, 'Табыс');
      expect(kk().accountTypeExpenses, 'Шығыстар');
      expect(kk().account, 'Шот');
      expect(kk().debit, 'Дебет');
      expect(kk().credit, 'Кредит');
      expect(kk().noTrialBalanceData, 'Бақылау баланс деректері жоқ');
      expect(kk().trialBalanceEmptySubtitle,
          'Журнал жазбалары тіркелгеннен кейін қалдықтар пайда болады');
    });
  });

  group('Account-type UI labels (backend enum → UI layer only)', () {
    test('EN: filter labels are the Type-column contract', () {
      // ASSET→Assets, LIABILITY→Liabilities, EQUITY→Equity, REVENUE→Revenue,
      // EXPENSE→Expenses — same words shown in the filter chips and the Type
      // column (the screen maps the codes to these keys on the UI layer).
      expect(en().accountTypeAssets, 'Assets');
      expect(en().accountTypeLiabilities, 'Liabilities');
      expect(en().accountTypeEquity, 'Equity');
      expect(en().revenue, 'Revenue');
      expect(en().accountTypeExpenses, 'Expenses');
    });

    test('RU: no raw ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE strings', () {
      for (final label in [
        ru().accountTypeAssets,
        ru().accountTypeLiabilities,
        ru().accountTypeEquity,
        ru().revenue,
        ru().accountTypeExpenses,
      ]) {
        expect(label, isNot(contains('ASSET')));
        expect(label, isNot(contains('LIABILITY')));
        expect(label, isNot(contains('EQUITY')));
        expect(label, isNot(contains('REVENUE')));
        expect(label, isNot(contains('EXPENSE')));
      }
    });

    test('KK: account types localize', () {
      expect(kk().accountTypeAssets, 'Активтер');
      expect(kk().accountTypeLiabilities, 'Міндеттемелер');
      expect(kk().accountTypeEquity, 'Меншікті капитал');
      expect(kk().accountTypeExpenses, 'Шығыстар');
    });
  });
}
