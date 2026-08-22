import 'dart:io' show Platform;
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:pdf/pdf.dart';
import 'package:printing/printing.dart' show Printer;
import 'package:stockflow/core/services/receipt_print_service.dart';
import 'package:stockflow/core/services/receipt_print_service_windows.dart'
    as win;
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

    test('carries quantity and money cells for thermal rendering', () {
      final markup =
          ReceiptExport.buildHtml(_sale(), productNames: {'p1': 'Espresso'});
      // Quantity cell rendered verbatim.
      expect(markup, contains('<td>2</td>'));
      // Line total in the sale's currency.
      expect(markup, contains('>₸100.00</td>'));
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

    test('still produces a well-formed PDF document for the print pipeline',
        () async {
      final bytes = await ReceiptExport.buildPdf(_sale());
      // Magic header: a valid PDF reaches the Windows spooler / browser
      // download — never truncated bytes.
      expect(String.fromCharCodes(bytes.sublist(0, 5)), '%PDF-');
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

    // On non-Windows hosts the stub routes nowhere and fails fast; on a
    // Windows host this same call would enter the real native pipeline
    // (platform channels are unavailable in flutter_test), so the assertion
    // is scoped to non-Windows hosts to stay deterministic.
    test('facade printReceipt fails fast off-Windows with a typed error',
        () async {
      await expectLater(
        ReceiptPrintService.printReceipt(
          html: '<html><body></body></html>',
          pdf: () async => Uint8List(0),
        ),
        throwsA(isA<UnsupportedError>()),
      );
    }, skip: Platform.isWindows ? 'Windows host runs the real pipeline' : false);
  });

  // ──────────────────────────────────
  // 4. Windows native printing pipeline (receipt_print_service_windows).
  //
  // The real `printing` plugin needs platform channels + physical printers,
  // so these tests inject fakes through the file's visibleForTesting seam.
  // They verify the abstraction contract — NOT that a physical printer
  // printed (that requires the manual Windows smoke test).
  // ──────────────────────────────────
  group('Windows native printing pipeline', () {
    tearDown(() => win.debugConfigureWindowsPrintPipeline());

    test('shared contract: completes when the spooler accepts the job',
        () async {
      var pdfBuilds = 0;
      var handedBytes = Uint8List(0);
      String? jobName;
      win.debugConfigureWindowsPrintPipeline(
        lister: () async => const <Printer>[
          Printer(url: 'th-80', name: 'Thermal 80mm'),
        ],
        launcher: ({required onLayout, required name}) async {
          jobName = name;
          handedBytes = await onLayout(PdfPageFormat.roll80);
          return true;
        },
      );

      await win.printReceipt(
        html: '<html><body>unused on windows</body></html>',
        pdf: () async {
          pdfBuilds++;
          return Uint8List.fromList(const [0x25, 0x50, 0x44, 0x46]); // %PDF
        },
      );

      // Lazy PDF builder ran exactly once, its bytes went to the job,
      // and the spooler job is named for the user's print queue.
      expect(pdfBuilds, 1);
      expect(handedBytes, hasLength(4));
      expect(jobName, 'StockFlow receipt');
    });

    test('job rejection surfaces a catchable Future error (no fake success)',
        () async {
      win.debugConfigureWindowsPrintPipeline(
        lister: () async => const <Printer>[Printer(url: 'th-80')],
        launcher:
            ({required onLayout, required name}) async => false, // cancelled
      );

      await expectLater(
        win.printReceipt(html: '', pdf: () async => Uint8List(4)),
        throwsA(isA<win.ReceiptPrintException>()
            .having((e) => e.code, 'code', 'printJobFailed')
            .having((e) => e.message, 'message', 'Print job failed')),
      );
    });

    test('platform crash is wrapped into a safe error, raw details logged',
        () async {
      win.debugConfigureWindowsPrintPipeline(
        lister: () async => const <Printer>[Printer(url: 'th-80')],
        launcher: ({required onLayout, required name}) async =>
            throw StateError('raw DEVMODE failure'),
      );

      // The POS layer catches any error from the Future; users only ever see
      // the safe message via the localized snackbar — never the StateError.
      await expectLater(
        win.printReceipt(html: '', pdf: () async => Uint8List(4)),
        throwsA(isA<win.ReceiptPrintException>()
            .having((e) => e.code, 'code', 'printJobFailed')
            .having((e) => e.toString(), 'toString', 'Print job failed')),
      );
    });

    test('no installed printers -> printerNotFound, dialog never opened',
        () async {
      var launched = false;
      win.debugConfigureWindowsPrintPipeline(
        lister: () async => const <Printer>[],
        launcher: ({required onLayout, required name}) async {
          launched = true;
          return true;
        },
      );

      await expectLater(
        win.printReceipt(html: '', pdf: () async => Uint8List(0)),
        throwsA(isA<win.ReceiptPrintException>()
            .having((e) => e.code, 'code', 'printerNotFound')
            .having((e) => e.message, 'message', 'Printer not found')),
      );
      expect(launched, isFalse);
    });
  });
}