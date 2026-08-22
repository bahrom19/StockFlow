import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:qr_flutter/qr_flutter.dart';
import 'package:stockflow/core/currency/currency_catalog.dart';
import 'package:stockflow/core/utils/pdf_fonts.dart';
import 'package:stockflow/core/widgets/status_badge.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

/// Builds a printable receipt (PDF bytes + HTML) for a completed [Sale].
///
/// This is a client-side renderer: it uses exactly the data the backend
/// returns on `/sales/:id/complete` (items, payments, totals) and never
/// touches the backend API.
class ReceiptExport {
  ReceiptExport._();

  static double _amount(String? v) => double.tryParse(v ?? '') ?? 0;

  static pw.TextStyle _style(double size, {bool bold = false}) =>
      pw.TextStyle(font: bold ? PdfFonts.bold : PdfFonts.regular, fontSize: size);

  /// Machine-readable QR payload for the receipt.
  static String qrPayload(Sale sale) =>
      'StockFlow|${sale.saleNumber}|${sale.total}|${sale.currency}|'
      '${sale.createdAt.toIso8601String()}|${sale.status}';

  /// Renders the QR payload to a PNG byte array (used by the print dialog
  /// and the HTML data-URI). Returns null when rendering fails (native).
  static Future<Uint8List?> qrPngBytes(String payload, {double size = 160}) async {
    try {
      final painter = QrPainter(
        data: payload,
        version: QrVersions.auto,
        gapless: true,
        errorCorrectionLevel: QrErrorCorrectLevel.M,
      );
      final imageData = await painter.toImageData(size);
      if (imageData == null) return null;
      return imageData.buffer.asUint8List();
    } catch (_) {
      return null;
    }
  }

  static Future<String?> qrPngBase64(String payload, {double size = 160}) async {
    final bytes = await qrPngBytes(payload, size: size);
    if (bytes == null) return null;
    return base64Encode(bytes);
  }

