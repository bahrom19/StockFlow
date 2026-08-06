import 'dart:typed_data';

import 'receipt_print_service_stub.dart'
    if (dart.library.html) 'receipt_print_service_web.dart' as impl;

/// Cross-platform facade for receipt output.
///
/// - Web: downloads PDF bytes via a Blob anchor and prints the receipt HTML
///   through a hidden iframe (window.print on the iframe content).
/// - Native: intentionally unsupported (throws) — receipts are a web concern
///   for the cashier terminal.
class ReceiptPrintService {
  ReceiptPrintService._();

  static Future<void> downloadPdf(Uint8List bytes, String filename) {
    return impl.downloadPdf(bytes, filename);
  }

  static Future<void> printHtml(String html) {
    return impl.printHtml(html);
  }
}
