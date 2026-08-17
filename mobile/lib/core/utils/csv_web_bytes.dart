import 'dart:convert';
import 'dart:typed_data';

/// UTF-8 bytes for a web CSV download, prefixed with the UTF-8 BOM
/// (`EF BB BF`).
///
/// The BOM lets Windows Excel detect the file as UTF-8 instead of falling
/// back to the system ANSI codepage, which would show Cyrillic/Kazakh as
/// mojibake in RU/KK exports. UTF-8-aware consumers (Google Sheets,
/// LibreOffice, browsers, strict parsers) tolerate and consume the BOM.
///
/// Pure and platform-neutral so the byte contract is unit-testable without
/// pulling in `dart:html` (the web download adapter lives in
/// [csv_download_web.dart]).
Uint8List webCsvBytes(String csv) {
  return Uint8List.fromList(<int>[0xEF, 0xBB, 0xBF, ...utf8.encode(csv)]);
}
