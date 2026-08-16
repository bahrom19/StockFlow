import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/sales/domain/cash_shift_models.dart';
import 'package:stockflow/features/sales/presentation/screens/pos_workspace.dart';

import '../../helpers/pdf_text.dart';

/// Phase 5D-7F-1 — X/Z cash-shift report PDF localization.
///
/// The report PDF previously rendered with the pdf-package DEFAULT font
/// (Helvetica/WinAnsi), which silently dropped RU/KK Cyrillic/Kazakh copy
/// from the content stream (proven in Phase 5D-7F). After the fix the
/// builder uses the shared Roboto TTFs and formats amounts via
/// CurrencyCatalog.formatPdf — these tests pin the new contract.
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

CashShift _shift() => CashShift(
      id: 'shift_000001',
      companyId: 'c',
      warehouseId: 'w',
      cashierId: 'u',
      status: 'OPEN',
      openedAt: DateTime.utc(2026, 8, 16, 10, 30),
      openingBalance: '5000.00',
      cashSales: '120.50',
      cardSales: '80.00',
      qrSales: '30.00',
      bankTransferSales: '10.00',
      mobileWalletSales: '5.00',
      totalSales: '245.50',
      cashIn: '100.00',
      cashOut: '50.00',
      expectedClosing: '5295.50',
      difference: '0.00',
    );

void main() {
  // rootBundle asset loading (Roboto TTFs) needs the binding in tests.
  TestWidgetsFlutterBinding.ensureInitialized();

  Future<String> pdfText(
    AppLocalizations l10n, {
    bool isZ = false,
  }) async {
    final bytes = await ShiftReportPdf.build(
      shift: _shift(),
      isZ: isZ,
      warehouseName: 'Main WH',
      l10n: l10n,
    );
    expect(bytes, isNotEmpty);
    return extractPdfText(bytes);
  }

  group('EN contract — X/Z shift report PDF', () {
    test('X report keeps EN labels and formatted amounts', () async {
      final text = await pdfText(en());
      expect(text, contains('X Report'));
      expect(text, contains('Warehouse: Main WH'));
      expect(text, contains('Status: Open'));
      for (final label in [
        'Opening balance',
        'Cash sales',
        'Card sales',
        'QR sales',
        'Bank transfer sales',
        'Mobile wallet sales',
        'Total sales',
        'Cash in',
        'Cash out',
      ]) {
        expect(text, contains(label));
      }
      // Amounts are formatted via CurrencyCatalog.formatPdf (thousands
      // grouping + currency prefix) and not lost.
      expect(text, contains('KZT 5,000.00'));
      expect(text, contains('KZT 245.50'));
      expect(text, contains('KZT 120.50'));
      expect(text, isNot(contains('KZT 0.00')));
    });

    test('Z report adds expected closing + difference', () async {
      final text = await pdfText(en(), isZ: true);
      expect(text, contains('Z Report'));
      expect(text, contains('Expected closing'));
      expect(text, contains('Difference'));
      expect(text, contains('KZT 5,295.50'));
      expect(text, contains('KZT 0.00'));
    });
  });

  group('RU localization + Cyrillic glyphs (5D-7F-1)', () {
    test('RU X report keeps Cyrillic labels and formatted amounts',
        () async {
      final text = await pdfText(ru());
      expect(text, contains('X-отчёт'));
      expect(text, contains('Склад: Main WH'));
      expect(text, contains('Статус: Открыт'));
      for (final label in [
        'Начальный остаток',
        'Продажи наличными',
        'Продажи по карте',
        'Продажи по QR',
        'Продажи банковским переводом',
        'Продажи через мобильный кошелёк',
        'Всего продаж',
        'Внесено',
        'Изъято',
      ]) {
        expect(text, contains(label),
            reason: 'RU label "$label" missing from PDF');
      }
      expect(text, contains('KZT 245.50'));
      // No raw-English / WinAnsi truncation.
      expect(text, isNot(contains('X Report')));
      expect(text, isNot(contains('Opening balance')));
      expect(text, isNot(contains('Total sales')));
    });

    test('RU Z report keeps expected closing + difference', () async {
      final text = await pdfText(ru(), isZ: true);
      expect(text, contains('Z-отчёт'));
      expect(text, contains('Ожидаемый остаток'));
      expect(text, contains('Разница'));
      expect(text, contains('KZT 5,295.50'));
    });
  });

  group('KK localization + Kazakh glyphs (5D-7F-1)', () {
    test('KK X report keeps Kazakh labels and formatted amounts', () async {
      final text = await pdfText(kk());
      expect(text, contains('X-есеп'));
      expect(text, contains('Қойма: Main WH'));
      expect(text, contains('Статус: Ашық'));
      for (final label in [
        'Бастапқы қалдық',
        'Қолма-қол сатылымдар',
        'Картамен сатылымдар',
        'QR сатылымдар',
        'Жалпы сатылымдар',
        'Енгізілді',
        'Алынды',
      ]) {
        expect(text, contains(label),
            reason: 'KK label "$label" missing from PDF');
      }
      expect(text, contains('KZT 245.50'));
      expect(text, isNot(contains('X Report')));
      expect(text, isNot(contains('Opening balance')));
    });

    test('KK Z report keeps expected closing + difference', () async {
      final text = await pdfText(kk(), isZ: true);
      expect(text, contains('Z-есеп'));
      expect(text, contains('Күтілетін қалдық'));
      expect(text, contains('Айырма'));
      expect(text, contains('KZT 5,295.50'));
    });
  });

  group('ARB parity — no new keys introduced by 5D-7F-1', () {
    Map<String, dynamic> arb(String file) =>
        jsonDecode(File('lib/l10n/$file').readAsStringSync())
            as Map<String, dynamic>;

    test('EN/RU/KK have identical key sets (unchanged)', () {
      final enKeys = arb('app_en.arb').keys.toSet();
      final ruKeys = arb('app_ru.arb').keys.toSet();
      final kkKeys = arb('app_kk.arb').keys.toSet();
      expect(ruKeys.difference(enKeys), isEmpty);
      expect(kkKeys.difference(enKeys), isEmpty);
      expect(enKeys.difference(ruKeys), isEmpty);
      expect(enKeys.difference(kkKeys), isEmpty);
    });
  });
}