  /// 80 mm thermal-receipt style PDF.
  ///
  /// [productNames] maps a productId to its display name (the backend's
  /// SaleItem does not include the product name, so the POS passes the cart
  /// mapping). [productNtins] maps a productId to its NTIN and follows the
  /// same cart-captured pattern; an item without an NTIN prints no NTIN line.
  /// SKU / barcode / productId are never printed. [cashierName],
  /// [warehouseName] and [storeName] decorate the header when provided.
  static Future<Uint8List> buildPdf(
    Sale sale, {
    Map<String, String>? productNames,
    Map<String, String?>? productNtins,
    String? cashierName,
    String? warehouseName,
    String? storeName,
    String? company,
    String? vatNumber,
    AppLocalizations? l10n,
    String currency = 'KZT',
  }) async {
    // Phase 5D-6: Roboto TTFs (Unicode: Latin+Cyrillic+Kazakh) are the
    // primary PDF fonts so RU/KK receipt copy actually renders.
    await PdfFonts.ensureLoaded();
    final doc = pw.Document();
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.roll80,
        margin: const pw.EdgeInsets.all(12),
        build: (context) => _buildBody(
          sale,
          productNames: productNames,
          productNtins: productNtins,
          cashierName: cashierName,
          warehouseName: warehouseName,
          storeName: storeName,
          company: company,
          vatNumber: vatNumber,
          l10n: l10n,
          currency: currency,
        ),
      ),
    );
    return doc.save();
  }

  static pw.Widget _buildBody(
    Sale sale, {
    Map<String, String>? productNames,
    Map<String, String?>? productNtins,
    String? cashierName,
    String? warehouseName,
    String? storeName,
    String? company,
    String? vatNumber,
    AppLocalizations? l10n,
    String currency = 'KZT',
  }) {
    final rows = <pw.TableRow>[
      pw.TableRow(
        children: [
          pw.Padding(
            padding: const pw.EdgeInsets.symmetric(vertical: 2),
            child: pw.Text(
              l10n?.posPdfItem ?? 'Item',
              style: _style(10, bold: true),
            ),
          ),
          pw.Padding(
            padding: const pw.EdgeInsets.symmetric(vertical: 2),
            child: pw.Text(
              l10n?.posPdfQty ?? 'Qty',
              style: _style(10, bold: true),
            ),
          ),
          pw.Padding(
            padding: const pw.EdgeInsets.symmetric(vertical: 2),
            child: pw.Text(
              l10n?.posTotal ?? 'Total',
              style: _style(10, bold: true),
            ),
          ),
        ],
      ),
      for (final item in sale.items)
        _pdfItemRow(item, productNames, productNtins, currency),
    ];

    final store = (storeName?.isNotEmpty ?? false)
        ? storeName!
        : 'StockFlow';

    return pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.start,
      children: [
        pw.Center(child: pw.Text(store, style: _style(14, bold: true))),
        if (company?.isNotEmpty ?? false)
          pw.Center(child: pw.Text(company!, style: _style(9))),
        if (vatNumber?.isNotEmpty ?? false)
          pw.Center(
            child: pw.Text(
              l10n?.posPdfVat(vatNumber!) ?? 'VAT $vatNumber',
              style: _style(8),
            ),
          ),
        pw.Center(
          child: pw.Text(sale.saleNumber, style: _style(9)),
        ),
        pw.SizedBox(height: 4),
        pw.Divider(),
        pw.Text(
          l10n?.posPdfDate(sale.createdAt.toLocal().toString()) ??
              'Date: ${sale.createdAt.toLocal()}',
          style: _style(8),
        ),
        if (cashierName?.isNotEmpty ?? false)
          pw.Text(
            l10n?.posCashier(cashierName!) ?? 'Cashier: $cashierName',
            style: _style(8),
          ),
        if (warehouseName?.isNotEmpty ?? false)
          pw.Text(
            l10n?.posWarehouseLine(warehouseName!) ??
                'Warehouse: $warehouseName',
            style: _style(8),
          ),
        pw.Text(
          l10n == null
              ? 'Status: ${sale.status}'
              : l10n.posStatus(StatusBadge.statusLabel(sale.status, l10n)),
          style: _style(8),
        ),
        pw.SizedBox(height: 4),
        pw.Divider(),
        pw.Table(
          border: pw.TableBorder(bottom: pw.BorderSide(width: .4)),
          columnWidths: const {
            0: pw.FlexColumnWidth(3),
            1: pw.FlexColumnWidth(1),
            2: pw.FlexColumnWidth(1),
          },
          children: rows,
        ),
        pw.SizedBox(height: 4),
        pw.Divider(),
        _amountRow(l10n?.posSubtotal ?? 'Subtotal', _amount(sale.subtotal),
            currency: currency),
        if (_amount(sale.discount) > 0)
          _amountRow(l10n?.posDiscount ?? 'Discount', -_amount(sale.discount),
              currency: currency),
        _amountRow(l10n?.posTax ?? 'Tax', _amount(sale.tax),
            currency: currency),
        _amountRow(l10n?.posPdfTotalLabel ?? 'TOTAL', _amount(sale.total),
            bold: true, currency: currency),
        pw.Divider(),
        _amountRow(l10n?.posPaid ?? 'Paid', _amount(sale.paidAmount),
            currency: currency),
        if (_amount(sale.changeAmount) > 0)
          _amountRow(l10n?.posChange ?? 'Change', _amount(sale.changeAmount),
              currency: currency),
        pw.SizedBox(height: 6),
        pw.Divider(),
        pw.Text(l10n?.posPayments ?? 'Payments', style: _style(9, bold: true)),
        for (final p in sale.payments)
          _amountRow(_paymentLabel(p.method, l10n), _amount(p.amount),
              currency: currency),
        pw.SizedBox(height: 8),
        pw.Center(
          child: pw.Text(
            l10n?.posThankYou ?? 'Thank you for your purchase!',
            style: _style(8),
          ),
        ),
        pw.SizedBox(height: 10),
        pw.Center(
          child: pw.BarcodeWidget(
            barcode: pw.Barcode.qrCode(),
            data: qrPayload(sale),
            width: 88,
            height: 88,
          ),
        ),
        pw.Center(
          child: pw.Text(sale.saleNumber, style: _style(7)),
        ),
      ],
    );
  }

  static pw.Widget _amountRow(
    String label,
    double amount, {
    bool bold = false,
    String currency = 'KZT',
  }) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 1),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label, style: _style(9, bold: bold)),
          pw.Text(
            CurrencyCatalog.formatPdf(amount, code: currency),
            style: _style(9, bold: bold),
          ),
        ],
      ),
    );
  }

  static String _shortId(String id) =>
      id.length <= 8 ? id : id.substring(0, 8);

  static String _itemName(SaleItem item, Map<String, String>? productNames) {
    final name = productNames?[item.productId];
    if (name != null && name.isNotEmpty) return name;
    return _shortId(item.productId);
  }

  /// NTIN of a sale item, resolved through the cart-captured [productNtins]
  /// map. Returns null when the map has no usable entry for the item —
  /// missing / blank NTINs print nothing at all. SKU, barcode and productId
  /// are deliberately never surfaced here.
  static String? _ntinOf(SaleItem item, Map<String, String?>? productNtins) {
    final ntin = productNtins?[item.productId]?.trim();
    return (ntin == null || ntin.isEmpty) ? null : ntin;
  }

  /// One receipt table row: name (plus optional small NTIN line under it),
  /// quantity and line total.
  static pw.TableRow _pdfItemRow(
    SaleItem item,
    Map<String, String>? productNames,
    Map<String, String?>? productNtins,
    String currency,
  ) {
    final ntin = _ntinOf(item, productNtins);
    return pw.TableRow(
      children: [
        pw.Padding(
          padding: const pw.EdgeInsets.symmetric(vertical: 2),
          child: pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(_itemName(item, productNames), style: _style(9)),
              if (ntin != null)
                pw.Text('NTIN: $ntin', style: _style(7)),
            ],
          ),
        ),
        pw.Text('${item.quantity}', style: _style(9)),
        pw.Text(
          CurrencyCatalog.formatPdf(_amount(item.total), code: currency),
          style: _style(9),
        ),
      ],
    );
  }

  /// Payment method display label — EN keeps the backend value byte-for-byte.
  static String _paymentLabel(String method, AppLocalizations? l10n) {
    if (l10n == null) return method;
    switch (method) {
      case 'CASH':
        return l10n.posPaymentCash;
      case 'CARD':
        return l10n.posPaymentCard;
      case 'QR':
        return l10n.posPaymentQr;
      default:
        return method;
    }
  }

  /// Print-friendly standalone HTML receipt (used by the web print dialog).
  static String buildHtml(
    Sale sale, {
    Map<String, String>? productNames,
    Map<String, String?>? productNtins,
    String? cashierName,
    String? warehouseName,
    String? storeName,
    String? company,
    String? vatNumber,
    String? qrPngDataUri,
    AppLocalizations? l10n,
    String currency = 'KZT',
  }) {
    final store = (storeName?.isNotEmpty ?? false)
        ? storeName!
        : 'StockFlow';
    final companyLine = (company?.isNotEmpty ?? false)
        ? '<div class="meta">${_esc(company!)}</div>'
        : '';
    final vatLine = (vatNumber?.isNotEmpty ?? false)
        ? '<div class="meta">${_esc(l10n?.posPdfVat(vatNumber!) ?? 'VAT $vatNumber')}</div>'
        : '';
    final cashier = (cashierName?.isNotEmpty ?? false)
        ? '<br>${_esc(l10n?.posCashier(cashierName!) ?? 'Cashier: $cashierName')}'
        : '';
    final warehouse = (warehouseName?.isNotEmpty ?? false)
        ? '<br>${_esc(l10n?.posWarehouseLine(warehouseName!) ?? 'Warehouse: $warehouseName')}'
        : '';
    final qrImg = (qrPngDataUri?.isNotEmpty ?? false)
        ? '<div style="text-align:center;margin-top:8px"><img src="$qrPngDataUri" width="88" height="88"><br>${_esc(sale.saleNumber)}</div>'
        : '';
    String fmt(num v) => CurrencyCatalog.format(v, code: currency);
    final items = sale.items.map((i) {
      final ntin = _ntinOf(i, productNtins);
      return '<tr>'
          '<td>${_esc(_itemName(i, productNames))}'
          '${ntin != null ? '<div class="ntin">NTIN: ${_esc(ntin)}</div>' : ''}</td>'
          '<td>${i.quantity}</td>'
          '<td>${_esc(fmt(_amount(i.total)))}</td>'
          '</tr>';
    }).join();
    final payments = sale.payments
        .map((p) => '<tr><td>${_esc(_paymentLabel(p.method, l10n))}</td>'
            '<td>${_esc(fmt(_amount(p.amount)))}</td></tr>')
        .join();

    return '''
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${_esc(sale.saleNumber)}</title>
<style>
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 58mm; margin: 0 auto; }
  h2 { margin: 0 0 2px; text-align: center; }
  .meta { text-align: center; font-size: 10px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; }
  .ntin { font-size: 10px; }
  .total td { font-weight: bold; border-top: 1px dashed #000; }
</style></head>
<body>
  <h2>${_esc(store)}</h2>
  $companyLine$vatLine
  <div class="meta">${_esc(sale.saleNumber)}<br>${_esc(sale.createdAt.toLocal().toString())}$cashier$warehouse</div>
  <table>
    <tr><td>${_esc(l10n?.posPdfItem ?? 'Item')}</td><td>${_esc(l10n?.posPdfQty ?? 'Qty')}</td><td>${_esc(l10n?.posTotal ?? 'Total')}</td></tr>
    $items
  </table>
  <table>
    <tr><td>${_esc(l10n?.posSubtotal ?? 'Subtotal')}</td><td>${_esc(fmt(_amount(sale.subtotal)))}</td></tr>
    ${_amount(sale.discount) > 0 ? '<tr><td>${_esc(l10n?.posDiscount ?? 'Discount')}</td><td>-${_esc(fmt(_amount(sale.discount)))}</td></tr>' : ''}
    <tr><td>${_esc(l10n?.posTax ?? 'Tax')}</td><td>${_esc(fmt(_amount(sale.tax)))}</td></tr>
    <tr class="total"><td>${_esc(l10n?.posPdfTotalLabel ?? 'TOTAL')}</td><td>${_esc(fmt(_amount(sale.total)))}</td></tr>
    <tr><td>${_esc(l10n?.posPaid ?? 'Paid')}</td><td>${_esc(fmt(_amount(sale.paidAmount)))}</td></tr>
    ${_amount(sale.changeAmount) > 0 ? '<tr><td>${_esc(l10n?.posChange ?? 'Change')}</td><td>-${_esc(fmt(_amount(sale.changeAmount)))}</td></tr>' : ''}
  </table>
  <h3>${_esc(l10n?.posPayments ?? 'Payments')}</h3>
  <table>$payments</table>
  $qrImg
  <p style="text-align:center;margin-top:8px">${_esc(l10n?.posThankYou ?? 'Thank you for your purchase!')}</p>
</body></html>
''';
  }

  static String _esc(String s) => s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
}
