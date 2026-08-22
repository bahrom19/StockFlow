import 'dart:typed_data';

import 'receipt_print_service_stub.dart'
    if (dart.library.html) 'receipt_print_service_web.dart' as impl;

/// Cross-platform facade for receipt output.
///
/// - Web: downloads PDF bytes via a Blob anchor and prints the receipt HTML
///   through a hidden iframe (window.print on the iframe content).
/// - Native (Windows/desktop/mobile): intentionally unsupported — receipts are
///   a web-terminal concern today. Real Windows native printing (print dialog
///   via a platform channel) is the recorded NEXT PHASE; until then the stub
///   fails fast with a documented UnsupportedError, which the POS surfaces as
///   a localized "Print failed" snackbar instead of crashing.
class ReceiptPrintService {
  ReceiptPrintService._();

  static Future<void> downloadPdf(Uint8List bytes, String filename) {
    return impl.downloadPdf(bytes, filename);
  }

  static Future<void> printHtml(String html) {
    return impl.printHtml(html);
  }
}
