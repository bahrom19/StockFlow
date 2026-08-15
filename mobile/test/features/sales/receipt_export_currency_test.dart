import 'package:flutter/material.dart';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/sales/data/receipt_export.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

import '../../helpers/pdf_text.dart';

Sale _sale({String currency = 'KZT'}) {
  final now = DateTime.utc(2026, 8, 13, 12, 0);
  return Sale(
    id: 's1',
    companyId: 'c1',
    warehouseId: 'w1',
    cashierId: 'u1',
    saleNumber: 'S-0001',
    status: 'COMPLETED',
    subtotal: '100.00',
    discount: '0.00',
    tax: '0.00',
    total: '100.00',
    paidAmount: '100.00',
    changeAmount: '0.00',
    currency: currency,
    createdAt: now,
    updatedAt: now,
    items: [
      SaleItem(
        id: 'i1',
        saleId: 's1',
        productId: 'p1',
        quantity: 2,
        unitPrice: '50.00',
        costPrice: '30.00',
        discount: '0.00',
        subtotal: '100.00',
        total: '100.00',
        margin: '40.00',
        createdAt: now,
        updatedAt: now,
      ),
    ],
    payments: [
      Payment(
        id: 'pay1',
        saleId: 's1',
        method: 'CASH',
        amount: '100.00',
        createdAt: now,
        updatedAt: now,
      ),
    ],
  );
}

AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  // rootBundle asset loading (Roboto TTFs) needs the binding in tests.
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ReceiptExport.buildHtml uses the selected currency', () {
    test('KZT renders ₸ (not \$)', () {
      final html = ReceiptExport.buildHtml(_sale(), currency: 'KZT');
      expect(html, contains('₸100.00'));
      expect(html, isNot(contains(r'$100.00')));
    });

    test('RUB renders ₽', () {
      final html = ReceiptExport.buildHtml(_sale(), currency: 'RUB');
      expect(html, contains('₽100.00'));
    });

    test('USD renders \$', () {
      final html = ReceiptExport.buildHtml(_sale(), currency: 'USD');
      expect(html, contains(r'$100.00'));
    });

    test('defaults to KZT when currency is omitted', () {
      final html = ReceiptExport.buildHtml(_sale());
      expect(html, contains('₸100.00'));
    });
  });

  group('ReceiptExport.buildPdf', () {
    test('builds without error for every supported currency', () async {
      for (final code in ['KZT', 'RUB', 'USD', 'EUR', 'CNY', 'AED', 'AUD', 'VND']) {
        final bytes = await ReceiptExport.buildPdf(_sale(), currency: code);
        expect(bytes.length, greaterThan(1000),
            reason: '$code PDF renders non-trivial output');
      }
    });
  });

  group('Receipt PDF Unicode rendering (5D-6)', () {
    test('RU receipt PDF contains Cyrillic copy', () async {
      final bytes = await ReceiptExport.buildPdf(
        _sale(),
        l10n: ru(),
        vatNumber: '123456',
      );
      final text = extractPdfText(bytes);
      expect(text, contains('Товар'));
      expect(text, contains('Кол-во'));
      expect(text, contains('НДС'));
      expect(text, contains('ИТОГО'));
    });

    test('KK receipt PDF contains Kazakh copy', () async {
      final bytes = await ReceiptExport.buildPdf(
        _sale(),
        l10n: kk(),
        vatNumber: '123456',
      );
      final text = extractPdfText(bytes);
      expect(text, contains('Тауар'));
      expect(text, contains('Саны'));
      expect(text, contains('ҚҚС'));
      expect(text, contains('БАРЛЫҒЫ'));
    });

    test('EN receipt PDF stays intact', () async {
      final bytes = await ReceiptExport.buildPdf(_sale());
      final text = extractPdfText(bytes);
      expect(text, contains('Item'));
      expect(text, contains('Qty'));
      expect(text, contains('TOTAL'));
    });
  });

  group('QR payload contract (unchanged)', () {
    test('keeps the sale currency code, not the display symbol', () {
      expect(ReceiptExport.qrPayload(_sale(currency: 'KZT')),
          contains('|100.00|KZT|'));
      expect(ReceiptExport.qrPayload(_sale(currency: 'RUB')),
          contains('|100.00|RUB|'));
    });
  });
}
