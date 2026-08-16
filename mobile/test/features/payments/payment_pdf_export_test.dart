import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:stockflow/core/utils/pdf_fonts.dart';
import 'package:stockflow/features/payments/data/payment_pdf_export.dart';

import '../../helpers/pdf_text.dart';

AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  // rootBundle asset loading (Roboto TTFs) needs the binding in tests.
  TestWidgetsFlutterBinding.ensureInitialized();

  const enHeaders = [
    'Date',
    'Receipt',
    'Cashier',
    'Customer',
    'Warehouse',
    'Method',
    'Amount',
    'Status',
  ];
  const ruHeaders = [
    'Дата',
    'Чек',
    'Кассир',
    'Клиент',
    'Склад',
    'Способ',
    'Сумма',
    'Статус',
  ];
  const kkHeaders = [
    'Күні',
    'Чек',
    'Кассир',
    'Клиент',
    'Қойма',
    'Әдіс',
    'Сома',
    'Мәртебе',
  ];
  const ruTitle = 'Детали платежей';
  const kkTitle = 'Төлем мәліметтері';
  const ruSubtitle = 'Фильтр: Наличные · 2 транзакции';
  const kkSubtitle = 'Сүзгі: Қолма-қол · 2 транзакция';

  List<List<String>> sampleRows() => [
        ['Aug 06, 2026 10:00', 'INV-0001', 'usr_abc', '', 'wh_1', 'CASH', '100.00', 'COMPLETED'],
        ['Aug 06, 2026 10:05', 'INV-0002', 'usr_abc', 'cus_9', 'wh_1', 'CARD', '250.00', 'COMPLETED'],
      ];

  // 100.00 + 250.00 = 350.00 → "KZT 350.00" via CurrencyCatalog.formatPdf.
  const expectedTotal = 'KZT 350.00';

  group('PaymentPdfExport — existing contract (Roboto TTF encoding)', () {
    test('build produces valid PDF bytes', () async {
      final bytes = await PaymentPdfExport.build(
        title: 'Payment Details',
        subtitle: 'Today · 2 transactions',
        headers: enHeaders,
        rows: sampleRows(),
        compress: false,
      );

      expect(bytes, isNotEmpty);
      // PDF magic header.
      expect(ascii.decode(bytes.take(5).toList()), '%PDF-');
      // TTF-embedded PDFs write text as hex glyph runs + ToUnicode CMap, so
      // content is asserted via ToUnicode-based extraction (5D-6 pattern).
      final text = extractPdfText(bytes);
      expect(text, contains('INV-0001'));
      expect(text, contains('250.00'));
    });

    test('build handles empty rows without error', () async {
      final bytes = await PaymentPdfExport.build(
        title: 'Payment Details',
        headers: enHeaders,
        rows: const [],
        compress: false,
      );

      expect(bytes, isNotEmpty);
      expect(ascii.decode(bytes.take(5).toList()), '%PDF-');
    });

    test('build renders every row provided', () async {
      final rows = [
        for (var i = 0; i < 20; i++)
          ['Aug 06, 2026 10:00', 'INV-${i.toString().padLeft(4, '0')}', 'u', '', 'w', 'CASH', '$i.00', 'COMPLETED'],
      ];
      final bytes = await PaymentPdfExport.build(
        title: 'Payment Details',
        headers: enHeaders,
        rows: rows,
        compress: false,
      );

      final text = extractPdfText(bytes);
      for (var i = 0; i < 20; i++) {
        expect(text, contains('INV-${i.toString().padLeft(4, '0')}'));
      }
    });
  });

  group('EN contract — amount column + metadata', () {
    test('semantic amountColumnIndex formats the total correctly', () async {
      final bytes = await PaymentPdfExport.build(
        title: 'Payment Details',
        subtitle: 'Today · 2 transactions',
        headers: enHeaders,
        rows: sampleRows(),
        amountColumnIndex: 6,
        l10n: en(),
        compress: false,
      );
      final text = extractPdfText(bytes);
      expect(text, contains('Payment Details'));
      for (final h in ['Date', 'Receipt', 'Cashier', 'Customer', 'Warehouse', 'Method', 'Amount', 'Status']) {
        expect(text, contains(h));
      }
      expect(text, contains('Total amount: $expectedTotal'));
      expect(text, contains('Rows: 2'));
      expect(text, contains('Generated:'));
      expect(text, contains('Page 1 of 1'));
    });

    test('legacy English-literal detection still works without the index',
        () async {
      final bytes = await PaymentPdfExport.build(
        title: 'Payment Details',
        headers: enHeaders,
        rows: sampleRows(),
        compress: false,
      );
      final text = extractPdfText(bytes);
      // 'Amount' header matched by the legacy detection → total correct.
      expect(text, contains('Total amount: $expectedTotal'));
      expect(text, isNot(contains('Total amount: KZT 0.00')));
    });
  });

  group('RU/KK localization + Unicode glyphs (5D-7E)', () {
    test('RU PDF keeps Cyrillic, localized headers/title and a correct total',
        () async {
      final bytes = await PaymentPdfExport.build(
        title: ruTitle,
        subtitle: ruSubtitle,
        headers: ruHeaders,
        rows: sampleRows(),
        amountColumnIndex: 6,
        l10n: ru(),
        compress: false,
      );
      final text = extractPdfText(bytes);
      // Title + subtitle (Cyrillic must survive into the content stream).
      expect(text, contains('Детали платежей'));
      expect(text, contains('транзакци'));
      // Headers.
      for (final h in ['Дата', 'Чек', 'Кассир', 'Клиент', 'Склад', 'Способ', 'Сумма', 'Статус']) {
        expect(text, contains(h));
      }
      // Localized metadata/footer.
      expect(text, contains('Сформировано:'));
      expect(text, contains('Строк: 2'));
      expect(text, contains('Страница 1 из 1'));
      // Locale-independent amount column → correct total, NOT 0.00.
      expect(text, contains('Итого: $expectedTotal'));
      expect(text, isNot(contains('Итого: KZT 0.00')));
      // No raw English leak.
      expect(text, isNot(contains('Payment Details')));
      expect(text, isNot(contains('Total amount:')));
      expect(text, isNot(contains('Rows:')));
    });

    test('KK PDF keeps Kazakh, localized headers/title and a correct total',
        () async {
      final bytes = await PaymentPdfExport.build(
        title: kkTitle,
        subtitle: kkSubtitle,
        headers: kkHeaders,
        rows: sampleRows(),
        amountColumnIndex: 6,
        l10n: kk(),
        compress: false,
      );
      final text = extractPdfText(bytes);
      expect(text, contains('Төлем мәліметтері'));
      expect(text, contains('транзакция'));
      for (final h in ['Күні', 'Чек', 'Кассир', 'Клиент', 'Қойма', 'Әдіс', 'Сома', 'Мәртебе']) {
        expect(text, contains(h));
      }
      expect(text, contains('Жасалған:'));
      expect(text, contains('Жолдар: 2'));
      expect(text, contains('1 / 1 бет'));
      expect(text, contains('Барлығы: $expectedTotal'));
      expect(text, isNot(contains('Барлығы: KZT 0.00')));
      expect(text, isNot(contains('Payment Details')));
      expect(text, isNot(contains('Total amount:')));
      expect(text, isNot(contains('Rows:')));
    });

    test('the full Kazakh alphabet survives PDF generation', () async {
      await PdfFonts.ensureLoaded();
      final doc = pw.Document();
      doc.addPage(pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (_) => pw.Text(
          'Әә Ғғ Ққ Ңң Өө Ұұ Үү Һһ Іі',
          style: pw.TextStyle(font: PdfFonts.regular, fontSize: 12),
        ),
      ));
      final text = extractPdfText(await doc.save());
      for (final ch in 'Әә Ғғ Ққ Ңң Өө Ұұ Үү Һһ Іі'.split('')) {
        expect(text, contains(ch), reason: 'Kazakh glyph $ch missing from PDF');
      }
    });
  });

  group('null-l10n fallback — EN byte-for-byte metadata', () {
    test('without l10n the metadata lines fall back to English', () async {
      final bytes = await PaymentPdfExport.build(
        title: 'Payment Details',
        headers: enHeaders,
        rows: sampleRows(),
        amountColumnIndex: 6,
        compress: false,
      );
      final text = extractPdfText(bytes);
      expect(text, contains('Generated:'));
      expect(text, contains('Page 1 of 1'));
      expect(text, contains('Rows: 2'));
      expect(text, contains('Total amount: $expectedTotal'));
    });
  });

  group('ARB parity — 5D-7E PDF metadata keys', () {
    Map<String, dynamic> arb(String file) =>
        jsonDecode(File('lib/l10n/$file').readAsStringSync())
            as Map<String, dynamic>;

    const keys = [
      'pdfGeneratedAt',
      'pdfPageOf',
      'pdfRows',
      'pdfTotalAmount',
    ];

    test('EN/RU/KK have identical key sets', () {
      final enKeys = arb('app_en.arb').keys.toSet();
      final ruKeys = arb('app_ru.arb').keys.toSet();
      final kkKeys = arb('app_kk.arb').keys.toSet();
      expect(ruKeys.difference(enKeys), isEmpty);
      expect(kkKeys.difference(enKeys), isEmpty);
      expect(enKeys.difference(ruKeys), isEmpty);
      expect(enKeys.difference(kkKeys), isEmpty);
    });

    test('the 5D-7E keys exist and are non-empty in every locale', () {
      for (final file in ['app_en.arb', 'app_ru.arb', 'app_kk.arb']) {
        final d = arb(file);
        for (final key in keys) {
          expect(d.containsKey(key), isTrue, reason: '$key missing in $file');
          expect((d[key] as String).trim(), isNotEmpty,
              reason: '$key empty in $file');
        }
      }
    });

    test('placeholders are declared in every ARB template', () {
      final placeholders = {
        'pdfGeneratedAt': '{date}',
        'pdfPageOf': '{page}',
        'pdfRows': '{count}',
        'pdfTotalAmount': '{amount}',
      };
      for (final file in ['app_en.arb', 'app_ru.arb', 'app_kk.arb']) {
        final d = arb(file);
        for (final entry in placeholders.entries) {
          expect((d[entry.key] as String), contains(entry.value),
              reason: '${entry.value} placeholder missing in $file');
        }
      }
    });

    test('getters substitute placeholders in every locale', () {
      expect(en().pdfGeneratedAt('15.08.2026'), 'Generated: 15.08.2026');
      expect(ru().pdfGeneratedAt('15.08.2026'), isNot(contains('{date}')));
      expect(ru().pdfGeneratedAt('15.08.2026'), contains('15.08.2026'));
      expect(kk().pdfGeneratedAt('15.08.2026'), contains('15.08.2026'));
      expect(en().pdfPageOf(1, 2), 'Page 1 of 2');
      expect(ru().pdfPageOf(1, 2), 'Страница 1 из 2');
      expect(kk().pdfPageOf(1, 2), '1 / 2 бет');
      expect(en().pdfRows(2), 'Rows: 2');
      expect(ru().pdfRows(2), 'Строк: 2');
      expect(kk().pdfRows(2), 'Жолдар: 2');
      expect(en().pdfTotalAmount('KZT 1.00'), 'Total amount: KZT 1.00');
      expect(ru().pdfTotalAmount('KZT 1.00'), 'Итого: KZT 1.00');
      expect(kk().pdfTotalAmount('KZT 1.00'), 'Барлығы: KZT 1.00');
    });
  });
}
