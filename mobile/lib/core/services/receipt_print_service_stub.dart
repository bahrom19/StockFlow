import 'dart:typed_data';

/// Non-web fallback: receipt output is a web-terminal concern.
Future<void> downloadPdf(Uint8List bytes, String filename) {
  throw UnsupportedError(
    'PDF download is only supported on the web build of StockFlow POS.',
  );
}

Future<void> printHtml(String html) {
  throw UnsupportedError(
    'Receipt printing is only supported on the web build of StockFlow POS.',
  );
}
