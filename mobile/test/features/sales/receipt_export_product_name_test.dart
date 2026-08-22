import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/sales/data/receipt_export.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

import '../../helpers/pdf_text.dart';

/// Regression tests for the receipt product-name mapping.
///
/// The backend `SaleItem` carries only `productId` (a UUID), never the
/// product name. `ReceiptExport` resolves names through the optional
/// [ReceiptExport.buildPdf]/[ReceiptExport.buildHtml] `productNames` map
/// that the POS captures from the cart. These tests pin the contract:
///
///   * when the mapping is passed, the receipt shows the REAL product name
///     ("Молоко 1 л") and never the raw productId ("12345");
///   * quantity / unit price / line total / TOTAL / payment method /
///     currency stay byte-for-byte unchanged by the mapping.
Sale _sale() {
  final now = DateTime.utc(2026, 8, 13, 12, 0);
  SaleItem item({
    required String id,
    required String productId,
    required int quantity,
    required String total,
  }) =>
      SaleItem(
        id: id,
        saleId: 's1',
        productId: productId,
        quantity: quantity,
        unitPrice: '50.00',
        costPrice: '30.00',
        discount: '0.00',
        subtotal: total,
        total: total,
        margin: '20.00',
        createdAt: now,
        updatedAt: now,
      );

  return Sale(
    id: 's1',
    companyId: 'c1',
    warehouseId: 'w1',
    cashierId: 'u1',
    saleNumber: 'S-0001',
    status: 'COMPLETED',
    subtotal: '150.00',
    discount: '0.00',
    tax: '0.00',
    total: '150.00',
    paidAmount: '200.00',
    changeAmount: '50.00',
    currency: 'KZT',
    createdAt: now,
    updatedAt: now,
    items: [
      // Numeric-looking productId — exactly the shape that used to leak
      // into the printed receipt as "digits" instead of the name.
      item(id: 'i1', productId: '12345', quantity: 2, total: '100.00'),
      item(id: 'i2', productId: 'p-fanta-uuid-9f2c', quantity: 1, total: '50.00'),
    ],
    payments: [
      Payment(
        id: 'pay1',
        saleId: 's1',
        method: 'CASH',
        amount: '200.00',
        createdAt: now,
        updatedAt: now,
      ),
    ],
  );
}

const Map<String, String> _names = {
  '12345': 'Молоко 1 л',
  'p-fanta-uuid-9f2c': 'Fanta 1.5 л',
};

void main() {
  // rootBundle asset loading (Roboto TTFs) needs the binding in tests.
  TestWidgetsFlutterBinding.ensureInitialized();

  group('receipt shows real product names, not productIds', () {
    test('HTML: renders mapped names for every line', () {
      final html = ReceiptExport.buildHtml(_sale(), productNames: _names);

      expect(html, contains('Молоко 1 л'));
      expect(html, contains('Fanta 1.5 л'));
      // The numeric productId must NOT appear anywhere in the receipt.
      expect(html, isNot(contains('12345')));
      expect(html, isNot(contains('p-fanta-uuid-9f2c')));
    });

    test('PDF: extracts mapped names from the rendered document', () async {
      final bytes =
          await ReceiptExport.buildPdf(_sale(), productNames: _names);
      final text = extractPdfText(bytes).replaceAll(RegExp(r'\s+'), ' ');

      expect(text, contains('Молоко 1 л'));
      expect(text, contains('Fanta 1.5 л'));
      expect(text, isNot(contains('12345')));
      expect(text, isNot(contains('p-fanta-uuid-9f2c')));
    });
  });

  group('mapping does not disturb the rest of the receipt', () {
    test('HTML keeps qty / totals / payment / currency intact', () {
      final withNames = ReceiptExport.buildHtml(_sale(), productNames: _names);
      final withoutNames = ReceiptExport.buildHtml(_sale());

      for (final html in [withNames, withoutNames]) {
        expect(html, contains('<td>2</td>')); // quantity
        expect(html, contains('>₸100.00</td>')); // line total
        expect(html, contains('>₸150.00</td>')); // TOTAL
        expect(html, contains('TOTAL')); // total label
        expect(html, contains('CASH')); // payment method
      }
      // Only the name cells differ between the two variants.
      String normalized(String s) => s
          .replaceAll('Молоко 1 л', '#')
          .replaceAll('Fanta 1.5 л', '#')
          .replaceAll('>12345<', '>#<')
          .replaceAll('>p-fanta-<', '>#<'); // _shortId(productId) = 8 chars
      expect(normalized(withNames), normalized(withoutNames));
    });

    test('PDF keeps TOTAL / CASH / amounts intact', () async {
      final bytes = await ReceiptExport.buildPdf(_sale(), productNames: _names);
      final text = extractPdfText(bytes);

      expect(text, contains('TOTAL'));
      expect(text, contains('CASH'));
      expect(text, contains('100.00'));
      expect(text, contains('150.00'));
      expect(text, contains('200.00'));
    });
  });

  group('legacy fallback contract (no mapping provided)', () {
    test('HTML falls back to the short productId when no map is passed', () {
      // Documents the pre-existing fallback so the behaviour stays explicit:
      // callers MUST pass productNames to get real names on paper.
      final html = ReceiptExport.buildHtml(_sale());
      expect(html, contains('>12345<'));
      expect(html.contains('Молоко 1 л'), isFalse);
    });
  });
}
