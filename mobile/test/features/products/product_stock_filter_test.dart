import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/products/domain/product_models.dart';

/// Builds a product with the given total (across warehouses) stock quantity
/// using the same minimal JSON shape the API returns.
Product product(int stockQuantity, {String name = 'Product'}) =>
    Product.fromJson({
      'id': 'p-$name-$stockQuantity',
      'companyId': 'comp-1',
      'name': '$name $stockQuantity',
      'price': '10.0000',
      'stockQuantity': stockQuantity,
      'isActive': true,
      'createdAt': '2026-08-01T00:00:00.000Z',
      'updatedAt': '2026-08-01T00:00:00.000Z',
    });

void main() {
  group('stock level classification (kLowStockThreshold)', () {
    test('threshold constant matches the app-wide reorder rule', () {
      // Mirrors backend /reports/dashboard counters and _StockCell colors.
      expect(kLowStockThreshold, 5);
    });

    test('zero stock → out of stock, NOT low stock', () {
      final p = product(0);
      expect(p.isOutOfStock, isTrue);
      expect(p.isLowStock, isFalse);
    });

    test('0 < q <= threshold → low stock, not out of stock', () {
      for (final q in [1, 2, 3, 4, kLowStockThreshold]) {
        final p = product(q);
        expect(p.isLowStock, isTrue, reason: 'qty=$q must be low stock');
        expect(p.isOutOfStock, isFalse, reason: 'qty=$q must not be out');
      }
    });

    test('strictly above threshold → healthy (neither low nor out)', () {
      for (final q in [kLowStockThreshold + 1, 6, 50]) {
        final p = product(q);
        expect(p.isLowStock, isFalse, reason: 'qty=$q must not be low stock');
        expect(p.isOutOfStock, isFalse, reason: 'qty=$q must not be out');
      }
    });

    test('boundary: exactly at threshold is still low stock', () {
      final p = product(kLowStockThreshold);
      expect(p.isLowStock, isTrue);
    });
  });

  group('ProductStockFilter', () {
    test('query parameter contract of the /products deep link', () {
      expect(ProductStockFilter.queryParameterKey, 'stock');
      expect(ProductStockFilter.low.queryParam, 'low');
      expect(ProductStockFilter.out.queryParam, 'out');
    });

    test('fromQueryParam parses both filters', () {
      expect(
        ProductStockFilter.fromQueryParam('low'),
        ProductStockFilter.low,
      );
      expect(
        ProductStockFilter.fromQueryParam('out'),
        ProductStockFilter.out,
      );
    });

    test('fromQueryParam degrades unknown/missing values to null', () {
      expect(ProductStockFilter.fromQueryParam(null), isNull);
      expect(ProductStockFilter.fromQueryParam(''), isNull);
      expect(ProductStockFilter.fromQueryParam('bogus'), isNull);
      expect(ProductStockFilter.fromQueryParam('LOW'), isNull); // case-sensitive
    });

    test('low filter matches only 0 < q <= threshold', () {
      const filter = ProductStockFilter.low;
      expect(filter.matches(product(0)), isFalse);
      expect(filter.matches(product(3)), isTrue);
      expect(filter.matches(product(kLowStockThreshold)), isTrue);
      expect(filter.matches(product(kLowStockThreshold + 1)), isFalse);
    });

    test('out filter matches only zero quantity', () {
      const filter = ProductStockFilter.out;
      expect(filter.matches(product(0)), isTrue);
      expect(filter.matches(product(1)), isFalse);
      expect(filter.matches(product(100)), isFalse);
    });

    test('filters are disjoint (a product never matches both)', () {
      for (final q in [0, 1, 3, 5, 6, 50]) {
        final p = product(q);
        expect(
          ProductStockFilter.low.matches(p) &&
              ProductStockFilter.out.matches(p),
          isFalse,
          reason: 'qty=$q matched both filters',
        );
      }
    });
  });
}
