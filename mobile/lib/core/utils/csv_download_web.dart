// ignore_for_file: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'csv_web_bytes.dart';

/// Web CSV downloader — builds a Blob (UTF-8 with BOM, so Windows Excel
/// detects the encoding) and triggers a browser download.
Future<void> downloadCsv(String filename, String csv) async {
  final blob = html.Blob([webCsvBytes(csv)], 'text/csv;charset=utf-8');
  final url = html.Url.createObjectUrl(blob);
  final anchor = html.AnchorElement(href: url)
    ..download = filename
    ..style.display = 'none';
  html.document.body!.append(anchor);
  anchor.click();
  anchor.remove();
  html.Url.revokeObjectUrl(url);
}
