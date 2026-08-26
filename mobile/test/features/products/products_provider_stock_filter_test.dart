import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:stockflow/features/products/data/repositories/products_repository.dart';
import 'package:stockflow/features/products/domain/product_models.dart';
import 'package:stockflow/features/products/presentation/providers/products_provider.dart';

/// Deterministic in-memory repository: serves canned pages keyed by page
/// number and records how often the list endpoint was hit.
class _FakeProductsRepository extends ProductsRepository {
  _FakeProductsRepository(super.ref, this.pages);

  /// Raw API pages by page number; missing pages come back empty.
  final Map<int, ProductListResponse> pages;
  int listCalls = 0;

  @override
  Future<ProductsResult<ProductListResponse>> list({
    int page = 1,
    int limit = 20,
    String? search,
    String? category,
    String? sortBy,
    String? sortOrder,
  }) async {
    listCalls++;
    return ProductsSuccess(
      pages[page] ??
          ProductListResponse(
            items: const [],
            total: 0,
            page: page,
            limit: limit,
          ),
    );
  }
}

Product p(String name, int stock) => Product.fromJson({
      'id': 'id-$name',
      'companyId': 'c1',
      'name': name,
      'price': '10.0000',
      'stockQuantity': stock,
      'isActive': true,
      'createdAt': '2026-08-01T00:00:00.000Z',
      'updatedAt': '2026-08-01T00:00:00.000Z',
    });

ProductListResponse page(List<Product> items, int total) =>
    ProductListResponse(items: items, total: total, page: 1, limit: 20);

void main() {
  /// Pumps a container whose repository serves [pages] and returns
  /// (container, notifier).
  (ProviderContainer, ProductsListNotifier) harness(
    Map<int, ProductListResponse> pages,
  ) {
    final container = ProviderContainer(
      overrides: [
        productsRepositoryProvider
            .overrideWith((ref) => _FakeProductsRepository(ref, pages)),
      ],
    );
    final notifier = container.read(productsListProvider.notifier);
    return (container, notifier);
  }

  /// Flushes the notifier's async fetch chain.
  Future<void> settle() async {
    await Future<void>.delayed(Duration.zero);
    await Future<void>.delayed(Duration.zero);
  }

  group('ProductsListNotifier stock filters', () {
    test('low filter scans multiple raw pages and keeps only matches',
        () async {
      // Page 1: 2 low among normals; page 2 carries one more match.
      // Raw totals exceed one page so the scan must continue past page 1.
      final (container, notifier) = harness({
        1: page([
          p('Normal A', 50),
          p('Low Three', 3),
          p('Low Five', 5), // exactly at the threshold
          p('Normal B', 12),
        ], 25),
        2: page([
          p('Low Two', 2),
          p('Normal C', 9),
        ], 25),
      });
      addTearDown(container.dispose);

      notifier.applyStockFilter(ProductStockFilter.low);
      await settle();

      final state = container.read(productsListProvider) as ProductsLoaded;
      expect(state.stockFilter, ProductStockFilter.low);
      expect(
        state.products.map((e) => e.name),
        ['Low Three', 'Low Five', 'Low Two'], // order follows raw pages
      );
      expect(state.total, 3); // exact filtered count, not the raw total
      expect(state.hasMore, isFalse); // whole catalog already classified
      expect(state.page, 1);

      final repo = container.read(productsRepositoryProvider)
          as _FakeProductsRepository;
      expect(repo.listCalls, 2); // scanned both raw pages
    });

    test('out-of-stock filter keeps only zero-quantity products', () async {
      final (container, notifier) = harness({
        1: page([
          p('Positive', 7),
          p('Zero A', 0),
          p('Zero B', 0),
        ], 3),
      });
      addTearDown(container.dispose);

      notifier.applyStockFilter(ProductStockFilter.out);
      await settle();

      final state = container.read(productsListProvider) as ProductsLoaded;
      expect(state.stockFilter, ProductStockFilter.out);
      expect(state.products.map((e) => e.name), ['Zero A', 'Zero B']);
      expect(state.products.every((e) => e.stockQuantity == 0), isTrue);
      expect(state.total, 2);
      expect(state.hasMore, isFalse);
    });

    test('re-tapping the same deep-link filter does not refetch', () async {
      final (container, notifier) = harness({
        1: page([p('Low One', 1)], 1),
      });
      addTearDown(container.dispose);

      notifier.applyStockFilter(ProductStockFilter.low);
      await settle();
      final repo =
          container.read(productsRepositoryProvider) as _FakeProductsRepository;
      final callsAfterFirst = repo.listCalls;

      notifier.applyStockFilter(ProductStockFilter.low); // no-op
      await settle();

      expect(repo.listCalls, callsAfterFirst);
      expect(
        (container.read(productsListProvider) as ProductsLoaded)
            .products
            .single
            .name,
        'Low One',
      );
    });
    test('clearing the filter restores the ordinary paginated list',
        () async {
      final (container, notifier) = harness({
        1: page([
          p('Normal A', 50),
          p('Normal B', 30),
          p('Normal C', 7),
        ], 30),
      });
      addTearDown(container.dispose);

      // Chip behaviour: first tap selects the filter, second tap clears it.
      notifier.setStockFilter(ProductStockFilter.low);
      await settle();
      notifier.setStockFilter(ProductStockFilter.low);
      await settle();

      final state = container.read(productsListProvider) as ProductsLoaded;
      expect(state.stockFilter, isNull);
      expect(state.products.length, 3); // unfiltered page 1
      expect(state.total, 30); // raw server-side total back
      expect(state.hasMore, isTrue);
    });

    test('switching between filters refetches with the new rule', () async {
      final (container, notifier) = harness({
        1: page([
          p('Zero', 0),
          p('Low', 2),
          p('Healthy', 40),
        ], 3),
      });
      addTearDown(container.dispose);

      notifier.applyStockFilter(ProductStockFilter.low);
      await settle();
      expect(
        (container.read(productsListProvider) as ProductsLoaded)
            .products
            .map((e) => e.name),
        ['Low'],
      );

      notifier.applyStockFilter(ProductStockFilter.out);
      await settle();
      expect(
        (container.read(productsListProvider) as ProductsLoaded)
            .products
            .map((e) => e.name),
        ['Zero'],
      );
    });
  });
}
