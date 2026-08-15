import 'package:flutter/services.dart';
import 'package:pdf/widgets.dart' as pw;

/// Bundled Roboto TTFs used by the PDF exporters (report + receipt).
///
/// These are the PRIMARY PDF fonts — not merely `fontFallback`. Helvetica
/// (WinAnsi/CP-1252) cannot encode Cyrillic or Kazakh, so RU/KK PDF copy was
/// silently dropped from the content stream. Roboto covers Latin + Cyrillic
/// + the full Kazakh alphabet (Әә Ғғ Ққ Ңң Өө Ұұ Үү Һһ Іі).
class PdfFonts {
  PdfFonts._();

  static pw.Font? _regular;
  static pw.Font? _bold;

  /// Loads both TTFs once via rootBundle and caches them. Safe to call
  /// repeatedly; idempotent.
  static Future<void> ensureLoaded() async {
    if (_regular != null && _bold != null) return;
    final regular = await rootBundle.load('assets/fonts/Roboto-Regular.ttf');
    final bold = await rootBundle.load('assets/fonts/Roboto-Bold.ttf');
    _regular = pw.Font.ttf(regular.buffer.asByteData());
    _bold = pw.Font.ttf(bold.buffer.asByteData());
  }

  static pw.Font get regular => _regular!;
  static pw.Font get bold => _bold!;
}
