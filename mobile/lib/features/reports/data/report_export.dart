import 'dart:typed_data';

import 'package:flutter_gen/gen_l10n/app_localizations.dart';
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
    AppLocalizations? l10n,
  }) async {
    // Phase 4: money cells render with the selected currency (PDF-safe symbol).
    String money(String? v) =>
        CurrencyCatalog.formatPdf(_amount(v), code: currency);
    // Phase 5D-5: PDF body copy localizes via the optional l10n param
    // (receipt_export precedent) — EN fallback when l10n is null.
    final generated = (generatedAt ?? DateTime.now()).toLocal();
    final doc = pw.Document();
    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(32),
        build: (context) => [
          pw.Center(
            child: pw.Text(l10n?.reportPdfTitle ?? 'StockFlow — Business Report',
                style: pw.TextStyle(font: _bold, fontSize: 18)),
          ),
          pw.SizedBox(height: 4),
          pw.Center(
            child: pw.Text(
              l10n?.reportPdfGeneratedAt(generated.toString()) ??
                  'Generated $generated',
              style: pw.TextStyle(font: _base, fontSize: 9),
            ),
          ),
          pw.SizedBox(height: 16),
          pw.Text(l10n?.reportPdfPerformanceSummary ?? 'Performance Summary',
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
                  _cell(l10n?.reportPdfToday ?? 'Today', bold: true),
                  _cell(l10n?.reportPdfYesterday ?? 'Yesterday', bold: true),
                  _cell(l10n?.reportPdfMonth ?? 'Month', bold: true),
                  _cell(l10n?.reportPdfGrossProfit ?? 'Gross Profit', bold: true),
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
                  _cell(l10n?.reportPdfInventoryValue ?? 'Inventory Value',
                      bold: true),
                  _cell(l10n?.reportPdfOrders ?? 'Orders', bold: true),
                  _cell(l10n?.reportPdfAvgOrder ?? 'Avg. Order', bold: true),
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
          pw.Text(l10n?.recentSales ?? 'Recent Sales',
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
                    _cell(
                        l10n?.reportPdfNoSalesInPeriod ??
                            'No sales in this period.'),
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
            child: pw.Text(
                l10n?.reportPdfFooter ??
                    'StockFlow ERP · Generated by the Reports module',
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
