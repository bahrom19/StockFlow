import 'dart:typed_data';

/// Desktop / mobile PDF downloader — writing binary files requires a path
/// picker that is not in scope; PDF export is a web-terminal concern.
Future<void> downloadPdf(String filename, Uint8List bytes) {
  throw UnsupportedError(
    'PDF export is only supported on the web build of StockFlow.',
  );
}
