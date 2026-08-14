import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/sales/data/receipt_export.dart';
import 'package:stockflow/features/sales/domain/sales_models.dart';

Sale _sale({String currency = 'KZT'}) {
  final now = DateTime.utc(2026, 8, 13, 12, 0);
  return Sale(
    id: 's1',
    companyId: 'c1',
    warehouseId: 'w1',
    cashierId: 'u1',
    saleNumber: 'S-0001',
    status: 'COMPLETED',
    subtotal: '100.00',
    discount: '0.00',
    tax: '0.00',
    total: '100.00',
    paidAmount: '100.00',
    changeAmount: '0.00',
    currency: currency,
    createdAt: now,
    updatedAt: now,
    items: [
      SaleItem(
        id: 'i1',
        saleId: 's1',
        productId: 'p1',
        quantity: 2,
        unitPrice: '50.00',
        costPrice: '30.00',
        discount: '0.00',
        subtotal: '100.00',
        total: '100.00',
        margin: '40.00',
        createdAt: now,
        updatedAt: now,
      ),
    ],
    payments: [
      Payment(
        id: 'pay1',
        saleId: 's1',
        method: 'CASH',
        amount: '100.00',
        createdAt: now,
        updatedAt: now,
      ),
    ],
  );
}

void main() {
  group('ReceiptExport.buildHtml uses the selected currency', () {
    test('KZT renders ₸ (not \$)', () {
      final html = ReceiptExport.buildHtml(_sale(), currency: 'KZT');
      expect(html, contains('₸100.00'));
      expect(html, isNot(contains(r'$100.00')));
    });

    test('RUB renders ₽', () {
      final html = ReceiptExport.buildHtml(_sale(), currency: 'RUB');
      expect(html, contains('₽100.00'));
    });

    test('USD renders \$', () {
      final html = ReceiptExport.buildHtml(_sale(), currency: 'USD');
      expect(html, contains(r'$100.00'));
    });

    test('defaults to KZT when currency is omitted', () {
      final html = ReceiptExport.buildHtml(_sale());
      expect(html, contains('₸100.00'));
    });
  });

  group('ReceiptExport.buildPdf', () {
    test('builds without error for every supported currency', () async {
      for (final code in ['KZT', 'RUB', 'USD', 'EUR', 'CNY', 'AED', 'AUD', 'VND']) {
        final bytes = await ReceiptExport.buildPdf(_sale(), currency: code);
        expect(bytes.length, greaterThan(1000),
            reason: '$code PDF renders non-trivial output');
      }
    });
  });

  group('QR payload contract (unchanged)', () {
    test('keeps the sale currency code, not the display symbol', () {
      expect(ReceiptExport.qrPayload(_sale(currency: 'KZT')),
          contains('|100.00|KZT|'));
      expect(ReceiptExport.qrPayload(_sale(currency: 'RUB')),
          contains('|100.00|RUB|'));
    });
  });
}
