import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/services/receipt_print_service.dart';
import 'package:stockflow/features/sales/data/receipt_export.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

Sale _sale() {
  final now = DateTime.utc(2026, 8, 13, 12);
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
    currency: 'KZT',
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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // ──────────────────────────────────
  // 1. Successful receipt formation — the markup handed to the print flow
  // ──────────────────────────────────
  group('receipt formation (buildHtml → print flow input)', () {
    test('produces complete printable receipt markup', () {
      final markup = ReceiptExport.buildHtml(
        _sale(),
        productNames: {'p1': 'Espresso'},
      );

      expect(markup, startsWith('<!DOCTYPE html>'));
      expect(markup, contains('</html>'));
      // Header + machine-readable data.
      expect(markup, contains('S-0001'));
      // Line item uses the cart product name mapping.
      expect(markup, contains('Espresso'));
      // Totals rendered in the sale currency.
      expect(markup, contains('₸100.00'));
      expect(markup, contains('TOTAL'));
      // Payments section present (CASH row — backend value kept verbatim).
      expect(markup, contains('CASH'));
    });

    test('markup is self-contained (no external resources required)', () {
      final markup = ReceiptExport.buildHtml(_sale());
      // A printable receipt must not depend on network fetches: no
      // http(s) resource links inside the document body markup itself.
      expect(markup.contains('src="http'), isFalse);
      expect(markup.contains("src='http"), isFalse);
    });
  });

  // ──────────────────────────────────
  // 2. PDF export path stays intact (separate concern from printing)
  // ──────────────────────────────────
  group('ReceiptExport.buildPdf (separate export path)', () {
    test('still builds non-trivial PDF bytes', () async {
      final bytes = await ReceiptExport.buildPdf(_sale());
      expect(bytes.length, greaterThan(1000));
    });
  });

  // ──────────────────────────────────
  // 3. Platform contract of the print service facade.
  //
  // flutter_test runs on the Dart VM (`dart.library.html` is false), so the
  // conditional import resolves to receipt_print_service_stub.dart. These
  // tests pin the documented native behavior: fail fast with the exact
  // UnsupportedError messages (which the POS catches and shows as a
  // localized snackbar) — never a silent fake success and never an uncaught
  // crash. The web implementation behind the same facade compiles via
  // `flutter build web` and is exercised by the browser print dialog.
  // ──────────────────────────────────
  group('ReceiptPrintService platform contract', () {
    test('printHtml fails fast off-web with the documented error', () async {
      await expectLater(
        ReceiptPrintService.printHtml('<html><body></body></html>'),
        throwsA(
          isA<UnsupportedError>().having(
            (e) => e.message,
            'message',
            'Receipt printing is only supported on the web build of '
                'StockFlow POS.',
          ),
        ),
      );
    });

    test('downloadPdf fails fast off-web with the documented error', () async {
      await expectLater(
        ReceiptPrintService.downloadPdf(Uint8List(0), 'S-0001.pdf'),
        throwsA(
          isA<UnsupportedError>().having(
            (e) => e.message,
            'message',
            'PDF download is only supported on the web build of StockFlow '
                'POS.',
          ),
        ),
      );
    });
  });
}