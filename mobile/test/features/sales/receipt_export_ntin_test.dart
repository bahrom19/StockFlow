import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/currency/money.dart';
import 'package:stockflow/features/sales/data/receipt_export.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

import '../../helpers/pdf_text.dart';

/// Regression tests for the receipt NTIN line.
///
/// Contract pinned here:
///   * when the POS passes `productNtins` (productId → NTIN), BOTH renderers
///     (`buildHtml` used by Web iframe printing AND `buildPdf` used by
///     Windows native printing / PDF download) print `NTIN: <value>` under
///     the item name;
///   * items without an NTIN (missing map entry, null or blank value) print
///     NO NTIN line at all;
///   * SKU / barcode / productId(UUID) never appear anywhere in the receipt,
///     while names, quantities, totals, TOTAL and CASH stay byte-for-byte
///     unchanged.
Sale _sale({List<SaleItem>? items}) {
  final now = DateTime.utc(2026, 8, 22, 10, 0);
  return Sale(
    id: 'sale-1',
    companyId: 'company-1',
    warehouseId: 'wh-1',
    cashierId: 'cashier-1',
    saleNumber: 'S-2026-0001',
    status: 'COMPLETED',
    subtotal: '700.00',
    discount: '0.00',
    tax: '0.00',
    total: '700.00',
    paidAmount: '1000.00',
    changeAmount: '300.00',
    currency: 'KZT',
    createdAt: now,
    updatedAt: now,
    items: items ??
        [
          SaleItem(
            // Realistic UUID-shaped productIds — must never reach the paper.
            id: 'item-1',
            saleId: 'sale-1',
            productId: '3f6c1e2a-91b7-4f0e-8a21-5c9d77e01b34',
            quantity: 2,
            unitPrice: '100.00',
            costPrice: '60.00',
            discount: '0.00',
            subtotal: '200.00',
            total: '200.00',
            margin: '80.00',
            createdAt: now,
            updatedAt: now,
          ),
          SaleItem(
            id: 'item-2',
            saleId: 'sale-1',
            productId: 'b81d4f60-22aa-49c3-9d10-7fe3a45c8de2',
            quantity: 1,
            unitPrice: '500.00',
            costPrice: '300.00',
            discount: '0.00',
            subtotal: '500.00',
            total: '500.00',
            margin: '200.00',
            createdAt: now,
            updatedAt: now,
          ),
        ],
    payments: [
      Payment(
        id: 'pay-1',
        saleId: 'sale-1',
        method: 'CASH',
        amount: '1000.00',
        createdAt: now,
        updatedAt: now,
      ),
    ],
  );
}

const _names = {
  '3f6c1e2a-91b7-4f0e-8a21-5c9d77e01b34': 'Молоко 1 л',
  'b81d4f60-22aa-49c3-9d10-7fe3a45c8de2': 'Fanta 1.5 л',
};

const _ntins = <String, String?>{
  '3f6c1e2a-91b7-4f0e-8a21-5c9d77e01b34': '123456789',
  'b81d4f60-22aa-49c3-9d10-7fe3a45c8de2': '987654321',
};

