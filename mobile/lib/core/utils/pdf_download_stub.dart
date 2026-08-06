import 'dart:typed_data';

/// Fallback PDF downloader (unused on real platforms).
Future<void> downloadPdf(String filename, Uint8List bytes) {
  throw UnsupportedError('PDF download is not supported on this platform');
}
