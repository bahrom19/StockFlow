import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/payments/data/payment_pdf_export.dart';

void main() {
  const headers = [
    'Date',
    'Receipt',
    'Cashier',
    'Customer',
    'Warehouse',
    'Method',
    'Amount',
    'Status',
  ];

  List<List<String>> sampleRows() => [
        ['Aug 06, 2026 10:00', 'INV-0001', 'usr_abc', '', 'wh_1', 'CASH', '100.00', 'COMPLETED'],
        ['Aug 06, 2026 10:05', 'INV-0002', 'usr_abc', 'cus_9', 'wh_1', 'CARD', '250.00', 'COMPLETED'],
      ];

  group('PaymentPdfExport', () {
    test('build produces valid PDF bytes', () async {
      final bytes = await PaymentPdfExport.build(
        title: 'Payment Details',
        subtitle: 'Today · 2 transactions',
        headers: headers,
        rows: sampleRows(),
        compress: false,
      );

      expect(bytes, isNotEmpty);
      // PDF magic header.
      expect(ascii.decode(bytes.take(5).toList()), '%PDF-');
      // Uncompressed streams keep the row values directly inspectable.
      // (The document title lives in hex-encoded PDF metadata, so row data
      // is the reliable content check.)
      final text = latin1.decode(bytes);
      expect(text, contains('INV-0001'));
      expect(text, contains('250.00'));
    });

    test('build handles empty rows without error', () async {
      final bytes = await PaymentPdfExport.build(
        title: 'Payment Details',
        headers: headers,
        rows: const [],
        compress: false,
      );

      expect(bytes, isNotEmpty);
      expect(ascii.decode(bytes.take(5).toList()), '%PDF-');
    });

    test('build renders every row provided', () async {
      final rows = [
        for (var i = 0; i < 20; i++)
          ['Aug 06, 2026 10:00', 'INV-${i.toString().padLeft(4, '0')}', 'u', '', 'w', 'CASH', '$i.00', 'COMPLETED'],
      ];
      final bytes = await PaymentPdfExport.build(
        title: 'Payment Details',
        headers: headers,
        rows: rows,
        compress: false,
      );

      final text = latin1.decode(bytes);
      for (var i = 0; i < 20; i++) {
        expect(text, contains('INV-${i.toString().padLeft(4, '0')}'));
      }
    });
  });
}
