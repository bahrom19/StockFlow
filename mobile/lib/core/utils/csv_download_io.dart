import 'package:flutter/services.dart';

/// Desktop / mobile CSV downloader — copies the document to the clipboard,
/// since writing files requires a path picker that is not in scope.
Future<void> downloadCsv(String filename, String csv) async {
  await Clipboard.setData(ClipboardData(text: csv));
}