void main() {
  // rootBundle asset loading (Roboto TTFs) needs the binding in tests.
  TestWidgetsFlutterBinding.ensureInitialized();

  group('NTIN present → printed on every channel', () {
    test('HTML (web iframe print flow) shows NTIN under the item name', () {
      final html = ReceiptExport.buildHtml(
        _sale(),
        productNames: _names,
        productNtins: _ntins,
      );

      expect(html, contains('NTIN: 123456789'));
      expect(html, contains('NTIN: 987654321'));
    });

    test('PDF (Windows native printing / download) shows NTIN', () async {
      final bytes = await ReceiptExport.buildPdf(
        _sale(),
        productNames: _names,
        productNtins: _ntins,
      );
      final text = extractPdfText(bytes).replaceAll(RegExp(r'\s+'), ' ');

      expect(text, contains('NTIN: 123456789'));
      expect(text, contains('NTIN: 987654321'));
    });
  });

  group('NTIN absent → nothing is shown', () {
    test('HTML prints no NTIN line when the map is omitted', () {
      final html = ReceiptExport.buildHtml(_sale(), productNames: _names);
      expect(html.contains('NTIN'), isFalse);
    });

    test('HTML skips blank / null entries but keeps filled ones', () {
      final html = ReceiptExport.buildHtml(
        _sale(),
        productNames: _names,
        productNtins: const {
          '3f6c1e2a-91b7-4f0e-8a21-5c9d77e01b34': null,
          'b81d4f60-22aa-49c3-9d10-7fe3a45c8de2': '   ',
        },
      );
      expect(html.contains('NTIN'), isFalse);
    });

    test('PDF prints no NTIN when the map is omitted', () async {
      final bytes =
          await ReceiptExport.buildPdf(_sale(), productNames: _names);
      final text = extractPdfText(bytes);

      expect(text.contains('NTIN'), isFalse);
    });

    test('PDF skips blank / null entries', () async {
      final bytes = await ReceiptExport.buildPdf(
        _sale(),
        productNames: _names,
        productNtins: const {
          '3f6c1e2a-91b7-4f0e-8a21-5c9d77e01b34': null,
          'b81d4f60-22aa-49c3-9d10-7fe3a45c8de2': '',
        },
      );
      final text = extractPdfText(bytes);

      expect(text.contains('NTIN'), isFalse);
    });
  });
  group('SKU / barcode / productId never leak into the receipt', () {
    // Values that exist on Product / CartItem but must stay off the paper.
    const sku = 'SKU-MILK-001';
    const barcode = '4870001122334';

    test('HTML contains no SKU / barcode / UUID', () {
      final html = ReceiptExport.buildHtml(
        _sale(),
        productNames: _names,
        productNtins: _ntins,
      );

      expect(html.contains(sku), isFalse);
      expect(html.contains(barcode), isFalse);
      expect(html.toLowerCase().contains('sku'), isFalse);
      expect(html.toLowerCase().contains('barcode'), isFalse);
      // Full UUIDs must not be printed either.
      for (final id in _names.keys) {
        expect(html.contains(id), isFalse);
      }
    });

    test('PDF contains no SKU / barcode / UUID', () async {
      final bytes = await ReceiptExport.buildPdf(
        _sale(),
        productNames: _names,
        productNtins: _ntins,
      );
      final text = extractPdfText(bytes);

      expect(text.contains(sku), isFalse);
      expect(text.contains(barcode), isFalse);
      expect(text.toLowerCase().contains('sku'), isFalse);
      expect(text.toLowerCase().contains('barcode'), isFalse);
      for (final id in _names.keys) {
        expect(text.contains(id), isFalse);
      }
    });

    test('CartItems carrying SKU/barcode still produce a clean receipt',
        () async {
      // The cart snapshot DOES hold sku/barcode/ntin — the receipt builder
      // simply never receives the identifying ones.
      final cartItem = CartItem(
        productId: '3f6c1e2a-91b7-4f0e-8a21-5c9d77e01b34',
        productName: 'Молоко 1 л',
        productSku: sku,
        barcode: barcode,
        ntin: '123456789',
        quantity: 2,
        unitPrice: Money.fromJson('100.00', 'KZT')!,
        costPrice: Money.fromJson('60.00', 'KZT')!,
      );
      expect(cartItem.productSku, sku);
      expect(cartItem.barcode, barcode);
      expect(cartItem.ntin, '123456789');

      final html = ReceiptExport.buildHtml(
        _sale(items: [_sale().items.first]),
        productNames: _names,
        productNtins: {'3f6c1e2a-91b7-4f0e-8a21-5c9d77e01b34': cartItem.ntin},
      );
      expect(html, contains('Молоко 1 л'));
      expect(html, contains('NTIN: 123456789'));
      expect(html.contains(sku), isFalse);
      expect(html.contains(barcode), isFalse);
    });
  });

  group('NTIN mapping does not disturb the rest of the receipt', () {
    test('HTML keeps names / qty / totals / payment intact', () {
      final withNtins = ReceiptExport.buildHtml(
        _sale(),
        productNames: _names,
        productNtins: _ntins,
      );
      final withoutNtins =
          ReceiptExport.buildHtml(_sale(), productNames: _names);

      for (final html in [withNtins, withoutNtins]) {
        expect(html, contains('Молоко 1 л'));
        expect(html, contains('Fanta 1.5 л'));
        expect(html, contains('<td>2</td>')); // quantity
        expect(html, contains('>₸200.00</td>')); // line total
        expect(html, contains('>₸700.00</td>')); // TOTAL
        expect(html, contains('TOTAL'));
        expect(html, contains('CASH')); // payment method
        expect(html, contains('>₸1,000.00</td>')); // paid
        expect(html, contains('-₸300.00</td>')); // change
      }

      // With the NTIN lines removed, both variants must be identical.
      String normalized(String s) =>
          s.replaceAll(RegExp(r'<div class="ntin">[^<]*</div>'), '');
      expect(normalized(withNtins), normalized(withoutNtins));
    });

    test('PDF keeps TOTAL / CASH amounts intact', () async {
      final bytes = await ReceiptExport.buildPdf(
        _sale(),
        productNames: _names,
        productNtins: _ntins,
      );
      final text = extractPdfText(bytes);

      expect(text, contains('Молоко 1 л'));
      expect(text, contains('Fanta 1.5 л'));
      expect(text, contains('TOTAL'));
      expect(text, contains('CASH'));
      expect(text, contains('700.00'));
      expect(text, contains('1,000.00'));
      expect(text, contains('300.00'));
    });
  });

  group('CartItem carries NTIN through persistence (held sales)', () {
    test('toJson/fromJson round-trips the NTIN', () {
      final item = CartItem(
        productId: 'p1',
        productName: 'Молоко 1 л',
        productSku: 'SKU-1',
        barcode: '4870001122334',
        ntin: '123456789',
        quantity: 2,
        unitPrice: Money.fromJson('100.00', 'KZT')!,
        costPrice: Money.fromJson('60.00', 'KZT')!,
      );

      final restored = CartItem.fromJson(item.toJson());
      expect(restored.ntin, '123456789');
      expect(restored.productName, 'Молоко 1 л');
      expect(restored.quantity, 2);
    });

    test('legacy persisted carts without the ntin key still parse', () {
      final json = <String, dynamic>{
        'productId': 'p1',
        'productName': 'Молоко 1 л',
        'productSku': 'SKU-1',
        'barcode': null,
        'quantity': 1,
        'unitPrice': '100.00',
        'costPrice': '60.00',
        'discount': '0.00',
        'currency': 'KZT',
      };

      final item = CartItem.fromJson(json);
      expect(item.ntin, isNull);
    });
  });
}
