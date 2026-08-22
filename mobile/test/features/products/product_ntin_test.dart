import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/products/domain/product_models.dart';

/// NTIN feature tests — NTIN is an optional third identifier next to
/// SKU and barcode. Old API payloads without NTIN must keep parsing.
void main() {
  group('Product.fromJson — ntin', () => _runProductNtinTests());
  group(
    'CreateProductRequest.toJson — ntin',
    () => _runCreateRequestTests(),
  );
  group('ProductFormData — ntin', () => _runFormDataTests());
}

// ── Product model ──
void _runProductNtinTests() {
  test('parses product with ntin', () {
    final json = <String, dynamic>{
      'id': 'prod-1',
      'companyId': 'comp-1',
      'name': 'Молоко 1 л',
      'barcode': '4870001234567',
      'ntin': '123456789',
      'sku': 'MILK-001',
      'price': '450.0000',
      'stockQuantity': 25,
      'isActive': true,
      'createdAt': '2026-07-01T00:00:00.000Z',
      'updatedAt': '2026-07-01T00:00:00.000Z',
    };

    final product = Product.fromJson(json);

    expect(product.ntin, '123456789');
    // All three identifiers exist independently.
    expect(product.barcode, '4870001234567');
    expect(product.sku, 'MILK-001');
  });

  test('legacy payload WITHOUT ntin still parses (backward compatibility)', () {
    final json = <String, dynamic>{
      'id': 'prod-2',
      'companyId': 'comp-1',
      'name': 'Old Product',
      'sku': 'OLD-1',
      'barcode': '2000000000017',
      'price': '10.0000',
      'stockQuantity': 3,
      'isActive': true,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
    };

    final product = Product.fromJson(json);

    expect(product.ntin, isNull);
    expect(product.sku, 'OLD-1');
    expect(product.barcode, '2000000000017');
  });

  test('null ntin parses as null', () {
    final json = <String, dynamic>{
      'id': 'prod-3',
      'companyId': 'comp-1',
      'name': 'No Ntin',
      'ntin': null,
      'price': '5.0000',
      'stockQuantity': 0,
      'isActive': true,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
    };

    expect(Product.fromJson(json).ntin, isNull);
  });

  test('copyWith can set and clear ntin', () {
    final base = Product.fromJson(<String, dynamic>{
      'id': 'prod-4',
      'companyId': 'comp-1',
      'name': 'Copy Target',
      'ntin': '123456789',
      'price': '1.0000',
      'stockQuantity': 1,
      'isActive': true,
      'createdAt': '2026-01-01T00:00:00.000Z',
      'updatedAt': '2026-01-01T00:00:00.000Z',
    });

    final changed = base.copyWith(ntin: '987654321');
    expect(changed.ntin, '987654321');

    final cleared = base.copyWith(ntin: null);
    expect(cleared.ntin, isNull);
  });
}

// ── CreateProductRequest serialization ──
void _runCreateRequestTests() {
  test('toJson includes ntin when provided (alongside sku and barcode)', () {
    const request = CreateProductRequest(
      name: 'Молоко 1 л',
      barcode: '4870001234567',
      ntin: '123456789',
      sku: 'MILK-001',
      price: '450',
    );

    final json = request.toJson();

    expect(json['ntin'], '123456789');
    expect(json['barcode'], '4870001234567');
    expect(json['sku'], 'MILK-001');
  });

  test('toJson serializes ntin as null when not provided', () {
    const request = CreateProductRequest(name: 'Simple', price: '10');

    final json = request.toJson();

    // Same behaviour as sku/barcode: optional fields are serialized as null.
    expect(json['ntin'], isNull);
    expect(json['sku'], isNull);
    expect(json['barcode'], isNull);
  });

  test('round-trip fromJson(toJson) preserves ntin', () {
    const request = CreateProductRequest(
      name: 'Round Trip',
      ntin: '123456789',
      price: '99',
    );

    final restored = CreateProductRequest.fromJson(request.toJson());

    expect(restored.ntin, '123456789');
  });
}

// ── ProductFormData ──
void _runFormDataTests() {
  test('holds optional ntin', () {
    const withNtin = ProductFormData(
      name: 'Form Product',
      price: '10',
      ntin: '123456789',
    );
    const withoutNtin = ProductFormData(name: 'Form Product', price: '10');

    expect(withNtin.ntin, '123456789');
    expect(withoutNtin.ntin, isNull);

    final updated = withoutNtin.copyWith(ntin: '555');
    expect(updated.ntin, '555');
  });
}
