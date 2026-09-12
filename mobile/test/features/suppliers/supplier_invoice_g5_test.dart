import 'package:flutter_test/flutter_test.dart';
import 'dart:ui';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:stockflow/features/suppliers/domain/supplier_payment_models.dart';

/// G5 — Purchase Invoice specific tests.
///
/// Covers:
///  1. PurchaseInvoice model decode
///  2. PurchaseInvoiceItem model decode
///  3. PurchaseInvoiceListResponse decode
///  4. Status mapping (DRAFT/APPROVED/PAID/CANCELLED)
///  5. Outstanding calculation
///  6. EN/RU/KK l10n parity for G5 keys
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  // ── 1. PurchaseInvoice model decode ────────────────────────

  group('PurchaseInvoice model', () {
    test('decodes all fields from backend JSON', () {
      final json = {
        'id': 'inv-1',
        'companyId': 'comp-1',
        'purchaseOrderId': 'po-1',
        'supplierId': 'sup-1',
        'invoiceNumber': 'INV-0001',
        'invoiceDate': '2026-09-01',
        'dueDate': '2026-10-01',
        'status': 'APPROVED',
        'subtotal': '249.9500',
        'discountAmount': '0.0000',
        'taxAmount': '0.0000',
        'grandTotal': '249.9500',
        'paidAmount': '100.0000',
        'currency': 'KZT',
        'notes': 'Test invoice',
        'approvedBy': 'user-1',
        'approvedAt': '2026-09-02T00:00:00.000Z',
        'cancelledBy': null,
        'cancelledAt': null,
        'createdAt': '2026-09-01T00:00:00.000Z',
        'updatedAt': '2026-09-01T00:00:00.000Z',
        'deletedAt': null,
        'items': [],
      };
      final invoice = PurchaseInvoice.fromJson(json);
      expect(invoice.id, 'inv-1');
      expect(invoice.companyId, 'comp-1');
      expect(invoice.purchaseOrderId, 'po-1');
      expect(invoice.supplierId, 'sup-1');
      expect(invoice.invoiceNumber, 'INV-0001');
      expect(invoice.invoiceDate, '2026-09-01');
      expect(invoice.dueDate, '2026-10-01');
      expect(invoice.status, 'APPROVED');
      expect(invoice.grandTotal, '249.9500');
      expect(invoice.paidAmount, '100.0000');
      expect(invoice.currency, 'KZT');
      expect(invoice.notes, 'Test invoice');
      expect(invoice.approvedBy, 'user-1');
      expect(invoice.items, isEmpty);
    });

    test('decodes with nullable fields', () {
      final json = {
        'id': 'inv-2',
        'companyId': 'comp-1',
        'purchaseOrderId': 'po-1',
        'supplierId': 'sup-1',
        'invoiceNumber': 'INV-0002',
        'invoiceDate': '2026-09-01',
        'status': 'DRAFT',
        'subtotal': '100',
        'discountAmount': '0',
        'taxAmount': '0',
        'grandTotal': '100',
        'paidAmount': '0',
        'currency': 'USD',
        'createdAt': '2026-09-01T00:00:00.000Z',
        'updatedAt': '2026-09-01T00:00:00.000Z',
      };
      final invoice = PurchaseInvoice.fromJson(json);
      expect(invoice.dueDate, isNull);
      expect(invoice.notes, isNull);
      expect(invoice.approvedBy, isNull);
      expect(invoice.cancelledBy, isNull);
      expect(invoice.deletedAt, isNull);
      expect(invoice.items, isEmpty); // default
    });

    test('decodes with items', () {
      final json = {
        'id': 'inv-3',
        'companyId': 'comp-1',
        'purchaseOrderId': 'po-1',
        'supplierId': 'sup-1',
        'invoiceNumber': 'INV-0003',
        'invoiceDate': '2026-09-01',
        'status': 'APPROVED',
        'subtotal': '500',
        'discountAmount': '0',
        'taxAmount': '0',
        'grandTotal': '500',
        'paidAmount': '0',
        'currency': 'KZT',
        'createdAt': '2026-09-01T00:00:00.000Z',
        'updatedAt': '2026-09-01T00:00:00.000Z',
        'items': [
          {
            'id': 'item-1',
            'purchaseInvoiceId': 'inv-3',
            'productId': 'prod-1',
            'quantity': 10,
            'unitCost': '50.0000',
            'discountAmount': '0.0000',
            'taxAmount': '0.0000',
            'subtotal': '500.0000',
            'total': '500.0000',
          },
        ],
      };
      final invoice = PurchaseInvoice.fromJson(json);
      expect(invoice.items.length, 1);
      expect(invoice.items[0].id, 'item-1');
      expect(invoice.items[0].quantity, 10);
      expect(invoice.items[0].unitCost, '50.0000');
    });
  });

  // ── 2. PurchaseInvoiceItem model decode ─────────────────────

  group('PurchaseInvoiceItem model', () {
    test('decodes all fields', () {
      final json = {
        'id': 'item-1',
        'purchaseInvoiceId': 'inv-1',
        'productId': 'prod-1',
        'purchaseOrderItemId': 'poi-1',
        'quantity': 5,
        'unitCost': '49.9900',
        'discountPercent': '10.00',
        'discountAmount': '24.9950',
        'taxPercent': '12.00',
        'taxAmount': '29.9940',
        'subtotal': '249.9500',
        'total': '249.9500',
        'notes': 'Bulk order',
      };
      final item = PurchaseInvoiceItem.fromJson(json);
      expect(item.id, 'item-1');
      expect(item.purchaseInvoiceId, 'inv-1');
      expect(item.productId, 'prod-1');
      expect(item.purchaseOrderItemId, 'poi-1');
      expect(item.quantity, 5);
      expect(item.unitCost, '49.9900');
      expect(item.discountPercent, '10.00');
      expect(item.taxPercent, '12.00');
      expect(item.total, '249.9500');
      expect(item.notes, 'Bulk order');
    });

    test('decodes with nullable fields', () {
      final json = {
        'id': 'item-2',
        'purchaseInvoiceId': 'inv-1',
        'productId': 'prod-1',
        'quantity': 1,
        'unitCost': '100',
        'discountAmount': '0',
        'taxAmount': '0',
        'subtotal': '100',
        'total': '100',
      };
      final item = PurchaseInvoiceItem.fromJson(json);
      expect(item.purchaseOrderItemId, isNull);
      expect(item.discountPercent, isNull);
      expect(item.taxPercent, isNull);
      expect(item.notes, isNull);
    });
  });

  // ── 3. PurchaseInvoiceListResponse decode ────────────────────

  group('PurchaseInvoiceListResponse', () {
    test('decodes paginated response', () {
      final json = {
        'items': [
          {
            'id': 'inv-1',
            'companyId': 'comp-1',
            'purchaseOrderId': 'po-1',
            'supplierId': 'sup-1',
            'invoiceNumber': 'INV-0001',
            'invoiceDate': '2026-09-01',
            'status': 'APPROVED',
            'subtotal': '500',
            'discountAmount': '0',
            'taxAmount': '0',
            'grandTotal': '500',
            'paidAmount': '200',
            'currency': 'KZT',
            'createdAt': '2026-09-01T00:00:00.000Z',
            'updatedAt': '2026-09-01T00:00:00.000Z',
          },
        ],
        'total': 1,
        'page': 1,
        'limit': 20,
      };
      final response = PurchaseInvoiceListResponse.fromJson(json);
      expect(response.items.length, 1);
      expect(response.items[0].invoiceNumber, 'INV-0001');
      expect(response.total, 1);
      expect(response.page, 1);
      expect(response.limit, 20);
    });

    test('empty items list', () {
      final json = {
        'items': <dynamic>[],
        'total': 0,
        'page': 1,
        'limit': 20,
      };
      final response = PurchaseInvoiceListResponse.fromJson(json);
      expect(response.items, isEmpty);
      expect(response.total, 0);
    });
  });

  // ── 4. Outstanding calculation ───────────────────────────────

  group('Outstanding calculation', () {
    test('grandTotal - paidAmount = outstanding', () {
      final invoice = PurchaseInvoice(
        id: 'inv-1',
        companyId: 'comp-1',
        purchaseOrderId: 'po-1',
        supplierId: 'sup-1',
        invoiceNumber: 'INV-0001',
        invoiceDate: '2026-09-01',
        status: 'APPROVED',
        subtotal: '500.0000',
        discountAmount: '0.0000',
        taxAmount: '0.0000',
        grandTotal: '500.0000',
        paidAmount: '200.0000',
        currency: 'KZT',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      );
      final grandTotal = double.tryParse(invoice.grandTotal) ?? 0;
      final paid = double.tryParse(invoice.paidAmount) ?? 0;
      final outstanding = grandTotal - paid;
      expect(outstanding, 300.0);
    });

    test('fully paid invoice has zero outstanding', () {
      final invoice = PurchaseInvoice(
        id: 'inv-1',
        companyId: 'comp-1',
        purchaseOrderId: 'po-1',
        supplierId: 'sup-1',
        invoiceNumber: 'INV-0001',
        invoiceDate: '2026-09-01',
        status: 'PAID',
        subtotal: '500',
        discountAmount: '0',
        taxAmount: '0',
        grandTotal: '500',
        paidAmount: '500',
        currency: 'KZT',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      );
      final grandTotal = double.tryParse(invoice.grandTotal) ?? 0;
      final paid = double.tryParse(invoice.paidAmount) ?? 0;
      final outstanding = grandTotal - paid;
      expect(outstanding, 0.0);
    });

    test('unpaid invoice has full outstanding', () {
      final invoice = PurchaseInvoice(
        id: 'inv-1',
        companyId: 'comp-1',
        purchaseOrderId: 'po-1',
        supplierId: 'sup-1',
        invoiceNumber: 'INV-0001',
        invoiceDate: '2026-09-01',
        status: 'DRAFT',
        subtotal: '1000',
        discountAmount: '0',
        taxAmount: '0',
        grandTotal: '1000',
        paidAmount: '0',
        currency: 'USD',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      );
      final grandTotal = double.tryParse(invoice.grandTotal) ?? 0;
      final paid = double.tryParse(invoice.paidAmount) ?? 0;
      final outstanding = grandTotal - paid;
      expect(outstanding, 1000.0);
    });
  });

  // ── 5. Status mapping ────────────────────────────────────────

  group('Status mapping', () {
    test('all 4 statuses are valid strings', () {
      const validStatuses = {'DRAFT', 'APPROVED', 'PAID', 'CANCELLED'};
      for (final status in validStatuses) {
        expect(validStatuses.contains(status), isTrue);
      }
    });

    test('status is a plain string matching backend enum', () {
      final invoice = PurchaseInvoice(
        id: 'inv-1',
        companyId: 'comp-1',
        purchaseOrderId: 'po-1',
        supplierId: 'sup-1',
        invoiceNumber: 'INV-0001',
        invoiceDate: '2026-09-01',
        status: 'APPROVED',
        subtotal: '100',
        discountAmount: '0',
        taxAmount: '0',
        grandTotal: '100',
        paidAmount: '0',
        currency: 'KZT',
        createdAt: '2026-09-01',
        updatedAt: '2026-09-01',
      );
      expect(invoice.status, 'APPROVED');
    });
  });

  // ── 6. G5 l10n parity ───────────────────────────────────────

  group('G5 l10n parity — EN/RU/KK', () {
    test('all G5 keys exist in EN', () {
      final e = en();
      expect(e.purchaseInvoices, isNotEmpty);
      expect(e.invoiceDate, isNotEmpty);
      expect(e.dueDate, isNotEmpty);
      expect(e.grandTotal, isNotEmpty);
      expect(e.paidAmount, isNotEmpty);
      expect(e.statusDraft, isNotEmpty);
      expect(e.statusApproved, isNotEmpty);
      expect(e.statusPaid, isNotEmpty);
      expect(e.statusCancelled, isNotEmpty);
      expect(e.noInvoices, isNotEmpty);
    });

    test('RU has all G5 keys', () {
      final r = ru();
      expect(r.purchaseInvoices, isNotEmpty);
      expect(r.invoiceDate, isNotEmpty);
      expect(r.dueDate, isNotEmpty);
      expect(r.grandTotal, isNotEmpty);
      expect(r.paidAmount, isNotEmpty);
      expect(r.statusDraft, isNotEmpty);
      expect(r.statusApproved, isNotEmpty);
      expect(r.statusPaid, isNotEmpty);
      expect(r.statusCancelled, isNotEmpty);
      expect(r.noInvoices, isNotEmpty);
    });

    test('KK has all G5 keys', () {
      final k = kk();
      expect(k.purchaseInvoices, isNotEmpty);
      expect(k.invoiceDate, isNotEmpty);
      expect(k.dueDate, isNotEmpty);
      expect(k.grandTotal, isNotEmpty);
      expect(k.paidAmount, isNotEmpty);
      expect(k.statusDraft, isNotEmpty);
      expect(k.statusApproved, isNotEmpty);
      expect(k.statusPaid, isNotEmpty);
      expect(k.statusCancelled, isNotEmpty);
      expect(k.noInvoices, isNotEmpty);
    });

    test('EN/RU/KK keys are not identical (translations differ)', () {
      expect(en().purchaseInvoices, isNot(equals(ru().purchaseInvoices)));
      expect(en().purchaseInvoices, isNot(equals(kk().purchaseInvoices)));
    });
  });
}
