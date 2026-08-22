import 'dart:typed_data';

import 'receipt_print_service_stub.dart'
    if (dart.library.html) 'receipt_print_service_web.dart' as impl;

/// Cross-platform facade for receipt output.
///
/// - Web: downloads PDF bytes via a Blob anchor and prints the receipt HTML
///   through a hidden iframe (window.print on the iframe content).
/// - Windows: real native printing — the 80mm roll PDF built by
///   ReceiptExport.buildPdf is rendered by the `printing` plugin (bundled
///   pdfium) and submitted through the standard Windows print dialog
///   (printer selection included). See receipt_print_service_windows.dart.
/// - Other native platforms: intentionally unsupported — fail fast with a
///   documented UnsupportedError, which the POS surfaces as a localized
///   "Print failed" snackbar instead of crashing.
class ReceiptPrintService {
  ReceiptPrintService._();

  static Future<void> downloadPdf(Uint8List bytes, String filename) {
    return impl.downloadPdf(bytes, filename);
  }

  static Future<void> printHtml(String html) {
    return impl.printHtml(html);
  }

  /// Platform-dispatching receipt print.
  ///
  /// [html] feeds the web iframe flow unchanged; [pdf] lazily builds the
  /// identical receipt as an 80mm roll PDF for the Windows print pipeline.
  /// The builder runs only where it is consumed (i.e. never on web).
  static Future<void> printReceipt({
    required String html,
    required Future<Uint8List> Function() pdf,
  }) {
    return impl.printReceipt(html: html, pdf: pdf);
  }
}
