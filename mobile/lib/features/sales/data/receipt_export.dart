import 'dart:convert';
import 'dart:typed_data';

import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:qr_flutter/qr_flutter.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

/// Builds a printable receipt (PDF bytes + HTML) for a completed [Sale].
///
/// This is a client-side renderer: it uses exactly the data the backend
/// returns on `/sales/:id/complete` (items, payments, totals) and never
/// touches the backend API.
class ReceiptExport {
  ReceiptExport._();

  static double _amount(String? v) => double.tryParse(v ?? '') ?? 0;

  static final pw.Font _base = pw.Font.helvetica();
  static final pw.Font _bold = pw.Font.helveticaBold();

  static pw.TextStyle _style(double size, {bool bold = false}) =>
      pw.TextStyle(font: bold ? _bold : _base, fontSize: size);

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
  /// mapping). [cashierName], [warehouseName] and [storeName] decorate the
  /// header when provided.
  static Future<Uint8List> buildPdf(
    Sale sale, {
    Map<String, String>? productNames,
    String? cashierName,
    String? warehouseName,
    String? storeName,
    String? company,
    String? vatNumber,
  }) async {
    final doc = pw.Document();
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.roll80,
        margin: const pw.EdgeInsets.all(12),
        build: (context) => _buildBody(
          sale,
          productNames: productNames,
          cashierName: cashierName,
          warehouseName: warehouseName,
          storeName: storeName,
          company: company,
          vatNumber: vatNumber,
        ),
      ),
    );
    return doc.save();
  }

  static pw.Widget _buildBody(
    Sale sale, {
    Map<String, String>? productNames,
    String? cashierName,
    String? warehouseName,
    String? storeName,
    String? company,
    String? vatNumber,
  }) {
    final rows = <pw.TableRow>[
      pw.TableRow(
        children: [
          pw.Padding(
            padding: const pw.EdgeInsets.symmetric(vertical: 2),
            child: pw.Text('Item', style: _style(10, bold: true)),
          ),
          pw.Padding(
            padding: const pw.EdgeInsets.symmetric(vertical: 2),
            child: pw.Text('Qty', style: _style(10, bold: true)),
          ),
          pw.Padding(
            padding: const pw.EdgeInsets.symmetric(vertical: 2),
            child: pw.Text('Total', style: _style(10, bold: true)),
          ),
        ],
      ),
      for (final item in sale.items)
        pw.TableRow(
          children: [
            pw.Padding(
              padding: const pw.EdgeInsets.symmetric(vertical: 2),
              child: pw.Text(
                _itemName(item, productNames),
                style: _style(9),
              ),
            ),
            pw.Text('${item.quantity}', style: _style(9)),
            pw.Text(
              _amount(item.total).toStringAsFixed(2),
              style: _style(9),
            ),
          ],
        ),
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
          pw.Center(child: pw.Text('VAT $vatNumber', style: _style(8))),
        pw.Center(
          child: pw.Text(sale.saleNumber, style: _style(9)),
        ),
        pw.SizedBox(height: 4),
        pw.Divider(),
        pw.Text('Date: ${sale.createdAt.toLocal()}', style: _style(8)),
        if (cashierName?.isNotEmpty ?? false)
          pw.Text('Cashier: $cashierName', style: _style(8)),
        if (warehouseName?.isNotEmpty ?? false)
          pw.Text('Warehouse: $warehouseName', style: _style(8)),
        pw.Text('Status: ${sale.status}', style: _style(8)),
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
        _amountRow('Subtotal', _amount(sale.subtotal)),
        if (_amount(sale.discount) > 0)
          _amountRow('Discount', -_amount(sale.discount)),
        _amountRow('Tax', _amount(sale.tax)),
        _amountRow('TOTAL', _amount(sale.total), bold: true),
        pw.Divider(),
        _amountRow('Paid', _amount(sale.paidAmount)),
        if (_amount(sale.changeAmount) > 0)
          _amountRow('Change', _amount(sale.changeAmount)),
        pw.SizedBox(height: 6),
        pw.Divider(),
        pw.Text('Payments', style: _style(9, bold: true)),
        for (final p in sale.payments)
          _amountRow(p.method, _amount(p.amount)),
        pw.SizedBox(height: 8),
        pw.Center(
          child: pw.Text('Thank you for your purchase!', style: _style(8)),
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

  static pw.Widget _amountRow(String label, double amount, {bool bold = false}) {
    return pw.Padding(
      padding: const pw.EdgeInsets.symmetric(vertical: 1),
      child: pw.Row(
        mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
        children: [
          pw.Text(label, style: _style(9, bold: bold)),
          pw.Text(amount.toStringAsFixed(2), style: _style(9, bold: bold)),
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

  /// Print-friendly standalone HTML receipt (used by the web print dialog).
  static String buildHtml(
    Sale sale, {
    Map<String, String>? productNames,
    String? cashierName,
    String? warehouseName,
    String? storeName,
    String? company,
    String? vatNumber,
    String? qrPngDataUri,
  }) {
    final store = (storeName?.isNotEmpty ?? false)
        ? storeName!
        : 'StockFlow';
    final companyLine = (company?.isNotEmpty ?? false)
        ? '<div class="meta">${_esc(company!)}</div>'
        : '';
    final vatLine = (vatNumber?.isNotEmpty ?? false)
        ? '<div class="meta">VAT ${_esc(vatNumber!)}</div>'
        : '';
    final cashier = (cashierName?.isNotEmpty ?? false)
        ? '<br>Cashier: ${_esc(cashierName!)}'
        : '';
    final warehouse = (warehouseName?.isNotEmpty ?? false)
        ? '<br>Warehouse: ${_esc(warehouseName!)}'
        : '';
    final qrImg = (qrPngDataUri?.isNotEmpty ?? false)
        ? '<div style="text-align:center;margin-top:8px"><img src="$qrPngDataUri" width="88" height="88"><br>${_esc(sale.saleNumber)}</div>'
        : '';
    final items = sale.items
        .map((i) => '<tr>'
            '<td>${_esc(_itemName(i, productNames))}</td>'
            '<td>${i.quantity}</td>'
            '<td>\$${_amount(i.total).toStringAsFixed(2)}</td>'
            '</tr>')
        .join();
    final payments = sale.payments
        .map((p) => '<tr><td>${_esc(p.method)}</td>'
            '<td>\$${_amount(p.amount).toStringAsFixed(2)}</td></tr>')
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
  .total td { font-weight: bold; border-top: 1px dashed #000; }
</style></head>
<body>
  <h2>${_esc(store)}</h2>
  $companyLine$vatLine
  <div class="meta">${_esc(sale.saleNumber)}<br>${_esc(sale.createdAt.toLocal().toString())}$cashier$warehouse</div>
  <table>
    <tr><td>Item</td><td>Qty</td><td>Total</td></tr>
    $items
  </table>
  <table>
    <tr><td>Subtotal</td><td>\$${_amount(sale.subtotal).toStringAsFixed(2)}</td></tr>
    ${_amount(sale.discount) > 0 ? '<tr><td>Discount</td><td>-\$${_amount(sale.discount).toStringAsFixed(2)}</td></tr>' : ''}
    <tr><td>Tax</td><td>\$${_amount(sale.tax).toStringAsFixed(2)}</td></tr>
    <tr class="total"><td>TOTAL</td><td>\$${_amount(sale.total).toStringAsFixed(2)}</td></tr>
    <tr><td>Paid</td><td>\$${_amount(sale.paidAmount).toStringAsFixed(2)}</td></tr>
    ${_amount(sale.changeAmount) > 0 ? '<tr><td>Change</td><td>\$${_amount(sale.changeAmount).toStringAsFixed(2)}</td></tr>' : ''}
  </table>
  <h3>Payments</h3>
  <table>$payments</table>
  $qrImg
  <p style="text-align:center;margin-top:8px">Thank you for your purchase!</p>
</body></html>
''';
  }

  static String _esc(String s) => s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
}
