import 'dart:typed_data';

import 'pdf_download_stub.dart'
    if (dart.library.html) 'pdf_download_web.dart'
    if (dart.library.io) 'pdf_download_io.dart' as platform_download;

/// Cross-platform PDF byte downloader.
///
/// On web a real browser download is triggered; on desktop/mobile the
/// operation is unsupported (mirrors the receipt-print service behavior).
class PdfDownloader {
  PdfDownloader._();

  static Future<void> download(String filename, Uint8List bytes) {
    return platform_download.downloadPdf(filename, bytes);
  }
}
