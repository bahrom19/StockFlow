import 'dart:typed_data';

import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:stockflow/core/currency/currency_catalog.dart';
import 'package:stockflow/core/utils/pdf_fonts.dart';

/// Builds a Payment Details PDF document from CSV-style rows.
///
/// Client-side renderer (mirrors the receipt/CSV export approach): takes the
/// exact rows/headers already shown in the details table and lays them out on
/// an A4 landscape page with a title, generated timestamp and row count.
/// Never touches the backend API.
class PaymentPdfExport {
  PaymentPdfExport._();

  static pw.TextStyle _style(double size, {bool bold = false}) => pw.TextStyle(
        font: bold ? PdfFonts.bold : PdfFonts.regular,
        fontSize: size,
      );

  /// Renders [headers] + [rows] (same shape as the CSV export) into PDF bytes.
  ///
  /// [amountColumnIndex] identifies the money column by its SEMANTIC position
  /// in the row shape — never by localized display text, so RU/KK headers
  /// (Сумма / Сома) resolve the column correctly. When omitted, the exporter
  /// falls back to the legacy English-literal detection (plain 'Amount' /
  /// 'Total' headers, existing tests).
  ///
  /// [l10n] localizes the generated/page/rows/total metadata lines; when
  /// null they fall back to the English originals (byte-for-byte).
  ///
  /// [compress] enables FlateDecode on content streams (default). Tests pass
  /// `false` so the emitted text is directly inspectable.
  static Future<Uint8List> build({
    required String title,
    String? subtitle,
    required List<String> headers,
    required List<List<String>> rows,
    bool compress = true,
    String currency = 'KZT',
    int? amountColumnIndex,
    AppLocalizations? l10n,
  }) async {
    // Phase 5D-7E: Roboto TTFs (Latin + Cyrillic + Kazakh) are the PRIMARY
    // PDF fonts — Helvetica/WinAnsi silently dropped RU/KK copy from the
    // content stream (proven in production). Same strategy as report/receipt.
    await PdfFonts.ensureLoaded();

    final amountCol =
        amountColumnIndex ?? _legacyAmountColumnIndex(headers);

    final doc = pw.Document(compress: compress);
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.all(24),
        header: (context) => _header(title, subtitle, l10n),
        footer: (context) => pw.Align(
          alignment: pw.Alignment.centerRight,
          child: pw.Text(
            l10n?.pdfPageOf(context.pageNumber, context.pagesCount) ??
                'Page ${context.pageNumber} of ${context.pagesCount}',
            style: _style(8),
          ),
        ),
        build: (context) => [
          pw.TableHelper.fromTextArray(
            context: context,
            headers: headers,
            data: amountCol >= 0
                ? [
                    for (final row in rows)
                      [
                        for (var i = 0; i < row.length; i++)
                          i == amountCol
                              ? CurrencyCatalog.formatPdf(
                                  double.tryParse(row[i]) ?? 0,
                                  code: currency,
                                )
                              : row[i],
                      ],
                  ]
                : rows,
            headerStyle: _style(9, bold: true),
            cellStyle: _style(8),
            headerDecoration: const pw.BoxDecoration(
              color: PdfColor.fromInt(0xFFE8F0FE),
              borderRadius: pw.BorderRadius.all(pw.Radius.circular(2)),
            ),
            oddRowDecoration: const pw.BoxDecoration(
              color: PdfColor.fromInt(0xFFFAFBFC),
            ),
            cellAlignments: {
              for (var i = 0; i < headers.length; i++)
                i: amountCol >= 0 && i == amountCol
                    ? pw.Alignment.centerRight
                    : pw.Alignment.centerLeft,
            },
          ),
          pw.SizedBox(height: 12),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                l10n?.pdfRows(rows.length) ?? 'Rows: ${rows.length}',
                style: _style(9, bold: true),
              ),
              pw.Text(
                _totalAmountLabel(rows, amountCol, currency, l10n),
                style: _style(9, bold: true),
              ),
            ],
          ),
        ],
      ),
    );
    return doc.save();
  }

  static String _totalAmountLabel(
    List<List<String>> rows,
    int amountCol,
    String currency,
    AppLocalizations? l10n,
  ) {
    final formatted = CurrencyCatalog.formatPdf(
      _sumAmount(rows, amountCol),
      code: currency,
    );
    return l10n?.pdfTotalAmount(formatted) ?? 'Total amount: $formatted';
  }

  /// Legacy English-literal detection — backward compatibility only.
  /// Production callers pass [amountColumnIndex] explicitly.
  static int _legacyAmountColumnIndex(List<String> headers) {
    return headers.indexWhere(
      (h) => h.toLowerCase() == 'amount' || h.toLowerCase() == 'total',
    );
  }

  static double _sumAmount(List<List<String>> rows, int amountColumnIndex) {
    if (amountColumnIndex < 0) return 0;
    var total = 0.0;
    for (final row in rows) {
      if (row.length > amountColumnIndex) {
        total += double.tryParse(row[amountColumnIndex]) ?? 0;
      }
    }
    return total;
  }

  static pw.Widget _header(
    String title,
    String? subtitle,
    AppLocalizations? l10n,
  ) {
    final subtitleLine = (subtitle != null && subtitle.isNotEmpty)
        ? pw.Text(subtitle, style: _style(9))
        : pw.SizedBox.shrink();
    final generated =
        DateTime.now().toLocal().toString().substring(0, 16);
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(title, style: _style(14, bold: true)),
            pw.Text(
              l10n?.pdfGeneratedAt(generated) ?? 'Generated: $generated',
              style: _style(8),
            ),
          ],
        ),
        subtitleLine,
        pw.SizedBox(height: 8),
        pw.Divider(color: PdfColor.fromInt(0xFFDADCE0)),
        pw.SizedBox(height: 8),
      ],
    );
  }
}
