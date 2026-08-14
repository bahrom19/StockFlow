import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:stockflow/core/currency/currency_catalog.dart';

/// Builds a Payment Details PDF document from CSV-style rows.
///
/// Client-side renderer (mirrors the receipt/CSV export approach): takes the
/// exact rows/headers already shown in the details table and lays them out on
/// an A4 landscape page with a title, generated timestamp and row count.
/// Never touches the backend API.
class PaymentPdfExport {
  PaymentPdfExport._();

  static final pw.Font _base = pw.Font.helvetica();
  static final pw.Font _bold = pw.Font.helveticaBold();

  static pw.TextStyle _style(double size, {bool bold = false}) =>
      pw.TextStyle(font: bold ? _bold : _base, fontSize: size);

  /// Renders [headers] + [rows] (same shape as the CSV export) into PDF bytes.
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
  }) async {
    // Right-align the column named "Amount" (or "Total") — derived from the
    // headers so reordering columns never silently misaligns the totals.
    final amountColumnIndex = headers.indexWhere(
      (h) => h.toLowerCase() == 'amount' || h.toLowerCase() == 'total',
    );
    final doc = pw.Document(compress: compress);
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.all(24),
        header: (context) => _header(title, subtitle),
        footer: (context) => pw.Align(
          alignment: pw.Alignment.centerRight,
          child: pw.Text(
            'Page ${context.pageNumber} of ${context.pagesCount}',
            style: _style(8),
          ),
        ),
        build: (context) => [
          pw.TableHelper.fromTextArray(
            context: context,
            headers: headers,
            data: amountColumnIndex >= 0
                ? [
                    for (final row in rows)
                      [
                        for (var i = 0; i < row.length; i++)
                          i == amountColumnIndex
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
                i: amountColumnIndex >= 0 && i == amountColumnIndex
                    ? pw.Alignment.centerRight
                    : pw.Alignment.centerLeft,
            },
          ),
          pw.SizedBox(height: 12),
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Text(
                'Rows: ${rows.length}',
                style: _style(9, bold: true),
              ),
              pw.Text(
                'Total amount: '
                '${CurrencyCatalog.formatPdf(_sumAmount(rows, amountColumnIndex), code: currency)}',
                style: _style(9, bold: true),
              ),
            ],
          ),
        ],
      ),
    );
    return doc.save();
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

  static pw.Widget _header(String title, String? subtitle) {
    final subtitleLine = (subtitle != null && subtitle.isNotEmpty)
        ? pw.Text(subtitle, style: _style(9))
        : pw.SizedBox.shrink();
    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(title, style: _style(14, bold: true)),
            pw.Text(
              'Generated: ${DateTime.now().toLocal().toString().substring(0, 16)}',
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
