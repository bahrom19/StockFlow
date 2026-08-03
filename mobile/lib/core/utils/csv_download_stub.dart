/// Fallback CSV downloader (unused on real platforms).
Future<void> downloadCsv(String filename, String csv) async {
  throw UnsupportedError('CSV download is not supported on this platform');
}
