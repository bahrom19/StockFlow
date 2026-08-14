import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:stockflow/core/currency/currency_catalog.dart';
import 'package:stockflow/features/dashboard/domain/dashboard_models.dart';

/// Builds an A4 PDF report from the dashboard summary + recent sales.
/// Client-side only — uses data already fetched from the production API.
class ReportExport {
  ReportExport._();

  static final pw.Font _base = pw.Font.helvetica();
  static final pw.Font _bold = pw.Font.helveticaBold();

  static double _amount(String? v) => double.tryParse(v ?? '') ?? 0;

  static Future<Uint8List> buildPdf({
    required DashboardSummary summary,
    required List<RecentSale> sales,
    DateTime? generatedAt,
    String currency = 'KZT',
  }) async {
    // Phase 4: money cells render with the selected currency (PDF-safe symbol).
    String money(String? v) =>
        CurrencyCatalog.formatPdf(_amount(v), code: currency);
    final doc = pw.Document();
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (context) => [
          pw.Center(
            child: pw.Text('StockFlow — Business Report',
                style: pw.TextStyle(font: _bold, fontSize: 18)),
          ),
          pw.SizedBox(height: 4),
          pw.Center(
            child: pw.Text(
              'Generated ${(generatedAt ?? DateTime.now()).toLocal()}',
              style: pw.TextStyle(font: _base, fontSize: 9),
            ),
          ),
          pw.SizedBox(height: 16),
          pw.Text('Performance Summary',
              style: pw.TextStyle(font: _bold, fontSize: 13)),
          pw.SizedBox(height: 6),
          pw.Table(
            border: pw.TableBorder.all(width: .5),
            columnWidths: const {
              0: pw.FlexColumnWidth(1),
              1: pw.FlexColumnWidth(1),
              2: pw.FlexColumnWidth(1),
              3: pw.FlexColumnWidth(1),
            },
            children: [
              pw.TableRow(
                decoration: const pw.BoxDecoration(
                  color: PdfColor.fromInt(0xFFF1F3F4),
                ),
                children: [
                  _cell('Today', bold: true),
                  _cell('Yesterday', bold: true),
                  _cell('Month', bold: true),
                  _cell('Gross Profit', bold: true),
                ],
              ),
              pw.TableRow(
                children: [
                  _cell(money(summary.todaySales.revenue)),
                  _cell(money(summary.yesterdaySales.revenue)),
                  _cell(money(summary.monthSales.revenue)),
                  _cell(money(summary.grossProfit)),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 8),
          pw.Table(
            border: pw.TableBorder.all(width: .5),
            children: [
              pw.TableRow(
                decoration: const pw.BoxDecoration(
                  color: PdfColor.fromInt(0xFFF1F3F4),
                ),
                children: [
                  _cell('Inventory Value', bold: true),
                  _cell('Orders', bold: true),
                  _cell('Avg. Order', bold: true),
                ],
              ),
              pw.TableRow(
                children: [
                  _cell(money(summary.inventoryValue)),
                  _cell(summary.ordersCount.toString()),
                  _cell(
                    summary.ordersCount > 0
                        ? money(
                            (_amount(summary.monthSales.revenue) /
                                    summary.ordersCount)
                                .toString(),
                          )
                        : money('0'),
                  ),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 20),
          pw.Text('Recent Sales',
              style: pw.TextStyle(font: _bold, fontSize: 13)),
          pw.SizedBox(height: 6),
          pw.Table(
            border: pw.TableBorder.all(width: .4),
            columnWidths: const {
              0: pw.FlexColumnWidth(2),
              1: pw.FlexColumnWidth(2),
              2: pw.FlexColumnWidth(1),
              3: pw.FlexColumnWidth(1),
              4: pw.FlexColumnWidth(1),
            },
            children: [
              pw.TableRow(
                decoration: const pw.BoxDecoration(
                  color: PdfColor.fromInt(0xFFF1F3F4),
                ),
                children: [
                  _cell('Number', bold: true),
                  _cell('Date', bold: true),
                  _cell('Status', bold: true),
                  _cell('Total', bold: true),
                  _cell('Paid', bold: true),
                ],
              ),
              if (sales.isEmpty)
                pw.TableRow(
                  children: [
                    _cell('No sales in this period.'),
                    _cell(''),
                    _cell(''),
                    _cell(''),
                    _cell(''),
                  ],
                )
              else
                for (final s in sales)
                  pw.TableRow(
                    children: [
                      _cell(s.saleNumber),
                      _cell(s.createdAt),
                      _cell(s.status),
                      _cell(money(s.total)),
                      _cell(money(s.paidAmount)),
                    ],
                  ),
            ],
          ),
          pw.SizedBox(height: 16),
          pw.Center(
            child: pw.Text('StockFlow ERP · Generated by the Reports module',
                style: pw.TextStyle(font: _base, fontSize: 8)),
          ),
        ],
      ),
    );
    return doc.save();
  }

  static pw.Widget _cell(String text, {bool bold = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.all(6),
      child: pw.Text(
        text,
        style: pw.TextStyle(
          font: bold ? _bold : _base,
          fontSize: 10,
        ),
      ),
    );
  }
}
