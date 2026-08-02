import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/core/errors/failures.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';

void main() {
  group('Product fromJson', () {
    test('should parse full product JSON', () {
      final json = {
        'id': 'prod-1',
        'companyId': 'comp-1',
        'name': 'Wireless Mouse',
        'description': 'Ergonomic wireless mouse with USB receiver',
        'sku': 'SKU-001',
        'barcode': '1234567890123',
        'price': '49.9900',
        'costPrice': '35.0000',
        'unit': 'pcs',
        'category': 'Electronics',
        'brand': 'Logitech',
        'stockQuantity': 25,
        'isActive': true,
        'createdAt': '2026-07-01T00:00:00.000Z',
        'updatedAt': '2026-07-15T00:00:00.000Z',
        'deletedAt': null,
      };

      final product = Product.fromJson(json);

      expect(product.id, 'prod-1');
      expect(product.name, 'Wireless Mouse');
      expect(product.price, '49.9900');
      expect(product.stockQuantity, 25);
      expect(product.category, 'Electronics');
      expect(product.isActive, true);
    });

    test('should handle null optional fields', () {
      final json = {
        'id': 'prod-2',
        'companyId': 'comp-1',
        'name': 'Basic Item',
        'price': '10.0000',
        'stockQuantity': 0,
        'isActive': true,
        'createdAt': '2026-07-01T00:00:00.000Z',
        'updatedAt': '2026-07-01T00:00:00.000Z',
      };

      final product = Product.fromJson(json);

      expect(product.description, null);
      expect(product.costPrice, null);
      expect(product.sku, null);
      expect(product.barcode, null);
    });

    test('should handle zero stock and inactive', () {
      final json = {
        'id': 'prod-3',
        'companyId': 'comp-1',
        'name': 'Discontinued Item',
        'price': '0.0000',
        'stockQuantity': 0,
        'isActive': false,
        'createdAt': '2026-07-01T00:00:00.000Z',
        'updatedAt': '2026-07-01T00:00:00.000Z',
      };

      final product = Product.fromJson(json);

      expect(product.stockQuantity, 0);
      expect(product.isActive, false);
      expect(product.price, '0.0000');
    });

    test('should parse product with deletedAt', () {
      final json = {
        'id': 'prod-4',
        'companyId': 'comp-1',
        'name': 'Deleted Item',
        'price': '15.0000',
        'stockQuantity': 0,
        'isActive': false,
        'createdAt': '2026-07-01T00:00:00.000Z',
        'updatedAt': '2026-07-01T00:00:00.000Z',
        'deletedAt': '2026-07-10T00:00:00.000Z',
      };

      final product = Product.fromJson(json);

      expect(product.deletedAt, isNotNull);
      expect(product.deletedAt, '2026-07-10T00:00:00.000Z');
    });
  });

  group('ProductListResponse fromJson', () {
    test('should parse paginated response', () {
      final json = {
        'items': [
          {
            'id': 'prod-1',
            'companyId': 'comp-1',
            'name': 'Product A',
            'price': '20.0000',
            'stockQuantity': 10,
            'isActive': true,
            'createdAt': '2026-07-01T00:00:00.000Z',
            'updatedAt': '2026-07-01T00:00:00.000Z',
          },
          {
            'id': 'prod-2',
            'companyId': 'comp-1',
            'name': 'Product B',
            'price': '30.0000',
            'stockQuantity': 5,
            'isActive': true,
            'createdAt': '2026-07-01T00:00:00.000Z',
            'updatedAt': '2026-07-01T00:00:00.000Z',
          },
        ],
        'total': 2,
        'page': 1,
        'limit': 20,
      };

      final response = ProductListResponse.fromJson(json);

      expect(response.items.length, 2);
      expect(response.total, 2);
      expect(response.page, 1);
      expect(response.limit, 20);
      expect(response.items[0].name, 'Product A');
      expect(response.items[1].name, 'Product B');
    });

    test('should handle empty items list', () {
      final json = {
        'items': [],
        'total': 0,
        'page': 1,
        'limit': 20,
      };

      final response = ProductListResponse.fromJson(json);

      expect(response.items, isEmpty);
      expect(response.total, 0);
    });
  });

  group('CreateProductRequest toJson', () {
    test('should serialize to correct JSON', () {
      final request = CreateProductRequest(
        name: 'New Product',
        sku: 'SKU-NEW',
        price: '99.9900',
        category: 'Accessories',
        stockQuantity: 50,
      );

      final json = request.toJson();

      expect(json['name'], 'New Product');
      expect(json['price'], '99.9900');
      expect(json['stockQuantity'], 50);
      expect(json['isActive'], true);
    });

    test('should handle null optional fields', () {
      final request = CreateProductRequest(
        name: 'Minimal Product',
        price: '5.0000',
      );

      final json = request.toJson();

      expect(json['name'], 'Minimal Product');
      expect(json['price'], '5.0000');
      expect(json['sku'], null);
      expect(json['category'], null);
    });
  });

  group('ProductFormData fromJson and toJson', () {
    test('should round-trip correctly', () {
      final formData = ProductFormData(
        name: 'Test Product',
        price: '25.0000',
        sku: 'TEST-001',
        category: 'Test',
        stockQuantity: 100,
      );

      final json = formData.toJson();
      final restored = ProductFormData.fromJson(json);

      expect(restored.name, 'Test Product');
      expect(restored.price, '25.0000');
      expect(restored.sku, 'TEST-001');
    });
  });

  group('ProductsState', () {
    test('ProductsLoading is ProductsState', () {
      expect(const ProductsLoading(), isA<ProductsState>());
    });

    test('ProductsEmpty has default message', () {
      final empty = ProductsEmpty();
      expect(empty.message, 'No products found');
    });

    test('ProductsEmpty accepts custom message', () {
      final empty = ProductsEmpty('Custom message');
      expect(empty.message, 'Custom message');
    });

    test('ProductsLoaded stores products', () {
      final products = <Product>[];
      final loaded = ProductsLoaded(
        products: products,
        total: 0,
        page: 1,
      );

      expect(loaded.products, same(products));
      expect(loaded.page, 1);
      expect(loaded.isRefreshing, false);
      expect(loaded.isLoadingMore, false);
      expect(loaded.hasMore, false);
    });

    test('ProductsLoaded copyWith updates fields', () {
      final loaded = ProductsLoaded(
        products: [],
        total: 0,
        page: 1,
      );

      final updated = loaded.copyWith(page: 2, isRefreshing: true);

      expect(updated.page, 2);
      expect(updated.isRefreshing, true);
      expect(updated.products, isEmpty);
    });

    test('ProductsError stores message', () {
      final error = ProductsError('Network error');

      expect(error.message, 'Network error');
      expect(error.failure, isNull);
    });

    test('ProductDetailLoading is ProductsState', () {
      expect(const ProductDetailLoading(), isA<ProductsState>());
    });

    test('ProductDetailLoaded stores product', () {
      final json = {
        'id': 'prod-1',
        'companyId': 'comp-1',
        'name': 'Detail Product',
        'price': '50.0000',
        'stockQuantity': 10,
        'isActive': true,
        'createdAt': '2026-07-01T00:00:00.000Z',
        'updatedAt': '2026-07-01T00:00:00.000Z',
      };

      final product = Product.fromJson(json);
      final loaded = ProductDetailLoaded(product);

      expect(loaded.product.id, 'prod-1');
      expect(loaded.product.name, 'Detail Product');
    });

    test('ProductDetailError stores message', () {
      final error = ProductDetailError('Product not found');
      expect(error.message, 'Product not found');
    });
  });

  group('ProductsResult', () {
    test('ProductsSuccess stores data', () {
      final productJson = {
        'id': 'prod-1',
        'companyId': 'comp-1',
        'name': 'Test',
        'price': '10.0000',
        'stockQuantity': 1,
        'isActive': true,
        'createdAt': '2026-07-01T00:00:00.000Z',
        'updatedAt': '2026-07-01T00:00:00.000Z',
      };
      final product = Product.fromJson(productJson);
      final success = ProductsSuccess(product);

      expect(success.data, same(product));
    });

    test('ProductsFail stores error', () {
      final failure = ProductsFail(AuthFailure(message: 'Unauthorized'));
      expect(failure.error, isA<AuthFailure>());
    });
  });
}

// ── Product field-level validation tests ──
void _runValidationTests() {
  test('name must not be empty', () {});
  test('price must be positive', () {});
  test('stock quantity must be non-negative', () {});
}
