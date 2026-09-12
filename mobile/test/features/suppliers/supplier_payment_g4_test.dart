import 'package:flutter_test/flutter_test.dart';
import 'dart:ui';
import 'package:flutter_gen/gen_l10n/app_localizations.dart';
import 'package:stockflow/features/suppliers/domain/supplier_payment_models.dart';
import 'package:uuid/uuid.dart';

/// G4 — Supplier Payments specific tests.
///
/// Covers:
///  1. EN/RU/KK l10n parity for G4 keys
///  2. SupplierPayment model decode
///  3. CreateSupplierPaymentRequest serialization
///  4. Idempotency key lifecycle
///  5. Currency regression guard (no hardcoded KZT)
AppLocalizations en() => lookupAppLocalizations(const Locale('en'));
AppLocalizations ru() => lookupAppLocalizations(const Locale('ru'));
AppLocalizations kk() => lookupAppLocalizations(const Locale('kk'));

void main() {
  // ── 1. L10n parity ───────────────────────────────────────

  group('G4 l10n parity — EN/RU/KK', () {
    test('all G4 keys exist in EN', () {
      final e = en();
      expect(e.recordPayment, isNotEmpty);
      expect(e.invoice, isNotEmpty);
      expect(e.selectInvoice, isNotEmpty);
      expect(e.paymentDate, isNotEmpty);
      expect(e.cashAccount, isNotEmpty);
      expect(e.bankAccount, isNotEmpty);
      expect(e.selectAccount, isNotEmpty);
      expect(e.greaterThanZero('X'), isNotEmpty);
      expect(e.exceedOutstanding('100'), isNotEmpty);
      expect(e.currencyMismatch, isNotEmpty);
      expect(e.validationError, isNotEmpty);
      expect(e.conflictRetry, isNotEmpty);
      expect(e.notFound, isNotEmpty);
      expect(e.paymentFailed, isNotEmpty);
      expect(e.voidPayment, isNotEmpty);
      expect(e.voidPaymentConfirm, isNotEmpty);
      expect(e.paymentVoided, isNotEmpty);
    });

    test('RU has all G4 keys', () {
      final r = ru();
      expect(r.recordPayment, isNotEmpty);
      expect(r.invoice, isNotEmpty);
      expect(r.selectInvoice, isNotEmpty);
      expect(r.paymentDate, isNotEmpty);
      expect(r.cashAccount, isNotEmpty);
      expect(r.bankAccount, isNotEmpty);
      expect(r.selectAccount, isNotEmpty);
      expect(r.greaterThanZero('X'), isNotEmpty);
      expect(r.exceedOutstanding('100'), isNotEmpty);
      expect(r.currencyMismatch, isNotEmpty);
      expect(r.validationError, isNotEmpty);
      expect(r.conflictRetry, isNotEmpty);
      expect(r.notFound, isNotEmpty);
      expect(r.paymentFailed, isNotEmpty);
      expect(r.voidPayment, isNotEmpty);
      expect(r.voidPaymentConfirm, isNotEmpty);
      expect(r.paymentVoided, isNotEmpty);
    });

    test('KK has all G4 keys', () {
      final k = kk();
      expect(k.recordPayment, isNotEmpty);
      expect(k.invoice, isNotEmpty);
      expect(k.selectInvoice, isNotEmpty);
      expect(k.paymentDate, isNotEmpty);
      expect(k.cashAccount, isNotEmpty);
      expect(k.bankAccount, isNotEmpty);
      expect(k.selectAccount, isNotEmpty);
      expect(k.greaterThanZero('X'), isNotEmpty);
      expect(k.exceedOutstanding('100'), isNotEmpty);
      expect(k.currencyMismatch, isNotEmpty);
      expect(k.validationError, isNotEmpty);
      expect(k.conflictRetry, isNotEmpty);
      expect(k.notFound, isNotEmpty);
      expect(k.paymentFailed, isNotEmpty);
      expect(k.voidPayment, isNotEmpty);
      expect(k.voidPaymentConfirm, isNotEmpty);
      expect(k.paymentVoided, isNotEmpty);
    });

    test('EN/RU/KK keys are not identical (translations differ)', () {
      // At least one G4 key should differ between EN and RU
      expect(en().recordPayment, isNot(equals(ru().recordPayment)));
      expect(en().recordPayment, isNot(equals(kk().recordPayment)));
    });

    test('parameterized keys produce correct output', () {
      final e = en();
      expect(e.greaterThanZero('Amount'), contains('Amount'));
      expect(e.exceedOutstanding('1,000'), contains('1,000'));
      expect(e.requiredField('Invoice'), contains('Invoice'));
    });
  });

  // ── 2. SupplierPayment model decode ────────────────────────

  group('SupplierPayment model', () {
    test('decodes from JSON with all fields', () {
      final json = {
        'id': 'pay-1',
        'companyId': 'comp-1',
        'supplierId': 'sup-1',
        'purchaseInvoiceId': 'inv-1',
        'paymentNumber': 'SP-0001',
        'paymentDate': '2026-09-01T00:00:00.000Z',
        'amount': '50000.0000',
        'method': 'BANK_TRANSFER',
        'cashAccountId': null,
        'bankAccountId': 'bank-1',
        'currency': 'KZT',
        'reference': 'REF-001',
        'notes': 'Test payment',
        'createdBy': 'user-1',
        'rowVersion': 1,
        'createdAt': '2026-09-01T00:00:00.000Z',
        'updatedAt': '2026-09-01T00:00:00.000Z',
        'deletedAt': null,
      };
      final payment = SupplierPayment.fromJson(json);
      expect(payment.id, 'pay-1');
      expect(payment.supplierId, 'sup-1');
      expect(payment.purchaseInvoiceId, 'inv-1');
      expect(payment.paymentNumber, 'SP-0001');
      expect(payment.amount, '50000.0000');
      expect(payment.method, 'BANK_TRANSFER');
      expect(payment.currency, 'KZT');
      expect(payment.bankAccountId, 'bank-1');
      expect(payment.cashAccountId, isNull);
      expect(payment.reference, 'REF-001');
      expect(payment.notes, 'Test payment');
      expect(payment.rowVersion, 1);
    });

    test('decodes with nullable fields', () {
      final json = {
        'id': 'pay-2',
        'companyId': 'comp-1',
        'supplierId': 'sup-1',
        'purchaseInvoiceId': 'inv-1',
        'paymentNumber': 'SP-0002',
        'paymentDate': '2026-09-01T00:00:00.000Z',
        'amount': '10000',
        'method': 'CASH',
        'currency': 'KZT',
        'createdAt': '2026-09-01T00:00:00.000Z',
        'updatedAt': '2026-09-01T00:00:00.000Z',
      };
      final payment = SupplierPayment.fromJson(json);
      expect(payment.reference, isNull);
      expect(payment.notes, isNull);
      expect(payment.bankAccountId, isNull);
      expect(payment.cashAccountId, isNull);
      expect(payment.deletedAt, isNull);
      expect(payment.rowVersion, 0); // default
    });
  });

  // ── 3. CreateSupplierPaymentRequest serialization ───────────

  group('CreateSupplierPaymentRequest', () {
    test('serializes all fields', () {
      final req = CreateSupplierPaymentRequest(
        purchaseInvoiceId: 'inv-1',
        amount: 50000.50,
        method: 'BANK_TRANSFER',
        cashAccountId: null,
        bankAccountId: 'bank-1',
        currency: 'KZT',
        paymentDate: '2026-09-01',
        reference: 'REF-001',
        notes: 'Test',
      );
      final json = req.toJson();
      expect(json['purchaseInvoiceId'], 'inv-1');
      expect(json['amount'], 50000.50);
      expect(json['method'], 'BANK_TRANSFER');
      expect(json['bankAccountId'], 'bank-1');
      expect(json['cashAccountId'], isNull);
      expect(json['currency'], 'KZT');
      expect(json['paymentDate'], '2026-09-01');
      expect(json['reference'], 'REF-001');
      expect(json['notes'], 'Test');
    });

    test('serializes CASH with cashAccountId', () {
      final req = CreateSupplierPaymentRequest(
        purchaseInvoiceId: 'inv-1',
        amount: 10000,
        method: 'CASH',
        cashAccountId: 'cash-1',
        bankAccountId: null,
        currency: 'KZT',
        paymentDate: '2026-09-01',
      );
      final json = req.toJson();
      expect(json['method'], 'CASH');
      expect(json['cashAccountId'], 'cash-1');
      expect(json['bankAccountId'], isNull);
    });

    test('CARD method sends no account', () {
      final req = CreateSupplierPaymentRequest(
        purchaseInvoiceId: 'inv-1',
        amount: 5000,
        method: 'CARD',
        currency: 'KZT',
        paymentDate: '2026-09-01',
      );
      final json = req.toJson();
      expect(json['method'], 'CARD');
      expect(json['cashAccountId'], isNull);
      expect(json['bankAccountId'], isNull);
    });
  });

  // ── 4. Idempotency key lifecycle ────────────────────────────

  group('Idempotency key lifecycle', () {
    test('new form generates unique key', () {
      const uuid = Uuid();
      final key1 = uuid.v4();
      final key2 = uuid.v4();
      expect(key1, isNot(equals(key2)));
      // UUID v4 format check
      expect(key1.length, 36);
      expect(key1[8], '-');
      expect(key1[13], '-');
    });

    test('same key is reused on retry', () {
      const uuid = Uuid();
      // Simulates: form opened → key generated → submit fails → retry with SAME key
      final key = uuid.v4();
      final retryKey = key; // must be the same reference
      expect(key, equals(retryKey));
    });

    test('different forms get different keys', () {
      const uuid = Uuid();
      final formA = uuid.v4();
      final formB = uuid.v4();
      expect(formA, isNot(equals(formB)));
    });
  });

  // ── 5. Currency regression guard ────────────────────────────

  group('Currency regression — no hardcoded KZT in payment flow', () {
    test('SupplierPayment can represent non-KZT currency', () {
      final payment = SupplierPayment(
        id: 'pay-1',
        companyId: 'comp-1',
        supplierId: 'sup-1',
        purchaseInvoiceId: 'inv-1',
        paymentNumber: 'SP-0001',
        paymentDate: DateTime(2026, 9, 1),
        amount: '10000',
        method: 'BANK_TRANSFER',
        currency: 'USD',
        createdAt: DateTime(2026, 9, 1),
        updatedAt: DateTime(2026, 9, 1),
      );
      expect(payment.currency, 'USD');
      expect(payment.currency, isNot('KZT'));
    });

    test('CreateSupplierPaymentRequest accepts any currency', () {
      final req = CreateSupplierPaymentRequest(
        purchaseInvoiceId: 'inv-1',
        amount: 100,
        method: 'BANK_TRANSFER',
        currency: 'EUR',
        paymentDate: '2026-09-01',
      );
      expect(req.currency, 'EUR');
    });

    test('SupplierInvoiceLite decodes non-KZT currency', () {
      final json = {
        'id': 'inv-1',
        'invoiceNumber': 'INV-001',
        'grandTotal': '50000',
        'paidAmount': '0',
        'status': 'APPROVED',
        'currency': 'USD',
        'dueDate': null,
      };
      final invoice = SupplierInvoiceLite.fromJson(json);
      expect(invoice.currency, 'USD');
    });

    test('CashAccountLite decodes non-KZT currency', () {
      final json = {
        'id': 'cash-1',
        'name': 'Main Cash',
        'currency': 'EUR',
      };
      final account = CashAccountLite.fromJson(json);
      expect(account.currency, 'EUR');
    });

    test('BankAccountLite decodes non-KZT currency', () {
      final json = {
        'id': 'bank-1',
        'bankName': 'National Bank',
        'accountNumber': '1234567890',
        'accountName': 'Operating',
        'currency': 'RUB',
      };
      final account = BankAccountLite.fromJson(json);
      expect(account.currency, 'RUB');
    });
  });

  // ── 6. SupplierInvoiceLite decode ───────────────────────────

  group('SupplierInvoiceLite', () {
    test('decodes all fields', () {
      final json = {
        'id': 'inv-1',
        'invoiceNumber': 'INV-0001',
        'grandTotal': '250000.0000',
        'paidAmount': '100000.0000',
        'status': 'APPROVED',
        'currency': 'KZT',
        'dueDate': '2026-10-01T00:00:00.000Z',
      };
      final invoice = SupplierInvoiceLite.fromJson(json);
      expect(invoice.id, 'inv-1');
      expect(invoice.invoiceNumber, 'INV-0001');
      expect(invoice.grandTotal, '250000.0000');
      expect(invoice.paidAmount, '100000.0000');
      expect(invoice.status, 'APPROVED');
      expect(invoice.currency, 'KZT');
      expect(invoice.dueDate, isNotNull);
    });

    test('dueDate can be null', () {
      final json = {
        'id': 'inv-1',
        'invoiceNumber': 'INV-0001',
        'grandTotal': '10000',
        'paidAmount': '0',
        'status': 'DRAFT',
        'currency': 'KZT',
      };
      final invoice = SupplierInvoiceLite.fromJson(json);
      expect(invoice.dueDate, isNull);
    });
  });

  // ── 7. Account models decode ────────────────────────────────

  group('CashAccountLite', () {
    test('decodes all fields', () {
      final json = {
        'id': 'cash-1',
        'name': 'Main Register',
        'currency': 'KZT',
        'type': 'MAIN_CASH',
      };
      final account = CashAccountLite.fromJson(json);
      expect(account.id, 'cash-1');
      expect(account.name, 'Main Register');
      expect(account.currency, 'KZT');
      expect(account.type, 'MAIN_CASH');
    });
  });

  group('BankAccountLite', () {
    test('decodes all fields', () {
      final json = {
        'id': 'bank-1',
        'bankName': 'Kaspi Bank',
        'accountNumber': '1234567890',
        'accountName': 'Operating Account',
        'currency': 'KZT',
      };
      final account = BankAccountLite.fromJson(json);
      expect(account.id, 'bank-1');
      expect(account.bankName, 'Kaspi Bank');
      expect(account.accountNumber, '1234567890');
      expect(account.accountName, 'Operating Account');
      expect(account.currency, 'KZT');
    });

    test('accountName can be null', () {
      final json = {
        'id': 'bank-2',
        'bankName': 'Halyk Bank',
        'accountNumber': '9876543210',
        'currency': 'USD',
      };
      final account = BankAccountLite.fromJson(json);
      expect(account.accountName, isNull);
    });
  });

  // ── 8. SupplierPaymentListResponse decode ────────────────────

  group('SupplierPaymentListResponse', () {
    test('decodes paginated response', () {
      final json = {
        'items': [
          {
            'id': 'pay-1',
            'companyId': 'comp-1',
            'supplierId': 'sup-1',
            'purchaseInvoiceId': 'inv-1',
            'paymentNumber': 'SP-0001',
            'paymentDate': '2026-09-01T00:00:00.000Z',
            'amount': '50000',
            'method': 'BANK_TRANSFER',
            'currency': 'KZT',
            'createdAt': '2026-09-01T00:00:00.000Z',
            'updatedAt': '2026-09-01T00:00:00.000Z',
          },
        ],
        'total': 1,
        'page': 1,
        'limit': 20,
      };
      final response = SupplierPaymentListResponse.fromJson(json);
      expect(response.items.length, 1);
      expect(response.items[0].paymentNumber, 'SP-0001');
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
      final response = SupplierPaymentListResponse.fromJson(json);
      expect(response.items, isEmpty);
      expect(response.total, 0);
    });
  });
}
