import 'csv_download_stub.dart'
    if (dart.library.html) 'csv_download_web.dart'
    if (dart.library.io) 'csv_download_io.dart' as platform_download;

/// RFC 4180 CSV builder + cross-platform download helper.
///
/// On web a real file download is triggered; on desktop/mobile the document
/// is copied to the clipboard (a file-picker integration can replace the io
/// implementation later without touching callers).
class CsvExporter {
  CsvExporter._();

  /// Escapes a single cell per RFC 4180.
  static String _escape(String value) {
    if (value.contains(',') ||
        value.contains('"') ||
        value.contains('\n') ||
        value.contains('\r')) {
      return '"${value.replaceAll('"', '""')}"';
    }
    return value;
  }

  /// Builds a CSV document string from [rows] (first row is the header).
  static String build(List<List<String>> rows) {
    final buffer = StringBuffer();
    for (final row in rows) {
      buffer.writeln(row.map(_escape).join(','));
    }
    return buffer.toString();
  }

  /// Downloads (web) or copies to clipboard (desktop/mobile) [rows] as CSV.
  static Future<void> download(
    String filename,
    List<List<String>> rows,
  ) {
    return platform_download.downloadCsv(filename, build(rows));
  }
}
