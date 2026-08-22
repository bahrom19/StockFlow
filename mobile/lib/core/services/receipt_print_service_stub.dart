import 'dart:io' show Platform;
import 'dart:typed_data';

import 'receipt_print_service_windows.dart' as windows;

/// Native fallback implementations behind the ReceiptPrintService facade.
///
/// Platform routing:
/// - Web .......... receipt_print_service_web.dart (picked by the facade's
///                  conditional import; this file is never compiled there).
/// - Windows ...... receipt_print_service_windows.dart — real native printing
///                  through the `printing` plugin (system print dialog,
///                  80mm thermal support).
/// - Other natives  fail fast with UnsupportedError (legacy behavior kept:
///                  receipts remain a web/Windows concern there).
Future<void> downloadPdf(Uint8List bytes, String filename) async {
  // async so the error is delivered through the returned Future (the
  // signature contract) instead of throwing synchronously at the call site.
  throw UnsupportedError(
    'PDF download is only supported on the web build of StockFlow POS.',
  );
}

Future<void> printHtml(String html) async {
  // async so the error is delivered through the returned Future (the
  // signature contract) instead of throwing synchronously at the call site.
  throw UnsupportedError(
    'Receipt printing is only supported on the web build of StockFlow POS.',
  );
}

/// Platform-aware receipt print: routes to the real Windows implementation or
/// fails fast elsewhere. Never silently fakes success.
Future<void> printReceipt({
  required String html,
  required Future<Uint8List> Function() pdf,
}) async {
  if (!Platform.isWindows) {
    throw UnsupportedError(
      'Native receipt printing is currently supported on the Windows build '
      'of StockFlow POS.',
    );
  }
  return windows.printReceipt(html: html, pdf: pdf);
}
